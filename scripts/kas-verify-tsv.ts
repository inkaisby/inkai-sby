/**
 * Verifikasi saldo TSV + diff vs DB produksi (fuzzy match).
 *
 * Usage:
 *   npx tsx scripts/kas-verify-tsv.ts --in=data/kas/cabang-sby-clean.tsv
 *   npx tsx scripts/kas-verify-tsv.ts --in=data/kas/cabang-sby-clean.tsv --diff-db --allow-remote
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import {
  filterRange,
  kasKpis,
  parseKasImportTsv,
  sumBefore,
  withRunningSaldo,
  type KasImportDraft,
  type KasLedgerInput,
} from "../src/lib/kas";
import { SITE_BRANCH_NAME } from "../src/lib/site";
import { assertLocalDatabase } from "./assert-local-database";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const args = process.argv.slice(2);
const inArg = args.find((a) => a.startsWith("--in="))?.slice("--in=".length);
const from = args.find((a) => a.startsWith("--from="))?.slice("--from=".length) ?? "2026-01-27";
const to = args.find((a) => a.startsWith("--to="))?.slice("--to=".length) ?? "2026-07-25";
const target = Number(
  args.find((a) => a.startsWith("--target="))?.slice("--target=".length) ?? "7045700",
);
const diffDb = args.includes("--diff-db");
const allowRemote = args.includes("--allow-remote");

if (allowRemote) {
  config({ path: resolve(process.cwd(), ".env"), override: true });
}

if (!inArg) {
  console.error(
    "Usage: npx tsx scripts/kas-verify-tsv.ts --in=<clean.tsv> [--from=] [--to=] [--diff-db] [--allow-remote]",
  );
  process.exit(1);
}

function fuzzyDesc(s: string): string {
  return s
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9]/g, "");
}

function draftKey(d: KasImportDraft): string {
  const amt = d.direction === "in" ? `in:${d.amount}` : `out:${d.amount}`;
  return `${d.txnDate}|${fuzzyDesc(d.description)}|${amt}`;
}

function dbKey(row: {
  txnDate: Date;
  description: string;
  amountIn: number;
  amountOut: number;
}): string {
  const ymd = row.txnDate.toISOString().slice(0, 10);
  const amt =
    row.amountIn > 0 ? `in:${row.amountIn}` : row.amountOut > 0 ? `out:${row.amountOut}` : "zero";
  return `${ymd}|${fuzzyDesc(row.description)}|${amt}`;
}

const drafts = parseKasImportTsv(readFileSync(resolve(process.cwd(), inArg), "utf8"));
const all: KasLedgerInput[] = drafts.map((d, i) => ({
  id: String(i),
  txnDate: d.txnDate,
  description: d.description,
  kegiatan: d.kegiatan,
  amountIn: d.direction === "in" ? d.amount : 0,
  amountOut: d.direction === "out" ? d.amount : 0,
  createdAt: `${d.txnDate}T00:00:00.000Z`,
  sourceType: "manual",
  sourceId: String(i),
  reconStatus: "open",
}));

const opening = sumBefore(all, from);
const filtered = filterRange(all, from, to);
const rows = withRunningSaldo(filtered, opening);
const kpis = kasKpis(rows, opening);

const report: Record<string, unknown> = {
  file: inArg,
  period: { from, to },
  tsv: {
    rowCount: filtered.length,
    totalRows: all.length,
    opening,
    saldoAkhir: kpis.saldoAkhir,
    totalIn: kpis.totalIn,
    totalOut: kpis.totalOut,
  },
  targetSaldo: target,
  deltaTsvVsTarget: kpis.saldoAkhir - target,
};

async function runDiffDb() {
  if (!allowRemote) {
    try {
      assertLocalDatabase();
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  const prisma = new PrismaClient();
  try {
    const branch = await prisma.branch.findFirst({
      where: { name: SITE_BRANCH_NAME, isDeleted: false },
      select: { id: true },
    });
    if (!branch) throw new Error("Cabang tidak ditemukan");

    const manual = await prisma.kasEntry.findMany({
      where: {
        scopeType: "branch",
        scopeId: branch.id,
        sourceType: "manual",
        txnDate: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) },
      },
      select: {
        txnDate: true,
        description: true,
        amountIn: true,
        amountOut: true,
      },
    });

    const dbKeys = new Set(manual.map((r) => dbKey(r)));
    const periodDrafts = drafts.filter((d) => d.txnDate >= from && d.txnDate <= to);
    const missingInDb = periodDrafts.filter((d) => !dbKeys.has(draftKey(d)));
    const tsvKeys = new Set(periodDrafts.map((d) => draftKey(d)));
    const extraInDb = manual.filter((r) => !tsvKeys.has(dbKey(r)));

    const entries = await prisma.kasEntry.findMany({
      where: { scopeType: "branch", scopeId: branch.id },
      orderBy: [{ txnDate: "asc" }, { createdAt: "asc" }],
    });
    const dbAll: KasLedgerInput[] = entries.map((e) => ({
      id: e.id,
      txnDate: e.txnDate.toISOString().slice(0, 10),
      description: e.description,
      kegiatan: e.kegiatan,
      amountIn: e.amountIn,
      amountOut: e.amountOut,
      createdAt: e.createdAt.toISOString(),
      sourceType: e.sourceType,
      sourceId: e.id,
      reconStatus: "open",
    }));
    const dbOpening = sumBefore(dbAll, from);
    const dbFiltered = filterRange(dbAll, from, to);
    const dbKpis = kasKpis(withRunningSaldo(dbFiltered, dbOpening), dbOpening);

    report.db = {
      manualInPeriod: manual.length,
      saldoAkhir: dbKpis.saldoAkhir,
      opening: dbOpening,
      totalIn: dbKpis.totalIn,
      totalOut: dbKpis.totalOut,
      rowCount: dbFiltered.length,
    };
    report.diff = {
      missingInDbCount: missingInDb.length,
      extraInDbCount: extraInDb.length,
      missingSample: missingInDb.slice(0, 20).map((d) => ({
        txnDate: d.txnDate,
        description: d.description,
        direction: d.direction,
        amount: d.amount,
      })),
      extraSample: extraInDb.slice(0, 10).map((r) => ({
        txnDate: r.txnDate.toISOString().slice(0, 10),
        description: r.description,
        in: r.amountIn,
        out: r.amountOut,
      })),
      latberApr5InDb: manual.filter(
        (r) =>
          r.txnDate.toISOString().slice(0, 10) === "2026-04-05" &&
          r.amountIn > 0 &&
          fuzzyDesc(r.description).includes("anak"),
      ).length,
    };
    report.deltaDbVsTarget = dbKpis.saldoAkhir - target;
    report.matchTarget = Math.abs(dbKpis.saldoAkhir - target) <= 100_000;
  } finally {
    await prisma.$disconnect();
  }
}

if (diffDb) {
  runDiffDb()
    .then(() => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
} else {
  console.log(JSON.stringify({ ...report, matchTarget: Math.abs(kpis.saldoAkhir - target) <= 1000 }, null, 2));
}

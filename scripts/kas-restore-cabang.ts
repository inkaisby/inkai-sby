/**
 * Koreksi nominal + impor baris hilang dari TSV bersih (plan web3).
 *
 * Usage:
 *   npx tsx scripts/kas-restore-cabang.ts --in=data/kas/cabang-sby-clean.tsv --dry-run --allow-remote
 *   npx tsx scripts/kas-restore-cabang.ts --in=data/kas/cabang-sby-clean.tsv --apply --allow-remote
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";
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
import { postKasBatch } from "../src/lib/kas-store";
import { SITE_BRANCH_NAME } from "../src/lib/site";
import { assertLocalDatabase } from "./assert-local-database";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const args = process.argv.slice(2);
const argSet = new Set(args);
const dryRun = argSet.has("--dry-run") || !argSet.has("--apply");
const apply = argSet.has("--apply");
const allowRemote = argSet.has("--allow-remote");
const fixNominals = !argSet.has("--no-fix-nominals");
const importMissing = !argSet.has("--no-import-missing");
const inArg =
  args.find((a) => a.startsWith("--in="))?.slice("--in=".length) ??
  "data/kas/cabang-sby-clean.tsv";
const from = args.find((a) => a.startsWith("--from="))?.slice("--from=".length) ?? "2026-01-27";
const to = args.find((a) => a.startsWith("--to="))?.slice("--to=".length) ?? "2026-07-25";
const targetSaldo = Number(
  args.find((a) => a.startsWith("--target="))?.slice("--target=".length) ?? "7045700",
);

if (allowRemote) {
  config({ path: resolve(process.cwd(), ".env"), override: true });
}

if (!allowRemote) {
  try {
    assertLocalDatabase();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const prisma = new PrismaClient();

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Alphanumeric-only for tolerant match (portal vs PDF spacing). */
function fuzzyDesc(s: string): string {
  return s
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9]/g, "");
}

function entryKey(d: KasImportDraft, fuzzy = true): string {
  const amt = d.direction === "in" ? `in:${d.amount}` : `out:${d.amount}`;
  const desc = fuzzy ? fuzzyDesc(d.description) : norm(d.description);
  return `${d.txnDate}|${desc}|${amt}`;
}

function dbKey(
  row: {
    txnDate: Date;
    description: string;
    amountIn: number;
    amountOut: number;
  },
  fuzzy = true,
): string {
  const ymd = row.txnDate.toISOString().slice(0, 10);
  const amt =
    row.amountIn > 0 ? `in:${row.amountIn}` : row.amountOut > 0 ? `out:${row.amountOut}` : "zero";
  const desc = fuzzy ? fuzzyDesc(row.description) : norm(row.description);
  return `${ymd}|${desc}|${amt}`;
}

/** Koreksi nominal typo yang diketahui dari portal web3. */
const NOMINAL_FIXES: Array<{
  txnDate: string;
  descriptionMatch: RegExp;
  wrongAmount: number;
  correctAmount: number;
  direction: "in" | "out";
}> = [
  {
    txnDate: "2026-04-05",
    descriptionMatch: /kai-zen/i,
    wrongAmount: 175,
    correctAmount: 175_000,
    direction: "in",
  },
  {
    txnDate: "2026-04-05",
    descriptionMatch: /griya amerta/i,
    wrongAmount: 20_000,
    correctAmount: 200_000,
    direction: "in",
  },
];

async function verifySaldo(scopeId: string, periodFrom: string, periodTo: string) {
  const entries = await prisma.kasEntry.findMany({
    where: { scopeType: "branch", scopeId },
    orderBy: [{ txnDate: "asc" }, { createdAt: "asc" }],
  });
  const all: KasLedgerInput[] = entries.map((e) => ({
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
  const opening = sumBefore(all, periodFrom);
  const filtered = filterRange(all, periodFrom, periodTo);
  const rows = withRunningSaldo(filtered, opening);
  const kpis = kasKpis(rows, opening);
  return { opening, kpis, rowCount: filtered.length, totalEntries: entries.length };
}

async function main() {
  const branch = await prisma.branch.findFirst({
    where: { name: SITE_BRANCH_NAME, isDeleted: false },
    select: { id: true },
  });
  if (!branch) throw new Error(`Cabang ${SITE_BRANCH_NAME} tidak ditemukan`);

  const scopeId = branch.id;
  const scope = { type: "branch" as const, id: scopeId };
  const before = await verifySaldo(scopeId, from, to);

  const tsvPath = resolve(process.cwd(), inArg);
  const drafts = parseKasImportTsv(readFileSync(tsvPath, "utf8"));
  const periodDrafts = drafts.filter((d) => d.txnDate >= from && d.txnDate <= to);

  const manual = await prisma.kasEntry.findMany({
    where: { scopeType: "branch", scopeId, sourceType: "manual" },
    select: {
      id: true,
      txnDate: true,
      description: true,
      amountIn: true,
      amountOut: true,
      kegiatan: true,
    },
  });

  const existingKeys = new Set(manual.map((r) => dbKey(r, true)));
  const missing = importMissing
    ? periodDrafts.filter((d) => !existingKeys.has(entryKey(d, true)))
    : [];

  const nominalFixes: Array<{ id: string; description: string; from: number; to: number }> = [];
  if (fixNominals) {
    for (const fix of NOMINAL_FIXES) {
      for (const row of manual) {
        const ymd = row.txnDate.toISOString().slice(0, 10);
        if (ymd !== fix.txnDate) continue;
        if (!fix.descriptionMatch.test(row.description)) continue;
        const amt = fix.direction === "in" ? row.amountIn : row.amountOut;
        if (amt === fix.wrongAmount) {
          nominalFixes.push({
            id: row.id,
            description: row.description,
            from: amt,
            to: fix.correctAmount,
          });
        }
      }
    }
  }

  const report: Record<string, unknown> = {
    mode: apply ? "apply" : "dry-run",
    file: inArg,
    period: { from, to },
    targetSaldoAkhir: targetSaldo,
    before: {
      opening: before.opening,
      saldoAkhir: before.kpis.saldoAkhir,
      rowCount: before.rowCount,
      totalEntries: before.totalEntries,
    },
    nominalFixes: { count: nominalFixes.length, rows: nominalFixes },
    missingFromTsv: {
      count: missing.length,
      sample: missing.slice(0, 15).map((d) => ({
        txnDate: d.txnDate,
        description: d.description,
        direction: d.direction,
        amount: d.amount,
        kegiatan: d.kegiatan,
      })),
    },
  };

  if (apply) {
    for (const fix of nominalFixes) {
      await prisma.kasEntry.update({
        where: { id: fix.id },
        data:
          fix.to > fix.from
            ? { amountIn: fix.to, amountOut: 0 }
            : { amountOut: fix.to, amountIn: 0 },
      });
    }
    report.nominalFixed = nominalFixes.length;

    if (missing.length > 0) {
      const result = await postKasBatch(
        missing.map((e) => ({
          scope,
          txnDate: e.txnDate,
          description: e.description,
          kegiatan: e.kegiatan,
          direction: e.direction,
          amount: e.amount,
          sourceType: "manual" as const,
          sourceId: randomUUID(),
        })),
      );
      report.imported = result.created;
    }

    const after = await verifySaldo(scopeId, from, to);
    report.after = {
      opening: after.opening,
      saldoAkhir: after.kpis.saldoAkhir,
      rowCount: after.rowCount,
      totalEntries: after.totalEntries,
      deltaSaldo: after.kpis.saldoAkhir - before.kpis.saldoAkhir,
      matchTarget: Math.abs(after.kpis.saldoAkhir - targetSaldo) <= 100_000,
    };
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

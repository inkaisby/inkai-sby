/**
 * Verifikasi saldo kas cabang + hapus duplikat (rencana analisis PDF).
 *
 * Usage (lokal):
 *   npx tsx scripts/kas-reconcile-cabang.ts --dry-run
 *   npx tsx scripts/kas-reconcile-cabang.ts --apply
 *
 * Produksi:
 *   DATABASE_URL=... npx tsx scripts/kas-reconcile-cabang.ts --allow-remote --dry-run
 *   DATABASE_URL=... npx tsx scripts/kas-reconcile-cabang.ts --allow-remote --apply
 */
import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import {
  filterRange,
  kasKpis,
  sumBefore,
  withRunningSaldo,
  type KasLedgerInput,
} from "../src/lib/kas";
import { SITE_BRANCH_NAME } from "../src/lib/site";
import { assertLocalDatabase } from "./assert-local-database";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const args = process.argv.slice(2);
const argSet = new Set(args);
const dryRun = argSet.has("--dry-run") || !argSet.has("--apply");
const apply = argSet.has("--apply");
const allowRemote = argSet.has("--allow-remote");

if (allowRemote) {
  config({ path: resolve(process.cwd(), ".env"), override: true });
}
const from = args.find((a) => a.startsWith("--from="))?.slice("--from=".length) ?? "2026-01-27";
const to = args.find((a) => a.startsWith("--to="))?.slice("--to=".length) ?? "2026-07-25";
const targetSaldo = Number(
  args.find((a) => a.startsWith("--target="))?.slice("--target=".length) ?? "7045700",
);

if (!allowRemote) {
  try {
    assertLocalDatabase();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error("Untuk DB produksi, tambahkan --allow-remote.");
    process.exit(1);
  }
}

const prisma = new PrismaClient();

type EntryRow = {
  id: string;
  txnDate: Date;
  description: string;
  kegiatan: string;
  amountIn: number;
  amountOut: number;
  createdAt: Date;
  sourceType: string;
};

function toLedgerInput(row: EntryRow): KasLedgerInput {
  return {
    id: row.id,
    txnDate: row.txnDate.toISOString().slice(0, 10),
    description: row.description,
    kegiatan: row.kegiatan,
    amountIn: row.amountIn,
    amountOut: row.amountOut,
    createdAt: row.createdAt.toISOString(),
    sourceType: row.sourceType,
    sourceId: row.id,
    reconStatus: "open",
  };
}

async function resolveBranchScopeId(): Promise<string> {
  const branch = await prisma.branch.findFirst({
    where: { name: SITE_BRANCH_NAME, isDeleted: false },
    select: { id: true, name: true },
  });
  if (!branch) throw new Error(`Cabang ${SITE_BRANCH_NAME} tidak ditemukan`);
  return branch.id;
}

function verifySaldo(all: KasLedgerInput[], periodFrom: string, periodTo: string) {
  const opening = sumBefore(all, periodFrom);
  const filtered = filterRange(all, periodFrom, periodTo);
  const rows = withRunningSaldo(filtered, opening);
  const kpis = kasKpis(rows, opening);
  return { opening, kpis, rowCount: filtered.length };
}

/** Hapus duplikat: simpan createdAt paling awal per kunci. */
function pickDuplicateIdsToDelete(
  rows: EntryRow[],
  keyFn: (r: EntryRow) => string,
): string[] {
  const groups = new Map<string, EntryRow[]>();
  for (const row of rows) {
    const k = keyFn(row);
    const list = groups.get(k) ?? [];
    list.push(row);
    groups.set(k, list);
  }
  const ids: string[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (let i = 1; i < list.length; i += 1) {
      ids.push(list[i].id);
    }
  }
  return ids;
}

async function findDuplicateIds(scopeId: string): Promise<{
  ids: string[];
  breakdown: Record<string, number>;
}> {
  const manual = await prisma.kasEntry.findMany({
    where: { scopeType: "branch", scopeId, sourceType: "manual" },
    select: {
      id: true,
      txnDate: true,
      description: true,
      kegiatan: true,
      amountIn: true,
      amountOut: true,
      createdAt: true,
      sourceType: true,
    },
    orderBy: [{ txnDate: "asc" }, { createdAt: "asc" }],
  });

  const breakdown: Record<string, number> = {};

  const porprov = manual.filter(
    (r) =>
      r.txnDate.toISOString().slice(0, 10) === "2026-02-10" &&
      r.kegiatan.toLowerCase().includes("seleksi atlet porprov"),
  );
  const porprovIds = pickDuplicateIdsToDelete(
    porprov,
    (r) =>
      `${r.description.trim().toLowerCase()}|${r.amountIn}|${r.amountOut}`,
  );
  breakdown.porprov = porprovIds.length;

  const latber = manual.filter(
    (r) =>
      r.txnDate.toISOString().slice(0, 10) === "2026-04-05" &&
      r.kegiatan.toLowerCase().includes("pemasukkan latihan bersama") &&
      r.amountIn > 0,
  );
  const latberIds = pickDuplicateIdsToDelete(
    latber,
    (r) =>
      `${r.description.trim().toLowerCase()}|${r.amountIn}`,
  );
  breakdown.latber = latberIds.length;

  const andi = manual.filter(
    (r) =>
      r.txnDate.toISOString().slice(0, 10) === "2026-04-19" &&
      r.description.toUpperCase().includes("ANDI IRAWAN"),
  );
  const andiIds = pickDuplicateIdsToDelete(
    andi,
    (r) => `${r.description.trim().toUpperCase()}|${r.amountOut}`,
  );
  breakdown.andiIrawan = andiIds.length;

  const suhuliwan = manual.filter(
    (r) =>
      r.txnDate.toISOString().slice(0, 10) === "2026-02-10" &&
      r.description.toUpperCase().includes("SUHULIWAN"),
  );
  const suhuliwanIds = pickDuplicateIdsToDelete(
    suhuliwan,
    (r) => `${r.description.trim().toUpperCase()}|${r.amountOut}`,
  );
  breakdown.suhuliwan = suhuliwanIds.length;

  const ids = [...new Set([...porprovIds, ...latberIds, ...andiIds, ...suhuliwanIds])];
  return { ids, breakdown };
}

async function main() {
  const scopeId = await resolveBranchScopeId();

  const tableCheck = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'KasEntry'
    ) AS exists
  `;
  if (!tableCheck[0]?.exists) {
    console.error('Tabel "KasEntry" belum ada — jalankan db push dulu.');
    process.exit(1);
  }

  const entries = await prisma.kasEntry.findMany({
    where: { scopeType: "branch", scopeId },
    orderBy: [{ txnDate: "asc" }, { createdAt: "asc" }],
  });

  const all = entries.map((e) =>
    toLedgerInput({
      id: e.id,
      txnDate: e.txnDate,
      description: e.description,
      kegiatan: e.kegiatan,
      amountIn: e.amountIn,
      amountOut: e.amountOut,
      createdAt: e.createdAt,
      sourceType: e.sourceType,
    }),
  );

  const before = verifySaldo(all, from, to);
  const { ids, breakdown } = await findDuplicateIds(scopeId);

  const report: Record<string, unknown> = {
    mode: apply ? "apply" : "dry-run",
    scope: { type: "branch", id: scopeId, name: SITE_BRANCH_NAME },
    period: { from, to },
    targetSaldoAkhir: targetSaldo,
    before: {
      opening: before.opening,
      saldoAkhir: before.kpis.saldoAkhir,
      totalIn: before.kpis.totalIn,
      totalOut: before.kpis.totalOut,
      rowCount: before.rowCount,
      totalEntries: entries.length,
    },
    duplicates: { count: ids.length, breakdown, ids: dryRun ? ids : ids.length },
  };

  if (apply && ids.length > 0) {
    const deleted = await prisma.kasEntry.deleteMany({
      where: {
        id: { in: ids },
        scopeType: "branch",
        scopeId,
        sourceType: "manual",
      },
    });
    report.deleted = deleted.count;

    const afterEntries = await prisma.kasEntry.findMany({
      where: { scopeType: "branch", scopeId },
      orderBy: [{ txnDate: "asc" }, { createdAt: "asc" }],
    });
    const afterAll = afterEntries.map((e) =>
      toLedgerInput({
        id: e.id,
        txnDate: e.txnDate,
        description: e.description,
        kegiatan: e.kegiatan,
        amountIn: e.amountIn,
        amountOut: e.amountOut,
        createdAt: e.createdAt,
        sourceType: e.sourceType,
      }),
    );
    const after = verifySaldo(afterAll, from, to);
    report.after = {
      opening: after.opening,
      saldoAkhir: after.kpis.saldoAkhir,
      totalIn: after.kpis.totalIn,
      totalOut: after.kpis.totalOut,
      rowCount: after.rowCount,
      deltaSaldo: after.kpis.saldoAkhir - before.kpis.saldoAkhir,
      matchTarget: Math.abs(after.kpis.saldoAkhir - targetSaldo) <= 100000,
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

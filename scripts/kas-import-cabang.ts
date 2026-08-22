/**
 * Impor TSV kas cabang ke DB (postKasBatch manual).
 *
 * Usage:
 *   npx tsx scripts/kas-import-cabang.ts --in data/kas/cabang-sby-clean.tsv --dry-run
 *   npx tsx scripts/kas-import-cabang.ts --in data/kas/cabang-sby-clean.tsv --apply
 *
 * Produksi (hanya jika buku kosong atau --replace-confirmed):
 *   DATABASE_URL=... npx tsx scripts/kas-import-cabang.ts --allow-remote --in=... --dry-run
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { parseKasImportTsv, KAS_MAX_IMPORT } from "../src/lib/kas";
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
const replaceConfirmed = argSet.has("--replace-confirmed");
const inArg = args.find((a) => a.startsWith("--in="))?.slice("--in=".length);

if (allowRemote) {
  config({ path: resolve(process.cwd(), ".env"), override: true });
}

if (!inArg) {
  console.error(
    "Usage: npx tsx scripts/kas-import-cabang.ts --in=<clean.tsv> [--dry-run|--apply] [--allow-remote]",
  );
  process.exit(1);
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

async function main() {
  const branch = await prisma.branch.findFirst({
    where: { name: SITE_BRANCH_NAME, isDeleted: false },
    select: { id: true },
  });
  if (!branch) throw new Error(`Cabang ${SITE_BRANCH_NAME} tidak ditemukan`);

  const scope = { type: "branch" as const, id: branch.id };
  const text = readFileSync(resolve(process.cwd(), inArg), "utf8");
  const entries = parseKasImportTsv(text);

  if (entries.length === 0) {
    throw new Error("TSV kosong atau tidak valid");
  }
  if (entries.length > KAS_MAX_IMPORT) {
    throw new Error(`Maksimal ${KAS_MAX_IMPORT} baris per impor`);
  }

  const existing = await prisma.kasEntry.count({
    where: { scopeType: "branch", scopeId: branch.id, sourceType: "manual" },
  });

  const report: Record<string, unknown> = {
    mode: apply ? "apply" : "dry-run",
    file: inArg,
    parsedRows: entries.length,
    existingManualRows: existing,
  };

  if (existing > 0 && !replaceConfirmed) {
    report.skipped =
      "Buku sudah berisi manual rows — gunakan reconcile atau --replace-confirmed (hapus manual dulu manual).";
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (apply) {
    const result = await postKasBatch(
      entries.map((e) => ({
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
    report.created = result.created;
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

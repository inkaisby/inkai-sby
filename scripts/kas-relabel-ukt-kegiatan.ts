/**
 * Relabel kegiatan kas UKT pendaftaran II-2026 dan Latber persiapan UKT.
 *
 * Lokal:
 *   npx tsx scripts/kas-relabel-ukt-kegiatan.ts --dry-run
 *   npx tsx scripts/kas-relabel-ukt-kegiatan.ts --apply
 *
 * Produksi:
 *   DATABASE_URL=... npx tsx scripts/kas-relabel-ukt-kegiatan.ts --allow-remote --dry-run
 *   DATABASE_URL=... npx tsx scripts/kas-relabel-ukt-kegiatan.ts --allow-remote --apply
 */
import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { KAS_KEGIATAN_RELABELS } from "../src/lib/kas-kegiatan";
import { assertLocalDatabase } from "./assert-local-database";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const args = process.argv.slice(2);
const argSet = new Set(args);
const apply = argSet.has("--apply");
const allowRemote = argSet.has("--allow-remote");

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

async function main() {
  const report: Array<{
    from: string;
    to: string;
    matched: number;
    updated: number;
    sample: Array<{ id: string; description: string; txnDate: Date }>;
  }> = [];

  for (const { from, to } of KAS_KEGIATAN_RELABELS) {
    const rows = await prisma.kasEntry.findMany({
      where: { kegiatan: from },
      select: { id: true, description: true, txnDate: true },
      take: 8,
      orderBy: { txnDate: "asc" },
    });
    const matched = await prisma.kasEntry.count({ where: { kegiatan: from } });
    let updated = 0;
    if (apply && matched > 0) {
      const result = await prisma.kasEntry.updateMany({
        where: { kegiatan: from },
        data: { kegiatan: to },
      });
      updated = result.count;
    }
    report.push({ from, to, matched, updated, sample: rows });
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        report,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

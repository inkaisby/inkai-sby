/**
 * Bersihkan export Excel/CSV kas cabang → TSV siap Impor Kas.
 *
 * Usage:
 *   npx tsx scripts/kas-prepare-import-tsv.ts --in data/kas/cabang-sby-raw.tsv --out data/kas/cabang-sby-clean.tsv
 *   npx tsx scripts/kas-prepare-import-tsv.ts --in export.csv --out clean.tsv --stats
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { parseKasImportTsv } from "../src/lib/kas";
import {
  cleanupKasImportRows,
  kasImportDraftsToTsv,
  parseRawKasSpreadsheet,
  rawKasRowsToImportDrafts,
} from "../src/lib/kas-import-cleanup";

const args = process.argv.slice(2);
const inArg = args.find((a) => a.startsWith("--in="))?.slice("--in=".length);
const outArg = args.find((a) => a.startsWith("--out="))?.slice("--out=".length);
const stats = args.includes("--stats");

if (!inArg || !outArg) {
  console.error(
    "Usage: npx tsx scripts/kas-prepare-import-tsv.ts --in=<raw.tsv> --out=<clean.tsv> [--stats]",
  );
  process.exit(1);
}

const rawPath = resolve(process.cwd(), inArg);
const outPath = resolve(process.cwd(), outArg);
const rawText = readFileSync(rawPath, "utf8");

const parsed = parseRawKasSpreadsheet(rawText);
const cleaned = cleanupKasImportRows(parsed);
const drafts = rawKasRowsToImportDrafts(cleaned);
const tsv = kasImportDraftsToTsv(drafts);

writeFileSync(outPath, tsv, "utf8");

const roundTrip = parseKasImportTsv(tsv);
const report = {
  inputRows: parsed.length,
  afterCleanup: cleaned.length,
  importRows: drafts.length,
  roundTripRows: roundTrip.length,
  skipped: parsed.length - cleaned.length,
  outFile: outPath,
};

console.log(JSON.stringify(report, null, 2));

if (stats) {
  const masuk = drafts.filter((d) => d.direction === "in").reduce((s, d) => s + d.amount, 0);
  const keluar = drafts.filter((d) => d.direction === "out").reduce((s, d) => s + d.amount, 0);
  console.log(
    JSON.stringify(
      { totalMasuk: masuk, totalKeluar: keluar, net: masuk - keluar },
      null,
      2,
    ),
  );
}

if (roundTrip.length !== drafts.length) {
  console.error("Round-trip parse mismatch");
  process.exit(1);
}

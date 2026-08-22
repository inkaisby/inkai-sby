/**
 * Ekstrak teks PDF laporan kas cabang → TSV mentah.
 *
 * Usage:
 *   python -c "from pypdf import PdfReader; ..."  # atau simpan ke data/kas/laporan-kas-cabang.txt
 *   npx tsx scripts/kas-pdf-to-raw.ts --in data/kas/laporan-kas-cabang.txt --out data/kas/cabang-sby-raw.tsv
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { parseKasPdfText, pdfKasRowsToTsv } from "../src/lib/kas-pdf-parse";

const args = process.argv.slice(2);
const inArg = args.find((a) => a.startsWith("--in="))?.slice("--in=".length);
const outArg =
  args.find((a) => a.startsWith("--out="))?.slice("--out=".length) ??
  "data/kas/cabang-sby-raw.tsv";

if (!inArg) {
  console.error(
    "Usage: npx tsx scripts/kas-pdf-to-raw.ts --in=<laporan-kas-cabang.txt> [--out=...]",
  );
  process.exit(1);
}

const text = readFileSync(resolve(process.cwd(), inArg), "utf8");
const rows = parseKasPdfText(text);
const tsv = pdfKasRowsToTsv(rows);
const outPath = resolve(process.cwd(), outArg);
writeFileSync(outPath, tsv, "utf8");
console.log(JSON.stringify({ rows: rows.length, outFile: outPath }, null, 2));

/**
 * Konversi teks diekstrak cetak portal Kas → TSV mentah (tanggal ID + nominal Rp).
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { parseFlexibleIdDate } from "../src/lib/parse-birth-date";

const args = process.argv.slice(2);
const inArg = args.find((a) => a.startsWith("--in="))?.slice("--in=".length);
const outArg =
  args.find((a) => a.startsWith("--out="))?.slice("--out=".length) ??
  "data/kas/cabang-sby-raw.tsv";

if (!inArg) {
  console.error(
    "Usage: npx tsx scripts/kas-portal-export-to-raw.ts --in=<export.txt> [--out=...]",
  );
  process.exit(1);
}

function parseMoney(raw: string): number {
  const m = raw.match(/Rp\s?([\d.,-]+)/i);
  if (!m) return 0;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function parsePortalExport(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let buf = "";

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("INSTITUT") || t.startsWith("Cabang Surabaya"))
      continue;
    if (t.startsWith("Sekretariat:") || t.startsWith("LAPORAN")) continue;
    if (t.startsWith("Periode:")) continue;
    if (t.startsWith("No \t") || t.startsWith("No ")) continue;
    if (/^-- \d+ of \d+ --$/.test(t)) continue;

    if (/^\d+\s+(Minggu|Senin|Selasa|Rabu|Kamis|Jumat|Sabtu)/i.test(t)) {
      if (buf) chunks.push(buf.trim());
      buf = t;
    } else if (buf) {
      buf += ` ${t}`;
    }
  }
  if (buf) chunks.push(buf.trim());

  const out: string[] = [];
  for (const chunk of chunks) {
    const noMatch = chunk.match(/^(\d+)\s+/);
    if (!noMatch) continue;
    const no = noMatch[1];
    const rest = chunk.slice(noMatch[0].length);

    const dateMatch = rest.match(
      /^((?:Minggu|Senin|Selasa|Rabu|Kamis|Jumat|Sabtu),?\s+\d{1,2}\s+\w+(?:\s+\d{4})?)\s+/i,
    );
    if (!dateMatch) continue;

    let tanggalRaw = dateMatch[1];
    if (!/\d{4}/.test(tanggalRaw)) {
      const yearFollow = rest.match(
        new RegExp(`${dateMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d{4})`),
      );
      if (yearFollow) tanggalRaw = `${dateMatch[1]} ${yearFollow[1]}`;
    }

    const ymd = parseFlexibleIdDate(tanggalRaw);
    if (!ymd) continue;

    const afterDate = rest.slice(dateMatch[0].length);
    const moneyParts = [...afterDate.matchAll(/Rp\s?[\d.,-]+|—/gi)].map((m) => m[0]);
    if (moneyParts.length < 2) continue;

    const masukRaw = moneyParts[0];
    const keluarRaw = moneyParts[1];
    const idxKeluar = afterDate.indexOf(keluarRaw);
    const ketEnd = afterDate.indexOf(masukRaw);
    const keterangan = afterDate.slice(0, ketEnd).trim();

    let kegiatan = "";
    const afterKeluar = afterDate.slice(idxKeluar + keluarRaw.length).trim();
    const saldoMatch = afterKeluar.match(/^Rp\s?[\d.,-]+/i);
    if (saldoMatch) {
      kegiatan = afterKeluar.slice(saldoMatch[0].length).trim();
    } else if (afterKeluar.startsWith("-Rp")) {
      kegiatan = afterKeluar.replace(/^-Rp\s?[\d.,-]+/i, "").trim();
    } else {
      kegiatan = afterKeluar;
    }

    kegiatan = kegiatan.replace(/\s*2025\s*2026\s*$/, " 2025").trim();
    if (kegiatan.endsWith("2025") && !kegiatan.includes("KEJURPROV")) {
      kegiatan = kegiatan.replace(/\s2025$/, "").trim();
    }

    const masuk = masukRaw === "—" ? "" : String(parseMoney(masukRaw));
    const keluar = keluarRaw === "—" ? "" : String(parseMoney(keluarRaw));

    if (!keterangan) continue;
    out.push([no, ymd, keterangan, masuk, keluar, kegiatan].join("\t"));
  }

  return out;
}

const text = readFileSync(resolve(process.cwd(), inArg), "utf8");
const rows = parsePortalExport(text);
const outPath = resolve(process.cwd(), outArg);
writeFileSync(outPath, rows.join("\n"), "utf8");
console.log(JSON.stringify({ rows: rows.length, outFile: outPath }, null, 2));

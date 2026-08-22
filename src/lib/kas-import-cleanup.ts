import { parseFlexibleIdDate } from "@/lib/parse-birth-date";
import type { KasImportDraft } from "@/lib/kas";

/** Baris mentah dari export Excel/CSV cabang (kolom bebas urutan). */
export type RawKasSpreadsheetRow = {
  no?: string;
  txnDate: string;
  description: string;
  amountIn: number;
  amountOut: number;
  kegiatan: string;
};

const TOTAL_ROW_SKIP = [
  /^pemasukkan latihan bersama persiapan ukt$/i,
  /^pengeluaran latihan bersama persiapan ukt$/i,
];

function parseMoneyCell(raw: string | undefined): number {
  if (!raw?.trim()) return 0;
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function normalizeDateCell(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return parseFlexibleIdDate(trimmed) ?? "";
}

/** Parse baris TSV/CSV: No?, Tanggal, Keterangan, Masuk, Keluar, Kegiatan? */
export function parseRawKasSpreadsheet(text: string): RawKasSpreadsheetRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: RawKasSpreadsheetRow[] = [];

  for (const line of lines) {
    const delim = line.includes("\t") ? "\t" : ",";
    const parts = line.split(delim).map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 2) continue;

    const h0 = parts[0].toLowerCase();
    if (h0 === "no" || h0 === "tanggal" || h0 === "keterangan") continue;
    if (/^-- \d+ of \d+ --$/i.test(parts[0])) continue;

    let idx = 0;
    let no: string | undefined;
    if (/^\d+$/.test(parts[0]) && parts.length >= 4) {
      no = parts[0];
      idx = 1;
    }

    const dateRaw = parts[idx] ?? "";
    const desc = parts[idx + 1] ?? "";
    const inRaw = parts[idx + 2] ?? "";
    const outRaw = parts[idx + 3] ?? "";
    const kegiatan = parts[idx + 4] ?? parts[idx + 3] ?? "";

    if (!desc) continue;

    let txnDate = normalizeDateCell(dateRaw);
    let amountIn = parseMoneyCell(inRaw);
    let amountOut = parseMoneyCell(outRaw);
    let keg = kegiatan;

    if (!txnDate && parseFlexibleIdDate(desc)) {
      continue;
    }

    if (!amountIn && !amountOut && parseMoneyCell(kegiatan) > 0) {
      amountOut = parseMoneyCell(kegiatan);
      keg = "";
    }

    if (!txnDate) continue;

    out.push({
      no,
      txnDate,
      description: desc,
      amountIn,
      amountOut,
      kegiatan: keg.trim(),
    });
  }

  return out;
}

export function isKasNoiseRow(row: RawKasSpreadsheetRow): boolean {
  const d = row.description.trim();
  if (!d) return true;
  if (/^no\s*$/i.test(d)) return true;
  if (d.length < 3 && !row.amountIn && !row.amountOut) return true;
  return false;
}

/** Baris total grup Excel (hanya Masuk atau Keluar tanpa detail anak). */
export function isKasTotalGroupRow(row: RawKasSpreadsheetRow): boolean {
  const desc = row.description.trim();
  if (!desc) return true;
  if (/^total pemasukan ukt/i.test(desc)) return false;
  const hasIn = row.amountIn > 0;
  const hasOut = row.amountOut > 0;
  if (hasIn && hasOut) return false;
  if (!hasIn && !hasOut) return true;
  return TOTAL_ROW_SKIP.some((re) => re.test(desc));
}

/** Isi tanggal kosong dari baris grup di atas (fill-down). */
export function fillDownKasDates(rows: readonly RawKasSpreadsheetRow[]): RawKasSpreadsheetRow[] {
  let lastDate = "";
  return rows.map((row) => {
    if (row.txnDate) {
      lastDate = row.txnDate;
      return row;
    }
    if (!lastDate) return row;
    return { ...row, txnDate: lastDate };
  });
}

export function cleanupKasImportRows(
  rows: readonly RawKasSpreadsheetRow[],
): RawKasSpreadsheetRow[] {
  const filled = fillDownKasDates(rows);
  return filled.filter((row) => !isKasNoiseRow(row) && !isKasTotalGroupRow(row));
}

export function rawKasRowsToImportDrafts(
  rows: readonly RawKasSpreadsheetRow[],
): KasImportDraft[] {
  const out: KasImportDraft[] = [];
  for (const row of rows) {
    if (row.amountIn > 0 && row.amountOut > 0) continue;
    if (row.amountIn <= 0 && row.amountOut <= 0) continue;
    out.push({
      txnDate: row.txnDate,
      description: row.description.trim(),
      kegiatan: row.kegiatan.trim(),
      direction: row.amountIn > 0 ? "in" : "out",
      amount: row.amountIn > 0 ? row.amountIn : row.amountOut,
    });
  }
  return out;
}

export function kasImportDraftsToTsv(drafts: readonly KasImportDraft[]): string {
  const header = "tanggal\tketerangan\tmasuk\tkeluar\tkegiatan";
  const lines = drafts.map((d) => {
    const masuk = d.direction === "in" ? String(d.amount) : "";
    const keluar = d.direction === "out" ? String(d.amount) : "";
    return `${d.txnDate}\t${d.description}\t${masuk}\t${keluar}\t${d.kegiatan}`;
  });
  return [header, ...lines].join("\n");
}

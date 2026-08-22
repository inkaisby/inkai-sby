import { parseFlexibleIdDate } from "@/lib/parse-birth-date";

export type PdfKasRawRow = {
  no?: string;
  txnDate: string;
  description: string;
  amountIn: number;
  amountOut: number;
  kegiatan: string;
};

const DAY =
  /(?:Minggu|Senin|Selasa|Rabu|Kamis|Jumat|Sabtu),?\s+\d{1,2}\s+\w+(?:\s+\d{4})?/i;
const MONEY = /Rp\s?[\d.,]+/gi;
const SKIP_LINE =
  /^(?:LAPORAN KEUANGAN DETAIL|SALDO Rp|NO Tanggal|-- \d+ of \d+ --)$/i;
const NOISE_NAME = /^[A-Z][A-Z\s.'-]{2,}$/;

function parseMoney(raw: string): number {
  const m = raw.match(/Rp\s?([\d.,]+)/i);
  if (!m) return 0;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function extractDate(chunk: string): { dateRaw: string; rest: string } | null {
  const glued = chunk.match(
    /^(\d+)?\s*((?:Minggu|Senin|Selasa|Rabu|Kamis|Jumat|Sabtu),?\s*\d{1,2}\s+\w+(?:\s+\d{4})?)/i,
  );
  if (glued) {
    return { dateRaw: normalizeSpaces(glued[2]), rest: chunk.slice(glued[0].length) };
  }
  const m = chunk.match(DAY);
  if (!m) return null;
  return { dateRaw: normalizeSpaces(m[0]), rest: chunk.slice(m.index! + m[0].length) };
}

function mergePdfLines(lines: string[]): string[] {
  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    const t = normalizeSpaces(buf);
    if (t) chunks.push(t);
    buf = "";
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || SKIP_LINE.test(line) || NOISE_NAME.test(line)) continue;
    if (/^NO Tanggal/i.test(line)) continue;

    const startsRow = /^\d+\s*(?:$|\d+\.|(?:Minggu|Senin|Selasa|Rabu|Kamis|Jumat|Sabtu))/i.test(
      line,
    );

    if (startsRow && buf && /Rp/i.test(buf)) flush();

    if (/^\d+$/.test(line) && !buf) {
      buf = line;
      continue;
    }

    if (buf) buf += ` ${line}`;
    else buf = line;

    const rpCount = (buf.match(/Rp/gi) ?? []).length;
    if (rpCount >= 2 && !/^\d+$/.test(normalizeSpaces(buf))) flush();
  }
  flush();
  return chunks;
}

function isGroupHeaderOnly(description: string, txn: number, saldo: number, prevSaldo: number): boolean {
  if (txn > 0) return false;
  if (saldo === prevSaldo && saldo > 0) return true;
  if (/^(pemasukkan|pengeluaran)\s+latihan bersama/i.test(description)) return true;
  if (/^pembayaran\s+juara/i.test(description)) return true;
  if (/^pengeluaran pertandingan/i.test(description)) return true;
  if (/^bertugas pertandingan/i.test(description)) return true;
  if (/^tambahan pertandingan/i.test(description) && txn === 0) return true;
  if (/^biaya panitia/i.test(description)) return true;
  if (/^rapat pengurus/i.test(description) && txn === 0) return true;
  return false;
}

/** Parse teks diekstrak PDF laporan kas cabang → baris mentah TSV. */
export function parseKasPdfText(text: string): PdfKasRawRow[] {
  const lines = text.split(/\r?\n/);
  const chunks = mergePdfLines(lines);
  const out: PdfKasRawRow[] = [];
  let prevSaldo = 0;
  let lastDate = "";
  let lastKegiatan = "";

  for (const chunk of chunks) {
    const noMatch = chunk.match(/^(\d+)\s+/);
    const no = noMatch?.[1];
    const body = noMatch ? chunk.slice(noMatch[0].length) : chunk;

    const moneyMatches = [...body.matchAll(MONEY)].map((m) => m[0]);
    if (moneyMatches.length === 0) {
      const header = normalizeSpaces(body);
      if (header.length > 5 && !/^\d+\./.test(header)) {
        lastKegiatan = header;
      }
      continue;
    }

    const dateInfo = extractDate(body);
    let dateRaw = dateInfo?.dateRaw ?? "";
    let descBody = dateInfo?.rest ?? body;

    if (!dateRaw && lastDate) dateRaw = lastDate;
    const ymd = dateRaw ? parseFlexibleIdDate(dateRaw) : null;
    if (!ymd) continue;

    lastDate = ymd;

    const saldoRaw = moneyMatches[moneyMatches.length - 1];
    const saldo = parseMoney(saldoRaw);
    let txn = 0;
    if (moneyMatches.length >= 2) {
      txn = parseMoney(moneyMatches[moneyMatches.length - 2]);
    } else {
      txn = Math.abs(saldo - prevSaldo);
    }

    const saldoIdx = descBody.lastIndexOf(saldoRaw);
    let description = saldoIdx >= 0 ? descBody.slice(0, saldoIdx) : descBody;
    if (moneyMatches.length >= 2) {
      const txnRaw = moneyMatches[moneyMatches.length - 2];
      const txnIdx = description.lastIndexOf(txnRaw);
      if (txnIdx >= 0) description = description.slice(0, txnIdx);
    }
    description = normalizeSpaces(description);

    let kegiatan = "";
    const afterSaldo = descBody.slice(descBody.lastIndexOf(saldoRaw) + saldoRaw.length).trim();
    if (afterSaldo && !/^Rp/i.test(afterSaldo) && !/^[\d.,]+$/.test(afterSaldo)) {
      kegiatan = afterSaldo;
    }

    if (!kegiatan && lastKegiatan) kegiatan = lastKegiatan;
    if (kegiatan) lastKegiatan = kegiatan;

    const delta = saldo - prevSaldo;

    if (isGroupHeaderOnly(description, txn, saldo, prevSaldo)) {
      if (description.length > 5) lastKegiatan = description;
      prevSaldo = saldo;
      continue;
    }

    if (delta === 0 || !description) {
      prevSaldo = saldo;
      continue;
    }

    const amount = Math.abs(delta);

    out.push({
      no,
      txnDate: ymd,
      description,
      amountIn: delta > 0 ? amount : 0,
      amountOut: delta < 0 ? amount : 0,
      kegiatan: normalizeSpaces(kegiatan),
    });

    prevSaldo = saldo;
  }

  return out;
}

export function pdfKasRowsToTsv(rows: readonly PdfKasRawRow[]): string {
  return rows
    .map((r) =>
      [
        r.no ?? "",
        r.txnDate,
        r.description,
        r.amountIn > 0 ? String(r.amountIn) : "",
        r.amountOut > 0 ? String(r.amountOut) : "",
        r.kegiatan,
      ].join("\t"),
    )
    .join("\n");
}

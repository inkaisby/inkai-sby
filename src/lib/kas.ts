const WIB = "Asia/Jakarta";

export const KAS_MAX_BATCH = 50;
export const KAS_MAX_IMPORT = 500;
export const KAS_OPENING_KEGIATAN = "Saldo awal";

export type KasSourceType =
  | "manual"
  | "iuran"
  | "ukt"
  | "latber"
  | "kwitansi"
  | "void";

export type KasScope = {
  type: "branch" | "dojo";
  id: string;
};

export type KasDirection = "in" | "out";

export type KasLedgerInput = {
  id: string;
  txnDate: string;
  description: string;
  kegiatan: string;
  amountIn: number;
  amountOut: number;
  createdAt: string;
  sourceType: string;
  sourceId: string;
  sourceHref?: string | null;
  reconStatus: string;
};

export type KasLedgerRow = KasLedgerInput & {
  no: number;
  saldo: number;
};

export type KasGroupHeader = {
  kind: "group";
  kegiatan: string;
  totalIn: number;
  totalOut: number;
};

export type KasTableRow =
  | ({ kind: "entry" } & KasLedgerRow)
  | KasGroupHeader;

export function rupiahInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

export function ymdWib(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: WIB });
}

export function yearMonthFromYmd(ymd: string): string {
  return ymd.slice(0, 7);
}

export function yearMonthWib(date = new Date()): string {
  return yearMonthFromYmd(ymdWib(date));
}

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function formatKasDateId(ymd: string): string {
  const d = parseYmd(ymd);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function sortKasEntries<T extends { txnDate: string; createdAt: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const byDate = a.txnDate.localeCompare(b.txnDate);
    if (byDate !== 0) return byDate;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function withRunningSaldo(
  rows: KasLedgerInput[],
  opening = 0,
): KasLedgerRow[] {
  const sorted = sortKasEntries(rows);
  let saldo = opening;
  return sorted.map((row, i) => {
    saldo += row.amountIn - row.amountOut;
    return { ...row, no: i + 1, saldo };
  });
}

export function sumBefore(
  rows: KasLedgerInput[],
  ymdExclusive: string,
): number {
  return rows.reduce((acc, row) => {
    if (row.txnDate < ymdExclusive) {
      return acc + row.amountIn - row.amountOut;
    }
    return acc;
  }, 0);
}

export function monthBounds(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, "0");
  const from = `${year}-${mm}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${mm}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

export function filterMonth(
  rows: KasLedgerInput[],
  year: number | null,
  month: number | null,
): KasLedgerInput[] {
  if (!year || !month) return rows;
  const { from, to } = monthBounds(year, month);
  return rows.filter((r) => r.txnDate >= from && r.txnDate <= to);
}

export function groupKasTable(rows: KasLedgerRow[]): KasTableRow[] {
  const out: KasTableRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const kegiatan = rows[i].kegiatan.trim();
    if (!kegiatan) {
      out.push({ kind: "entry", ...rows[i] });
      i += 1;
      continue;
    }
    let j = i;
    let totalIn = 0;
    let totalOut = 0;
    while (j < rows.length && rows[j].kegiatan.trim() === kegiatan) {
      totalIn += rows[j].amountIn;
      totalOut += rows[j].amountOut;
      j += 1;
    }
    if (j - i >= 2) {
      out.push({ kind: "group", kegiatan, totalIn, totalOut });
    }
    for (let k = i; k < j; k += 1) {
      out.push({ kind: "entry", ...rows[k] });
    }
    i = j;
  }
  return out;
}

export function skipKwitansiJenis(jenis: string): boolean {
  const j = jenis.trim().toLowerCase();
  return j === "iuran" || j.startsWith("iuran");
}

export type KasImportDraft = {
  txnDate: string;
  description: string;
  kegiatan: string;
  direction: KasDirection;
  amount: number;
};

export function parseKasImportTsv(text: string): KasImportDraft[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: KasImportDraft[] = [];
  for (const line of lines) {
    const parts = line.split("\t").map((p) => p.trim());
    if (parts.length < 2) continue;
    const maybeHeader = parts[0].toLowerCase();
    if (maybeHeader === "tanggal" || maybeHeader === "keterangan") continue;
    let txnDate = ymdWib();
    let description = "";
    let amountIn = 0;
    let amountOut = 0;
    let kegiatan = "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(parts[0]) || parts[0].includes("/")) {
      txnDate = normalizeImportDate(parts[0]) ?? ymdWib();
      description = parts[1] ?? "";
      amountIn = parseMoney(parts[2]);
      amountOut = parseMoney(parts[3]);
      kegiatan = parts[4] ?? "";
    } else {
      description = parts[0] ?? "";
      amountIn = parseMoney(parts[1]);
      amountOut = parseMoney(parts[2]);
      kegiatan = parts[3] ?? "";
    }
    if (!description) continue;
    if (amountIn > 0 && amountOut > 0) continue;
    if (amountIn <= 0 && amountOut <= 0) continue;
    out.push({
      txnDate,
      description,
      kegiatan,
      direction: amountIn > 0 ? "in" : "out",
      amount: amountIn > 0 ? amountIn : amountOut,
    });
  }
  return out;
}

function parseMoney(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return rupiahInt(cleaned);
}

function normalizeImportDate(raw: string): string | null {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return null;
}

export function kasKpis(rows: KasLedgerRow[], opening: number) {
  const totalIn = rows.reduce((s, r) => s + r.amountIn, 0);
  const totalOut = rows.reduce((s, r) => s + r.amountOut, 0);
  const saldoAkhir =
    rows.length > 0 ? rows[rows.length - 1].saldo : opening;
  return { totalIn, totalOut, saldoAkhir, opening, unmatched: 0 };
}

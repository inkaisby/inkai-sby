import { parseFlexibleIdDate } from "@/lib/parse-birth-date";

const WIB = "Asia/Jakarta";

export const KAS_MAX_BATCH = 500;
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
  return filterRange(rows, from, to);
}

/** Inclusive YYYY-MM-DD range. Null/empty bound = unbounded on that side. */
export function filterRange(
  rows: KasLedgerInput[],
  from: string | null,
  to: string | null,
): KasLedgerInput[] {
  const start = from?.trim() || null;
  const end = to?.trim() || null;
  return rows.filter((r) => {
    if (start && r.txnDate < start) return false;
    if (end && r.txnDate > end) return false;
    return true;
  });
}

export function firstOfMonthWib(date = new Date()): string {
  return `${ymdWib(date).slice(0, 7)}-01`;
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

export function kasGroupKegiatanNames(groups: KasTableRow[]): string[] {
  return groups
    .filter((r): r is Extract<KasTableRow, { kind: "group" }> => r.kind === "group")
    .map((r) => r.kegiatan);
}

/** Hide grouped entries when collapsed. Standalone / empty-kegiatan rows stay visible. */
export function visibleKasTableRows(
  groups: KasTableRow[],
  collapsed: readonly string[],
): KasTableRow[] {
  const hide = new Set(collapsed);
  const out: KasTableRow[] = [];
  let skipKegiatan: string | null = null;
  for (const row of groups) {
    if (row.kind === "group") {
      skipKegiatan = hide.has(row.kegiatan) ? row.kegiatan : null;
      out.push(row);
      continue;
    }
    const k = row.kegiatan.trim();
    if (skipKegiatan && k === skipKegiatan) continue;
    skipKegiatan = null;
    out.push(row);
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

/** Paste Excel/TSV ke Tambah massal: 2 kolom (ket+nominal) pakai defaultDirection. */
export function parseKasMassPaste(
  text: string,
  opts?: { defaultDirection?: KasDirection; defaultTxnDate?: string },
): KasImportDraft[] {
  const defaultDirection = opts?.defaultDirection ?? "out";
  const defaultTxnDate = opts?.defaultTxnDate ?? ymdWib();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: KasImportDraft[] = [];

  for (const line of lines) {
    let parts = line.split("\t").map((p) => p.trim());
    if (parts.length === 1 && /\s{2,}|\s+Rp/i.test(line)) {
      parts = line.split(/\s{2,}|\t/).map((p) => p.trim()).filter(Boolean);
    }
    if (parts.length >= 2 && /^(?:\d+\.?|#)$/.test(parts[0])) {
      parts = parts.slice(1);
    }
    if (parts.length < 2) continue;
    const maybeHeader = parts[0].toLowerCase();
    if (
      maybeHeader === "tanggal" ||
      maybeHeader === "keterangan" ||
      maybeHeader === "uraian" ||
      maybeHeader === "item"
    ) {
      continue;
    }

    let txnDate = defaultTxnDate;
    let description = "";
    let amountIn = 0;
    let amountOut = 0;
    let kegiatan = "";

    const col0Date = normalizeImportDate(parts[0]);
    if (col0Date && parts.length >= 3) {
      txnDate = col0Date;
      description = parts[1] ?? "";
      amountIn = parseMoney(parts[2]);
      amountOut = parseMoney(parts[3]);
      kegiatan = parts[4] ?? "";
      if (!description) continue;
      if (amountIn > 0 && amountOut > 0) continue;
      if (amountIn <= 0 && amountOut <= 0) {
        const single = parseMoney(parts[2]);
        if (single <= 0) continue;
        out.push({
          txnDate,
          description,
          kegiatan,
          direction: defaultDirection,
          amount: single,
        });
        continue;
      }
      out.push({
        txnDate,
        description,
        kegiatan,
        direction: amountIn > 0 ? "in" : "out",
        amount: amountIn > 0 ? amountIn : amountOut,
      });
      continue;
    }

    description = parts[0] ?? "";
    if (parts.length >= 3 && parseMoney(parts[1]) > 0 && parseMoney(parts[2]) > 0) {
      continue;
    }
    if (parts.length >= 3 && (parseMoney(parts[1]) > 0 || parseMoney(parts[2]) > 0)) {
      amountIn = parseMoney(parts[1]);
      amountOut = parseMoney(parts[2]);
      kegiatan = parts[3] ?? "";
      if (!description) continue;
      if (amountIn <= 0 && amountOut <= 0) continue;
      out.push({
        txnDate: defaultTxnDate,
        description,
        kegiatan,
        direction: amountIn > 0 ? "in" : "out",
        amount: amountIn > 0 ? amountIn : amountOut,
      });
      continue;
    }

    const amount = parseMoney(parts[1]);
    if (!description || amount <= 0) continue;
    out.push({
      txnDate: defaultTxnDate,
      description,
      kegiatan: parts[2] ?? "",
      direction: defaultDirection,
      amount,
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
  const trimmed = raw.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return parseFlexibleIdDate(trimmed);
}

export type MassPasteRowLike = {
  txnDate: string;
  description: string;
  direction: "in" | "out";
  amount: string | number;
};

export function isMassRowFilled(row: MassPasteRowLike): boolean {
  return Boolean(row.description.trim()) || Number(row.amount) > 0;
}

export function mergeMassPasteRows<T extends MassPasteRowLike>(
  existing: readonly T[],
  incoming: readonly T[],
  max: number,
): { rows: T[]; added: number } | { error: "max" } {
  const kept = existing.filter(isMassRowFilled);
  const merged = [...kept, ...incoming];
  if (merged.length > max) return { error: "max" };
  return { rows: merged, added: incoming.length };
}

export function kasKpis(rows: KasLedgerRow[], opening: number) {
  const totalIn = rows.reduce((s, r) => s + r.amountIn, 0);
  const totalOut = rows.reduce((s, r) => s + r.amountOut, 0);
  const saldoAkhir =
    rows.length > 0 ? rows[rows.length - 1].saldo : opening;
  return { totalIn, totalOut, saldoAkhir, opening, unmatched: 0 };
}

export type DojoKasSummaryItemBreakdown = {
  label: string;
  amountIn: number;
  category: "ukt" | "latber" | "iuran" | "lainnya";
};

export type DojoKasSummary = {
  dojoName: string;
  isOfficialDojo: boolean;
  totalUkt: number;
  totalKomisiUkt: number;
  totalLatber: number;
  totalKomisiLatber: number;
  totalIuran: number;
  totalLainnya: number;
  totalMasuk: number;
  itemsBreakdown?: DojoKasSummaryItemBreakdown[];
};

const NON_DOJO_KEYWORDS_REGEX =
  /^(pendaftaran|konsumsi|rapat|disppora|setoran|kas|iuran|latber|ukt|komisi|pengeluaran|pembayaran|konsumsi rapat|operasional|rekening|bank|bunga|pajak|administrasi|biaya)$/i;

export function extractDojoNameFromKasRow(
  row: KasLedgerInput,
  dojoList?: Array<{ name: string } | string>,
): string | null {
  const kegiatan = (row.kegiatan || "").trim();
  const desc = (row.description || "").trim();
  const combined = (kegiatan + " " + desc).trim();

  // Extract list of official names if provided, sorted longest first for precise matching
  const officialNames = (dojoList || [])
    .map((d) => (typeof d === "string" ? d : d.name).trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  // 1. Direct match against official dojo list (case-insensitive boundary match)
  if (officialNames.length > 0) {
    for (const official of officialNames) {
      const core = official.replace(/^(Ranting|Dojo)\s+/i, "").trim();
      const targets = [official, core].filter(Boolean);

      for (const t of targets) {
        const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const reg = new RegExp(`(?:^|\\b|\\s|-|/)${escaped}(?:$|\\b|\\s|-|/)`, "i");
        if (reg.test(combined)) {
          return official;
        }
      }
    }
    // If an official list is provided, but no official dojo name matched in text, return null (fallback to TANPA RANTING)
    return null;
  }

  // 2. Check pattern 'Ranting <DojoName>' or 'Dojo <DojoName>'
  const matchRanting = combined.match(
    /(?:Ranting|Dojo)\s+([A-Za-z0-9_\-\s]+?)(?=\s*(?:—|-|\(|\)|$))/i,
  );
  if (matchRanting && matchRanting[1]) {
    const found = matchRanting[1].trim();
    if (
      found &&
      !/^(ranting|cabang|persiapan|ukt|latber|pendaftaran|umum)$/i.test(found)
    ) {
      return found;
    }
  }

  return null;
}

export function aggregateKasByDojo(
  rows: KasLedgerInput[],
  dojoList?: Array<{ name: string } | string>,
): DojoKasSummary[] {
  const map = new Map<string, DojoKasSummary>();

  for (const row of rows) {
    if (row.amountIn <= 0) continue;

    const rawDojo = extractDojoNameFromKasRow(row, dojoList);
    // Ignore entries that do not belong to an official Ranting/Dojo
    if (!rawDojo) continue;

    const dojoName = rawDojo.toUpperCase();
    const isOfficialDojo = true;

    let item = map.get(dojoName);
    if (!item) {
      item = {
        dojoName,
        isOfficialDojo,
        totalUkt: 0,
        totalKomisiUkt: 0,
        totalLatber: 0,
        totalKomisiLatber: 0,
        totalIuran: 0,
        totalLainnya: 0,
        totalMasuk: 0,
      };
      map.set(dojoName, item);
    }

    const src = (row.sourceType || "").toLowerCase();
    const keg = (row.kegiatan || "").toLowerCase();
    const desc = (row.description || "").toLowerCase();
    const isKomisi = desc.includes("komisi") || keg.includes("komisi");

    if (src === "latber" || keg.includes("latber") || desc.includes("latber")) {
      if (isKomisi) {
        item.totalKomisiLatber += row.amountIn;
      } else {
        item.totalLatber += row.amountIn;
      }
    } else if (src === "ukt" || keg.includes("ukt") || desc.includes("ukt")) {
      if (isKomisi) {
        item.totalKomisiUkt += row.amountIn;
      } else {
        item.totalUkt += row.amountIn;
      }
    } else if (
      src === "iuran" ||
      keg.includes("iuran") ||
      desc.includes("iuran")
    ) {
      item.totalIuran += row.amountIn;
    } else {
      item.totalLainnya += row.amountIn;
    }
    item.totalMasuk += row.amountIn;
  }

  return Array.from(map.values()).sort((a, b) => b.totalMasuk - a.totalMasuk);
}

export function formatRecapDojoTextForWa(
  dojoSummaries: DojoKasSummary[],
  periodCaption: string,
  formatRp: (n: number) => string,
): string {
  const official = dojoSummaries.filter((d) => d.isOfficialDojo);
  const grandTotal = dojoSummaries.reduce((s, d) => s + d.totalMasuk, 0);

  const lines: string[] = [
    `*REKAPITULASI SETORAN MASUK PER RANTING*`,
    `Periode: ${periodCaption}`,
    `Total ${official.length} Ranting Mengikuti`,
    `----------------------------------------`,
  ];

  let no = 1;
  for (const item of official) {
    lines.push(`${no++}. *${item.dojoName}*`);
    if (item.totalUkt > 0) lines.push(`   - UKT: ${formatRp(item.totalUkt)}`);
    if (item.totalKomisiUkt > 0)
      lines.push(`   - Komisi UKT: ${formatRp(item.totalKomisiUkt)}`);
    if (item.totalLatber > 0)
      lines.push(`   - Latber: ${formatRp(item.totalLatber)}`);
    if (item.totalKomisiLatber > 0)
      lines.push(`   - Komisi Latber: ${formatRp(item.totalKomisiLatber)}`);
    if (item.totalIuran > 0)
      lines.push(`   - Iuran: ${formatRp(item.totalIuran)}`);
    if (item.totalLainnya > 0)
      lines.push(`   - Lainnya: ${formatRp(item.totalLainnya)}`);
    lines.push(`   *Total: ${formatRp(item.totalMasuk)}*`);
  }

  lines.push(`----------------------------------------`);
  lines.push(`*TOTAL KESELURUHAN: ${formatRp(grandTotal)}*`);

  return lines.join("\n");
}




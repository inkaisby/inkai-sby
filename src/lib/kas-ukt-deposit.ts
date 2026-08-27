import {
  uktDepositStatusLabel,
  type UktDepositRecord,
  type UktDepositStatus,
  type UktSemester,
} from "@/lib/ukt";

export type KasDojoRef = { id?: string; name: string };

export function uktTermFromYmd(
  ymd: string,
): { semester: UktSemester; year: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(5, 7));
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { semester: month <= 6 ? "I" : "II", year };
}

function midpointYmd(from: string, to: string): string {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const t0 = Date.UTC(y1, m1 - 1, d1);
  const t1 = Date.UTC(y2, m2 - 1, d2);
  const mid = new Date((t0 + t1) / 2);
  const y = mid.getUTCFullYear();
  const m = String(mid.getUTCMonth() + 1).padStart(2, "0");
  const d = String(mid.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function resolveUktTermFromDateRange(
  from: string,
  to: string,
): {
  term: { semester: UktSemester; year: number } | null;
  ambiguous: boolean;
} {
  const start = uktTermFromYmd(from);
  const end = uktTermFromYmd(to || from);
  if (!start && !end) return { term: null, ambiguous: false };
  const a = start ?? end!;
  const b = end ?? start!;
  const ambiguous = a.semester !== b.semester || a.year !== b.year;
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const mid = uktTermFromYmd(midpointYmd(from, to));
    return { term: mid ?? a, ambiguous };
  }
  return { term: a, ambiguous };
}

export function normalizeKasDojoKey(name: string): string {
  return name
    .replace(/^(ranting|dojo)\s+/i, "")
    .trim()
    .toUpperCase();
}

export function matchKasDojoId(
  dojoName: string,
  dojos: Array<{ id: string; name: string }>,
): string | null {
  const key = normalizeKasDojoKey(dojoName);
  if (!key) return null;
  for (const d of dojos) {
    if (normalizeKasDojoKey(d.name) === key) return d.id;
  }
  return null;
}

export function kasUktDepositDisplay(
  dojoId: string | null | undefined,
  depositMap: Record<string, UktDepositRecord> | null | undefined,
  loadError = false,
): { label: string; status: UktDepositStatus | null } {
  if (loadError) return { label: "tidak tersedia", status: null };
  if (!dojoId) return { label: "—", status: null };
  if (!depositMap) return { label: "—", status: null };
  const rec = depositMap[dojoId];
  const status: UktDepositStatus = rec?.status ?? "PENDING";
  return { label: uktDepositStatusLabel(status), status };
}

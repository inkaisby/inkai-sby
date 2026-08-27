import {
  formatMemberName,
  formatRankLabel,
  formatGenderLabel,
  getBeltGroup,
  shortRankLabel,
  isBlankUktRank,
} from "@/lib/belt";
import { DISPORA_JATIM, isDisporaJatim } from "@/lib/venue";
import { LATBER_PAYMENT } from "@/lib/latber";

export type UktSemester = "I" | "II";

export const DEFAULT_KOMISI_RANTING = 50000;
export const UKT_KOMISI_SETTING_KEY = "ukt-komisi-ranting";

export function isNotaParticipant(status: string): boolean {
  return status !== "REJECTED" && status !== "BELUM_DAFTAR";
}

export function currentSemester(): UktSemester {
  return new Date().getMonth() < 6 ? "I" : "II";
}

export function formatUktPeriodLabel(semester: UktSemester, year: number): string {
  return `Semester ${semester}-${year}`;
}

export function buildUktEventTitle(semester: UktSemester, year: number): string {
  return `UKT ${formatUktPeriodLabel(semester, year)}`;
}

/** Rentang kalender semester UKT (Jan–Jun atau Jul–Des). */
export function buildUktSemesterWindow(semester: UktSemester, year: number) {
  const startMonth = semester === "I" ? 0 : 6;
  const semesterStart = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const semesterEnd = new Date(year, startMonth + 6, 0, 23, 59, 59, 999);
  return { semesterStart, semesterEnd };
}

/**
 * Tanggal event untuk backend: batas pendaftaran = akhir semester.
 * Backend mensyaratkan registrationCloseAt <= startDate; jika kosong, startDate jadi deadline.
 * Buka pendaftaran default = awal semester (disimpan di period-meta, bukan kolom Event).
 */
export function buildUktEventDates(semester: UktSemester, year: number) {
  const { semesterStart, semesterEnd } = buildUktSemesterWindow(semester, year);
  return {
    startDate: semesterEnd,
    endDate: semesterEnd,
    registrationCloseAt: semesterEnd,
    registrationOpenAt: semesterStart,
  };
}

export type UktPeriodSchedule = {
  startDate: string;
  endDate: string;
  registrationCloseAt?: string | null;
  /** ISO — dari period-meta; kosong = tidak ada batas buka (langsung boleh daftar). */
  registrationOpenAt?: string | null;
};

export function getUktRegistrationDeadline(period: UktPeriodSchedule): Date {
  if (period.registrationCloseAt) {
    return new Date(period.registrationCloseAt);
  }
  return new Date(period.startDate);
}

export function getUktRegistrationOpenAt(period: UktPeriodSchedule): Date | null {
  if (!period.registrationOpenAt) return null;
  const d = new Date(period.registrationOpenAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isUktRegistrationNotYetOpen(period: UktPeriodSchedule): boolean {
  const openAt = getUktRegistrationOpenAt(period);
  return Boolean(openAt && Date.now() < openAt.getTime());
}

export function isUktRegistrationOpen(period: UktPeriodSchedule): boolean {
  const now = Date.now();
  if (isUktRegistrationNotYetOpen(period)) return false;
  return now <= getUktRegistrationDeadline(period).getTime();
}

export function formatUktRegistrationDeadline(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${datePart}, ${pad(d.getHours())}.${pad(d.getMinutes())}`;
}

export function toDateTimeLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toDateInput(iso: string): string {
  return toDateTimeLocalInput(iso).slice(0, 10);
}

export function toTimeInput(iso: string): string {
  return toDateTimeLocalInput(iso).slice(11, 16);
}

export function combineDateAndTimeLocal(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

export const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
export const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export function splitTimeInput(time: string): { hour: string; minute: string } {
  const [hour = "00", minute = "00"] = time.split(":");
  return { hour: hour.padStart(2, "0"), minute: minute.padStart(2, "0") };
}

export function joinTimeInput(hour: string, minute: string): string {
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function parseUktEventTitle(title: string): { semester: UktSemester; year: number } | null {
  const match = title.match(/semester\s*(I|II)\s*[-/]\s*(\d{4})/i);
  if (!match) return null;
  return {
    semester: match[1].toUpperCase() as UktSemester,
    year: parseInt(match[2], 10),
  };
}

/** Judul event UKT admin — bukan Latber yang kebetulan memuat kata "UKT". */
export function isUktAdminEventTitle(title: string): boolean {
  if (parseUktEventTitle(title)) return true;
  const upper = String(title ?? "").toUpperCase();
  return (
    upper.includes("UKT") &&
    !upper.includes("LATBER") &&
    !upper.includes("LATIHAN BERSAMA")
  );
}

export type UktPeriodOption = {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  registrationCloseAt?: string | null;
  createdAt?: string;
  archived?: boolean;
  locked?: boolean;
};

/** Apakah judul/event termasuk semester+tahun yang diminta. */
export function uktPeriodBelongsToTerm(
  period: UktPeriodOption,
  semester: UktSemester,
  year: number,
): boolean {
  const expectedTitle = buildUktEventTitle(semester, year).toLowerCase();
  if (period.title.trim().toLowerCase() === expectedTitle) return true;
  if (period.title.toLowerCase().startsWith(expectedTitle)) return true;
  const parsed = parseUktEventTitle(period.title);
  if (parsed?.semester === semester && parsed?.year === year) return true;

  const { semesterStart, semesterEnd } = buildUktSemesterWindow(semester, year);
  if (period.startDate) {
    const t = new Date(period.startDate).getTime();
    if (Number.isFinite(t) && t >= semesterStart.getTime() && t <= semesterEnd.getTime()) {
      return true;
    }
  }
  return false;
}

/** Cari event UKT yang cocok dengan semester + tahun (judul standar, parse judul, atau rentang tanggal). */
export function findUktPeriodsForTerm(
  periods: UktPeriodOption[],
  semester: UktSemester,
  year: number,
): UktPeriodOption[] {
  return periods.filter((p) => uktPeriodBelongsToTerm(p, semester, year));
}

export function findUktPeriodForTerm(
  periods: UktPeriodOption[],
  semester: UktSemester,
  year: number,
): UktPeriodOption | null {
  const matches = findUktPeriodsForTerm(periods, semester, year);
  if (matches.length === 0) return null;

  const expectedTitle = buildUktEventTitle(semester, year).toLowerCase();
  const rank = (p: UktPeriodOption) => {
    let score = 0;
    if (!p.archived && !p.locked) score += 100;
    if (isUktRegistrationOpen({
      startDate: p.startDate ?? "",
      endDate: p.endDate ?? p.startDate ?? "",
      registrationCloseAt: p.registrationCloseAt,
    })) {
      score += 50;
    }
    if (p.title.trim().toLowerCase() === expectedTitle) score += 20;
    if (parseUktEventTitle(p.title)) score += 10;
    const created = p.createdAt ? new Date(p.createdAt).getTime() : 0;
    score += Number.isFinite(created) ? created / 1e13 : 0;
    return score;
  };

  return [...matches].sort((a, b) => rank(b) - rank(a))[0] ?? null;
}

/** Periode operasional (bukan arsip/kunci) — untuk halaman depan. */
export function isUktPeriodActiveView(period: UktPeriodOption): boolean {
  return !period.archived && !period.locked;
}

/** Periode riwayat/arsip untuk term — yang paling baru lebih dulu. */
export function findUktArchivedPeriodForTerm(
  periods: UktPeriodOption[],
  semester: UktSemester,
  year: number,
): UktPeriodOption | null {
  const matches = findUktPeriodsForTerm(periods, semester, year).filter(
    (p) => !isUktPeriodActiveView(p),
  );
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => {
    const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return cb - ca;
  })[0] ?? null;
}

export type UktAdminViewMode = "registration" | "archive";

/** Cari sebarang periode aktif (bukan arsip/kunci) jika term saat ini belum memiliki event. */
export function findAnyActiveUktPeriod(
  periods: UktPeriodOption[],
): UktPeriodOption | null {
  const activePeriods = periods.filter((p) => isUktPeriodActiveView(p));
  if (activePeriods.length === 0) return null;

  const expectedTitle = buildUktEventTitle(currentSemester(), new Date().getFullYear()).toLowerCase();
  const rank = (p: UktPeriodOption) => {
    let score = 0;
    if (
      isUktRegistrationOpen({
        startDate: p.startDate ?? "",
        endDate: p.endDate ?? p.startDate ?? "",
        registrationCloseAt: p.registrationCloseAt,
      })
    ) {
      score += 50;
    }
    if (p.title.trim().toLowerCase() === expectedTitle) score += 20;
    if (parseUktEventTitle(p.title)) score += 10;
    const created = p.createdAt ? new Date(p.createdAt).getTime() : 0;
    score += Number.isFinite(created) ? created / 1e13 : 0;
    return score;
  };

  return [...activePeriods].sort((a, b) => rank(b) - rank(a))[0] ?? null;
}

/**
 * Pilih periode: Pendaftaran mengutamakan aktif; Arsip mengutamakan riwayat/terkunci.
 */
export function resolveUktSelectedPeriodId(
  periods: UktPeriodOption[],
  semester: UktSemester,
  year: number,
  periodFromUrl: string | null | undefined,
  viewMode: UktAdminViewMode = "registration",
): string | null {
  if (viewMode === "archive") {
    const archiveMatch = findUktArchivedPeriodForTerm(periods, semester, year);
    if (periodFromUrl) {
      const urlPeriod = periods.find((p) => p.id === periodFromUrl);
      if (
        urlPeriod &&
        !isUktPeriodActiveView(urlPeriod) &&
        uktPeriodBelongsToTerm(urlPeriod, semester, year)
      ) {
        return periodFromUrl;
      }
    }
    return archiveMatch?.id ?? null;
  }

  const matchByTerm = findUktPeriodForTerm(periods, semester, year);
  if (periodFromUrl) {
    const urlPeriod = periods.find((p) => p.id === periodFromUrl);
    // Pertahankan ID dari URL bila belum ada di list (list kosong/gagal) —
    // jangan loncat ke periode lain yang memicu redirect strip → blink.
    if (!urlPeriod) return periodFromUrl;
    if (!uktPeriodBelongsToTerm(urlPeriod, semester, year)) {
      // Term URL salah: biarkan caller sync semester/tahun dari judul, tetap pakai ID URL
      // jika periode aktif; jangan ganti ke event term lain.
      if (isUktPeriodActiveView(urlPeriod)) return periodFromUrl;
      return matchByTerm?.id ?? null;
    }
    // URL menunjuk arsip, tapi ada periode aktif di term yang sama → fokus ke aktif
    if (
      !isUktPeriodActiveView(urlPeriod) &&
      matchByTerm &&
      isUktPeriodActiveView(matchByTerm) &&
      matchByTerm.id !== urlPeriod.id
    ) {
      return matchByTerm.id;
    }
    // Di Pendaftaran: jangan buka arsip — kosongkan agar UI buat/alih term
    if (!isUktPeriodActiveView(urlPeriod)) {
      return matchByTerm && isUktPeriodActiveView(matchByTerm)
        ? matchByTerm.id
        : null;
    }
    return periodFromUrl;
  }
  const fallback = !matchByTerm ? findAnyActiveUktPeriod(periods) : null;
  return matchByTerm?.id ?? fallback?.id ?? null;
}

/**
 * Apakah URL admin UKT perlu di-redirect ke bentuk kanonikal.
 * Tidak strip `period` saat fetch gagal / canonical null — itu sumber blink loader.
 */
export function resolveUktAdminCanonicalRedirect(opts: {
  createMode?: boolean;
  urlSemester?: string;
  urlYear?: string;
  urlCreate?: string;
  periodFromUrl: string | null;
  targetSemester: UktSemester;
  targetYear: number;
  canonicalPeriod: string | null;
  dataOk: boolean;
  basePath?: "/admin/ukt" | "/admin/ukt/arsip";
}): string | null {
  const basePath = opts.basePath ?? "/admin/ukt";
  if (opts.createMode) {
    const target = buildUktAdminUrl(opts.targetSemester, opts.targetYear, null, {
      create: true,
      basePath,
    });
    const current = buildUktAdminUrl(
      (opts.urlSemester === "II" || opts.urlSemester === "I"
        ? opts.urlSemester
        : opts.targetSemester) as UktSemester,
      opts.urlYear ? parseInt(opts.urlYear, 10) || opts.targetYear : opts.targetYear,
      opts.periodFromUrl,
      opts.urlCreate === "1" ? { create: true, basePath } : { basePath },
    );
    if (opts.urlCreate !== "1" || opts.periodFromUrl || current !== target) {
      return current === target ? null : target;
    }
    return null;
  }

  // Fetch gagal: jangan rewrite URL (terutama jangan strip period).
  if (!opts.dataOk) return null;

  // Jangan strip period dari URL → redirect bolak-balik dengan light resolve.
  if (opts.periodFromUrl && !opts.canonicalPeriod) return null;

  const target = buildUktAdminUrl(
    opts.targetSemester,
    opts.targetYear,
    opts.canonicalPeriod,
    { basePath },
  );
  const current = buildUktAdminUrl(
    (opts.urlSemester === "II" || opts.urlSemester === "I"
      ? opts.urlSemester
      : opts.targetSemester) as UktSemester,
    opts.urlYear ? parseInt(opts.urlYear, 10) || opts.targetYear : opts.targetYear,
    opts.periodFromUrl,
    { basePath },
  );
  if (current === target) return null;

  const missingTerm = !opts.urlSemester || !opts.urlYear;
  const periodMissing = Boolean(opts.canonicalPeriod) && !opts.periodFromUrl;
  const termMismatch =
    opts.urlSemester !== opts.targetSemester ||
    opts.urlYear !== String(opts.targetYear);
  const periodMismatch =
    (opts.periodFromUrl ?? "") !== (opts.canonicalPeriod ?? "");

  if (missingTerm || periodMissing || termMismatch || periodMismatch) {
    return target;
  }
  return null;
}

export function buildUktAdminUrl(
  semester: UktSemester,
  year: number,
  periodId: string | null,
  opts?: { create?: boolean; basePath?: "/admin/ukt" | "/admin/ukt/arsip" },
): string {
  const qs = new URLSearchParams({ semester, year: String(year) });
  if (periodId) qs.set("period", periodId);
  if (opts?.create) qs.set("create", "1");
  const base = opts?.basePath ?? "/admin/ukt";
  return `${base}?${qs.toString()}`;
}

/** URL UKT admin untuk semester berjalan (nav menu, quick link). */
export function buildDefaultUktAdminUrl(): string {
  return buildUktAdminUrl(currentSemester(), new Date().getFullYear(), null);
}

/** Link admin UKT dari judul event (halaman kegiatan, dll.). */
export function buildUktAdminUrlFromEvent(title: string, eventId: string): string {
  const parsed = parseUktEventTitle(title);
  if (parsed) {
    return buildUktAdminUrl(parsed.semester, parsed.year, eventId);
  }
  return buildUktAdminUrl(currentSemester(), new Date().getFullYear(), eventId);
}

export function buildNotaNumber(dojoSlug: string, semester: UktSemester, year: number): string {
  const slug = dojoSlug
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12) || "RANTING";
  return `UKT/SBY/${slug}/${semester}/${year}`;
}

export const BELT_FEE_KEYS = ["PUTIH", "KUNING", "HIJAU", "BIRU", "COKELAT"] as const;
export type BeltFeeKey = (typeof BELT_FEE_KEYS)[number];

export const DEFAULT_BELT_FEES: Record<BeltFeeKey, number> = {
  PUTIH: 285000,
  KUNING: 295000,
  HIJAU: 305000,
  BIRU: 315000,
  COKELAT: 345000,
};

/** Tarif setor ke Pengprov (terpisah dari biaya Nota/cabang). */
export const DEFAULT_UKT_PENGPROV_BELT_FEES: Record<BeltFeeKey, number> = {
  PUTIH: 150000,
  KUNING: 150000,
  HIJAU: 150000,
  BIRU: 155000,
  COKELAT: 195000,
};

export const DEFAULT_UKT_PENGPROV_BANK_FOOTER =
  "UANG UJIAN MOHON DITRANSFER KE REKENING BANK JATIM a.n. PENGPROV INKAI JATIM No. Rek. 0013809828";

export const UKT_SALAH_PENULISAN_FEE = 15000;
export const UKT_BUKU_HILANG_RUSAK_FEE = 100000;

export const BELT_FEE_LABELS: Record<BeltFeeKey, string> = {
  PUTIH: "Putih",
  KUNING: "Kuning",
  HIJAU: "Hijau",
  BIRU: "Biru",
  COKELAT: "Cokelat",
};

export function formatRupiahNota(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")},-`;
}

/** Format rupiah tanpa sufiks `,-` (teks WA / ringkas). */
export function formatRupiahPlain(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function parsePengprovBeltFeesPartial(
  raw: unknown,
): Partial<Record<BeltFeeKey, number>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Partial<Record<BeltFeeKey, number>> = {};
  let any = false;
  for (const key of BELT_FEE_KEYS) {
    const n = Number((raw as Record<string, unknown>)[key]);
    if (Number.isFinite(n) && n >= 0) {
      out[key] = Math.round(n);
      any = true;
    }
  }
  return any ? out : undefined;
}

/**
 * Normalisasi nama template biaya: "Sabuk Biru", "Coklat (Kyu 3)", "Biru" → warna kanonis.
 */
export function normalizeBeltFeeRankName(rankName: string): string {
  return rankName
    .trim()
    .toLowerCase()
    .replace(/^(sabuk|belt)\s+/i, "")
    .replace(/\bcoklat\b/g, "cokelat")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function beltFeeKeyFromRankName(rankName: string): BeltFeeKey | null {
  const normalized = normalizeBeltFeeRankName(rankName);
  if (!normalized) return null;
  for (const key of BELT_FEE_KEYS) {
    const label = BELT_FEE_LABELS[key].toLowerCase();
    if (normalized === label || normalized.startsWith(`${label} `)) {
      return key;
    }
  }
  return null;
}

export function findTemplatesForBeltFee<T extends { rankName: string }>(
  templates: T[],
  key: BeltFeeKey,
): T[] {
  return templates.filter((t) => beltFeeKeyFromRankName(t.rankName) === key);
}

function preferCanonicalBeltTemplate<T extends { rankName: string; fee: number }>(
  matches: T[],
  key: BeltFeeKey,
): T {
  const canonical = BELT_FEE_LABELS[key].toLowerCase();
  return (
    matches.find((t) => normalizeBeltFeeRankName(t.rankName) === canonical) ??
    matches[0]
  );
}

/**
 * UKT tidak memakai kode unik (+1..999) di frontend.
 * Prefer `baseFeeAmount`; fallback strip sisa tail lama dari API/historis.
 */
export function uktBaseFeeAmount(
  amount: number | null | undefined,
  baseFeeAmount?: number | null | undefined,
): number | null {
  if (baseFeeAmount != null && !Number.isNaN(Number(baseFeeAmount))) {
    return Math.round(Number(baseFeeAmount));
  }
  if (amount == null || Number.isNaN(Number(amount))) return null;
  const n = Math.round(Number(amount));
  // Kompatibilitas data lama yang mungkin masih punya uniqueTail di amount
  return n - (n % 1000);
}

export function beltFeesFromTemplates(
  templates: { rankName: string; fee: number }[],
): Record<BeltFeeKey, number> {
  const fees = { ...DEFAULT_BELT_FEES };
  for (const key of BELT_FEE_KEYS) {
    const matches = findTemplatesForBeltFee(templates, key);
    if (matches.length === 0) continue;
    fees[key] = Math.round(preferCanonicalBeltTemplate(matches, key).fee);
  }
  return fees;
}

const KYU_TARGET_BELT: Record<number, BeltFeeKey> = {
  10: "PUTIH",
  9: "PUTIH",
  8: "KUNING",
  7: "KUNING",
  6: "HIJAU",
  5: "BIRU",
  4: "BIRU",
  3: "COKELAT",
  2: "COKELAT",
  1: "COKELAT",
};

function beltGroupFromKyuText(rankRaw: string | null | undefined): BeltFeeKey | null {
  if (!rankRaw) return null;
  const match = rankRaw.match(/kyu\s*(\d+)/i);
  if (!match) return null;
  return KYU_TARGET_BELT[parseInt(match[1], 10)] ?? null;
}

function beltGroupFromBilling(
  amount: number | null,
  beltFees: Record<BeltFeeKey, number>,
): BeltFeeKey | null {
  if (amount == null) return null;
  for (const belt of BELT_FEE_KEYS) {
    const fee = beltFees[belt];
    if (amount >= fee && amount <= fee + 999) return belt;
  }
  return null;
}

/**
 * Grouping legacy (WA setor / Laporan Pengprov): prefer cocok billing ke tarif snapshot.
 * Cetak Nota memakai `resolveNotaBeltGroupFromKyu` + `buildNotaBeltLines`.
 */
export function resolveNotaBeltGroup(
  row: UktMemberRow,
  beltFees: Record<BeltFeeKey, number>,
): BeltFeeKey | null {
  const fromBilling = beltGroupFromBilling(row.billingAmount, beltFees);
  if (fromBilling) return fromBilling;

  const fromLama = getBeltGroup(row.kyuLama);
  if (fromLama !== "LAINNYA") return fromLama as BeltFeeKey;

  return beltGroupFromKyuText(row.kyuLama);
}

/** Grouping Cetak Nota / WA: Kyu Lama, fallback Kyu Baru (selaras daftar peserta WA). */
export function resolveNotaBeltGroupFromKyu(
  row: Pick<UktMemberRow, "kyuLama" | "kyuBaru" | "billingAmount">,
  beltFees: Record<BeltFeeKey, number>,
): BeltFeeKey | "LAINNYA" {
  const rankRaw = (row.kyuLama || row.kyuBaru || "").trim();
  const fromRank = getBeltGroup(rankRaw);
  if (fromRank !== "LAINNYA") return fromRank as BeltFeeKey;

  const fromKyu = beltGroupFromKyuText(rankRaw);
  if (fromKyu) return fromKyu;

  const fromBilling = beltGroupFromBilling(row.billingAmount, beltFees);
  if (fromBilling) return fromBilling;

  return "LAINNYA";
}

export type NotaBeltLine = {
  belt: BeltFeeKey | "LAINNYA";
  count: number;
  unitFee: number;
  subtotal: number;
};

export type NotaBeltBuildResult = {
  lines: NotaBeltLine[];
  subtotalA: number;
  registeredCount: number;
  unpaidCount: number;
  unpaidAmount: number;
};

/**
 * Baris sabuk Cetak Nota / Laporan WA: satu baris per sabuk dari Kyu Lama
 * (fallback Kyu Baru bila Kyu Lama kosong — selaras daftar peserta WA).
 * Unit fee = tarif snapshot periode (`fallbackFees[belt]`); `billingAmount` hanya
 * untuk `LAINNYA` (atau fallback Putih bila null). Subtotal A = sum tarif snapshot.
 */
export function buildNotaBeltLines(
  rows: UktMemberRow[],
  fallbackFees: Record<BeltFeeKey, number>,
): NotaBeltBuildResult {
  /** key = belt (unitFee seragam per sabuk diketahui) */
  const buckets = new Map<
    string,
    { belt: BeltFeeKey | "LAINNYA"; unitFee: number; count: number; subtotal: number }
  >();

  let unpaidCount = 0;
  let unpaidAmount = 0;

  for (const row of rows) {
    const belt = resolveNotaBeltGroupFromKyu(row, fallbackFees);
    const unitFee = Math.round(
      belt !== "LAINNYA"
        ? fallbackFees[belt]
        : (uktBaseFeeAmount(row.billingAmount) ?? fallbackFees.PUTIH),
    );
    const key = belt === "LAINNYA" ? `LAINNYA|${unitFee}` : belt;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.subtotal += unitFee;
    } else {
      buckets.set(key, { belt, unitFee, count: 1, subtotal: unitFee });
    }

    const bs = String(row.billingStatus ?? "").toUpperCase();
    if (bs === "PENDING") {
      unpaidCount += 1;
      unpaidAmount += unitFee;
    }
  }

  const beltOrder: Array<BeltFeeKey | "LAINNYA"> = [...BELT_FEE_KEYS, "LAINNYA"];
  const lines: NotaBeltLine[] = [...buckets.values()]
    .sort((a, b) => {
      const ai = beltOrder.indexOf(a.belt);
      const bi = beltOrder.indexOf(b.belt);
      if (ai !== bi) return ai - bi;
      return a.unitFee - b.unitFee;
    })
    .map((b) => ({
      belt: b.belt,
      count: b.count,
      unitFee: b.unitFee,
      subtotal: b.subtotal,
    }));

  const subtotalA = lines.reduce((sum, l) => sum + l.subtotal, 0);

  return {
    lines,
    subtotalA,
    registeredCount: rows.length,
    unpaidCount,
    unpaidAmount,
  };
}

/** Cocokkan ranting nota: dojoId dulu, fallback nama (trim, case-insensitive). */
export function rowMatchesNotaDojoSelection(
  row: Pick<UktMemberRow, "dojoId" | "dojoName">,
  selectedIds: Set<string>,
  dojoOptions: Array<{ id: string; name: string }>,
): boolean {
  if (selectedIds.has(row.dojoId)) return true;
  const selectedNames = new Set(
    dojoOptions
      .filter((d) => selectedIds.has(d.id))
      .map((d) => d.name.trim().toLowerCase()),
  );
  const name = (row.dojoName || "").trim().toLowerCase();
  return Boolean(name && selectedNames.has(name));
}

export function countNotaBeltGroups(
  rows: UktMemberRow[],
  beltFees: Record<BeltFeeKey, number>,
): Record<BeltFeeKey, number> {
  const result: Record<BeltFeeKey, number> = {
    PUTIH: 0,
    KUNING: 0,
    HIJAU: 0,
    BIRU: 0,
    COKELAT: 0,
  };
  for (const row of rows) {
    const grp = resolveNotaBeltGroup(row, beltFees);
    if (grp) result[grp]++;
  }
  return result;
}

export const APPROVED_STATUSES = new Set(["APPROVED", "SUCCESS", "PAID"]);

export function isRegistrationApproved(status: string): boolean {
  return APPROVED_STATUSES.has(String(status ?? "").toUpperCase());
}

export function isUktSelfRegistrationPendingStatus(status: string): boolean {
  return String(status ?? "").toUpperCase() === "PENDING";
}

export type UktExamResult = "PENDING" | "LULUS" | "GAGAL" | "MENGULANG";

export type UktMemberRow = {
  memberId: string;
  registrationId: string | null;
  photoUrl: string | null;
  nia: string | null;
  fullName: string;
  birthPlace: string | null;
  birthDate: string | null;
  gender: string | null;
  address: string | null;
  kyuLama: string;
  kyuBaru: string | null;
  /** Sabuk resmi keanggotaan (`currentRank`) — sumber Kyu Lama sebelum UKT selesai. */
  memberCurrentRank?: string | null;
  birthCertificateUrl: string | null;
  bpjsCardUrl: string | null;
  dojoName: string;
  dojoId: string;
  status: string;
  billingId: string | null;
  billingStatus: string | null;
  billingAmount: number | null;
  outstandingDues: number;
  pendingVerifications: number;
  attendancePct: number | null;
  attendanceCount: number;
  examResult: UktExamResult | null;
  /** Hadir di tempat ujian (hari-H); null = belum dicatat. */
  examPresent: boolean | null;
  /** Pendaftaran mandiri anggota (menunggu Terima ranting). */
  selfRegistration?: boolean;
  /** Anggota sudah konfirmasi bayar ke ranting (flag saja). */
  memberPaymentConfirmedAt?: string | null;
  /** ISO `EventRegistration.createdAt`; null untuk Belum Daftar. */
  registeredAt?: string | null;
  registrationWaiver?: UktRegistrationWaiver | null;
};

/** Item snapshot refresh cepat — field pendaftaran/tagihan + identitas Prisma. */
export type UktRegistrationSnapshotItem = {
  memberId: string;
  registrationId: string;
  status: string;
  kyuLama: string | null;
  kyuBaru: string | null;
  billingId: string | null;
  billingStatus: string | null;
  billingAmount: number | null;
  examResult: UktExamResult | null;
  examPresent: boolean | null;
  registrationWaiver: UktRegistrationWaiver | null;
  selfRegistration?: boolean;
  memberPaymentConfirmedAt?: string | null;
  /** ISO `EventRegistration.createdAt`. */
  registeredAt?: string | null;
  /** Identity untuk append / hydrate peserta (registrants-first). */
  fullName?: string;
  nia?: string | null;
  dojoId?: string | null;
  dojoName?: string | null;
  photoUrl?: string | null;
  memberCurrentRank?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  address?: string | null;
  birthCertificateUrl?: string | null;
  bpjsCardUrl?: string | null;
};

function coalesceIdentity(
  next: string | null | undefined,
  prev: string | null | undefined,
): string | null {
  const n = typeof next === "string" ? next.trim() : "";
  if (n) return next as string;
  const p = typeof prev === "string" ? prev.trim() : "";
  return p ? (prev as string) : null;
}

/**
 * Gabungkan snapshot registrasi ke baris yang sudah ada di UI.
 * Anggota yang hilang dari snapshot → Belum Daftar (pertahankan stub).
 * Peserta baru di snapshot yang belum ada di rows → di-append.
 */
export function shouldKeepUktRowsOnEmptySnapshot(
  prevRegisteredCount: number,
  participantCount: number,
): boolean {
  return participantCount === 0 && prevRegisteredCount > 0;
}

export function applyUktRegistrationSnapshotToRows(
  rows: UktMemberRow[],
  participants: UktRegistrationSnapshotItem[],
): UktMemberRow[] {
  const byMember = new Map(participants.map((p) => [p.memberId, p]));
  const mapped = rows.map((r) => {
    const p = byMember.get(r.memberId);
    if (!p) {
      if (!r.registrationId) return r;
      return {
        ...r,
        registrationId: null,
        billingId: null,
        billingStatus: null,
        billingAmount: null,
        status: "BELUM_DAFTAR",
        examResult: null,
        examPresent: null,
        kyuBaru: null,
        registrationWaiver: null,
        selfRegistration: false,
        memberPaymentConfirmedAt: null,
        registeredAt: null,
      };
    }
    return {
      ...r,
      registrationId: p.registrationId,
      status: p.status,
      billingId: p.billingId,
      billingStatus: p.billingStatus,
      billingAmount: p.billingAmount,
      examResult: p.examResult,
      examPresent: p.examPresent,
      registrationWaiver: p.registrationWaiver,
      kyuLama: p.kyuLama?.trim() ? p.kyuLama : r.kyuLama,
      kyuBaru: p.kyuBaru,
      selfRegistration: p.selfRegistration ?? r.selfRegistration,
      memberPaymentConfirmedAt:
        p.memberPaymentConfirmedAt !== undefined
          ? p.memberPaymentConfirmedAt
          : r.memberPaymentConfirmedAt,
      registeredAt:
        p.registeredAt !== undefined ? p.registeredAt : r.registeredAt,
      fullName: p.fullName?.trim() ? p.fullName : r.fullName,
      nia: coalesceIdentity(p.nia, r.nia),
      dojoId: p.dojoId?.trim() ? p.dojoId : r.dojoId,
      dojoName: p.dojoName?.trim() ? p.dojoName : r.dojoName,
      photoUrl: coalesceIdentity(p.photoUrl, r.photoUrl),
      memberCurrentRank: coalesceIdentity(p.memberCurrentRank, r.memberCurrentRank),
      birthPlace: coalesceIdentity(p.birthPlace, r.birthPlace),
      birthDate: coalesceIdentity(p.birthDate, r.birthDate),
      gender: coalesceIdentity(p.gender, r.gender),
      address: coalesceIdentity(p.address, r.address),
      birthCertificateUrl: coalesceIdentity(
        p.birthCertificateUrl,
        r.birthCertificateUrl,
      ),
      bpjsCardUrl: coalesceIdentity(p.bpjsCardUrl, r.bpjsCardUrl),
    };
  });

  const known = new Set(mapped.map((r) => r.memberId));
  const appended: UktMemberRow[] = [];
  for (const p of participants) {
    if (known.has(p.memberId)) continue;
    appended.push({
      memberId: p.memberId,
      registrationId: p.registrationId,
      photoUrl: p.photoUrl ?? null,
      nia: p.nia ?? null,
      fullName: p.fullName || "Peserta",
      birthPlace: p.birthPlace ?? null,
      birthDate: p.birthDate ?? null,
      gender: p.gender ?? null,
      address: p.address ?? null,
      kyuLama: p.kyuLama?.trim() || "—",
      kyuBaru: p.kyuBaru,
      memberCurrentRank: p.memberCurrentRank ?? null,
      birthCertificateUrl: p.birthCertificateUrl ?? null,
      bpjsCardUrl: p.bpjsCardUrl ?? null,
      dojoName: p.dojoName || "—",
      dojoId: p.dojoId || "",
      status: p.status,
      billingId: p.billingId,
      billingStatus: p.billingStatus,
      billingAmount: p.billingAmount,
      outstandingDues: 0,
      pendingVerifications: 0,
      attendanceCount: 0,
      attendancePct: 0,
      examResult: p.examResult,
      examPresent: p.examPresent,
      registrationWaiver: p.registrationWaiver,
      selfRegistration: p.selfRegistration ?? false,
      memberPaymentConfirmedAt: p.memberPaymentConfirmedAt ?? null,
      registeredAt: p.registeredAt ?? null,
    });
  }
  return appended.length > 0 ? [...mapped, ...appended] : mapped;
}

/** Minimum kehadiran latihan per semester agar boleh daftar UKT (48 sesi = 100%). */
export const UKT_MIN_ATTENDANCE_PCT = 75;
export const UKT_SEMESTER_SESSION_TOTAL = 48;

/** Hari kalender Asia/Jakarta sebagai YYYY-MM-DD. */
export function jakartaDayKey(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

export type AttendanceProgressTone = "red" | "amber" | "green";

export type AttendanceProgressLabel = {
  label: string;
  tone: AttendanceProgressTone;
};

/** Badge progres kehadiran semester (UI anggota & admin). */
export function attendanceProgressLabel(pct: number): AttendanceProgressLabel {
  const n = Number.isFinite(pct) ? Math.max(0, pct) : 0;
  if (n <= 0) return { label: "MULAI LATIHAN", tone: "red" };
  if (n < 25) return { label: "TINGKATKAN LATIHAN", tone: "red" };
  if (n < 50) return { label: "TERUS BERLATIH", tone: "amber" };
  if (n < UKT_MIN_ATTENDANCE_PCT) return { label: "HAMPIR LAYAK", tone: "amber" };
  return { label: "LAYAK UJIAN", tone: "green" };
}

/** Hitung % semester dari daftar check-in (hari unik / 48). */
export function semesterAttendanceStats(
  attendances: Array<{ checkInAt: string }>,
  now: Date = new Date(),
): {
  count: number;
  totalSessions: number;
  pct: number;
  isFirstSemester: boolean;
} {
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const isFirstSemester = currentMonth < 6;
  const days = new Set<string>();
  for (const h of attendances) {
    const d = new Date(h.checkInAt);
    if (Number.isNaN(d.getTime())) continue;
    const isFirst = d.getMonth() < 6;
    if (isFirst === isFirstSemester && d.getFullYear() === currentYear) {
      days.add(jakartaDayKey(d));
    }
  }
  const count = days.size;
  const pct =
    UKT_SEMESTER_SESSION_TOTAL > 0
      ? Math.min(100, Math.round((count / UKT_SEMESTER_SESSION_TOTAL) * 1000) / 10)
      : 0;
  return {
    count,
    totalSessions: UKT_SEMESTER_SESSION_TOTAL,
    pct,
    isFirstSemester,
  };
}

export function isCheckedInOnJakartaDay(
  attendances: Array<{ checkInAt: string }>,
  dayKey: string = jakartaDayKey(),
): boolean {
  return attendances.some((a) => {
    const d = new Date(a.checkInAt);
    if (Number.isNaN(d.getTime())) return false;
    return jakartaDayKey(d) === dayKey;
  });
}

export type UktRegistrationBlocker =
  | "PERIODE_TUTUP"
  | "PERIODE_BELUM_BUKA"
  | "IURAN_TUNGGAKAN"
  | "DOKUMEN_KURANG"
  | "ABSENSI_KURANG";

export type UktDisplayStatus =
  | "belum_daftar"
  | "terdaftar"
  | "belum_bayar"
  | "menunggu_terima_ranting"
  | "menunggu_konfirmasi_ranting"
  | "menunggu_verifikasi"
  | "lunas"
  | "menunggu_ujian"
  | "lulus"
  | "gagal"
  | "mengulang"
  | "selesai"
  | "ditolak";

export function uktExamResultKey(periodId: string, registrationId: string): string {
  return `ukt-exam-result:${periodId}:${registrationId}`;
}

export function uktExamAttendanceKey(periodId: string, registrationId: string): string {
  return `ukt-exam-attendance:${periodId}:${registrationId}`;
}

export function uktDepositKey(periodId: string, dojoId: string): string {
  return `ukt-deposit:${periodId}:${dojoId}`;
}

export function uktPeriodMetaKey(periodId: string): string {
  return `ukt-period-meta:${periodId}`;
}

export type UktDepositStatus = "PENDING" | "SUBMITTED" | "RECEIVED";

export type UktDepositRecord = {
  status: UktDepositStatus;
  note?: string;
  at?: string;
  by?: string;
};

export type UktPeriodMeta = {
  archived: boolean;
  locked: boolean;
  archivedAt?: string;
  lockedAt?: string;
  by?: string;
  /** ISO — kapan ranting boleh mulai mendaftarkan peserta. */
  registrationOpenAt?: string;
  /** Snapshot biaya sabuk periode (dibekukan saat buat / simpan periode). */
  beltFees?: Partial<Record<BeltFeeKey, number>>;
  komisiRanting?: number;
  /** Tarif setor Pengprov per sabuk (Laporan UKT cabang; terpisah dari beltFees Nota). */
  pengprovBeltFees?: Partial<Record<BeltFeeKey, number>>;
  /** Jadwal & tempat ujian (bukan batas daftar). */
  examAt?: string;
  examLocation?: string;
  /** Pejabat dokumen untuk periode ini (fallback ke kebijakan cabang). */
  bidangUjianName?: string;
  bendaharaCabangName?: string;
  /** Lembar TTD Pengda — pejabat + penguji (override per periode). */
  pengdaKetua?: string;
  pengdaKetuaTitle?: string;
  pengdaKetuaMemberId?: string;
  mshKetua?: string;
  mshKetuaTitle?: string;
  mshKetuaMemberId?: string;
  ketuaCabangName?: string;
  ketuaCabangTitle?: string;
  ketuaCabangMemberId?: string;
  bidangUjianTitle?: string;
  bidangUjianMemberId?: string;
  pengujiNames?: string[];
  pengujiTitles?: string[];
  pengujiMemberIds?: string[];
  pengdaKetuaSignUrl?: string;
  mshKetuaSignUrl?: string;
  ketuaCabangSignUrl?: string;
  bidangUjianSignUrl?: string;
  pengujiSignUrls?: string[];
  /** Idempotensi notifikasi jadwal. */
  notifiedOpenAt?: string;
  notifiedCloseReminderAt?: string;
  notifiedExtendedAt?: string;
};

export function resolveUktPengprovBeltFees(
  meta?: UktPeriodMeta | null,
): Record<BeltFeeKey, number> {
  const snap = meta?.pengprovBeltFees;
  const fees = { ...DEFAULT_UKT_PENGPROV_BELT_FEES };
  if (!snap) return fees;
  for (const k of BELT_FEE_KEYS) {
    const n = Number(snap[k]);
    if (Number.isFinite(n) && n >= 0) fees[k] = Math.round(n);
  }
  return fees;
}

export function resolveUktPeriodFees(
  globalFees: Record<BeltFeeKey, number>,
  globalKomisi: number,
  meta?: UktPeriodMeta | null,
): {
  beltFees: Record<BeltFeeKey, number>;
  komisiRanting: number;
  fromSnapshot: boolean;
} {
  const snap = meta?.beltFees;
  const hasSnap =
    Boolean(snap) &&
    BELT_FEE_KEYS.every((k) => typeof snap?.[k] === "number" && Number.isFinite(snap[k]));
  if (hasSnap && typeof meta?.komisiRanting === "number") {
    const beltFees = { ...DEFAULT_BELT_FEES };
    for (const k of BELT_FEE_KEYS) {
      beltFees[k] = Math.round(Number(snap![k]));
    }
    return {
      beltFees,
      komisiRanting: Math.round(meta.komisiRanting),
      fromSnapshot: true,
    };
  }
  return {
    beltFees: { ...globalFees },
    komisiRanting: globalKomisi,
    fromSnapshot: false,
  };
}

export function resolveUktPeriodOfficers(
  meta: UktPeriodMeta | null | undefined,
  org?: { bidangUjianName?: string; bendaharaCabangName?: string } | null,
): { bidangUjianName: string; bendaharaCabangName: string } {
  return {
    bidangUjianName:
      meta?.bidangUjianName?.trim() || org?.bidangUjianName?.trim() || "SETIA BASUKI",
    bendaharaCabangName:
      meta?.bendaharaCabangName?.trim() ||
      org?.bendaharaCabangName?.trim() ||
      "Habibur Rahman",
  };
}

export type UktDepositReconRow = {
  dojoId: string;
  dojoName: string;
  participantCount: number;
  paidCount: number;
  expectedAmount: number;
  depositStatus: UktDepositStatus;
  gapLabel: string;
};

/** Rekonsiliasi setoran: total tagihan peserta terdaftar (disetor ke cabang net = kotor − komisi ranting) vs status setor ranting. */
export function buildUktDepositReconciliation(
  rows: Array<{
    dojoId: string;
    dojoName: string;
    registrationId: string | null;
    billingAmount: number | null;
    billingStatus: string | null;
    status: string;
  }>,
  dojos: Array<{ id: string; name: string }>,
  depositMap: Record<string, UktDepositRecord>,
  komisiRanting: number = DEFAULT_KOMISI_RANTING,
): UktDepositReconRow[] {
  const byDojo = new Map<
    string,
    { name: string; participantCount: number; paidCount: number; grossAmount: number }
  >();

  for (const d of dojos) {
    byDojo.set(d.id, {
      name: d.name,
      participantCount: 0,
      paidCount: 0,
      grossAmount: 0,
    });
  }

  for (const r of rows) {
    if (!r.registrationId || !r.dojoId) continue;
    if (r.status === "REJECTED") continue;
    let bucket = byDojo.get(r.dojoId);
    if (!bucket) {
      bucket = {
        name: r.dojoName || r.dojoId,
        participantCount: 0,
        paidCount: 0,
        grossAmount: 0,
      };
      byDojo.set(r.dojoId, bucket);
    }
    bucket.participantCount += 1;
    const amt = uktBaseFeeAmount(r.billingAmount) ?? 0;
    const paid =
      r.billingStatus === "PAID" ||
      r.status === "PAID" ||
      r.status === "SUCCESS";
    if (paid) {
      bucket.paidCount += 1;
      bucket.grossAmount += amt;
    }
  }

  const result: UktDepositReconRow[] = [];
  for (const [dojoId, b] of byDojo) {
    if (b.participantCount === 0) continue;
    const depositStatus: UktDepositStatus = depositMap[dojoId]?.status ?? "PENDING";
    const belumBayar = Math.max(0, b.participantCount - b.paidCount);
    const gapLabel = `Belum Bayar: ${belumBayar}, Menunggu Ujian: ${b.paidCount}`;
    const expectedAmount = Math.max(
      0,
      b.grossAmount - b.paidCount * komisiRanting,
    );
    result.push({
      dojoId,
      dojoName: b.name,
      participantCount: b.participantCount,
      paidCount: b.paidCount,
      expectedAmount,
      depositStatus,
      gapLabel,
    });
  }

  return result.sort((a, b) => a.dojoName.localeCompare(b.dojoName, "id"));
}

export function parseUktExamAttendanceValue(value: unknown): boolean | null {
  if (!value || typeof value !== "object") return null;
  const present = (value as { present?: unknown }).present;
  if (typeof present === "boolean") return present;
  return null;
}

export function buildUktExamAttendanceMap(
  settings: Array<{ key: string; value: unknown }>,
  periodId: string,
): Map<string, boolean> {
  const prefix = `ukt-exam-attendance:${periodId}:`;
  const map = new Map<string, boolean>();
  for (const s of settings) {
    if (!s.key.startsWith(prefix)) continue;
    const registrationId = s.key.slice(prefix.length);
    const parsed = parseUktExamAttendanceValue(s.value);
    if (registrationId && parsed != null) map.set(registrationId, parsed);
  }
  return map;
}

export function parseUktDepositValue(value: unknown): UktDepositRecord | null {
  if (!value || typeof value !== "object") return null;
  const status = String((value as { status?: string }).status ?? "").toUpperCase();
  if (status !== "PENDING" && status !== "SUBMITTED" && status !== "RECEIVED") {
    return null;
  }
  const note = (value as { note?: string }).note;
  const at = (value as { at?: string }).at;
  const by = (value as { by?: string }).by;
  return {
    status,
    note: typeof note === "string" ? note : undefined,
    at: typeof at === "string" ? at : undefined,
    by: typeof by === "string" ? by : undefined,
  };
}

export function buildUktDepositMap(
  settings: Array<{ key: string; value: unknown }>,
  periodId: string,
): Map<string, UktDepositRecord> {
  const prefix = `ukt-deposit:${periodId}:`;
  const map = new Map<string, UktDepositRecord>();
  for (const s of settings) {
    if (!s.key.startsWith(prefix)) continue;
    const dojoId = s.key.slice(prefix.length);
    const parsed = parseUktDepositValue(s.value);
    if (dojoId && parsed) map.set(dojoId, parsed);
  }
  return map;
}

export function parseUktPeriodMetaValue(value: unknown): UktPeriodMeta {
  if (!value || typeof value !== "object") {
    return { archived: false, locked: false };
  }
  const v = value as Record<string, unknown>;
  const beltFeesRaw = v.beltFees;
  let beltFees: Partial<Record<BeltFeeKey, number>> | undefined;
  if (beltFeesRaw && typeof beltFeesRaw === "object") {
    beltFees = {};
    for (const key of BELT_FEE_KEYS) {
      const n = Number((beltFeesRaw as Record<string, unknown>)[key]);
      if (Number.isFinite(n)) beltFees[key] = Math.round(n);
    }
  }
  const komisi = v.komisiRanting;
  const pengprovBeltFees = parsePengprovBeltFeesPartial(v.pengprovBeltFees);
  return {
    archived: v.archived === true,
    locked: v.locked === true,
    archivedAt: typeof v.archivedAt === "string" ? v.archivedAt : undefined,
    lockedAt: typeof v.lockedAt === "string" ? v.lockedAt : undefined,
    by: typeof v.by === "string" ? v.by : undefined,
    registrationOpenAt:
      typeof v.registrationOpenAt === "string" ? v.registrationOpenAt : undefined,
    beltFees,
    komisiRanting:
      typeof komisi === "number" && Number.isFinite(komisi)
        ? Math.round(komisi)
        : undefined,
    pengprovBeltFees,
    examAt: typeof v.examAt === "string" ? v.examAt : undefined,
    examLocation: typeof v.examLocation === "string" ? v.examLocation : undefined,
    bidangUjianName:
      typeof v.bidangUjianName === "string" ? v.bidangUjianName : undefined,
    bendaharaCabangName:
      typeof v.bendaharaCabangName === "string" ? v.bendaharaCabangName : undefined,
    pengdaKetua:
      typeof v.pengdaKetua === "string" ? v.pengdaKetua.trim() || undefined : undefined,
    pengdaKetuaTitle:
      typeof v.pengdaKetuaTitle === "string"
        ? v.pengdaKetuaTitle.trim() || undefined
        : undefined,
    mshKetua:
      typeof v.mshKetua === "string" ? v.mshKetua.trim() || undefined : undefined,
    mshKetuaTitle:
      typeof v.mshKetuaTitle === "string"
        ? v.mshKetuaTitle.trim() || undefined
        : undefined,
    ketuaCabangName:
      typeof v.ketuaCabangName === "string"
        ? v.ketuaCabangName.trim() || undefined
        : undefined,
    ketuaCabangTitle:
      typeof v.ketuaCabangTitle === "string"
        ? v.ketuaCabangTitle.trim() || undefined
        : undefined,
    bidangUjianTitle:
      typeof v.bidangUjianTitle === "string"
        ? v.bidangUjianTitle.trim() || undefined
        : undefined,
    pengdaKetuaMemberId:
      typeof v.pengdaKetuaMemberId === "string"
        ? v.pengdaKetuaMemberId.trim() || undefined
        : undefined,
    mshKetuaMemberId:
      typeof v.mshKetuaMemberId === "string"
        ? v.mshKetuaMemberId.trim() || undefined
        : undefined,
    ketuaCabangMemberId:
      typeof v.ketuaCabangMemberId === "string"
        ? v.ketuaCabangMemberId.trim() || undefined
        : undefined,
    bidangUjianMemberId:
      typeof v.bidangUjianMemberId === "string"
        ? v.bidangUjianMemberId.trim() || undefined
        : undefined,
    pengujiNames: Array.isArray(v.pengujiNames)
      ? v.pengujiNames
          .filter((n): n is string => typeof n === "string")
          .map((n) => n.trim())
          .filter(Boolean)
          .slice(0, 20)
      : undefined,
    pengujiTitles: Array.isArray(v.pengujiTitles)
      ? v.pengujiTitles
          .map((n) => (typeof n === "string" ? n.trim() : ""))
          .slice(0, 20)
      : undefined,
    pengujiMemberIds: Array.isArray(v.pengujiMemberIds)
      ? v.pengujiMemberIds
          .map((n) => (typeof n === "string" ? n.trim() : ""))
          .slice(0, 20)
      : undefined,
    pengdaKetuaSignUrl:
      typeof v.pengdaKetuaSignUrl === "string"
        ? v.pengdaKetuaSignUrl.trim() || undefined
        : undefined,
    mshKetuaSignUrl:
      typeof v.mshKetuaSignUrl === "string"
        ? v.mshKetuaSignUrl.trim() || undefined
        : undefined,
    ketuaCabangSignUrl:
      typeof v.ketuaCabangSignUrl === "string"
        ? v.ketuaCabangSignUrl.trim() || undefined
        : undefined,
    bidangUjianSignUrl:
      typeof v.bidangUjianSignUrl === "string"
        ? v.bidangUjianSignUrl.trim() || undefined
        : undefined,
    pengujiSignUrls: Array.isArray(v.pengujiSignUrls)
      ? v.pengujiSignUrls
          .map((n) => (typeof n === "string" ? n.trim() : ""))
          .slice(0, 20)
      : undefined,
    notifiedOpenAt:
      typeof v.notifiedOpenAt === "string" ? v.notifiedOpenAt : undefined,
    notifiedCloseReminderAt:
      typeof v.notifiedCloseReminderAt === "string"
        ? v.notifiedCloseReminderAt
        : undefined,
    notifiedExtendedAt:
      typeof v.notifiedExtendedAt === "string" ? v.notifiedExtendedAt : undefined,
  };
}

export function uktDepositStatusLabel(status: UktDepositStatus): string {
  if (status === "RECEIVED") return "Setoran diterima";
  if (status === "SUBMITTED") return "Menunggu konfirmasi cabang";
  return "Belum setor";
}

export type UktExportDataIssue = {
  memberId: string;
  fullName: string;
  missing: Array<"nia" | "ttl" | "alamat" | "kyu" | "jk">;
};

export function collectUktExportDataIssues(rows: UktMemberRow[]): UktExportDataIssue[] {
  const issues: UktExportDataIssue[] = [];
  for (const r of rows) {
    if (!r.registrationId) continue;
    const missing: UktExportDataIssue["missing"] = [];
    if (!r.nia?.trim()) missing.push("nia");
    if (!formatUktBirthPlaceDate(r.birthPlace, r.birthDate)) missing.push("ttl");
    if (!r.address?.trim()) missing.push("alamat");
    if (!resolveUktExportKyuLamaNumber(r.kyuLama, r.kyuBaru, r.memberCurrentRank))
      missing.push("kyu");
    if (!formatGenderLabel(r.gender)) missing.push("jk");
    if (missing.length > 0) {
      issues.push({
        memberId: r.memberId,
        fullName: r.fullName,
        missing,
      });
    }
  }
  return issues;
}

export function parseUktExamResultValue(value: unknown): UktExamResult | null {
  if (!value || typeof value !== "object") return null;
  const result = String((value as { result?: string }).result ?? "").toUpperCase();
  if (result === "LULUS" || result === "GAGAL" || result === "MENGULANG") {
    return result;
  }
  return null;
}

export function buildUktExamResultMap(
  settings: Array<{ key: string; value: unknown }>,
  periodId: string,
): Map<string, UktExamResult> {
  const prefix = `ukt-exam-result:${periodId}:`;
  const map = new Map<string, UktExamResult>();
  for (const s of settings) {
    if (!s.key.startsWith(prefix)) continue;
    const registrationId = s.key.slice(prefix.length);
    const parsed = parseUktExamResultValue(s.value);
    if (registrationId && parsed) map.set(registrationId, parsed);
  }
  return map;
}

export function computeSemesterAttendance(
  attendances: Array<{ checkInAt: string; memberId?: string }>,
  semester: UktSemester,
  year: number,
): { countByMember: Map<string, number>; pctByMember: Map<string, number> } {
  const { semesterStart, semesterEnd } = buildUktSemesterWindow(semester, year);
  const startMs = semesterStart.getTime();
  const endMs = semesterEnd.getTime();
  /** memberId → set of YYYY-MM-DD (Asia/Jakarta) */
  const daysByMember = new Map<string, Set<string>>();

  for (const row of attendances) {
    const memberId = row.memberId?.trim();
    if (!memberId) continue;
    const t = new Date(row.checkInAt).getTime();
    if (Number.isNaN(t) || t < startMs || t > endMs) continue;
    const day = jakartaDayKey(new Date(row.checkInAt));
    let set = daysByMember.get(memberId);
    if (!set) {
      set = new Set();
      daysByMember.set(memberId, set);
    }
    set.add(day);
  }

  const countByMember = new Map<string, number>();
  const pctByMember = new Map<string, number>();
  for (const [memberId, days] of daysByMember) {
    const count = days.size;
    countByMember.set(memberId, count);
    pctByMember.set(
      memberId,
      Math.min(
        100,
        Math.round((count / UKT_SEMESTER_SESSION_TOTAL) * 1000) / 10,
      ),
    );
  }

  return { countByMember, pctByMember };
}

export function hasRequiredUktDocuments(row: {
  birthCertificateUrl: string | null;
  bpjsCardUrl: string | null;
}): boolean {
  return Boolean(row.birthCertificateUrl?.trim() && row.bpjsCardUrl?.trim());
}

export function getUktRegistrationBlockers(
  row: Pick<
    UktMemberRow,
    | "outstandingDues"
    | "birthCertificateUrl"
    | "bpjsCardUrl"
    | "pendingVerifications"
    | "attendancePct"
  >,
  opts: {
    registrationOpen: boolean;
    /** true jika sekarang masih sebelum tanggal buka pendaftaran */
    registrationNotYetOpen?: boolean;
    /** @deprecated pakai requireMinAttendance */
    enforceAttendance?: boolean;
    requireNoOutstandingDues?: boolean;
    requireDocuments?: boolean;
    requireMinAttendance?: boolean;
    minAttendancePct?: number;
  },
): UktRegistrationBlocker[] {
  const blockers: UktRegistrationBlocker[] = [];
  if (!opts.registrationOpen) {
    blockers.push(opts.registrationNotYetOpen ? "PERIODE_BELUM_BUKA" : "PERIODE_TUTUP");
  }
  const requireDues = opts.requireNoOutstandingDues !== false;
  const requireDocs = opts.requireDocuments !== false;
  const requireAttendance =
    opts.requireMinAttendance !== false && opts.enforceAttendance !== false;
  const minPct = opts.minAttendancePct ?? UKT_MIN_ATTENDANCE_PCT;

  if (requireDues && row.outstandingDues > 0) blockers.push("IURAN_TUNGGAKAN");
  if (requireDocs && !hasRequiredUktDocuments(row)) blockers.push("DOKUMEN_KURANG");
  if (requireAttendance) {
    const pct = row.attendancePct ?? 0;
    if (pct < minPct) blockers.push("ABSENSI_KURANG");
  }
  return blockers;
}

export function formatUktRegistrationBlockers(
  blockers: UktRegistrationBlocker[],
  minAttendancePct = UKT_MIN_ATTENDANCE_PCT,
): string {
  const labels: Record<UktRegistrationBlocker, string> = {
    PERIODE_TUTUP: "Batas pendaftaran sudah lewat",
    PERIODE_BELUM_BUKA: "Pendaftaran belum dibuka",
    IURAN_TUNGGAKAN: "Masih ada iuran belum lunas",
    DOKUMEN_KURANG: "Akte kelahiran & BPJS belum lengkap",
    ABSENSI_KURANG: `Kehadiran semester di bawah ${minAttendancePct}%`,
  };
  return blockers.map((b) => labels[b]).join("; ");
}

export function isUktRegistrationAllowed(
  row: Parameters<typeof getUktRegistrationBlockers>[0],
  opts: Parameters<typeof getUktRegistrationBlockers>[1],
): boolean {
  return getUktRegistrationBlockers(row, opts).length === 0;
}

export function isUktBillingPaid(
  row: Pick<UktMemberRow, "billingStatus" | "status">,
): boolean {
  const bs = String(row.billingStatus ?? "").toUpperCase();
  if (bs === "PAID" || bs === "SUCCESS") return true;
  // Status tagihan eksplisit belum lunas → jangan loncat ke Menunggu Ujian
  if (
    bs === "PENDING" ||
    bs === "WAITING_VERIFICATION" ||
    bs === "REJECTED" ||
    bs === "CANCELLED"
  ) {
    return false;
  }
  // Tanpa status tagihan: hanya anggap lunas bila status registrasi memang PAID/SUCCESS
  // (bukan APPROVED hasil daftar ranting)
  const st = String(row.status ?? "").toUpperCase();
  return st === "PAID" || st === "SUCCESS";
}

/** Ranting tidak boleh batal setelah cabang verifikasi (Menunggu Ujian+). */
export function canRantingCancelUkt(
  row: Pick<UktMemberRow, "registrationId" | "billingStatus" | "status">,
): boolean {
  return Boolean(row.registrationId) && !isUktBillingPaid(row);
}

export function resolveUktDisplayStatus(
  row: UktMemberRow,
  examResult: UktExamResult | null = row.examResult,
): UktDisplayStatus {
  if (!row.registrationId || row.status === "BELUM_DAFTAR") return "belum_daftar";
  if (row.status === "REJECTED") return "ditolak";
  if (examResult === "GAGAL") return "gagal";
  if (examResult === "MENGULANG") return "mengulang";
  if (isUktSelesai(row)) return "selesai";

  // Daftar mandiri: PENDING tanpa tagihan / belum diterima ranting
  const selfPending =
    isUktSelfRegistrationPendingStatus(row.status) &&
    (row.selfRegistration === true || !row.billingId);
  if (selfPending) {
    if (row.memberPaymentConfirmedAt) return "menunggu_konfirmasi_ranting";
    return "menunggu_terima_ranting";
  }

  const paid = isUktBillingPaid(row);

  if (paid && examResult === "LULUS" && row.kyuBaru?.trim()) return "selesai";
  if (paid && examResult === "LULUS") return "lulus";
  if (paid) return "menunggu_ujian";
  if (row.billingStatus === "WAITING_VERIFICATION") return "menunggu_verifikasi";
  if (row.billingStatus === "PENDING" || row.registrationId) return "belum_bayar";
  if (isRegistrationApproved(row.status)) return "terdaftar";
  return "terdaftar";
}

export function uktDisplayStatusLabel(status: UktDisplayStatus): string {
  const labels: Record<UktDisplayStatus, string> = {
    belum_daftar: "Belum Daftar",
    terdaftar: "Terdaftar",
    belum_bayar: "Belum Bayar",
    menunggu_terima_ranting: "Menunggu Terima Ranting",
    menunggu_konfirmasi_ranting: "Menunggu Konfirmasi Ranting",
    menunggu_verifikasi: "Menunggu Verifikasi",
    lunas: "Lunas",
    menunggu_ujian: "Menunggu Ujian",
    lulus: "Lulus Ujian",
    gagal: "Tidak Lulus",
    mengulang: "Mengulang",
    selesai: "Selesai",
    ditolak: "Ditolak",
  };
  return labels[status];
}

export function canApplyUktKyuBaru(
  row: UktMemberRow,
  _examResult: UktExamResult | null = row.examResult,
): boolean {
  // Alur cabang: Verifikasi → Menunggu Ujian → isi Kyu Baru (= otomatis Lulus+Selesai)
  return isUktBillingPaid(row) && !isUktSelesai(row);
}

/**
 * Hasil ujian efektif untuk UI.
 * Jangan infer LULUS hanya dari sabuk target (category) — itu membuat
 * Verifikasi langsung terlihat Selesai.
 */
export function resolveEffectiveUktExamResult(
  row: UktMemberRow,
): UktExamResult | null {
  if (
    row.examResult === "LULUS" ||
    row.examResult === "GAGAL" ||
    row.examResult === "MENGULANG"
  ) {
    return row.examResult;
  }
  return null;
}

function formatWaParticipantLine(row: UktMemberRow, index: number): string {
  // WA harus mengikuti sabuk yang tampak di tabel (Kyu Lama).
  const rk = formatRankLabel(row.kyuLama || row.kyuBaru);
  return `${index + 1}. ${formatMemberName(row.fullName)}${rk ? ` ${rk}` : ""}`;
}

function waRankBucketLabel(row: UktMemberRow): string {
  // Laporan WA cabang = ringkas "Jumlah per kyu" yang harus konsisten dengan tabel.
  const raw = (row.kyuLama || row.kyuBaru || "").trim();
  const short = shortRankLabel(raw);
  if (!short) return "Lainnya";
  return short.toLowerCase();
}

/** Urut Kyu 10→1 lalu Dan 1→10; label lain di akhir (A–Z). */
function compareWaRankBuckets(a: string, b: string): number {
  const parse = (label: string) => {
    const kyu = label.match(/^kyu\s*(\d+)$/i);
    if (kyu) return { kind: 0 as const, n: Number(kyu[1]) };
    const dan = label.match(/^dan\s*(\d+)$/i);
    if (dan) return { kind: 1 as const, n: Number(dan[1]) };
    return { kind: 2 as const, n: 0, label };
  };
  const pa = parse(a);
  const pb = parse(b);
  if (pa.kind !== pb.kind) return pa.kind - pb.kind;
  if (pa.kind === 0) return pb.n - pa.n; // Kyu 10 → 1
  if (pa.kind === 1) return pa.n - pb.n; // Dan 1 → 10
  return a.localeCompare(b, "id");
}

/**
 * Label ranting untuk Laporan WA — jangan pakai "Semua Ranting" saat login ranting.
 * Urutan: filter aktif → nama unik peserta → dojo tunggal di scope → fallback login.
 */
export function resolveUktWaDojoLabel(opts: {
  effectiveDojoId?: string | null;
  dojos: Array<{ id: string; name: string }>;
  approvedRows: UktMemberRow[];
  loginDojoName?: string | null;
}): string {
  const dojoId = opts.effectiveDojoId?.trim() || "";
  if (dojoId) {
    const fromList = opts.dojos.find((d) => d.id === dojoId)?.name?.trim();
    if (fromList) return fromList;
    const fromRow = opts.approvedRows
      .find((r) => r.dojoId === dojoId)
      ?.dojoName?.trim();
    if (fromRow) return fromRow;
  }

  const fromRows = [
    ...new Set(
      opts.approvedRows
        .map((r) => r.dojoName?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  ];
  if (fromRows.length === 1) return fromRows[0];
  if (opts.dojos.length === 1) return opts.dojos[0].name.trim() || "Ranting";
  const login = opts.loginDojoName?.trim();
  if (login) return login;
  if (fromRows.length > 1) return fromRows.join(", ");
  if (opts.dojos.length > 0) {
    return opts.dojos.map((d) => d.name.trim()).filter(Boolean).join(", ") || "Ranting";
  }
  return "Ranting";
}

const UKT_WA_WIB = "Asia/Jakarta";

export type UktWaExamMeta = {
  examAt?: string | null;
  examLocation?: string | null;
  now?: number;
};

/** Hitung mundur ke jadwal ujian. Lewat / invalid → null. */
export function formatUktWaCountdownLine(
  examAt: string,
  nowMs = Date.now(),
): string | null {
  const t = new Date(examAt).getTime();
  if (Number.isNaN(t)) return null;
  const diffMs = t - nowMs;
  if (diffMs <= 0) return null;
  const totalSec = Math.floor(diffMs / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `_-${d} Hari: ${pad(h)} Jam: ${pad(m)} Menit: ${pad(s)} Detik_`;
}

/** Tanggal/jam ujian manusia, zona WIB. */
export function formatUktWaExamDateTimeWib(
  examAt: string | null | undefined,
): string | null {
  if (!examAt?.trim()) return null;
  const d = new Date(examAt);
  if (Number.isNaN(d.getTime())) return null;
  const weekday = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: UKT_WA_WIB,
  }).format(d);
  const datePart = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: UKT_WA_WIB,
  }).format(d);
  const timePart = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: UKT_WA_WIB,
  })
    .format(d)
    .replace(":", ".");
  return `*${weekday}, ${datePart}, ${timePart} WIB*`;
}

export function buildUktWaVenueLines(
  examLocation?: string | null,
): string[] {
  const raw = examLocation?.trim();
  if (!raw) return [];
  if (isDisporaJatim(raw)) {
    return [
      `*Tempat:* ${DISPORA_JATIM.name}`,
      `*Lokasi:* ${DISPORA_JATIM.address}`,
    ];
  }
  return [`*Tempat:* ${raw}`];
}

function buildUktWaExamHeader(
  periodTitle: string,
  meta?: UktWaExamMeta,
  afterTitle: string[] = [],
): string[] {
  const lines = [`*Pelaksanaan ${periodTitle}*`];
  if (afterTitle.length) lines.push(...afterTitle);

  const examAt = meta?.examAt?.trim() || "";
  const countdown = examAt
    ? formatUktWaCountdownLine(examAt, meta?.now)
    : null;
  const dateLine = examAt ? formatUktWaExamDateTimeWib(examAt) : null;
  if (countdown || dateLine) {
    lines.push("");
    if (countdown) lines.push(countdown);
    if (dateLine) lines.push(dateLine);
  }
  const venue = buildUktWaVenueLines(meta?.examLocation);
  if (venue.length) {
    lines.push("", ...venue);
  }
  return lines;
}

/**
 * Net A−C (B=0) untuk subset baris yang di-pass (caller yang filter).
 * Tidak re-filter `isUktNotaRow` — WA roster bisa menyertakan tanpa tagihan.
 */
export function uktWaNetOfNotaRows(
  rows: UktMemberRow[],
  beltFees: Record<BeltFeeKey, number>,
  komisiRanting: number,
): number {
  if (rows.length === 0) return 0;
  const { subtotalA } = buildNotaBeltLines(rows, beltFees);
  return subtotalA - rows.length * komisiRanting;
}

export function formatUktWaCountPaidSuffix(
  count: number,
  paid: number,
): string {
  if (count > 0 && paid === count) return "  Lunas";
  return `  (Lunas: ${paid} · Belum lunas: ${count - paid})`;
}

export function formatUktWaMoneyPaidLine(
  paidRp: number,
  unpaidRp: number,
  opts?: { sudahLunasLabel?: boolean },
): string {
  const allPaid = unpaidRp === 0;
  if (allPaid) {
    return opts?.sudahLunasLabel ? "_Sudah lunas_" : "_Lunas_";
  }
  const paidLabel = opts?.sudahLunasLabel ? "Sudah lunas" : "Lunas";
  return `_(${paidLabel}: ${formatRupiahNota(paidRp)} · Belum lunas: ${formatRupiahNota(unpaidRp)})_`;
}

/** Peserta terdaftar untuk picker/roster Laporan WA (selaras tabel UKT). */
export function isUktWaRosterRow(row: UktMemberRow): boolean {
  if (!row.registrationId) return false;
  const st = String(row.status ?? "").toUpperCase();
  if (st === "REJECTED" || st === "CANCELLED" || st === "BELUM_DAFTAR") {
    return false;
  }
  return true;
}

export type UktWaBendaharaPayment = {
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bendaharaName?: string | null;
  paymentInstructions?: string | null;
};

/**
 * Rekening bendahara untuk WA ranting: profil cabang jika nomor terisi,
 * else fallback Mandiri bendahara (sama LATBER_PAYMENT). Tanpa instruksi Latber.
 */
export function resolveUktWaBendaharaPayment(
  profile?: {
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
    bendaharaCabangName?: string | null;
    bendaharaName?: string | null;
    paymentInstructions?: string | null;
  } | null,
): UktWaBendaharaPayment {
  const fromProfile = profile?.bankAccountNumber?.trim() || "";
  if (fromProfile) {
    return {
      bankName: profile?.bankName?.trim() || "",
      bankAccountNumber: fromProfile,
      bankAccountName: profile?.bankAccountName?.trim() || "",
      bendaharaName:
        profile?.bendaharaCabangName?.trim() ||
        profile?.bendaharaName?.trim() ||
        "",
      paymentInstructions: profile?.paymentInstructions?.trim() || "",
    };
  }
  return {
    bankName: LATBER_PAYMENT.bankName,
    bankAccountNumber: LATBER_PAYMENT.bankAccountNumber,
    bankAccountName: LATBER_PAYMENT.bankAccountName,
    bendaharaName: LATBER_PAYMENT.bankAccountName,
    paymentInstructions: "",
  };
}

/** Baris rekening bendahara cabang untuk Laporan WA ranting (kosong jika tanpa nomor). */
export function formatUktWaBendaharaPaymentLines(
  payment?: UktWaBendaharaPayment | null,
): string[] {
  const number = payment?.bankAccountNumber?.trim() || "";
  if (!number) return [];
  const bank = payment?.bankName?.trim() || "";
  const accountName =
    payment?.bankAccountName?.trim() ||
    payment?.bendaharaName?.trim() ||
    "";
  const instructions = payment?.paymentInstructions?.trim() || "";
  const lines = ["*Pembayaran ke rekening Bendahara Cabang*"];
  if (bank) lines.push(`Bank ${bank}`);
  lines.push(accountName ? `${number} a.n. ${accountName}` : number);
  if (instructions) lines.push(instructions);
  return lines;
}

/** Urut roster WA ranting: Kyu 10→1, Dan 1→10, lalu nama. */
export function sortUktWaRosterByKyu(rows: UktMemberRow[]): UktMemberRow[] {
  return [...rows].sort((a, b) => {
    const byRank = compareWaRankBuckets(
      waRankBucketLabel(a),
      waRankBucketLabel(b),
    );
    if (byRank !== 0) return byRank;
    return (a.fullName || "").localeCompare(b.fullName || "", "id");
  });
}

/** Laporan WA satu ranting: roster penuh + rincian sabuk/A dari snapshot Kyu Lama. */
export function buildUktRantingWaReportText(
  periodTitle: string,
  dojoName: string,
  rosterRows: UktMemberRow[],
  beltFees: Record<BeltFeeKey, number>,
  komisiRanting: number,
  examMeta?: UktWaExamMeta,
  payment?: UktWaBendaharaPayment | null,
): string {
  const sortedRoster = sortUktWaRosterByKyu(rosterRows);
  const participantLines = sortedRoster.map((r, i) =>
    formatWaParticipantLine(r, i),
  );
  const participantCount = sortedRoster.length;
  const { lines, subtotalA } = buildNotaBeltLines(sortedRoster, beltFees);
  const unpaidRosterCount = sortedRoster.filter(
    (r) => !isUktBillingPaid(r),
  ).length;
  const subtotalB = 0;
  const totalC = participantCount * komisiRanting;
  const grandTotal = subtotalA + subtotalB - totalC;

  const paidRows = sortedRoster.filter((r) => isUktBillingPaid(r));
  const unpaidRows = sortedRoster.filter((r) => !isUktBillingPaid(r));
  const paidNet = uktWaNetOfNotaRows(paidRows, beltFees, komisiRanting);
  const unpaidNet = uktWaNetOfNotaRows(unpaidRows, beltFees, komisiRanting);

  const beltLines = lines.map((l) => {
    const label = l.belt === "LAINNYA" ? "LAINNYA" : l.belt;
    return `${label}: ${l.count} × ${formatRupiahNota(l.unitFee)} = ${formatRupiahNota(l.subtotal)}`;
  });

  const resolvedPayment = resolveUktWaBendaharaPayment(payment);
  const out = [
    ...buildUktWaExamHeader(periodTitle, examMeta),
    "",
    `*Ranting/Dojo: ${dojoName}*`,
    "",
    "*Peserta yang terdaftar*",
    ...participantLines,
    "",
    "*Rincian pembayaran*",
    ...beltLines,
  ];
  if (unpaidRosterCount > 0) {
    out.push("", `_Termasuk ${unpaidRosterCount} Belum Bayar_`);
  }
  out.push(
    "",
    `*A.* Subtotal A (Biaya UKT): _${formatRupiahNota(subtotalA)}_`,
    `*B.* Subtotal B (Buku Rusak/Hilang): _${formatRupiahNota(subtotalB)}_`,
    `*C.* Komisi Ranting (${participantCount} × ${formatRupiahNota(komisiRanting)}): - ${formatRupiahNota(totalC)}`,
    "",
    `*TOTAL (A+B−C): ${formatRupiahNota(grandTotal)}*`,
    formatUktWaMoneyPaidLine(paidNet, unpaidNet, { sudahLunasLabel: true }),
  );
  const paymentLines = formatUktWaBendaharaPaymentLines(resolvedPayment);
  if (paymentLines.length > 0) {
    out.push("", ...paymentLines);
  }
  return out.join("\n");
}

/**
 * Laporan WA admin cabang: ringkasan jumlah per ranting + sebaran kyu + Jumlah UKT.
 */
export function buildUktCabangWaReportText(
  periodTitle: string,
  rosterRows: UktMemberRow[],
  beltFees: Record<BeltFeeKey, number>,
  komisiRanting: number,
  examMeta?: UktWaExamMeta,
): string {
  const byDojo = new Map<
    string,
    { dojoName: string; count: number; paid: number }
  >();
  const byRank = new Map<string, number>();
  let paidAll = 0;

  for (const row of rosterRows) {
    const key = row.dojoId || row.dojoName || "unknown";
    const existing = byDojo.get(key);
    const paid = isUktBillingPaid(row);
    if (paid) paidAll++;
    if (existing) {
      existing.count++;
      if (paid) existing.paid++;
    } else {
      byDojo.set(key, {
        dojoName: row.dojoName?.trim() || "TANPA RANTING",
        count: 1,
        paid: paid ? 1 : 0,
      });
    }
    const rank = waRankBucketLabel(row);
    byRank.set(rank, (byRank.get(rank) ?? 0) + 1);
  }

  const rantingList = [...byDojo.values()].sort((a, b) =>
    a.dojoName.localeCompare(b.dojoName, "id"),
  );
  const rankList = [...byRank.entries()].sort(([a], [b]) =>
    compareWaRankBuckets(a, b),
  );

  const rantingLines = rantingList.map(
    (g, i) =>
      `${i + 1}. ${g.dojoName} = _${g.count} peserta_${formatUktWaCountPaidSuffix(g.count, g.paid)}`,
  );
  const rankLines = rankList.map(
    ([label, count]) => `${label} = _${count} peserta_`,
  );
  const unpaidAll = rosterRows.length - paidAll;

  const paidRows = rosterRows.filter((r) => isUktBillingPaid(r));
  const unpaidRows = rosterRows.filter((r) => !isUktBillingPaid(r));
  const paidNet = uktWaNetOfNotaRows(paidRows, beltFees, komisiRanting);
  const unpaidNet = uktWaNetOfNotaRows(unpaidRows, beltFees, komisiRanting);
  const jumlahUkt = paidNet + unpaidNet;

  const countPaidLine =
    unpaidAll === 0 && rosterRows.length > 0
      ? "_Lunas_"
      : `_(Lunas: ${paidAll} · Belum lunas: ${unpaidAll})_`;

  return [
    ...buildUktWaExamHeader(periodTitle, examMeta, [
      `*Jumlah UKT: ${formatRupiahNota(jumlahUkt)}*`,
      formatUktWaMoneyPaidLine(paidNet, unpaidNet),
    ]),
    "",
    `*TOTAL SEMUA: ${rosterRows.length} peserta*`,
    countPaidLine,
    "",
    `*${rantingList.length} Ranting*`,
    ...rantingLines,
    "",
    "*Jumlah*",
    ...rankLines,
  ].join("\n");
}

/** Selesai = lunas + lulus ujian + Kyu Baru diisi cabang. */
export function isUktSelesai(row: UktMemberRow): boolean {
  return (
    isUktBillingPaid(row) &&
    row.examResult === "LULUS" &&
    Boolean(row.kyuBaru?.trim())
  );
}

export function isUktBillingUnpaid(row: UktMemberRow): boolean {
  if (!row.registrationId) return false;
  if (row.billingStatus === "PAID" || row.status === "PAID" || row.status === "SUCCESS") {
    return false;
  }
  return true;
}

/**
 * Baris Laporan WA rincian setor (bukan Cetak Nota):
 * Menunggu Verifikasi atau sudah lunas — bukan Belum Bayar.
 * Cetak Nota memakai `isUktNotaRow`.
 */
export function isUktPaymentDocumentRow(row: UktMemberRow): boolean {
  if (!row.registrationId) return false;
  const st = String(row.status ?? "").toUpperCase();
  if (st === "REJECTED" || st === "BELUM_DAFTAR" || st === "CANCELLED") {
    return false;
  }
  if (row.billingStatus === "WAITING_VERIFICATION") return true;
  return isUktBillingPaid(row);
}

/**
 * Baris Cetak Nota: semua peserta terdaftar yang punya tagihan
 * (Belum Bayar / Menunggu Verifikasi / Lunas). Bukan Belum Daftar,
 * Ditolak, Batal, atau daftar mandiri PENDING tanpa tagihan.
 */
export function isUktNotaRow(row: UktMemberRow): boolean {
  if (!row.registrationId) return false;
  const st = String(row.status ?? "").toUpperCase();
  if (st === "REJECTED" || st === "BELUM_DAFTAR" || st === "CANCELLED") {
    return false;
  }
  // Daftar mandiri PENDING tanpa tagihan: belum diterima ranting
  if (
    isUktSelfRegistrationPendingStatus(row.status) &&
    (row.selfRegistration === true || !row.billingId)
  ) {
    return false;
  }
  if (!row.billingId && row.billingAmount == null) return false;
  const bs = String(row.billingStatus ?? "").toUpperCase();
  if (bs === "PENDING" || bs === "WAITING_VERIFICATION") return true;
  if (isUktBillingPaid(row)) return true;
  // Tagihan ada tapi status belum jelas — tetap masuk bila ada nominal
  return row.billingAmount != null || Boolean(row.billingId);
}

/** Ranting boleh ajukan Bayar UKT (Menunggu Verifikasi) — belum lunas & belum diajukan. */
export function canRantingSubmitUktPayment(row: UktMemberRow): boolean {
  if (!isUktBillingUnpaid(row)) return false;
  // Daftar mandiri PENDING: pakai Terima, bukan Bayar UKT
  if (
    isUktSelfRegistrationPendingStatus(row.status) &&
    (row.selfRegistration === true || !row.billingId)
  ) {
    return false;
  }
  if (!row.billingId) return false;
  return row.billingStatus !== "WAITING_VERIFICATION";
}

/**
 * Cabang boleh Verifikasi pembayaran UKT — bukan daftar mandiri PENDING
 * (harus lewat Terima ranting dulu).
 */
export function canCabangVerifyUktPayment(row: UktMemberRow): boolean {
  if (!isUktBillingUnpaid(row)) return false;
  if (
    isUktSelfRegistrationPendingStatus(row.status) &&
    (row.selfRegistration === true || !row.billingId)
  ) {
    return false;
  }
  return Boolean(row.billingId);
}

export function participantAmount(
  billingAmount: number | null,
  billingStatus: string | null,
  categoryFee: number | null,
): number {
  if (billingAmount != null && billingStatus) {
    if (billingStatus === "PAID" || billingStatus === "PENDING" || billingStatus === "WAITING_VERIFICATION") {
      return uktBaseFeeAmount(billingAmount) ?? billingAmount;
    }
  }
  return categoryFee ?? 0;
}

export type UktKpiStats = {
  allMembers: number;
  total: number;
  belumDaftar: number;
  disetujui: number;
  pending: number;
  ditolak: number;
  totalTagihan: number;
  totalTerbayar: number;
};

export function computeUktKpiStats(rows: UktMemberRow[]): UktKpiStats {
  const registered = rows.filter((r) => r.registrationId);
  let totalTagihan = 0;
  let totalTerbayar = 0;
  registered.forEach((r) => {
    const amt = participantAmount(r.billingAmount, r.billingStatus, null);
    totalTagihan += amt;
    if (r.billingStatus === "PAID" || r.status === "PAID") totalTerbayar += amt;
  });
  return {
    allMembers: rows.length,
    total: registered.length,
    belumDaftar: rows.filter((r) => !r.registrationId).length,
    disetujui: registered.filter((r) => isRegistrationApproved(r.status)).length,
    pending: registered.filter(
      (r) =>
        r.billingStatus === "PENDING" ||
        r.billingStatus === "WAITING_VERIFICATION",
    ).length,
    ditolak: registered.filter((r) => r.status === "REJECTED").length,
    totalTagihan,
    totalTerbayar,
  };
}

export function filterUktRowsByView(rows: UktMemberRow[], viewFilter: string): UktMemberRow[] {
  if (viewFilter === "registered") return rows.filter((r) => r.registrationId);
  if (viewFilter === "unregistered") return rows.filter((r) => !r.registrationId);
  if (viewFilter === "approved") return rows.filter((r) => isRegistrationApproved(r.status));
  if (viewFilter === "pending") {
    return rows.filter(
      (r) =>
        r.billingStatus === "PENDING" ||
        r.billingStatus === "WAITING_VERIFICATION",
    );
  }
  if (viewFilter === "rejected") return rows.filter((r) => r.status === "REJECTED");
  if (viewFilter === "paid") return rows.filter((r) => r.billingStatus === "PAID" || r.status === "PAID");
  const displayStatuses: UktDisplayStatus[] = [
    "belum_daftar",
    "terdaftar",
    "belum_bayar",
    "menunggu_terima_ranting",
    "menunggu_konfirmasi_ranting",
    "menunggu_verifikasi",
    "lunas",
    "menunggu_ujian",
    "lulus",
    "gagal",
    "mengulang",
    "selesai",
    "ditolak",
  ];
  if (displayStatuses.includes(viewFilter as UktDisplayStatus)) {
    return filterUktRowsByDisplayStatus(rows, viewFilter);
  }
  return rows;
}

export const UKT_DISPLAY_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Semua status" },
  { value: "belum_daftar", label: "Belum Daftar" },
  { value: "menunggu_terima_ranting", label: "Menunggu Terima Ranting" },
  { value: "menunggu_konfirmasi_ranting", label: "Menunggu Konfirmasi Ranting" },
  { value: "belum_bayar", label: "Belum Bayar" },
  { value: "menunggu_verifikasi", label: "Menunggu Verifikasi" },
  { value: "menunggu_ujian", label: "Menunggu Ujian" },
  { value: "lulus", label: "Lulus Ujian" },
  { value: "selesai", label: "Selesai" },
  { value: "gagal", label: "Tidak Lulus" },
  { value: "mengulang", label: "Mengulang" },
  { value: "ditolak", label: "Ditolak" },
];

export function filterUktRowsByDisplayStatus(
  rows: UktMemberRow[],
  status: string,
): UktMemberRow[] {
  if (!status || status === "all") return rows;
  if (status === "menunggu_terima_ranting") {
    return rows.filter((r) => {
      const s = resolveUktDisplayStatus(r);
      return (
        s === "menunggu_terima_ranting" || s === "menunggu_konfirmasi_ranting"
      );
    });
  }
  if (status === "gagal_mengulang") {
    return rows.filter((r) => {
      const s = resolveUktDisplayStatus(r);
      return s === "gagal" || s === "mengulang";
    });
  }
  return rows.filter((r) => resolveUktDisplayStatus(r) === status);
}

export type UktOperationalKpi = UktKpiStats & {
  menungguTerima: number;
  belumBayar: number;
  menungguVerifikasi: number;
  menungguUjian: number;
  lulus: number;
  selesai: number;
  gagal: number;
  mengulang: number;
};

export function computeUktOperationalKpi(rows: UktMemberRow[]): UktOperationalKpi {
  const base = computeUktKpiStats(rows);
  const tagged = rows.map((r) => resolveUktDisplayStatus(r));
  return {
    ...base,
    menungguTerima: tagged.filter(
      (s) =>
        s === "menunggu_terima_ranting" || s === "menunggu_konfirmasi_ranting",
    ).length,
    belumBayar: tagged.filter((s) => s === "belum_bayar").length,
    menungguVerifikasi: tagged.filter((s) => s === "menunggu_verifikasi").length,
    menungguUjian: tagged.filter((s) => s === "menunggu_ujian").length,
    lulus: tagged.filter((s) => s === "lulus").length,
    selesai: tagged.filter((s) => s === "selesai").length,
    gagal: tagged.filter((s) => s === "gagal").length,
    mengulang: tagged.filter((s) => s === "mengulang").length,
  };
}

export type UktRegistrationWaiver = {
  blockers: UktRegistrationBlocker[];
  note: string;
  at: string;
  by: string;
};

export function uktRegistrationWaiverKey(periodId: string, memberId: string): string {
  return `ukt-registration-waiver:${periodId}:${memberId}`;
}

export function parseUktWaiverValue(value: unknown): UktRegistrationWaiver | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { blockers?: unknown; note?: string; at?: string; by?: string };
  const blockers = Array.isArray(raw.blockers)
    ? raw.blockers.filter((b): b is UktRegistrationBlocker =>
        b === "PERIODE_TUTUP" ||
        b === "PERIODE_BELUM_BUKA" ||
        b === "IURAN_TUNGGAKAN" ||
        b === "DOKUMEN_KURANG" ||
        b === "ABSENSI_KURANG",
      )
    : [];
  if (blockers.length === 0 || !raw.note?.trim()) return null;
  return {
    blockers,
    note: raw.note.trim(),
    at: raw.at || "",
    by: raw.by || "",
  };
}

export function buildUktWaiverMap(
  settings: Array<{ key: string; value: unknown }>,
  periodId: string,
): Map<string, UktRegistrationWaiver> {
  const prefix = `ukt-registration-waiver:${periodId}:`;
  const map = new Map<string, UktRegistrationWaiver>();
  for (const s of settings) {
    if (!s.key.startsWith(prefix)) continue;
    const memberId = s.key.slice(prefix.length);
    const waiver = parseUktWaiverValue(s.value);
    if (waiver) map.set(memberId, waiver);
  }
  return map;
}

export function getUktRegistrationBlockersWithWaiver(
  row: Parameters<typeof getUktRegistrationBlockers>[0],
  opts: Parameters<typeof getUktRegistrationBlockers>[1],
  waiver?: UktRegistrationWaiver | null,
): UktRegistrationBlocker[] {
  const blockers = getUktRegistrationBlockers(row, opts);
  if (!waiver) return blockers;
  return blockers.filter((b) => !waiver.blockers.includes(b));
}

export function summarizeRowEligibility(
  row: Pick<
    UktMemberRow,
    | "outstandingDues"
    | "birthCertificateUrl"
    | "bpjsCardUrl"
    | "pendingVerifications"
    | "attendancePct"
    | "registrationWaiver"
  >,
  registrationOpen: boolean,
  registrationNotYetOpen = false,
  requirementOpts?: Pick<
    Parameters<typeof getUktRegistrationBlockers>[1],
    | "requireNoOutstandingDues"
    | "requireDocuments"
    | "requireMinAttendance"
    | "minAttendancePct"
  >,
): { ok: boolean; label: string } {
  const blockers = getUktRegistrationBlockersWithWaiver(
    row,
    {
      registrationOpen,
      registrationNotYetOpen,
      ...requirementOpts,
    },
    row.registrationWaiver,
  );
  if (blockers.length === 0) {
    return {
      ok: true,
      label: row.registrationWaiver ? "Disetujui cabang" : "Memenuhi syarat",
    };
  }
  return {
    ok: false,
    label: formatUktRegistrationBlockers(
      blockers,
      requirementOpts?.minAttendancePct ?? UKT_MIN_ATTENDANCE_PCT,
    ),
  };
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Angka Kyu/Dan saja untuk kolom daftar peserta (mis. "10", "5"). */
export function extractUktRankNumber(rankRaw: string | null | undefined): string {
  const r = (rankRaw || "").trim();
  if (!r || r === "—" || r === "-") return "";
  const kyu = r.match(/\bkyu\s*(\d+)\b/i);
  if (kyu) return kyu[1];
  const dan = r.match(/\bdan\s*(\d+)\b/i);
  if (dan) return dan[1];
  if (/^\d+$/.test(r)) return r;
  return "";
}

/** Angka Kyu lama untuk export PDF/CSV — dari sabuk keanggotaan / Kyu Lama, tanpa infer dari Kyu Baru. */
export function resolveUktExportKyuLamaNumber(
  kyuLama: string | null | undefined,
  _kyuBaru?: string | null | undefined,
  memberCurrentRank?: string | null,
): string {
  const fromMember = extractUktRankNumber(memberCurrentRank);
  if (fromMember) return fromMember;
  return extractUktRankNumber(kyuLama);
}

export function formatUktBirthPlaceDate(
  birthPlace: string | null | undefined,
  birthDate: string | null | undefined,
): string {
  const place = (birthPlace || "").trim().toUpperCase();
  let dateStr = "";
  if (birthDate) {
    const d = new Date(birthDate);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    } else {
      dateStr = birthDate.trim();
    }
  }
  if (place && dateStr) return `${place}, ${dateStr}`;
  return place || dateStr;
}

export type UktPesertaExportRow = {
  no: number;
  nia: string;
  nama: string;
  tempatTanggalLahir: string;
  jenisKelamin: string;
  alamat: string;
  kyu: string;
  kyuBaru: string;
  ranting: string;
};

export function buildUktPesertaExportRows(rows: UktMemberRow[]): UktPesertaExportRow[] {
  const sorted = [...rows]
    .filter((r) => r.registrationId)
    .sort((a, b) => {
      const byDojo = (a.dojoName || "").localeCompare(b.dojoName || "", "id");
      if (byDojo !== 0) return byDojo;
      return (a.fullName || "").localeCompare(b.fullName || "", "id");
    });

  return sorted.map((r, i) => {
    // KYU di PDF/CSV = sabuk keanggotaan; setelah selesai kunci snapshot Kyu Lama
    const kyuSource = isUktSelesai(r)
      ? r.kyuLama
      : r.memberCurrentRank || r.kyuLama;
    return {
      no: i + 1,
      nia: r.nia || "",
      nama: formatMemberName(r.fullName),
      tempatTanggalLahir: formatUktBirthPlaceDate(r.birthPlace, r.birthDate),
      jenisKelamin: formatGenderLabel(r.gender),
      alamat: (r.address || "").trim().toUpperCase(),
      kyu: extractUktRankNumber(kyuSource),
      kyuBaru: extractUktRankNumber(r.kyuBaru),
      ranting: (r.dojoName || "").trim().toUpperCase(),
    };
  });
}

export function buildUktPesertaTitle(semester: UktSemester, year: number): string {
  return `DAFTAR PESERTA UJIAN SEMESTER ${semester} TAHUN ${year}`;
}

/** CSV format daftar peserta ujian (kolom selaras formulir cabang). */
export function buildUktPesertaCsv(rows: UktMemberRow[]): string {
  const header = [
    "NO. URUT",
    "NO. INDUK ANGGOTA",
    "NAMA",
    "TEMPAT TANGGAL LAHIR",
    "JENIS KELAMIN",
    "ALAMAT",
    "KYU",
    "KYU BARU",
    "RANTING",
  ];
  const lines = buildUktPesertaExportRows(rows).map((r) =>
    [
      r.no,
      r.nia,
      r.nama,
      r.tempatTanggalLahir,
      r.jenisKelamin,
      r.alamat,
      r.kyu,
      r.kyuBaru,
      r.ranting,
    ]
      .map(csvEscape)
      .join(","),
  );
  return `\uFEFF${header.join(",")}\n${lines.join("\n")}`;
}

export function triggerCsvDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type UktHasilUjianSabukLabel =
  | "PUTIH"
  | "KUNING"
  | "HIJAU"
  | "BIRU"
  | "COKELAT"
  | "HITAM";

export const UKT_HASIL_UJIAN_SABUK_ORDER: UktHasilUjianSabukLabel[] = [
  "PUTIH",
  "KUNING",
  "HIJAU",
  "BIRU",
  "COKELAT",
  "HITAM",
];

/** Pejabat tetap di Lembar TTD Pengda — dipakai Excel + PDF/Print. */
export const UKT_HASIL_UJIAN_OFFICERS = {
  pengdaKetua: "SUYANTO KASDI, S.H.",
  pengdaKetuaTitle: "DAN 7 INKAI MSH NO. 2702",
  mshKetua: "S Y A H R U L L A H",
  mshKetuaTitle: "DAN 6 INKAI MSH NO. 245",
} as const;

export type UktHasilUjianRecapRow = {
  no: number;
  noRanting: number;
  nia: string;
  nama: string;
  tempatTanggalLahir: string;
  jenisKelamin: string;
  alamat: string;
  kyuLama: string;
  kyuBaru: string;
  sabuk: UktHasilUjianSabukLabel | "";
  ranting: string;
  dojoId: string;
};

const UKT_RECAP_MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function titleCaseId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/(^|[^\p{L}])(\p{L})/gu, (full, sep: string, ch: string) => {
      void full;
      return `${sep}${ch.toUpperCase()}`;
    });
}

function parseUktRecapDate(value: string): Date | null {
  const dayOnly = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dayOnly) {
    return new Date(
      Number(dayOnly[1]),
      Number(dayOnly[2]) - 1,
      Number(dayOnly[3]),
    );
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatUktRecapLongDate(d: Date): string {
  return `${d.getDate()} ${UKT_RECAP_MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

/** TTL format rekap Pengda: `Surabaya, 28 Februari 2011`. */
export function formatUktHasilUjianTtl(
  birthPlace: string | null | undefined,
  birthDate: string | null | undefined,
): string {
  const place = titleCaseId(birthPlace || "");
  let dateStr = "";
  if (birthDate) {
    const d = parseUktRecapDate(birthDate);
    dateStr = d ? formatUktRecapLongDate(d) : birthDate.trim();
  }
  if (place && dateStr) return `${place}, ${dateStr}`;
  return place || dateStr;
}

function isDanOrBlackRank(rankRaw: string | null | undefined): boolean {
  const r = (rankRaw || "").trim().toLowerCase();
  if (!r) return false;
  if (r.includes("hitam")) return true;
  return /\bdan\s*\d+\b/i.test(r);
}

/** Warna sabuk Kyu Baru untuk kolom SABUK rekap Pengda. */
export function sabukLabelFromKyuBaru(
  kyuBaru: string | null | undefined,
): UktHasilUjianSabukLabel | "" {
  if (isBlankUktRank(kyuBaru)) return "";
  if (isDanOrBlackRank(kyuBaru)) return "HITAM";
  const group = getBeltGroup(kyuBaru);
  if (group !== "LAINNYA") return group;
  const n = Number(extractUktRankNumber(kyuBaru));
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 9) return "PUTIH";
  if (n >= 7) return "KUNING";
  if (n === 6) return "HIJAU";
  if (n >= 4) return "BIRU";
  if (n >= 1) return "COKELAT";
  return "";
}

export function rowHasUktHasilUjianKyuBaru(row: UktMemberRow): boolean {
  return Boolean(row.registrationId) && !isBlankUktRank(row.kyuBaru);
}

export function hasUktHasilUjianRecap(rows: UktMemberRow[]): boolean {
  return rows.some(rowHasUktHasilUjianKyuBaru);
}

function niaNumericKey(nia: string): bigint {
  const digits = nia.replace(/\D/g, "");
  if (!digits) return BigInt(0);
  try {
    return BigInt(digits);
  } catch {
    return BigInt(0);
  }
}

/** NIA numerik tertinggi di baris rekap (bukan baris terakhir tabel). */
export function resolveUktHasilUjianLastNia(
  rows: Array<{ nia?: string | null }>,
): string {
  let best = "";
  let bestKey = BigInt(0);
  for (const row of rows) {
    const nia = (row.nia || "").trim();
    if (!nia) continue;
    const key = niaNumericKey(nia);
    if (key > bestKey) {
      bestKey = key;
      best = nia;
    }
  }
  return best;
}

function kyuLamaSortNumber(kyuLama: string): number {
  const n = Number(extractUktRankNumber(kyuLama));
  return Number.isFinite(n) && n > 0 ? n : -1;
}

/**
 * Rekap hasil ujian Pengda: peserta terdaftar yang sudah punya Kyu Baru.
 * Kyu Lama selalu dari snapshot pendaftaran (bukan currentRank).
 */
export function buildUktHasilUjianRecapRows(
  rows: UktMemberRow[],
): UktHasilUjianRecapRow[] {
  const eligible = rows.filter(rowHasUktHasilUjianKyuBaru).sort((a, b) => {
    const byDojo = (a.dojoName || "").localeCompare(b.dojoName || "", "id");
    if (byDojo !== 0) return byDojo;
    const byKyu = kyuLamaSortNumber(b.kyuLama) - kyuLamaSortNumber(a.kyuLama);
    if (byKyu !== 0) return byKyu;
    return (a.fullName || "").localeCompare(b.fullName || "", "id");
  });

  const rantingCounter = new Map<string, number>();
  return eligible.map((r, i) => {
    const rantingKey = r.dojoId || r.dojoName || "";
    const noRanting = (rantingCounter.get(rantingKey) ?? 0) + 1;
    rantingCounter.set(rantingKey, noRanting);
    return {
      no: i + 1,
      noRanting,
      nia: (r.nia || "").trim(),
      nama: formatMemberName(r.fullName),
      tempatTanggalLahir: formatUktHasilUjianTtl(r.birthPlace, r.birthDate),
      jenisKelamin: formatGenderLabel(r.gender),
      alamat: (r.address || "").trim(),
      kyuLama: extractUktRankNumber(r.kyuLama),
      kyuBaru: extractUktRankNumber(r.kyuBaru),
      sabuk: sabukLabelFromKyuBaru(r.kyuBaru),
      ranting: (r.dojoName || "").trim().toUpperCase(),
      dojoId: r.dojoId || "",
    };
  });
}

export function countUktHasilUjianSabuk(
  recapRows: UktHasilUjianRecapRow[],
): Record<UktHasilUjianSabukLabel, number> {
  const counts: Record<UktHasilUjianSabukLabel, number> = {
    PUTIH: 0,
    KUNING: 0,
    HIJAU: 0,
    BIRU: 0,
    COKELAT: 0,
    HITAM: 0,
  };
  for (const row of recapRows) {
    if (row.sabuk) counts[row.sabuk] += 1;
  }
  return counts;
}

export function countUktHasilUjianRanting(
  recapRows: UktHasilUjianRecapRow[],
): number {
  const ids = new Set(
    recapRows.map((r) => r.dojoId || r.ranting).filter(Boolean),
  );
  return ids.size;
}

export function formatUktExamDateLong(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = parseUktRecapDate(iso);
  return d ? formatUktRecapLongDate(d) : "";
}

export function buildUktHasilUjianFilename(
  semester: UktSemester,
  year: number,
  examAt?: string | null,
  ext: "xlsx" | "pdf" = "xlsx",
): string {
  const exam = formatUktExamDateLong(examAt);
  const examSlug = exam ? `_${exam.replace(/\s+/g, "-")}` : "";
  return `SURABAYA_UKT_S${semester}_${year}${examSlug}.${ext}`;
}

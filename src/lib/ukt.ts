import { formatMemberName, formatRankLabel, formatGenderLabel, getBeltGroup, shortRankLabel } from "@/lib/belt";

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
    if (!urlPeriod) return matchByTerm?.id ?? null;
    if (!uktPeriodBelongsToTerm(urlPeriod, semester, year)) {
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
  return matchByTerm?.id ?? null;
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

export function resolveNotaBeltGroup(
  row: UktMemberRow,
  beltFees: Record<BeltFeeKey, number>,
): BeltFeeKey | null {
  if (row.kyuBaru) {
    const fromBaru = getBeltGroup(row.kyuBaru);
    if (fromBaru !== "LAINNYA") return fromBaru as BeltFeeKey;
    const fromBaruKyu = beltGroupFromKyuText(row.kyuBaru);
    if (fromBaruKyu) return fromBaruKyu;
  }

  const fromBilling = beltGroupFromBilling(row.billingAmount, beltFees);
  if (fromBilling) return fromBilling;

  const fromLama = getBeltGroup(row.kyuLama);
  if (fromLama !== "LAINNYA") return fromLama as BeltFeeKey;

  return beltGroupFromKyuText(row.kyuLama);
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

export const APPROVED_STATUSES = new Set(["APPROVED", "SUCCESS", "PAID", "PENDING"]);

export function isRegistrationApproved(status: string): boolean {
  return APPROVED_STATUSES.has(status);
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
  registrationWaiver?: UktRegistrationWaiver | null;
};

/** Item snapshot refresh cepat — hanya field pendaftaran/tagihan periode. */
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
};

/**
 * Gabungkan snapshot registrasi ke pool anggota yang sudah ada di UI.
 * Anggota yang hilang dari snapshot → Belum Daftar (tanpa refetch pool).
 */
export function applyUktRegistrationSnapshotToRows(
  rows: UktMemberRow[],
  participants: UktRegistrationSnapshotItem[],
): UktMemberRow[] {
  const byMember = new Map(participants.map((p) => [p.memberId, p]));
  return rows.map((r) => {
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
    };
  });
}

/** Minimum kehadiran latihan per semester agar boleh daftar UKT (48 sesi = 100%). */
export const UKT_MIN_ATTENDANCE_PCT = 75;
export const UKT_SEMESTER_SESSION_TOTAL = 48;

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
  /** Jadwal & tempat ujian (bukan batas daftar). */
  examAt?: string;
  examLocation?: string;
  /** Pejabat dokumen untuk periode ini (fallback ke kebijakan cabang). */
  bidangUjianName?: string;
  bendaharaCabangName?: string;
  /** Idempotensi notifikasi jadwal. */
  notifiedOpenAt?: string;
  notifiedCloseReminderAt?: string;
  notifiedExtendedAt?: string;
};

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

/** Rekonsiliasi setoran: total tagihan peserta terdaftar vs status setor ranting. */
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
): UktDepositReconRow[] {
  const byDojo = new Map<
    string,
    { name: string; participantCount: number; paidCount: number; expectedAmount: number }
  >();

  for (const d of dojos) {
    byDojo.set(d.id, {
      name: d.name,
      participantCount: 0,
      paidCount: 0,
      expectedAmount: 0,
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
        expectedAmount: 0,
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
      bucket.expectedAmount += amt;
    }
  }

  const result: UktDepositReconRow[] = [];
  for (const [dojoId, b] of byDojo) {
    if (b.participantCount === 0) continue;
    const depositStatus: UktDepositStatus = depositMap[dojoId]?.status ?? "PENDING";
    let gapLabel = "Belum setor";
    if (depositStatus === "SUBMITTED") gapLabel = "Menunggu konfirmasi cabang";
    if (depositStatus === "RECEIVED") gapLabel = "Lunas ke cabang";
    if (b.paidCount === 0) gapLabel = "Belum ada pembayaran peserta";
    result.push({
      dojoId,
      dojoName: b.name,
      participantCount: b.participantCount,
      paidCount: b.paidCount,
      expectedAmount: b.expectedAmount,
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
    examAt: typeof v.examAt === "string" ? v.examAt : undefined,
    examLocation: typeof v.examLocation === "string" ? v.examLocation : undefined,
    bidangUjianName:
      typeof v.bidangUjianName === "string" ? v.bidangUjianName : undefined,
    bendaharaCabangName:
      typeof v.bendaharaCabangName === "string" ? v.bendaharaCabangName : undefined,
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
  const countByMember = new Map<string, number>();

  for (const row of attendances) {
    const memberId = row.memberId?.trim();
    if (!memberId) continue;
    const t = new Date(row.checkInAt).getTime();
    if (Number.isNaN(t) || t < startMs || t > endMs) continue;
    countByMember.set(memberId, (countByMember.get(memberId) ?? 0) + 1);
  }

  const pctByMember = new Map<string, number>();
  for (const [memberId, count] of countByMember) {
    const pct = Math.min(
      100,
      Math.round((count / UKT_SEMESTER_SESSION_TOTAL) * 1000) / 10,
    );
    pctByMember.set(memberId, pct);
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

export function resolveUktDisplayStatus(
  row: UktMemberRow,
  examResult: UktExamResult | null = row.examResult,
): UktDisplayStatus {
  if (!row.registrationId || row.status === "BELUM_DAFTAR") return "belum_daftar";
  if (row.status === "REJECTED") return "ditolak";
  if (examResult === "GAGAL") return "gagal";
  if (examResult === "MENGULANG") return "mengulang";
  if (isUktSelesai(row)) return "selesai";

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
  examResult: UktExamResult | null = row.examResult,
): boolean {
  return isUktBillingPaid(row) && examResult === "LULUS";
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
  const rk = formatRankLabel(row.kyuBaru || row.kyuLama);
  return `${index + 1}. ${formatMemberName(row.fullName)}${rk ? ` ${rk}` : ""}`;
}

function sumWaParticipantAmount(rows: UktMemberRow[]): number {
  return rows.reduce(
    (sum, r) => sum + participantAmount(r.billingAmount, r.billingStatus, null),
    0,
  );
}

function waRankBucketLabel(row: UktMemberRow): string {
  const raw = (row.kyuBaru || row.kyuLama || "").trim();
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

/** Laporan WA satu ranting (peserta + total pembayaran). */
export function buildUktRantingWaReportText(
  periodTitle: string,
  dojoName: string,
  approvedRows: UktMemberRow[],
): string {
  const lines = approvedRows.map((r, i) => formatWaParticipantLine(r, i));
  const total = sumWaParticipantAmount(approvedRows);
  return [
    periodTitle,
    `Ranting/Dojo: ${dojoName}`,
    "",
    "Peserta yang terdaftar",
    ...lines,
    "",
    `Total pembayaran Rp ${new Intl.NumberFormat("id-ID").format(total)}`,
  ].join("\n");
}

/**
 * Laporan WA admin cabang: ringkasan jumlah per ranting + sebaran kyu.
 */
export function buildUktCabangWaReportText(
  periodTitle: string,
  approvedRows: UktMemberRow[],
): string {
  const byDojo = new Map<string, { dojoName: string; count: number }>();
  const byRank = new Map<string, number>();

  for (const row of approvedRows) {
    const key = row.dojoId || row.dojoName || "unknown";
    const existing = byDojo.get(key);
    if (existing) {
      existing.count++;
    } else {
      byDojo.set(key, {
        dojoName: row.dojoName?.trim() || "Ranting",
        count: 1,
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
    (g, i) => `${i + 1}. ${g.dojoName} = ${g.count} peserta`,
  );
  const rankLines = rankList.map(
    ([label, count]) => `${label} = ${count} peserta`,
  );

  return [
    periodTitle,
    "",
    `Total Ranting : ${rantingList.length}`,
    "",
    "List Ranting",
    ...rantingLines,
    "",
    "Jumlah",
    ...rankLines,
    "",
    `TOTAL SEMUA: ${approvedRows.length} peserta`,
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

/** Ranting boleh ajukan Bayar UKT (Menunggu Verifikasi) — belum lunas & belum diajukan. */
export function canRantingSubmitUktPayment(row: UktMemberRow): boolean {
  if (!isUktBillingUnpaid(row)) return false;
  return row.billingStatus !== "WAITING_VERIFICATION";
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
  return rows.filter((r) => resolveUktDisplayStatus(r) === status);
}

export type UktOperationalKpi = UktKpiStats & {
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
  const kyu = r.match(/kyu\s*(\d+)/i);
  if (kyu) return kyu[1];
  const dan = r.match(/dan\s*(\d+)/i);
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

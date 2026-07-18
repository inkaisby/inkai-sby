import { getBeltGroup } from "@/lib/belt";

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
 */
export function buildUktEventDates(semester: UktSemester, year: number) {
  const { semesterEnd } = buildUktSemesterWindow(semester, year);
  return {
    startDate: semesterEnd,
    endDate: semesterEnd,
    registrationCloseAt: semesterEnd,
  };
}

export type UktPeriodSchedule = {
  startDate: string;
  endDate: string;
  registrationCloseAt?: string | null;
};

export function getUktRegistrationDeadline(period: UktPeriodSchedule): Date {
  if (period.registrationCloseAt) {
    return new Date(period.registrationCloseAt);
  }
  return new Date(period.startDate);
}

export function isUktRegistrationOpen(period: UktPeriodSchedule): boolean {
  return Date.now() <= getUktRegistrationDeadline(period).getTime();
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

export type UktPeriodOption = { id: string; title: string; startDate?: string };

/** Cari event UKT yang cocok dengan semester + tahun (judul standar, parse judul, atau rentang tanggal). */
export function findUktPeriodForTerm(
  periods: UktPeriodOption[],
  semester: UktSemester,
  year: number,
): UktPeriodOption | null {
  const expectedTitle = buildUktEventTitle(semester, year).toLowerCase();
  const byTitle = periods.find((p) => p.title.toLowerCase() === expectedTitle);
  if (byTitle) return byTitle;
  const byParsed =
    periods.find((p) => {
      const parsed = parseUktEventTitle(p.title);
      return parsed?.semester === semester && parsed?.year === year;
    }) ?? null;
  if (byParsed) return byParsed;

  const { semesterStart, semesterEnd } = buildUktSemesterWindow(semester, year);
  const startMs = semesterStart.getTime();
  const endMs = semesterEnd.getTime();
  return (
    periods.find((p) => {
      if (!p.startDate) return false;
      const t = new Date(p.startDate).getTime();
      return Number.isFinite(t) && t >= startMs && t <= endMs;
    }) ?? null
  );
}

/**
 * Pilih periode aktif: URL `period` dipakai kecuali judulnya jelas milik semester/tahun lain.
 * Judul tanpa pola semester (atau belum di-parse) tetap dihormati agar kontrol batas pendaftaran tidak hilang.
 */
export function resolveUktSelectedPeriodId(
  periods: UktPeriodOption[],
  semester: UktSemester,
  year: number,
  periodFromUrl: string | null | undefined,
): string | null {
  const matchByTerm = findUktPeriodForTerm(periods, semester, year);
  if (periodFromUrl) {
    const urlPeriod = periods.find((p) => p.id === periodFromUrl);
    if (!urlPeriod) return matchByTerm?.id ?? null;
    const parsed = parseUktEventTitle(urlPeriod.title);
    if (parsed && (parsed.semester !== semester || parsed.year !== year)) {
      return matchByTerm?.id ?? null;
    }
    return periodFromUrl;
  }
  return matchByTerm?.id ?? null;
}

export function buildUktAdminUrl(
  semester: UktSemester,
  year: number,
  periodId: string | null,
): string {
  const qs = new URLSearchParams({ semester, year: String(year) });
  if (periodId) qs.set("period", periodId);
  return `/admin/ukt?${qs.toString()}`;
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

const BELT_FEE_LABELS: Record<BeltFeeKey, string> = {
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
 * UKT tidak memakai kode unik (+1..999). Billing dari API bisa masih
 * menyimpan amount = baseFee + uniqueTail; tampilan/nota pakai base saja.
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
  return n - (n % 1000);
}

export function beltFeesFromTemplates(
  templates: { rankName: string; fee: number }[],
): Record<BeltFeeKey, number> {
  const fees = { ...DEFAULT_BELT_FEES };
  for (const key of BELT_FEE_KEYS) {
    const label = BELT_FEE_LABELS[key].toLowerCase();
    const match = templates.find((t) => t.rankName.trim().toLowerCase().includes(label));
    if (match) fees[key] = Math.round(match.fee);
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
  registrationWaiver?: UktRegistrationWaiver | null;
};

/** Minimum kehadiran latihan per semester agar boleh daftar UKT (48 sesi = 100%). */
export const UKT_MIN_ATTENDANCE_PCT = 75;
export const UKT_SEMESTER_SESSION_TOTAL = 48;

export type UktRegistrationBlocker =
  | "PERIODE_TUTUP"
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
    enforceAttendance?: boolean;
  },
): UktRegistrationBlocker[] {
  const blockers: UktRegistrationBlocker[] = [];
  if (!opts.registrationOpen) blockers.push("PERIODE_TUTUP");
  if (row.outstandingDues > 0) blockers.push("IURAN_TUNGGAKAN");
  if (!hasRequiredUktDocuments(row)) blockers.push("DOKUMEN_KURANG");
  if (
    opts.enforceAttendance !== false &&
    row.attendancePct != null &&
    row.attendancePct < UKT_MIN_ATTENDANCE_PCT
  ) {
    blockers.push("ABSENSI_KURANG");
  }
  return blockers;
}

export function formatUktRegistrationBlockers(blockers: UktRegistrationBlocker[]): string {
  const labels: Record<UktRegistrationBlocker, string> = {
    PERIODE_TUTUP: "Batas pendaftaran sudah lewat",
    IURAN_TUNGGAKAN: "Masih ada iuran belum lunas",
    DOKUMEN_KURANG: "Akte kelahiran & BPJS belum lengkap",
    ABSENSI_KURANG: `Kehadiran semester di bawah ${UKT_MIN_ATTENDANCE_PCT}%`,
  };
  return blockers.map((b) => labels[b]).join("; ");
}

export function isUktRegistrationAllowed(
  row: Parameters<typeof getUktRegistrationBlockers>[0],
  opts: Parameters<typeof getUktRegistrationBlockers>[1],
): boolean {
  return getUktRegistrationBlockers(row, opts).length === 0;
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

  const paid =
    row.billingStatus === "PAID" || row.status === "PAID" || row.status === "SUCCESS";

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
  const paid =
    row.billingStatus === "PAID" || row.status === "PAID" || row.status === "SUCCESS";
  return paid && examResult === "LULUS";
}

/**
 * Hasil ujian efektif untuk UI: jika sudah Selesai (lunas + Kyu Baru),
 * tampilkan LULUS meski setting hasil ujian belum ter-load / kosong.
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
  if (isUktSelesai(row)) return "LULUS";
  return null;
}

export type UktDojoRecap = {
  dojoId: string;
  dojoName: string;
  totalMembers: number;
  registered: number;
  paid: number;
  unpaid: number;
  selesai: number;
  totalTagihan: number;
  totalTerbayar: number;
};

export function buildUktDojoRecaps(
  rows: UktMemberRow[],
  dojos: Array<{ id: string; name: string }>,
): UktDojoRecap[] {
  const byDojo = new Map<string, UktDojoRecap>();
  for (const d of dojos) {
    byDojo.set(d.id, {
      dojoId: d.id,
      dojoName: d.name,
      totalMembers: 0,
      registered: 0,
      paid: 0,
      unpaid: 0,
      selesai: 0,
      totalTagihan: 0,
      totalTerbayar: 0,
    });
  }

  for (const row of rows) {
    const recap = byDojo.get(row.dojoId);
    if (!recap) continue;
    recap.totalMembers++;
    if (!row.registrationId) continue;
    recap.registered++;
    const amt = participantAmount(row.billingAmount, row.billingStatus, null);
    recap.totalTagihan += amt;
    const paid =
      row.billingStatus === "PAID" || row.status === "PAID" || row.status === "SUCCESS";
    if (paid) {
      recap.paid++;
      recap.totalTerbayar += amt;
    } else {
      recap.unpaid++;
    }
    if (isUktSelesai(row)) recap.selesai++;
  }

  return [...byDojo.values()].sort((a, b) => a.dojoName.localeCompare(b.dojoName, "id"));
}

export function buildUktBranchRecapText(
  periodTitle: string,
  recaps: UktDojoRecap[],
): string {
  const lines = recaps.map((r) => {
    const pct =
      r.totalMembers > 0
        ? Math.round((r.registered / r.totalMembers) * 100)
        : 0;
    return (
      `• ${r.dojoName}: ${r.registered}/${r.totalMembers} terdaftar (${pct}%), ` +
      `${r.paid} lunas, ${r.unpaid} belum bayar, ${r.selesai} selesai · ` +
      `Tagihan Rp ${r.totalTagihan.toLocaleString("id-ID")} / Terbayar Rp ${r.totalTerbayar.toLocaleString("id-ID")}`
    );
  });
  const totals = recaps.reduce(
    (acc, r) => ({
      registered: acc.registered + r.registered,
      paid: acc.paid + r.paid,
      unpaid: acc.unpaid + r.unpaid,
      selesai: acc.selesai + r.selesai,
      totalTagihan: acc.totalTagihan + r.totalTagihan,
      totalTerbayar: acc.totalTerbayar + r.totalTerbayar,
    }),
    { registered: 0, paid: 0, unpaid: 0, selesai: 0, totalTagihan: 0, totalTerbayar: 0 },
  );

  return [
    `REKAP UKT — ${periodTitle}`,
    "",
    ...lines,
    "",
    `TOTAL: ${totals.registered} terdaftar · ${totals.paid} lunas · ${totals.unpaid} belum bayar · ${totals.selesai} selesai`,
    `Tagihan Rp ${totals.totalTagihan.toLocaleString("id-ID")} · Terbayar Rp ${totals.totalTerbayar.toLocaleString("id-ID")}`,
  ].join("\n");
}

/** Selesai = pembayaran lunas + sabuk target (Kyu Baru) sudah diisi cabang. */
export function isUktSelesai(row: UktMemberRow): boolean {
  const paid =
    row.billingStatus === "PAID" ||
    row.status === "PAID" ||
    row.status === "SUCCESS";
  return paid && Boolean(row.kyuBaru?.trim());
}

export function isUktBillingUnpaid(row: UktMemberRow): boolean {
  if (!row.registrationId) return false;
  if (row.billingStatus === "PAID" || row.status === "PAID" || row.status === "SUCCESS") {
    return false;
  }
  return true;
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
): { ok: boolean; label: string } {
  const blockers = getUktRegistrationBlockersWithWaiver(
    row,
    { registrationOpen },
    row.registrationWaiver,
  );
  if (blockers.length === 0) {
    return {
      ok: true,
      label: row.registrationWaiver ? "Disetujui cabang" : "Memenuhi syarat",
    };
  }
  return { ok: false, label: formatUktRegistrationBlockers(blockers) };
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildUktRecapCsv(rows: UktMemberRow[], periodTitle: string): string {
  const header = [
    "Periode",
    "NIA",
    "Nama",
    "Ranting",
    "Sabuk Saat Ini",
    "Sabuk Target",
    "Status",
    "Kehadiran %",
    "Hasil Ujian",
    "Nominal",
  ];
  const lines = rows
    .filter((r) => r.registrationId)
    .map((r) => {
      const display = uktDisplayStatusLabel(resolveUktDisplayStatus(r));
      return [
        periodTitle,
        r.nia || "",
        r.fullName,
        r.dojoName,
        r.kyuLama,
        r.kyuBaru || "",
        display,
        r.attendancePct != null ? String(r.attendancePct) : "",
        r.examResult || "",
        r.billingAmount != null ? String(r.billingAmount) : "",
      ]
        .map(csvEscape)
        .join(",");
    });
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

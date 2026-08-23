import { formatMemberName, formatRankLabel, shortRankLabel } from "@/lib/belt";

export const DEFAULT_LATBER_FEE = 45_000;
export const DEFAULT_LATBER_KOMISI_RANTING = 5_000;
export const LATBER_CATEGORY = "Pendaftaran Latihan Bersama";
export const LATBER_EVENT_PREFIX = "Latihan Bersama";

/** Rekening transfer Latber walk-in (QRIS percobaan Livin). */
export const LATBER_PAYMENT = {
  bankName: "Mandiri",
  bankAccountNumber: "1400024546344",
  bankAccountName: "HABIBUR RAHMAN",
  paymentInstructions:
    "Transfer Rp45.000 per peserta. Cantumkan NIA atau nama di berita transfer.",
  qrisImageUrl: "/images/latber-qris-trial.png",
  qrisTrialNote: "QRIS percobaan — hanya 1 transaksi",
  qrisExpiresAtLabel: "16 Agustus 2026, 10:26 WIB",
} as const;

export type LatberPaymentInfo = {
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  paymentInstructions: string;
  qrisImageUrl: string;
  qrisTrialNote: string;
  qrisExpiresAtLabel: string;
};

export type LatberPeriodSchedule = {
  startDate: string;
  endDate: string;
  registrationCloseAt?: string | null;
  registrationOpenAt?: string | null;
};

export type LatberPeriodMeta = {
  archived: boolean;
  locked: boolean;
  archivedAt?: string;
  lockedAt?: string;
  by?: string;
  registrationOpenAt?: string;
  eventAt?: string;
  eventLocation?: string;
  feeAmount?: number;
  komisiRanting?: number;
};

export type LatberDisplayStatus =
  | "belum_daftar"
  | "menunggu_terima_ranting"
  | "menunggu_konfirmasi_ranting"
  | "belum_bayar"
  | "menunggu_verifikasi"
  | "lunas"
  | "tunai"
  | "ditolak"
  | "batal";

export type LatberMemberRow = {
  memberId: string;
  registrationId?: string | null;
  nia?: string | null;
  fullName: string;
  currentRank?: string | null;
  dojoId: string;
  dojoName?: string | null;
  photoUrl?: string | null;
  status?: string | null;
  billingId?: string | null;
  billingAmount?: number | null;
  billingStatus?: string | null;
  /** Payment.paymentMethod — CASH → status Tunai. */
  paymentMethod?: string | null;
  selfRegistration?: boolean;
  memberPaymentConfirmedAt?: string | null;
  /** ISO `EventRegistration.createdAt`; null untuk Belum Daftar. */
  registeredAt?: string | null;
  /** Stub walk-in di luar keanggotaan (flag AppSetting). */
  isLatberGuest?: boolean;
  memberStatus?: string | null;
  gender?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
  address?: string | null;
  nik?: string | null;
  phoneNumber?: string | null;
  hasAccount?: boolean;
  membershipReady?: boolean;
};

export type LatberPeriodOption = {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  registrationCloseAt?: string | null;
  archived?: boolean;
  locked?: boolean;
};

export function isLatberEventTitle(title: string): boolean {
  const upper = String(title ?? "").toUpperCase();
  return upper.includes("LATBER") || upper.includes("LATIHAN BERSAMA");
}

export function buildLatberEventTitle(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return `${LATBER_EVENT_PREFIX} — Periode`;
  const upper = trimmed.toUpperCase();
  if (upper.startsWith("LATBER") || upper.startsWith("LATIHAN BERSAMA")) return trimmed;
  return `${LATBER_EVENT_PREFIX} — ${trimmed}`;
}

export function latberPeriodMetaKey(periodId: string): string {
  return `latber-period-meta:${periodId}`;
}

export function parseLatberPeriodMetaValue(raw: unknown): LatberPeriodMeta {
  const base: LatberPeriodMeta = { archived: false, locked: false };
  if (!raw || typeof raw !== "object") return base;
  const v = raw as Record<string, unknown>;
  const next: LatberPeriodMeta = {
    ...base,
    archived: v.archived === true,
    locked: v.locked === true,
    archivedAt: typeof v.archivedAt === "string" ? v.archivedAt : undefined,
    lockedAt: typeof v.lockedAt === "string" ? v.lockedAt : undefined,
    by: typeof v.by === "string" ? v.by : undefined,
    registrationOpenAt:
      typeof v.registrationOpenAt === "string" ? v.registrationOpenAt : undefined,
    eventAt: typeof v.eventAt === "string" ? v.eventAt : undefined,
    eventLocation:
      typeof v.eventLocation === "string" ? v.eventLocation : undefined,
  };
  const fee = Number(v.feeAmount);
  if (Number.isFinite(fee) && fee >= 0) next.feeAmount = Math.round(fee);
  const komisi = Number(v.komisiRanting);
  if (Number.isFinite(komisi) && komisi >= 0) next.komisiRanting = Math.round(komisi);
  return next;
}

export function resolveLatberPeriodFees(meta?: LatberPeriodMeta | null): {
  feeAmount: number;
  komisiRanting: number;
} {
  return {
    feeAmount:
      typeof meta?.feeAmount === "number" && meta.feeAmount >= 0
        ? Math.round(meta.feeAmount)
        : DEFAULT_LATBER_FEE,
    komisiRanting:
      typeof meta?.komisiRanting === "number" && meta.komisiRanting >= 0
        ? Math.round(meta.komisiRanting)
        : DEFAULT_LATBER_KOMISI_RANTING,
  };
}

export function getLatberRegistrationDeadline(period: LatberPeriodSchedule): Date {
  if (period.registrationCloseAt) return new Date(period.registrationCloseAt);
  return new Date(period.endDate || period.startDate);
}

export function getLatberRegistrationOpenAt(
  period: LatberPeriodSchedule,
): Date | null {
  if (!period.registrationOpenAt) return null;
  const d = new Date(period.registrationOpenAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isLatberRegistrationNotYetOpen(
  period: LatberPeriodSchedule,
): boolean {
  const openAt = getLatberRegistrationOpenAt(period);
  return Boolean(openAt && Date.now() < openAt.getTime());
}

export function isLatberRegistrationOpen(period: LatberPeriodSchedule): boolean {
  const now = Date.now();
  if (isLatberRegistrationNotYetOpen(period)) return false;
  return now <= getLatberRegistrationDeadline(period).getTime();
}

export function isLatberPeriodActiveView(meta?: LatberPeriodMeta | null): boolean {
  return !meta?.archived && !meta?.locked;
}

export function buildLatberAdminUrl(opts?: { period?: string | null }): string {
  const qs = new URLSearchParams();
  if (opts?.period) qs.set("period", opts.period);
  const q = qs.toString();
  return q ? `/admin/latber?${q}` : "/admin/latber";
}

export function buildDefaultLatberAdminUrl(): string {
  return "/admin/latber";
}

export function buildLatberArsipUrl(opts?: { period?: string | null }): string {
  const qs = new URLSearchParams();
  if (opts?.period) qs.set("period", opts.period);
  const q = qs.toString();
  return q ? `/admin/latber/arsip?${q}` : "/admin/latber/arsip";
}

function isLatberBillingPaid(row: LatberMemberRow): boolean {
  const bs = String(row.billingStatus ?? "").toUpperCase();
  if (bs === "PAID" || bs === "SUCCESS") return true;
  const st = String(row.status ?? "").toUpperCase();
  return st === "PAID" || st === "SUCCESS";
}

function isSelfPending(row: LatberMemberRow): boolean {
  const st = String(row.status ?? "").toUpperCase();
  return (
    st === "PENDING" &&
    (row.selfRegistration === true || !row.billingId)
  );
}

export function resolveLatberDisplayStatus(row: LatberMemberRow): LatberDisplayStatus {
  if (!row.registrationId || row.status === "BELUM_DAFTAR") return "belum_daftar";
  const st = String(row.status ?? "").toUpperCase();
  if (st === "REJECTED") return "ditolak";
  if (st === "CANCELLED") return "batal";
  if (isSelfPending(row)) {
    if (row.memberPaymentConfirmedAt) return "menunggu_konfirmasi_ranting";
    return "menunggu_terima_ranting";
  }
  if (isLatberBillingPaid(row)) {
    const method = String(row.paymentMethod ?? "").toUpperCase();
    if (method === "CASH") return "tunai";
    return "lunas";
  }
  if (String(row.billingStatus ?? "").toUpperCase() === "WAITING_VERIFICATION") {
    return "menunggu_verifikasi";
  }
  if (row.billingStatus === "PENDING" || row.registrationId) return "belum_bayar";
  return "belum_bayar";
}

/** Lunas transfer/QRIS atau Tunai kasir — ikut nota, KPI setor, rekap. */
export function isLatberPaidStatus(
  status: LatberDisplayStatus | string | null | undefined,
): boolean {
  return status === "lunas" || status === "tunai";
}

export function latberDisplayStatusLabel(status: LatberDisplayStatus): string {
  const labels: Record<LatberDisplayStatus, string> = {
    belum_daftar: "Belum Daftar",
    menunggu_terima_ranting: "Menunggu Terima Ranting",
    menunggu_konfirmasi_ranting: "Menunggu Konfirmasi Ranting",
    belum_bayar: "Belum Bayar",
    menunggu_verifikasi: "Menunggu Verifikasi",
    lunas: "Lunas",
    tunai: "Tunai",
    ditolak: "Ditolak",
    batal: "Batal",
  };
  return labels[status];
}

/** Warna badge status Latber — dipakai admin dan roster publik. */
export function latberStatusBadgeClass(status: string): string {
  if (status === "lunas") return "bg-emerald-600 text-white";
  if (status === "tunai") return "bg-teal-600 text-white";
  if (status === "menunggu_verifikasi" || status === "belum_bayar") {
    return "bg-amber-500/15 text-amber-800";
  }
  if (
    status === "menunggu_terima_ranting" ||
    status === "menunggu_konfirmasi_ranting"
  ) {
    return "bg-blue-500/15 text-blue-800";
  }
  if (status === "ditolak" || status === "batal") {
    return "bg-red-500/15 text-red-700";
  }
  return "bg-muted text-muted-foreground";
}

export function filterLatberRowsByDisplayStatus(
  rows: LatberMemberRow[],
  status: LatberDisplayStatus,
): LatberMemberRow[] {
  return rows.filter((r) => resolveLatberDisplayStatus(r) === status);
}

export function buildLatberNotaTotals(
  rows: LatberMemberRow[],
  feeAmount: number,
  komisiRanting: number,
): {
  participantCount: number;
  paidCount: number;
  subtotal: number;
  komisiTotal: number;
  grandTotal: number;
} {
  const paid = rows.filter((r) =>
    isLatberPaidStatus(resolveLatberDisplayStatus(r)),
  );
  const paidCount = paid.length;
  const subtotal = paidCount * feeAmount;
  const komisiTotal = paidCount * komisiRanting;
  return {
    participantCount: rows.filter((r) => r.registrationId).length,
    paidCount,
    subtotal,
    komisiTotal,
    grandTotal: subtotal - komisiTotal,
  };
}

export function formatLatberMemberLabel(row: LatberMemberRow): string {
  return formatMemberName(row.fullName);
}

export function formatLatberRank(row: LatberMemberRow): string {
  return formatRankLabel(row.currentRank || "—");
}

export function periodOptionFromLatberEvent(
  event: Record<string, unknown>,
  idOverride?: string,
): LatberPeriodOption {
  return {
    id: idOverride || String(event.id ?? ""),
    title: String(event.title ?? ""),
    startDate: event.startDate ? String(event.startDate) : undefined,
    endDate: event.endDate ? String(event.endDate) : undefined,
    registrationCloseAt: event.registrationCloseAt
      ? String(event.registrationCloseAt)
      : null,
  };
}

export function findActiveLatberPeriod(
  periods: LatberPeriodOption[],
): LatberPeriodOption | null {
  const open = periods.filter((p) => !p.archived && !p.locked);
  if (open.length === 0) return null;
  return open.sort((a, b) => {
    const da = new Date(a.startDate || 0).getTime();
    const db = new Date(b.startDate || 0).getTime();
    return db - da;
  })[0];
}

export function formatLatberPeriodLabel(title: string): string {
  return (
    title
      .replace(/^Latihan Bersama\s*—?\s*/i, "")
      .replace(/^Latber\s*—?\s*/i, "")
      .trim() || title
  );
}

export function formatLatberCurrency(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatLatberRupiahPlain(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

const LATBER_APPROVED_STATUSES = new Set(["APPROVED", "SUCCESS", "PAID"]);

export function isLatberRegistrationApproved(status: string | null | undefined): boolean {
  return LATBER_APPROVED_STATUSES.has(String(status ?? "").toUpperCase());
}

/** Peserta yang sudah diterima ranting (bukan mandiri PENDING / ditolak / batal). */
export function isLatberApprovedParticipant(row: LatberMemberRow): boolean {
  if (!row.registrationId) return false;
  if (isSelfPending(row)) return false;
  const st = String(row.status ?? "").toUpperCase();
  if (st === "REJECTED" || st === "CANCELLED" || st === "BELUM_DAFTAR") return false;
  return isLatberRegistrationApproved(row.status) || Boolean(row.billingId);
}

export function filterLatberApprovedRows(rows: LatberMemberRow[]): LatberMemberRow[] {
  return rows.filter(isLatberApprovedParticipant);
}

export function resolveLatberWaDojoLabel(opts: {
  effectiveDojoId?: string | null;
  dojos: Array<{ id: string; name: string }>;
  approvedRows: LatberMemberRow[];
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
  if (fromRows.length > 1) return fromRows.join(", ");
  if (opts.dojos.length > 0) {
    return opts.dojos.map((d) => d.name.trim()).filter(Boolean).join(", ") || "Ranting";
  }
  return "Ranting";
}

function formatLatberWaParticipantLine(row: LatberMemberRow, index: number): string {
  const rk = formatLatberRank(row);
  return `${index + 1}. ${formatMemberName(row.fullName)}${rk && rk !== "—" ? ` ${rk}` : ""}`;
}

function latberWaRankBucketLabelFromRank(
  currentRank?: string | null,
): string {
  const short = shortRankLabel(currentRank);
  if (!short) return "Lainnya";
  return short.toLowerCase();
}

function latberWaRankBucketLabel(row: LatberMemberRow): string {
  return latberWaRankBucketLabelFromRank(row.currentRank);
}

function compareLatberWaRankBuckets(a: string, b: string): number {
  const parse = (label: string) => {
    const kyu = label.match(/^kyu\s*(\d+)$/i);
    if (kyu) return { kind: 0 as const, n: Number(kyu[1]) };
    const dan = label.match(/^dan\s*(\d+)$/i);
    if (dan) return { kind: 1 as const, n: Number(dan[1]) };
    return { kind: 2 as const, n: 0 };
  };
  const pa = parse(a);
  const pb = parse(b);
  if (pa.kind !== pb.kind) return pa.kind - pb.kind;
  if (pa.kind === 0) return pb.n - pa.n;
  if (pa.kind === 1) return pa.n - pb.n;
  return a.localeCompare(b, "id");
}

/** Laporan WA satu ranting (peserta + rincian setor selaras Nota). */
export function buildLatberRantingWaReportText(
  periodTitle: string,
  dojoName: string,
  approvedRows: LatberMemberRow[],
  feeAmount: number,
  komisiRanting: number,
): string {
  const lines = approvedRows.map((r, i) => formatLatberWaParticipantLine(r, i));
  const n = approvedRows.length;
  const subtotal = n * feeAmount;
  const komisiTotal = n * komisiRanting;
  const grandTotal = subtotal - komisiTotal;

  return [
    `*${periodTitle}*`,
    `*Ranting/Dojo: ${dojoName}*`,
    "",
    "*Peserta yang terdaftar*",
    ...lines,
    "",
    "*Rincian pembayaran*",
    `Peserta: ${n} × ${formatLatberRupiahPlain(feeAmount)} = ${formatLatberRupiahPlain(subtotal)}`,
    `Subtotal (Biaya Latber): _${formatLatberRupiahPlain(subtotal)}_`,
    `Komisi Ranting (${n} × ${formatLatberRupiahPlain(komisiRanting)}): - ${formatLatberRupiahPlain(komisiTotal)}`,
    `*TOTAL disetor ke cabang: ${formatLatberRupiahPlain(grandTotal)}*`,
  ].join("\n");
}

/** Laporan WA admin cabang: ringkasan jumlah per ranting + sebaran sabuk. */
export function buildLatberCabangWaReportText(
  periodTitle: string,
  approvedRows: LatberMemberRow[],
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
    const rank = latberWaRankBucketLabel(row);
    byRank.set(rank, (byRank.get(rank) ?? 0) + 1);
  }

  const rantingList = [...byDojo.values()].sort((a, b) =>
    a.dojoName.localeCompare(b.dojoName, "id"),
  );
  const rankList = [...byRank.entries()].sort(([a], [b]) =>
    compareLatberWaRankBuckets(a, b),
  );

  const rantingLines = rantingList.map(
    (g, i) => `${i + 1}. ${g.dojoName} = _${g.count} peserta_`,
  );
  const rankLines = rankList.map(
    ([label, count]) => `${label} = _${count} peserta_`,
  );

  return [
    `*${periodTitle}*`,
    "",
    `*Total Ranting : ${rantingList.length}*`,
    "",
    "*List Ranting*",
    ...rantingLines,
    "",
    "*Jumlah*",
    ...rankLines,
    "",
    `*TOTAL SEMUA: ${approvedRows.length} peserta*`,
  ].join("\n");
}

const LATBER_WIB = "Asia/Jakarta";

export type LatberPublicCormatRow = {
  dojoName: string;
  currentRank?: string | null;
  displayStatus: string;
};

function formatLatberWibDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: LATBER_WIB,
  }).format(d);
  return formatted.replace(/ /g, "-");
}

function formatLatberEventCountdown(
  eventAtIso: string,
  nowMs = Date.now(),
): string {
  const target = new Date(eventAtIso).getTime();
  if (Number.isNaN(target)) return "";
  const diff = target - nowMs;
  if (diff <= 0) return "_Sudah dilaksanakan_";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);
  return `_${days} Hari: ${hours} Jam: ${minutes} Menit: ${seconds} Detik_`;
}

/** Ringkasan publik format Cormat (batas daftar, countdown, ranting, kyu, status). */
export function buildLatberPublicCormatWaText(opts: {
  registrationCloseAt?: string | null;
  eventAt?: string | null;
  rows: LatberPublicCormatRow[];
}): string {
  const closeAt = opts.registrationCloseAt?.trim() || "";
  const closeLabel = closeAt
    ? formatLatberWibDate(closeAt) ?? "Belum ditetapkan"
    : "Belum ditetapkan";

  const byDojo = new Map<string, number>();
  const byRank = new Map<string, number>();
  let lunas = 0;
  let belumBayar = 0;
  let menungguVerifikasi = 0;

  for (const row of opts.rows) {
    const name = row.dojoName?.trim() || "—";
    byDojo.set(name, (byDojo.get(name) ?? 0) + 1);
    const rank = latberWaRankBucketLabelFromRank(row.currentRank);
    byRank.set(rank, (byRank.get(rank) ?? 0) + 1);
    if (isLatberPaidStatus(row.displayStatus)) lunas += 1;
    else if (row.displayStatus === "menunggu_verifikasi") menungguVerifikasi += 1;
    else if (row.displayStatus === "belum_bayar") belumBayar += 1;
  }

  const rantingList = [...byDojo.entries()].sort(([a], [b]) =>
    a.localeCompare(b, "id"),
  );
  const rankList = [...byRank.entries()].sort(([a], [b]) =>
    compareLatberWaRankBuckets(a, b),
  );

  const lines: string[] = [
    "*Batas Pendaftaran Latber:*",
    `_${closeLabel}_`,
    "",
  ];

  const eventAt = opts.eventAt?.trim() || "";
  if (eventAt) {
    const eventDateLabel = formatLatberWibDate(eventAt);
    const countdown = formatLatberEventCountdown(eventAt);
    if (eventDateLabel || countdown) {
      lines.push("*Pelaksanaan Latihan Bersama*");
      if (eventDateLabel) lines.push(`_${eventDateLabel}_`);
      if (countdown) lines.push(countdown);
      lines.push("");
    }
  }

  lines.push(
    `*Total Ranting : ${rantingList.length}*`,
    "",
    "*List Ranting*",
    ...rantingList.map(
      ([name, count], i) => `${i + 1}. ${name} = _${count} peserta_`,
    ),
    "",
    "*Jumlah*",
    ...rankList.map(([label, count]) => `${label} = _${count} peserta_`),
    "",
    `*TOTAL SEMUA: ${opts.rows.length} peserta*`,
    "",
    "*Status:*",
    `Lunas: _${lunas} peserta_`,
    `Belum Bayar: _${belumBayar} peserta_`,
  );

  if (menungguVerifikasi > 0) {
    lines.push(`Menunggu Verifikasi: _${menungguVerifikasi} peserta_`);
  }

  return lines.join("\n");
}

export type LatberRekapRow = {
  no: number;
  nia: string;
  nama: string;
  sabuk: string;
  ranting: string;
  biaya: number;
  status: string;
};

export function buildLatberRekapRows(
  rows: LatberMemberRow[],
  feeAmount: number,
): LatberRekapRow[] {
  return filterLatberApprovedRows(rows).map((row, i) => ({
    no: i + 1,
    nia: row.nia?.trim() || "—",
    nama: formatMemberName(row.fullName),
    sabuk: formatLatberRank(row),
    ranting: row.dojoName?.trim() || "—",
    biaya: feeAmount,
    status: latberDisplayStatusLabel(resolveLatberDisplayStatus(row)),
  }));
}

export function buildLatberRekapTotals(
  rowCount: number,
  feeAmount: number,
  komisiRanting: number,
): { subtotal: number; komisiTotal: number; grandTotal: number } {
  const subtotal = rowCount * feeAmount;
  const komisiTotal = rowCount * komisiRanting;
  return {
    subtotal,
    komisiTotal,
    grandTotal: subtotal - komisiTotal,
  };
}

export function buildLatberRekapFilename(
  periodTitle: string,
  ext: "xlsx" | "pdf" = "xlsx",
): string {
  const slug =
    formatLatberPeriodLabel(periodTitle)
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "periode";
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `rekap-latber-${slug}-${ymd}.${ext}`;
}

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

export function parseUktEventTitle(title: string): { semester: UktSemester; year: number } | null {
  const match = title.match(/semester\s*(I|II)\s*[-/]\s*(\d{4})/i);
  if (!match) return null;
  return {
    semester: match[1].toUpperCase() as UktSemester,
    year: parseInt(match[2], 10),
  };
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

export const APPROVED_STATUSES = new Set(["APPROVED", "SUCCESS", "PAID"]);

export function isRegistrationApproved(status: string): boolean {
  return APPROVED_STATUSES.has(status);
}

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
  billingStatus: string | null;
  billingAmount: number | null;
  outstandingDues: number;
  pendingVerifications: number;
};

export function participantAmount(
  billingAmount: number | null,
  billingStatus: string | null,
  categoryFee: number | null,
): number {
  if (billingAmount != null && billingStatus) {
    if (billingStatus === "PAID" || billingStatus === "PENDING" || billingStatus === "WAITING_VERIFICATION") {
      return billingAmount;
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
    pending: registered.filter((r) => r.status === "PENDING").length,
    ditolak: registered.filter((r) => r.status === "REJECTED").length,
    totalTagihan,
    totalTerbayar,
  };
}

export function filterUktRowsByView(rows: UktMemberRow[], viewFilter: string): UktMemberRow[] {
  if (viewFilter === "registered") return rows.filter((r) => r.registrationId);
  if (viewFilter === "unregistered") return rows.filter((r) => !r.registrationId);
  if (viewFilter === "approved") return rows.filter((r) => ["APPROVED", "PAID", "SUCCESS"].includes(r.status));
  if (viewFilter === "pending") return rows.filter((r) => r.status === "PENDING");
  if (viewFilter === "rejected") return rows.filter((r) => r.status === "REJECTED");
  if (viewFilter === "paid") return rows.filter((r) => r.billingStatus === "PAID" || r.status === "PAID");
  return rows;
}

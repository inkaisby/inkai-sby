export type UktSemester = "I" | "II";

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

export const DEFAULT_BELT_FEES: Record<string, number> = {
  PUTIH: 285000,
  KUNING: 295000,
  HIJAU: 305000,
  BIRU: 315000,
  COKELAT: 345000,
};

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

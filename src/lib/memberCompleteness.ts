export type MemberCompletenessInput = {
  fullName?: string | null;
  phoneNumber?: string | null;
  photoUrl?: string | null;
  gender?: string | null;
  birthDate?: string | Date | null;
  birthPlace?: string | null;
  address?: string | null;
  dojoId?: string | null;
  birthCertificateUrl?: string | null;
  bpjsCardUrl?: string | null;
  allowEventWithoutDues?: boolean | null;
};

export function isProfileComplete(m: MemberCompletenessInput | null | undefined) {
  if (!m) return false;
  return Boolean(
    m.fullName?.trim() &&
      m.phoneNumber?.trim() &&
      m.photoUrl?.trim() &&
      m.gender?.trim() &&
      m.birthDate &&
      m.birthPlace?.trim() &&
      m.address?.trim() &&
      m.dojoId,
  );
}

export function isDocumentComplete(m: MemberCompletenessInput | null | undefined) {
  if (!m) return false;
  return Boolean(m.birthCertificateUrl?.trim() && m.bpjsCardUrl?.trim());
}

export function hasUnpaidMonthlyIuran(
  billings: Array<{ type?: string; status?: string }>,
  allowEventWithoutDues?: boolean | null,
) {
  if (allowEventWithoutDues) return false;
  const monthly = billings.filter((b) => b.type === "MONTHLY_IURAN");
  if (monthly.length === 0) return false;
  return !monthly.some((b) => b.status === "PAID");
}

export type EventGateReason = "profile" | "documents" | "iuran" | null;

export function getEventRegistrationGate(opts: {
  member: MemberCompletenessInput | null | undefined;
  billings: Array<{ type?: string; status?: string }>;
}): EventGateReason {
  if (!isProfileComplete(opts.member)) return "profile";
  if (!isDocumentComplete(opts.member)) return "documents";
  if (
    hasUnpaidMonthlyIuran(
      opts.billings,
      opts.member?.allowEventWithoutDues,
    )
  ) {
    return "iuran";
  }
  return null;
}

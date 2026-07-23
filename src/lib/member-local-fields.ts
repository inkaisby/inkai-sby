import { prisma } from "@/lib/prisma";

/** Field keanggotaan yang disimpan di Prisma lokal (bukan Inkai API). */
export async function overlayMemberLocalFields(
  member: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (!member?.id) return member;
  const local = await prisma.member.findUnique({
    where: { id: String(member.id) },
    select: {
      allowEventWithoutDues: true,
      monthlyDuesAmount: true,
      birthCertificateUrl: true,
      bpjsCardUrl: true,
      bpjsCardNumber: true,
      nik: true,
      gender: true,
      birthPlace: true,
      birthDate: true,
      address: true,
      nia: true,
      mshNumber: true,
      currentRank: true,
      emailSelfEditedAt: true,
      niaSelfEditedAt: true,
      rankSelfEditedAt: true,
      mshSelfEditedAt: true,
      user: {
        select: {
          email: true,
          phoneNumber: true,
          photoUrl: true,
        },
      },
    },
  });
  if (!local) return member;

  const inkaiUser = member.user as
    | { email?: string; phoneNumber?: string; photoUrl?: string }
    | undefined;

  return {
    ...member,
    allowEventWithoutDues: local.allowEventWithoutDues,
    monthlyDuesAmount: member.monthlyDuesAmount ?? local.monthlyDuesAmount,
    birthCertificateUrl:
      member.birthCertificateUrl ?? local.birthCertificateUrl,
    bpjsCardUrl: member.bpjsCardUrl ?? local.bpjsCardUrl,
    bpjsCardNumber: member.bpjsCardNumber ?? local.bpjsCardNumber,
    nik: member.nik ?? local.nik,
    gender: member.gender ?? local.gender,
    birthPlace: member.birthPlace ?? local.birthPlace,
    birthDate: member.birthDate ?? local.birthDate,
    address: member.address ?? local.address,
    nia: member.nia ?? local.nia,
    mshNumber: local.mshNumber ?? (member.mshNumber as string | null) ?? null,
    currentRank: member.currentRank ?? local.currentRank,
    emailSelfEditedAt: local.emailSelfEditedAt,
    niaSelfEditedAt: local.niaSelfEditedAt,
    rankSelfEditedAt: local.rankSelfEditedAt,
    mshSelfEditedAt: local.mshSelfEditedAt,
    email:
      inkaiUser?.email ??
      local.user?.email ??
      (typeof member.email === "string" ? member.email : null),
    phoneNumber:
      (typeof member.phoneNumber === "string" && member.phoneNumber) ||
      inkaiUser?.phoneNumber ||
      local.user?.phoneNumber ||
      null,
    photoUrl:
      (typeof member.photoUrl === "string" && member.photoUrl) ||
      inkaiUser?.photoUrl ||
      local.user?.photoUrl ||
      null,
  };
}

export async function fetchDuesExemptMemberIds(
  memberIds: string[],
): Promise<Set<string>> {
  if (memberIds.length === 0) return new Set();
  const rows = await prisma.member.findMany({
    where: { id: { in: memberIds }, allowEventWithoutDues: true },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

export function isMemberDuesExempt(
  member: { allowEventWithoutDues?: boolean | null } | null | undefined,
): boolean {
  return Boolean(member?.allowEventWithoutDues);
}

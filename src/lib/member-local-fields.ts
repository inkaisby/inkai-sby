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
    },
  });
  if (!local) return member;
  return {
    ...member,
    allowEventWithoutDues: local.allowEventWithoutDues,
    monthlyDuesAmount:
      member.monthlyDuesAmount ?? local.monthlyDuesAmount,
    birthCertificateUrl:
      member.birthCertificateUrl ?? local.birthCertificateUrl,
    bpjsCardUrl: member.bpjsCardUrl ?? local.bpjsCardUrl,
    bpjsCardNumber: member.bpjsCardNumber ?? local.bpjsCardNumber,
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

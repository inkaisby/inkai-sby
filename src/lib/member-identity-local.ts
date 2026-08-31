import { prisma } from "@/lib/prisma";
import { normalizeNia } from "@/lib/member-profile-locks";

export type MemberIdentityLocalInput = {
  nik?: string | null;
  gender?: string | null;
  birthPlace?: string | null;
  birthDate?: string | Date | null;
  address?: string | null;
  currentRank?: string;
  nia?: string | null;
  mshNumber?: string | null;
};

export function buildMemberIdentityLocalData(input: MemberIdentityLocalInput) {
  const nia = normalizeNia(input.nia) || null;
  return {
    nik: input.nik?.trim() || null,
    gender: input.gender || null,
    birthPlace: input.birthPlace?.trim()
      ? input.birthPlace.trim().toUpperCase()
      : null,
    birthDate: input.birthDate ? new Date(input.birthDate) : null,
    address: input.address?.trim()
      ? input.address.trim().toUpperCase()
      : null,
    ...(input.currentRank ? { currentRank: input.currentRank } : {}),
    ...(nia ? { nia } : {}),
    ...(input.mshNumber ? { mshNumber: input.mshNumber } : {}),
  };
}

export async function persistMemberIdentityLocal(
  memberId: string,
  input: MemberIdentityLocalInput,
  opts?: { userId?: string | null; phoneNumber?: string | null },
): Promise<void> {
  await prisma.member.update({
    where: { id: memberId },
    data: buildMemberIdentityLocalData(input),
  });
  const phone = opts?.phoneNumber?.trim();
  if (phone && opts?.userId) {
    await prisma.user.update({
      where: { id: opts.userId },
      data: { phoneNumber: phone },
    });
  }
}

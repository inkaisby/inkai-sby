import { prisma } from "@/lib/prisma";
import { resolveMemberPhotoUrl } from "@/lib/member-photo";

/** Muat klaim sesi terbaru dari DB — dipakai refresh JWT setelah promosi role. */
export async function loadSessionClaimsFromDb(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false, isActive: true },
    select: {
      fullName: true,
      photoUrl: true,
      managedBranchId: true,
      managedProvinceId: true,
      managedDojoId: true,
      roles: { select: { name: true } },
      member: { select: { id: true, photoUrl: true } },
    },
  });
  if (!user) return null;
  return {
    name: user.fullName ?? undefined,
    photoUrl: resolveMemberPhotoUrl(user.member?.photoUrl, user.photoUrl),
    roles: user.roles.map((r) => r.name),
    managedProvinceId: user.managedProvinceId,
    managedBranchId: user.managedBranchId,
    managedDojoId: user.managedDojoId,
    memberId: user.member?.id ?? null,
  };
}

import { prisma } from "@/lib/prisma";

/** Muat klaim sesi terbaru dari DB — dipakai refresh JWT setelah promosi role. */
export async function loadSessionClaimsFromDb(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false, isActive: true },
    select: {
      fullName: true,
      managedBranchId: true,
      managedProvinceId: true,
      managedDojoId: true,
      roles: { select: { name: true } },
      member: { select: { id: true } },
    },
  });
  if (!user) return null;
  return {
    name: user.fullName ?? undefined,
    roles: user.roles.map((r) => r.name),
    managedProvinceId: user.managedProvinceId,
    managedBranchId: user.managedBranchId,
    managedDojoId: user.managedDojoId,
    memberId: user.member?.id ?? null,
  };
}

import { prisma } from "@/lib/prisma";
import { resolveMemberPhotoUrl } from "@/lib/member-photo";

export type SessionClaims = {
  name?: string;
  photoUrl: string | null;
  roles: string[];
  managedProvinceId: string | null;
  managedBranchId: string | null;
  managedDojoId: string | null;
  memberId: string | null;
};

/** Muat klaim sesi terbaru dari DB — dipakai refresh JWT setelah promosi role.
 *  Jangan select Member.photoUrl: kolom drift (P2022) tidak boleh merobohkan JWT. */
export async function loadSessionClaimsFromDb(
  userId: string,
): Promise<SessionClaims | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false, isActive: true },
    select: {
      fullName: true,
      photoUrl: true,
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
    photoUrl: resolveMemberPhotoUrl(null, user.photoUrl),
    roles: user.roles.map((r) => r.name),
    managedProvinceId: user.managedProvinceId,
    managedBranchId: user.managedBranchId,
    managedDojoId: user.managedDojoId,
    memberId: user.member?.id ?? null,
  };
}

/** Hasil refresh klaim JWT — dipakai auth callback + unit test. */
export type JwtClaimsRefreshOutcome =
  | { kind: "blocked" }
  | { kind: "missing" }
  | { kind: "ok"; claims: SessionClaims }
  | { kind: "error"; error: unknown };

export type JwtClaimsToken = {
  sub?: string;
  error?: string;
  claimsUpdatedAt?: number;
  roles?: string[];
  managedProvinceId?: string | null;
  managedBranchId?: string | null;
  managedDojoId?: string | null;
  memberId?: string | null;
  name?: string | null;
  photoUrl?: string | null;
};

/** Petakan outcome refresh → token. Error DB = keep session (fail-open). */
export function applyJwtClaimsRefreshOutcome<T extends JwtClaimsToken>(
  token: T,
  outcome: JwtClaimsRefreshOutcome,
  now = Date.now(),
): T {
  if (outcome.kind === "blocked" || outcome.kind === "missing") {
    return {
      ...token,
      sub: undefined,
      error: "SessionBlocked",
      claimsUpdatedAt: now,
    };
  }

  if (outcome.kind === "error") {
    return {
      ...token,
      claimsUpdatedAt: now,
    };
  }

  const { claims } = outcome;
  return {
    ...token,
    roles: claims.roles,
    managedProvinceId: claims.managedProvinceId,
    managedBranchId: claims.managedBranchId,
    managedDojoId: claims.managedDojoId,
    memberId: claims.memberId,
    name: claims.name ?? token.name,
    photoUrl: claims.photoUrl ?? null,
    claimsUpdatedAt: now,
  };
}

import { prisma } from "@/lib/prisma";
import { isPrismaSchemaDriftError } from "@/lib/prisma-errors";

type MemberPhotoColumnCache = {
  at: number;
  hasPhotoUrl: boolean;
};

const CACHE_TTL_MS = 5 * 60_000;

let memberPhotoColumnCache: MemberPhotoColumnCache | null = null;

/** Invalidate after P2022 so the next request re-probes information_schema. */
export function invalidateMemberPhotoColumnCache(): void {
  memberPhotoColumnCache = null;
}

export function notePossibleMemberPhotoDrift(error: unknown): void {
  if (isPrismaSchemaDriftError(error)) {
    invalidateMemberPhotoColumnCache();
  }
}

/**
 * Probe once per process (TTL) whether public."Member"."photoUrl" exists.
 * Fail-open to `true` if the probe itself errors — callers still have
 * withPrismaFallback / User.photoUrl paths.
 */
export async function hasMemberPhotoUrlColumn(): Promise<boolean> {
  const now = Date.now();
  if (
    memberPhotoColumnCache &&
    now - memberPhotoColumnCache.at < CACHE_TTL_MS
  ) {
    return memberPhotoColumnCache.hasPhotoUrl;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean | null }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Member'
          AND column_name = 'photoUrl'
      ) AS "exists"
    `;
    const hasPhotoUrl = Boolean(rows[0]?.exists);
    memberPhotoColumnCache = { at: now, hasPhotoUrl };
    return hasPhotoUrl;
  } catch (error) {
    console.error("[prisma-columns] Member.photoUrl probe failed", error);
    return true;
  }
}

/** Spread into Member `select` / nested member select: `{ photoUrl: true }` or `{}`. */
export async function memberPhotoSelect(): Promise<{ photoUrl?: true }> {
  return (await hasMemberPhotoUrlColumn()) ? { photoUrl: true } : {};
}

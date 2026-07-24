import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/prisma";

const REVOKE_TTL_MS = 24 * 60 * 60 * 1000;
const BLOCK_CACHE_TTL_MS = 8_000;
const REDIS_REVOKE_PREFIX = "inkai-sby:session:revoked:";
const REDIS_LOCK_PREFIX = "inkai-sby:session:locked:";

type BlockedResult = {
  blocked: boolean;
  reason?: "revoked" | "locked" | "inactive";
};

type CacheEntry = {
  result: BlockedResult;
  expiresAt: number;
};

const revokedUntilByUserId = new Map<string, number>();
const lockedUntilByUserId = new Map<string, Date>();
const blockCache = new Map<string, CacheEntry>();

function hasUpstashEnv() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

function getRedis(): Redis | null {
  if (!hasUpstashEnv()) return null;
  try {
    return Redis.fromEnv();
  } catch {
    return null;
  }
}

function cleanupMemory(now = Date.now()) {
  for (const [userId, until] of revokedUntilByUserId) {
    if (until <= now) revokedUntilByUserId.delete(userId);
  }
  for (const [userId, until] of lockedUntilByUserId) {
    if (until.getTime() <= now) lockedUntilByUserId.delete(userId);
  }
  for (const [userId, entry] of blockCache) {
    if (entry.expiresAt <= now) blockCache.delete(userId);
  }
}

function invalidateBlockCache(userId: string) {
  blockCache.delete(userId);
}

async function setRedisRevoked(userId: string, ttlMs: number) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(REDIS_REVOKE_PREFIX + userId, "1", {
      px: Math.max(1_000, ttlMs),
    });
  } catch (error) {
    console.error("[session-control] redis revoke set", error);
  }
}

async function clearRedisRevoked(userId: string) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(REDIS_REVOKE_PREFIX + userId);
  } catch (error) {
    console.error("[session-control] redis revoke del", error);
  }
}

async function setRedisLocked(userId: string, until: Date) {
  const redis = getRedis();
  if (!redis) return;
  try {
    const ttl = until.getTime() - Date.now();
    if (ttl <= 0) {
      await redis.del(REDIS_LOCK_PREFIX + userId);
      return;
    }
    await redis.set(REDIS_LOCK_PREFIX + userId, until.toISOString(), {
      px: ttl,
    });
  } catch (error) {
    console.error("[session-control] redis lock set", error);
  }
}

async function clearRedisLocked(userId: string) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(REDIS_LOCK_PREFIX + userId);
  } catch (error) {
    console.error("[session-control] redis lock del", error);
  }
}

async function redisIsRevoked(userId: string): Promise<boolean | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const v = await redis.get<string>(REDIS_REVOKE_PREFIX + userId);
    return v != null && v !== "";
  } catch (error) {
    console.error("[session-control] redis revoke get", error);
    return null;
  }
}

async function redisLockedUntil(userId: string): Promise<Date | null | undefined> {
  const redis = getRedis();
  if (!redis) return undefined;
  try {
    const v = await redis.get<string>(REDIS_LOCK_PREFIX + userId);
    if (v == null || v === "") return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch (error) {
    console.error("[session-control] redis lock get", error);
    return undefined;
  }
}

/** Hapus flag revoke (mis. setelah login ulang sukses). */
export async function clearUserRevocation(userId: string) {
  cleanupMemory();
  revokedUntilByUserId.delete(userId);
  invalidateBlockCache(userId);
  await clearRedisRevoked(userId);
}

/** Akhiri semua sesi DB + tandai revoke (TTL 24 jam) agar JWT lama gagal. */
export async function revokeUserSessions(userId: string) {
  const now = new Date();
  try {
    await prisma.userSession.updateMany({
      where: {
        userId,
        OR: [{ isCurrent: true }, { endedAt: null }],
      },
      data: { isCurrent: false, endedAt: now, lastSeenAt: now },
    });
  } catch (error) {
    console.error("[session-control] revoke sessions", error);
  }

  const until = Date.now() + REVOKE_TTL_MS;
  revokedUntilByUserId.set(userId, until);
  invalidateBlockCache(userId);
  await setRedisRevoked(userId, REVOKE_TTL_MS);
}

/**
 * Nonaktifkan akun, simpan kunci, dan cabut sesi.
 * `until` kosong = terkunci sampai unlock eksplisit.
 */
export async function lockUser(userId: string, until?: Date) {
  const lockUntil =
    until && until.getTime() > Date.now()
      ? until
      : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  } catch (error) {
    console.error("[session-control] lockUser prisma", error);
    throw error;
  }

  lockedUntilByUserId.set(userId, lockUntil);
  invalidateBlockCache(userId);
  await setRedisLocked(userId, lockUntil);
  await revokeUserSessions(userId);
}

export async function unlockUser(userId: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });
  } catch (error) {
    console.error("[session-control] unlockUser prisma", error);
    throw error;
  }

  lockedUntilByUserId.delete(userId);
  invalidateBlockCache(userId);
  await clearRedisLocked(userId);
  await clearUserRevocation(userId);
}

export async function isUserBlocked(userId: string): Promise<BlockedResult> {
  if (!userId) return { blocked: false };

  cleanupMemory();
  const cached = blockCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const now = Date.now();

  const memLock = lockedUntilByUserId.get(userId);
  if (memLock && memLock.getTime() > now) {
    const result: BlockedResult = { blocked: true, reason: "locked" };
    blockCache.set(userId, { result, expiresAt: now + BLOCK_CACHE_TTL_MS });
    return result;
  }

  const redisLock = await redisLockedUntil(userId);
  if (redisLock && redisLock.getTime() > now) {
    lockedUntilByUserId.set(userId, redisLock);
    const result: BlockedResult = { blocked: true, reason: "locked" };
    blockCache.set(userId, { result, expiresAt: now + BLOCK_CACHE_TTL_MS });
    return result;
  }

  const memRevokedUntil = revokedUntilByUserId.get(userId);
  if (memRevokedUntil && memRevokedUntil > now) {
    const result: BlockedResult = { blocked: true, reason: "revoked" };
    blockCache.set(userId, { result, expiresAt: now + BLOCK_CACHE_TTL_MS });
    return result;
  }

  const redisRevoked = await redisIsRevoked(userId);
  if (redisRevoked === true) {
    revokedUntilByUserId.set(userId, now + REVOKE_TTL_MS);
    const result: BlockedResult = { blocked: true, reason: "revoked" };
    blockCache.set(userId, { result, expiresAt: now + BLOCK_CACHE_TTL_MS });
    return result;
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, isDeleted: false },
      select: { isActive: true },
    });
    if (!user) {
      const result: BlockedResult = { blocked: true, reason: "inactive" };
      blockCache.set(userId, { result, expiresAt: now + BLOCK_CACHE_TTL_MS });
      return result;
    }
    if (!user.isActive) {
      const result: BlockedResult = { blocked: true, reason: "inactive" };
      blockCache.set(userId, { result, expiresAt: now + BLOCK_CACHE_TTL_MS });
      return result;
    }
  } catch (error) {
    console.error("[session-control] isUserBlocked db", error);
  }

  const result: BlockedResult = { blocked: false };
  blockCache.set(userId, { result, expiresAt: now + BLOCK_CACHE_TTL_MS });
  return result;
}

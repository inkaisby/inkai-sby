import { Redis } from "@upstash/redis";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getPrimaryAdminRole,
  type SessionUser,
} from "@/lib/rbac";
import {
  DB_LAST_SEEN_THROTTLE_MS,
  ONLINE_THRESHOLD_MS,
  REDIS_PRESENCE_TTL_SEC,
  canViewAccountPresence,
} from "@/lib/presence-constants";

export {
  ONLINE_THRESHOLD_MS,
  HEARTBEAT_INTERVAL_VISIBLE_MS,
  HEARTBEAT_INTERVAL_HIDDEN_MS,
  REDIS_PRESENCE_TTL_SEC,
  DB_LAST_SEEN_THROTTLE_MS,
  LOGIN_24H_MS,
  formatRelativeId,
  canViewAccountPresence,
  type PresenceListRow,
} from "@/lib/presence-constants";

const PRESENCE_KEY_PREFIX = "inkai-sby:presence:";
const DB_TOUCH_KEY_PREFIX = "inkai-sby:presence-db:";

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

function presenceKey(userId: string) {
  return `${PRESENCE_KEY_PREFIX}${userId}`;
}

function dbTouchKey(userId: string) {
  return `${DB_TOUCH_KEY_PREFIX}${userId}`;
}

export function isOnlineFromTimestamps(
  lastSeenAt: Date | null | undefined,
  redisOnline: boolean,
  now = Date.now(),
) {
  if (redisOnline) return true;
  if (!lastSeenAt) return false;
  return now - lastSeenAt.getTime() < ONLINE_THRESHOLD_MS;
}

export async function markUserLogin(userId: string) {
  const now = new Date();
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: now, lastSeenAt: now },
    });
  } catch (error) {
    console.error("[presence] markUserLogin", error);
  }
  await touchPresence(userId, { forceDb: true });
}

/**
 * Catat kehadiran. Redis (jika ada) = sinyal online cepat;
 * DB lastSeenAt di-throttle sebagai sumber daftar + fallback.
 */
export async function touchPresence(
  userId: string,
  opts?: { forceDb?: boolean },
) {
  const now = Date.now();
  const redis = getRedis();

  if (redis) {
    try {
      await redis.set(presenceKey(userId), String(now), {
        ex: REDIS_PRESENCE_TTL_SEC,
      });
    } catch (error) {
      console.error("[presence] redis set", error);
    }
  }

  let shouldWriteDb = Boolean(opts?.forceDb);
  if (!shouldWriteDb && redis) {
    try {
      const touched = await redis.set(dbTouchKey(userId), "1", {
        ex: Math.ceil(DB_LAST_SEEN_THROTTLE_MS / 1000),
        nx: true,
      });
      // Upstash: "OK" saat set; null bila key sudah ada (NX).
      shouldWriteDb = touched != null;
    } catch {
      shouldWriteDb = true;
    }
  } else if (!shouldWriteDb && !redis) {
    // Tanpa Redis: selalu tulis DB (interval client sudah 45–120 dtk).
    shouldWriteDb = true;
  }

  if (!shouldWriteDb) return;

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date(now) },
    });
  } catch (error) {
    console.error("[presence] lastSeenAt", error);
  }
}

/** Hapus sinyal online segera (logout / ganti akun). */
export async function clearPresence(userId: string) {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(presenceKey(userId), dbTouchKey(userId));
    } catch (error) {
      console.error("[presence] redis del", error);
    }
  }

  // Paksa offline di fallback DB tanpa menghapus lastLoginAt.
  const offlineAt = new Date(Date.now() - ONLINE_THRESHOLD_MS - 1000);
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: offlineAt },
    });
  } catch (error) {
    console.error("[presence] clearPresence db", error);
  }
}

export async function getRedisOnlineUserIds(
  userIds: string[],
): Promise<Set<string>> {
  const online = new Set<string>();
  if (userIds.length === 0) return online;
  const redis = getRedis();
  if (!redis) return online;

  try {
    const keys = userIds.map(presenceKey);
    const values = await redis.mget<(string | null)[]>(...keys);
    values.forEach((value, index) => {
      if (value != null && value !== "") {
        online.add(userIds[index]!);
      }
    });
  } catch (error) {
    console.error("[presence] redis mget", error);
  }
  return online;
}

/** Scope user yang boleh dilihat penonton presence. */
export function buildPresenceScopeWhere(
  viewer: SessionUser,
): Prisma.UserWhereInput | null {
  if (!canViewAccountPresence(viewer.roles)) return null;

  const role = getPrimaryAdminRole(viewer.roles);
  const base: Prisma.UserWhereInput = {
    isDeleted: false,
    isActive: true,
  };

  if (
    role === "ADMINISTRATOR" ||
    role === "ADMIN_PUSAT" ||
    role === "ADMIN"
  ) {
    return base;
  }

  if (role === "ADMIN_BRANCH" && viewer.managedBranchId) {
    const branchId = viewer.managedBranchId;
    return {
      ...base,
      OR: [
        { managedBranchId: branchId },
        { managedDojo: { is: { branchId } } },
        {
          member: {
            is: {
              isDeleted: false,
              dojo: { is: { branchId } },
            },
          },
        },
      ],
    };
  }

  return null;
}

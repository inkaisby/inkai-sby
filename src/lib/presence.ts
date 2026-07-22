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
import type { SessionAuditSnapshot } from "@/lib/session-audit-parse";
import { deviceSummary } from "@/lib/session-audit-parse";

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

function sessionDataFromSnapshot(snap: SessionAuditSnapshot) {
  return {
    ip: snap.ip,
    userAgent: snap.userAgent,
    deviceType: snap.deviceType,
    browser: snap.browser,
    os: snap.os,
    city: snap.city,
    region: snap.region,
    country: snap.country,
    locationLabel: snap.locationLabel,
    timezone: snap.timezone,
    language: snap.language,
    screen: snap.screen,
    platform: snap.platform,
  };
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

export async function markUserLogin(
  userId: string,
  snap?: SessionAuditSnapshot | null,
) {
  const now = new Date();
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: now, lastSeenAt: now },
    });
  } catch (error) {
    console.error("[presence] markUserLogin", error);
  }

  if (snap) {
    try {
      await prisma.userSession.updateMany({
        where: { userId, isCurrent: true, endedAt: null },
        data: { isCurrent: false, endedAt: now },
      });
      await prisma.userSession.create({
        data: {
          userId,
          startedAt: now,
          lastSeenAt: now,
          isCurrent: true,
          ...sessionDataFromSnapshot(snap),
        },
      });
      await prisma.auditLog.create({
        data: {
          userId,
          action: "USER_LOGIN",
          details: [
            deviceSummary(snap),
            snap.locationLabel,
            snap.ip ? `IP ${snap.ip}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          ip: snap.ip,
          userAgent: snap.userAgent,
          location: snap.locationLabel,
        },
      });
    } catch (error) {
      console.error("[presence] session create", error);
    }
  }

  await touchPresence(userId, { forceDb: true, snap: snap ?? undefined });
}

/**
 * Catat kehadiran. Redis (jika ada) = sinyal online cepat;
 * DB lastSeenAt di-throttle sebagai sumber daftar + fallback.
 */
export async function touchPresence(
  userId: string,
  opts?: { forceDb?: boolean; snap?: SessionAuditSnapshot },
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
      shouldWriteDb = touched != null;
    } catch {
      shouldWriteDb = true;
    }
  } else if (!shouldWriteDb && !redis) {
    shouldWriteDb = true;
  }

  // Snapshot sesi: bootstrap bila belum ada, atau perbarui jejak.
  if (opts?.snap) {
    try {
      const current = await prisma.userSession.findFirst({
        where: { userId, isCurrent: true, endedAt: null },
        orderBy: { startedAt: "desc" },
      });
      const stamp = new Date(now);

      if (!current) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { lastLoginAt: true },
        });
        await prisma.user.update({
          where: { id: userId },
          data: {
            lastSeenAt: stamp,
            ...(user?.lastLoginAt ? {} : { lastLoginAt: stamp }),
          },
        });
        await prisma.userSession.create({
          data: {
            userId,
            startedAt: stamp,
            lastSeenAt: stamp,
            isCurrent: true,
            ...sessionDataFromSnapshot(opts.snap),
          },
        });
        shouldWriteDb = false;
      } else if (shouldWriteDb || opts.forceDb) {
        const patch: Prisma.UserSessionUpdateInput = {
          lastSeenAt: stamp,
        };
        const needsFull =
          (opts.snap.ip && opts.snap.ip !== current.ip) ||
          !current.userAgent ||
          !current.deviceType;
        if (needsFull) {
          Object.assign(patch, sessionDataFromSnapshot(opts.snap));
        } else {
          if (!current.timezone && opts.snap.timezone) {
            patch.timezone = opts.snap.timezone;
          }
          if (!current.language && opts.snap.language) {
            patch.language = opts.snap.language;
          }
          if (!current.screen && opts.snap.screen) {
            patch.screen = opts.snap.screen;
          }
          if (!current.platform && opts.snap.platform) {
            patch.platform = opts.snap.platform;
          }
          if (!current.locationLabel && opts.snap.locationLabel) {
            patch.locationLabel = opts.snap.locationLabel;
            patch.city = opts.snap.city;
            patch.region = opts.snap.region;
            patch.country = opts.snap.country;
          }
        }
        await prisma.userSession.update({
          where: { id: current.id },
          data: patch,
        });
      }
    } catch (error) {
      console.error("[presence] session touch", error);
    }
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

  const now = new Date();
  const offlineAt = new Date(Date.now() - ONLINE_THRESHOLD_MS - 1000);
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: offlineAt },
    });
  } catch (error) {
    console.error("[presence] clearPresence db", error);
  }

  try {
    await prisma.userSession.updateMany({
      where: { userId, isCurrent: true, endedAt: null },
      data: { isCurrent: false, endedAt: now, lastSeenAt: now },
    });
    await prisma.auditLog.create({
      data: {
        userId,
        action: "USER_LOGOUT",
        details: "Sesi diakhiri",
      },
    });
  } catch (error) {
    console.error("[presence] end session", error);
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

export async function loadCurrentSessionsByUserIds(userIds: string[]) {
  if (userIds.length === 0) return new Map();
  const sessions = await prisma.userSession.findMany({
    where: {
      userId: { in: userIds },
      OR: [
        { isCurrent: true },
        { endedAt: null },
        { lastSeenAt: { gte: new Date(Date.now() - ONLINE_THRESHOLD_MS * 2) } },
      ],
    },
    orderBy: [{ isCurrent: "desc" }, { lastSeenAt: "desc" }],
  });

  const map = new Map<string, (typeof sessions)[number]>();
  for (const s of sessions) {
    if (!map.has(s.userId)) map.set(s.userId, s);
  }
  return map;
}

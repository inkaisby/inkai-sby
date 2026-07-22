import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS, getPrimaryAdminRole } from "@/lib/rbac";
import {
  LOGIN_24H_MS,
  ONLINE_THRESHOLD_MS,
  buildPresenceScopeWhere,
  canViewAccountPresence,
  getRedisOnlineUserIds,
  isOnlineFromTimestamps,
  loadCurrentSessionsByUserIds,
  type PresenceListRow,
} from "@/lib/presence";
import { deviceSummary } from "@/lib/session-audit-parse";
import {
  rateLimitAsync,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

function scopeLabelForUser(user: {
  roles: { name: string }[];
  managedDojo: { name: string } | null;
  managedBranch: { name: string } | null;
  managedProvince: { name: string } | null;
  member: { dojo: { name: string } | null } | null;
}) {
  return (
    user.managedDojo?.name ||
    user.member?.dojo?.name ||
    user.managedBranch?.name ||
    user.managedProvince?.name ||
    "—"
  );
}

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  lastSeenAt: true,
  lastLoginAt: true,
  roles: { select: { name: true } },
  managedDojo: { select: { name: true } },
  managedBranch: { select: { name: true } },
  managedProvince: { select: { name: true } },
  member: { select: { dojo: { select: { name: true } } } },
} as const;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewAccountPresence(session.user.roles ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = await rateLimitAsync(`presence:list:${session.user.id}`, {
    max: 60,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfterSec ?? 30);
  }

  const scope = buildPresenceScopeWhere(session.user);
  if (!scope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "online";
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  const now = Date.now();
  const onlineSince = new Date(now - ONLINE_THRESHOLD_MS);
  const loginSince = new Date(now - LOGIN_24H_MS);

  const activityWhere =
    status === "login24h"
      ? { lastLoginAt: { gte: loginSince } }
      : status === "all"
        ? {
            OR: [
              { lastSeenAt: { gte: onlineSince } },
              { lastLoginAt: { gte: loginSince } },
            ],
          }
        : { lastSeenAt: { gte: onlineSince } };

  const users = await prisma.user.findMany({
    where: { AND: [scope, activityWhere] },
    select: userSelect,
    orderBy: [{ lastSeenAt: "desc" }, { lastLoginAt: "desc" }],
    take: 300,
  });

  let candidates = users;
  if (status === "online" || status === "all") {
    const wider = await prisma.user.findMany({
      where: {
        AND: [
          scope,
          { lastSeenAt: { gte: new Date(now - ONLINE_THRESHOLD_MS * 2) } },
        ],
      },
      select: userSelect,
      orderBy: [{ lastSeenAt: "desc" }],
      take: 300,
    });
    const map = new Map(users.map((u) => [u.id, u]));
    for (const u of wider) map.set(u.id, u);
    candidates = [...map.values()];
  }

  const redisOnline = await getRedisOnlineUserIds(candidates.map((u) => u.id));
  const sessions = await loadCurrentSessionsByUserIds(
    candidates.map((u) => u.id),
  );

  let rows: PresenceListRow[] = candidates.map((user) => {
    const roles = user.roles.map((r) => r.name);
    const primary = getPrimaryAdminRole(roles);
    const online = isOnlineFromTimestamps(
      user.lastSeenAt,
      redisOnline.has(user.id),
      now,
    );
    const sess = sessions.get(user.id) ?? null;
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles,
      roleLabel: ROLE_LABELS[primary] || primary,
      scopeLabel: scopeLabelForUser(user),
      online,
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      lastLoginAt:
        user.lastLoginAt?.toISOString() ??
        sess?.startedAt?.toISOString() ??
        null,
      isSelf: user.id === session.user.id,
      session: sess
        ? {
            id: sess.id,
            ip: sess.ip,
            deviceType: sess.deviceType,
            browser: sess.browser,
            os: sess.os,
            deviceLabel: deviceSummary(sess),
            locationLabel: sess.locationLabel,
            city: sess.city,
            region: sess.region,
            country: sess.country,
            timezone: sess.timezone,
            language: sess.language,
            screen: sess.screen,
            platform: sess.platform,
            userAgent: sess.userAgent,
            startedAt: sess.startedAt.toISOString(),
            lastSeenAt: sess.lastSeenAt.toISOString(),
          }
        : null,
    };
  });

  if (status === "online") {
    rows = rows.filter((r) => r.online);
  } else if (status === "login24h") {
    rows = rows.filter(
      (r) =>
        r.lastLoginAt &&
        now - new Date(r.lastLoginAt).getTime() < LOGIN_24H_MS,
    );
  }

  if (q) {
    rows = rows.filter((r) => {
      const hay = [
        r.fullName,
        r.email,
        r.roleLabel,
        r.scopeLabel,
        r.session?.ip,
        r.session?.deviceLabel,
        r.session?.locationLabel,
        r.session?.browser,
        r.session?.os,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  rows.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    const aSeen = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
    const bSeen = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    if (aSeen !== bSeen) return bSeen - aSeen;
    return (a.fullName || a.email).localeCompare(b.fullName || b.email, "id");
  });

  const onlineCount = rows.filter((r) => r.online).length;
  const login24hCount = rows.filter(
    (r) =>
      r.lastLoginAt &&
      now - new Date(r.lastLoginAt).getTime() < LOGIN_24H_MS,
  ).length;

  const [kpiOnline, kpiLogin24h, kpiTotal] = await Promise.all([
    prisma.user.count({
      where: { AND: [scope, { lastSeenAt: { gte: onlineSince } }] },
    }),
    prisma.user.count({
      where: { AND: [scope, { lastLoginAt: { gte: loginSince } }] },
    }),
    prisma.user.count({ where: scope }),
  ]);

  return NextResponse.json({
    generatedAt: new Date(now).toISOString(),
    onlineThresholdMs: ONLINE_THRESHOLD_MS,
    kpi: {
      online: Math.max(kpiOnline, onlineCount),
      login24h: kpiLogin24h,
      totalAccounts: kpiTotal,
    },
    rows,
    meta: {
      onlineInResult: onlineCount,
      login24hInResult: login24hCount,
      count: rows.length,
    },
  });
}

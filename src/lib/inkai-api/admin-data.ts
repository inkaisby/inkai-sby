import { cache } from "react";
import { inkaiFetch } from "./server";
import {
  getPrimaryAdminRole,
  buildMemberFilter,
  buildDojoFilter,
  type SessionUser,
} from "@/lib/rbac";
import { resolveUktRankColumns } from "@/lib/belt";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import {
  beltFeesFromTemplates,
  DEFAULT_KOMISI_RANTING,
  UKT_KOMISI_SETTING_KEY,
  uktBaseFeeAmount,
  resolveUktSelectedPeriodId,
  computeSemesterAttendance,
  buildUktSemesterWindow,
  buildUktExamResultMap,
  buildUktExamAttendanceMap,
  buildUktDepositMap,
  buildUktWaiverMap,
  parseUktPeriodMetaValue,
  uktPeriodMetaKey,
  type UktExamResult,
  type UktMemberRow,
  type UktPeriodMeta,
  type UktDepositRecord,
  type UktRegistrationWaiver,
  type UktSemester,
} from "@/lib/ukt";

export type AdminMemberRow = {
  id: string;
  fullName: string;
  nia: string | null;
  currentRank: string;
  status: string;
  dojo: { name: string; branch?: { name: string } };
  birthCertificateUrl?: string | null;
  bpjsCardUrl?: string | null;
  bpjsCardNumber?: string | null;
  photoUrl?: string | null;
  /** Waktu terdaftar di sistem (ISO dari API). */
  createdAt?: string | null;
  /** Nominal iuran bulanan per anggota. */
  monthlyDuesAmount?: number | null;
};

function listMetaTotal(data: Record<string, unknown>, fallback: number) {
  const meta = (data.meta as { total?: number } | undefined) ?? {};
  return meta.total ?? fallback;
}

function filterUktEvents(events: Array<Record<string, unknown>>) {
  return events.filter((e) => String(e.title).toUpperCase().includes("UKT"));
}

export async function fetchAdminMembers(
  token: string,
  opts: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    dojoId?: string;
  } = {},
) {
  try {
    const qs = new URLSearchParams();
    qs.set("page", String(opts.page ?? 1));
    qs.set("limit", String(opts.limit ?? 20));
    if (opts.search) qs.set("search", opts.search);
    if (opts.status) qs.set("status", opts.status);
    if (opts.dojoId) qs.set("dojoId", opts.dojoId);

    const { res, data } = await inkaiFetch(`/v1/members?${qs}`, {}, token);
    if (!res.ok) return { ok: false as const, error: "Gagal memuat anggota" };

    const raw = (data.data as Array<AdminMemberRow & { createdAt?: string | null }>) ?? [];
    const meta =
      (data.meta as { total?: number; page?: number; limit?: number }) ?? {};

    const missingIds = raw
      .filter((m) => !m.createdAt || m.monthlyDuesAmount == null)
      .map((m) => m.id)
      .filter(Boolean);
    let createdAtById = new Map<string, string>();
    let duesById = new Map<string, number>();
    if (missingIds.length > 0) {
      const local = await withPrismaFallback(
        "admin-members-createdAt",
        () =>
          prisma.member.findMany({
            where: { id: { in: missingIds } },
            select: { id: true, createdAt: true, monthlyDuesAmount: true },
          }),
        [] as Array<{ id: string; createdAt: Date; monthlyDuesAmount: number }>,
      );
      createdAtById = new Map(
        (local.data ?? []).map((r) => [r.id, r.createdAt.toISOString()]),
      );
      duesById = new Map(
        (local.data ?? []).map((r) => [r.id, r.monthlyDuesAmount]),
      );
    }

    const members: AdminMemberRow[] = raw.map((m) => ({
      ...m,
      createdAt: m.createdAt ?? createdAtById.get(m.id) ?? null,
      monthlyDuesAmount:
        m.monthlyDuesAmount ?? duesById.get(m.id) ?? null,
    }));

    return {
      ok: true as const,
      members,
      total: meta.total ?? members.length,
      page: meta.page ?? 1,
    };
  } catch (error) {
    console.error("[fetchAdminMembers]", error);
    return { ok: false as const, error: "Gagal memuat anggota" };
  }
}

export type MemberStatusCounts = {
  all: number;
  pending: number;
  active: number;
  inactive: number;
  rejected: number;
  /** Akte atau BPJS belum ada. */
  docsIncomplete: number;
  /** NIA kosong / null. */
  missingNia: number;
};

function memberScopeWhere(
  user: SessionUser,
  opts?: { dojoId?: string; dojoIds?: string[] },
) {
  const scope = buildMemberFilter(user);
  const refine =
    opts?.dojoIds && opts.dojoIds.length > 0
      ? { dojoId: { in: [...new Set(opts.dojoIds.filter(Boolean))] } }
      : opts?.dojoId
        ? { dojoId: opts.dojoId }
        : null;
  return refine ? { AND: [scope, refine] } : scope;
}

/** Dokumen kurang: akte atau BPJS kosong (selaras isDocumentComplete). */
function docsIncompleteClause() {
  return {
    OR: [
      { birthCertificateUrl: null },
      { birthCertificateUrl: "" },
      { bpjsCardUrl: null },
      { bpjsCardUrl: "" },
    ],
  };
}

function missingNiaClause() {
  return {
    OR: [{ nia: null }, { nia: "" }],
  };
}

/** Satu query Prisma groupBy + count dokumen/NIA untuk KPI — selalu scoped RBAC. */
export async function fetchAdminMemberStatusCounts(
  user: SessionUser,
  opts: {
    dojoIds?: string[];
    dojoId?: string;
  } = {},
): Promise<MemberStatusCounts> {
  const where = memberScopeWhere(user, opts);

  const [statusResult, docsResult, niaResult] = await Promise.all([
    withPrismaFallback(
      "admin-member-status-counts",
      () =>
        prisma.member.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
        }),
      [] as Array<{ status: string; _count: { _all: number } }>,
    ),
    withPrismaFallback(
      "admin-member-docs-incomplete",
      () =>
        prisma.member.count({
          where: { AND: [where, docsIncompleteClause()] },
        }),
      0,
    ),
    withPrismaFallback(
      "admin-member-missing-nia",
      () =>
        prisma.member.count({
          where: { AND: [where, missingNiaClause()] },
        }),
      0,
    ),
  ]);

  const counts: MemberStatusCounts = {
    all: 0,
    pending: 0,
    active: 0,
    inactive: 0,
    rejected: 0,
    docsIncomplete: docsResult.data,
    missingNia: niaResult.data,
  };

  for (const row of statusResult.data) {
    const n = row._count._all;
    counts.all += n;
    const st = row.status.trim().toUpperCase();
    if (st === "PENDING") counts.pending += n;
    else if (st === "ACTIVE" || st === "AKTIF") counts.active += n;
    else if (st === "INACTIVE" || st === "SUSPENDED") counts.inactive += n;
    else if (st === "REJECTED") counts.rejected += n;
  }

  return counts;
}

/**
 * Daftar anggota scoped RBAC via Prisma (cabang/ranting/pengprov).
 * Satu sumber kebenaran dengan KPI — menghindari total Inkai yang beda cakupan.
 */
export async function fetchAdminMembersScoped(
  user: SessionUser,
  opts: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    dojoId?: string;
    dojoIds?: string[];
    /** Filter KPI: dokumen akte/BPJS kurang. */
    docsIncomplete?: boolean;
    /** Filter KPI: tanpa NIA. */
    missingNia?: boolean;
  } = {},
) {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const search = opts.search?.trim();
  const status = opts.status?.trim();

  const where = {
    AND: [
      memberScopeWhere(user, {
        dojoId: opts.dojoId,
        dojoIds: opts.dojoIds,
      }),
      ...(status
        ? [{ status: { equals: status, mode: "insensitive" as const } }]
        : []),
      ...(opts.docsIncomplete ? [docsIncompleteClause()] : []),
      ...(opts.missingNia ? [missingNiaClause()] : []),
      ...(search
        ? [
            {
              OR: [
                {
                  fullName: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
                { nia: { contains: search, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  };

  try {
    const [total, rows] = await Promise.all([
      prisma.member.count({ where }),
      prisma.member.findMany({
        where,
        include: {
          dojo: {
            select: {
              name: true,
              branch: { select: { name: true } },
            },
          },
          user: { select: { photoUrl: true } },
        },
        orderBy: { fullName: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const members: AdminMemberRow[] = rows.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      nia: m.nia,
      currentRank: m.currentRank,
      status: m.status,
      dojo: {
        name: m.dojo.name,
        branch: m.dojo.branch ? { name: m.dojo.branch.name } : undefined,
      },
      birthCertificateUrl: m.birthCertificateUrl,
      bpjsCardUrl: m.bpjsCardUrl,
      bpjsCardNumber: m.bpjsCardNumber,
      photoUrl: m.user?.photoUrl ?? null,
      createdAt: m.createdAt.toISOString(),
      monthlyDuesAmount: m.monthlyDuesAmount,
    }));

    return { ok: true as const, members, total, page };
  } catch (error) {
    console.error("[fetchAdminMembersScoped]", error);
    return { ok: false as const, error: "Gagal memuat anggota" };
  }
}

/**
 * Ambil anggota untuk satu atau banyak dojo via Prisma (DB bersama).
 * Selalu Prisma — token Inkai sering scoped ke ranting utama saja, sehingga
 * filter dojoId ke API bisa mengabaikan pilihan "Kelola ranting".
 */
export async function fetchAdminMembersForDojoIds(
  token: string,
  dojoIds: string[],
  opts: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  } = {},
) {
  const ids = [...new Set(dojoIds.filter(Boolean))];
  if (ids.length === 0) {
    return { ok: true as const, members: [] as AdminMemberRow[], total: 0, page: 1 };
  }

  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const search = opts.search?.trim();
  const status = opts.status?.trim();

  const where = {
    isDeleted: false,
    dojoId: { in: ids },
    ...(status
      ? { status: { equals: status, mode: "insensitive" as const } }
      : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" as const } },
            { nia: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  try {
    const [total, rows] = await Promise.all([
      prisma.member.count({ where }),
      prisma.member.findMany({
        where,
        include: {
          dojo: {
            select: {
              name: true,
              branch: { select: { name: true } },
            },
          },
          user: { select: { photoUrl: true } },
        },
        orderBy: { fullName: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const members: AdminMemberRow[] = rows.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      nia: m.nia,
      currentRank: m.currentRank,
      status: m.status,
      dojo: {
        name: m.dojo.name,
        branch: m.dojo.branch ? { name: m.dojo.branch.name } : undefined,
      },
      birthCertificateUrl: m.birthCertificateUrl,
      bpjsCardUrl: m.bpjsCardUrl,
      bpjsCardNumber: m.bpjsCardNumber,
      photoUrl: m.user?.photoUrl ?? null,
      createdAt: m.createdAt.toISOString(),
      monthlyDuesAmount: m.monthlyDuesAmount,
    }));

    return { ok: true as const, members, total, page };
  } catch (error) {
    console.error("[fetchAdminMembersForDojoIds]", error);
    // Fallback: gabungkan fetch API per dojo (token mungkin mengabaikan dojoId non-primer)
    const chunks = await Promise.all(
      ids.map((id) =>
        fetchAdminMembers(token, { ...opts, dojoId: id, page: 1, limit: 500 }),
      ),
    );
    const merged: AdminMemberRow[] = [];
    for (const chunk of chunks) {
      if (chunk.ok) merged.push(...chunk.members);
    }
    const start = (page - 1) * limit;
    return {
      ok: true as const,
      members: merged.slice(start, start + limit),
      total: merged.length,
      page,
    };
  }
}

export async function fetchDashboardStats(token: string) {
  const { res, data } = await inkaiFetch("/v1/dashboard/stats", {}, token);
  if (!res.ok) return null;
  return (data.data as Record<string, unknown>) ?? null;
}

export async function fetchRecentMembers(token: string) {
  const { res, data } = await inkaiFetch("/v1/dashboard/recent-activities", {}, token);
  if (!res.ok) return [];
  return (data.data as AdminMemberRow[]) ?? [];
}

export async function fetchPendingMembersCount(token: string) {
  const { res, data } = await inkaiFetch("/v1/members?status=PENDING&limit=1&page=1", {}, token);
  if (!res.ok) return 0;
  const members = (data.data as unknown[]) ?? [];
  return listMetaTotal(data, members.length);
}

export async function fetchPendingVerificationsCount(token: string) {
  const { res, data } = await inkaiFetch("/v1/verifications/pending?limit=1", {}, token);
  if (!res.ok) return 0;
  const items = (data.data as unknown[]) ?? [];
  return listMetaTotal(data, items.length);
}

export async function fetchPendingBillingsCount(token: string) {
  const { res, data } = await inkaiFetch(
    "/v1/billing?status=WAITING_VERIFICATION&limit=1",
    {},
    token,
  );
  if (!res.ok) return 0;
  const items = (data.data as unknown[]) ?? [];
  return listMetaTotal(data, items.length);
}

export async function fetchPendingVerifications(token: string) {
  const { res, data } = await inkaiFetch("/v1/verifications/pending", {}, token);
  if (!res.ok) return [];
  return (data.data as unknown[]) ?? [];
}

export async function fetchPendingBillings(token: string) {
  const { res, data } = await inkaiFetch("/v1/billing?status=WAITING_VERIFICATION", {}, token);
  if (!res.ok) return [];
  return (data.data as unknown[]) ?? [];
}

export async function fetchUpcomingEvents(token: string, limit = 10) {
  const { res, data } = await inkaiFetch(`/v1/events?limit=${limit + 10}`, {}, token);
  if (!res.ok) return [];
  const events = (data.data as Array<Record<string, unknown>>) ?? [];
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  return events
    .filter((e) => new Date(String(e.startDate)).getTime() >= cutoff)
    .sort((a, b) => new Date(String(a.startDate)).getTime() - new Date(String(b.startDate)).getTime())
    .slice(0, limit);
}

export async function fetchMyNotifications(
  token: string,
  user?: SessionUser,
) {
  const { res, data } = await inkaiFetch("/v1/notifications/my", {}, token);
  if (!res.ok) return { items: [], unread: 0 };
  let items = (data.data as Array<Record<string, unknown>>) ?? [];
  if (user) {
    const { filterNotificationsForAdminScope } = await import(
      "@/lib/admin-notify-scope"
    );
    items = await filterNotificationsForAdminScope(user, items);
  }
  const unread = items.filter((n) => !n.isRead).length;
  return { items: items.slice(0, 5), unread };
}

export async function fetchAllNotifications(
  token: string,
  limit = 100,
  user?: SessionUser,
) {
  const { res, data } = await inkaiFetch("/v1/notifications/my", {}, token);
  if (!res.ok) return [];
  let items = (data.data as Array<Record<string, unknown>>) ?? [];
  if (user) {
    const { filterNotificationsForAdminScope } = await import(
      "@/lib/admin-notify-scope"
    );
    items = await filterNotificationsForAdminScope(user, items);
  }
  return items.slice(0, limit);
}

export async function fetchPendingVerificationClaims(token: string) {
  const { res, data } = await inkaiFetch("/v1/verifications/pending", {}, token);
  const apiClaims = res.ok
    ? ((data.data as Array<Record<string, unknown>>) ?? [])
    : [];

  // Gabung klaim lokal (pindah dojo / piagam / reset password) agar selalu terlihat
  const localRes = await withPrismaFallback(
    "pending-local-verifications",
    () =>
      prisma.verification.findMany({
        where: {
          status: "PENDING",
          type: {
            in: [
              "PASSWORD_RESET",
              "DOJO_TRANSFER",
              "TRANSFER",
              "ACHIEVEMENT",
              "DOCUMENT",
            ],
          },
        },
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
              nia: true,
              dojo: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    [] as Array<Record<string, unknown>>,
  );

  const byId = new Map<string, Record<string, unknown>>();
  for (const c of apiClaims) {
    byId.set(String(c.id), c);
  }
  for (const c of localRes.data as Array<Record<string, unknown>>) {
    const id = String(c.id);
    if (!byId.has(id)) byId.set(id, c);
  }
  return Array.from(byId.values());
}

export async function fetchBillings(
  token: string,
  opts: { status?: string; limit?: number } = {},
) {
  const qs = new URLSearchParams();
  qs.set("limit", String(opts.limit ?? 100));
  if (opts.status) qs.set("status", opts.status);
  const { res, data } = await inkaiFetch(`/v1/billing?${qs}`, {}, token);
  if (!res.ok) return [];
  return (data.data as Array<Record<string, unknown>>) ?? [];
}

export async function fetchAttendanceLogs(
  token: string,
  opts: {
    date?: string;
    from?: string;
    to?: string;
    limit?: number;
  } = {},
) {
  const qs = new URLSearchParams();
  qs.set("limit", String(opts.limit ?? 200));
  if (opts.date) qs.set("date", opts.date);
  if (opts.from) qs.set("from", opts.from);
  if (opts.to) qs.set("to", opts.to);
  const { res, data } = await inkaiFetch(`/v1/attendance?${qs}`, {}, token);
  if (!res.ok) return [];
  let rows = (data.data as Array<Record<string, unknown>>) ?? [];

  // Client-side window if API ignores from/to
  if (opts.from || opts.to) {
    const fromMs = opts.from ? new Date(opts.from).getTime() : Number.NEGATIVE_INFINITY;
    const toMs = opts.to ? new Date(opts.to).getTime() : Number.POSITIVE_INFINITY;
    rows = rows.filter((row) => {
      const t = new Date(String(row.checkInAt ?? "")).getTime();
      return Number.isFinite(t) && t >= fromMs && t <= toMs;
    });
  }

  return rows;
}

export const fetchAdminEvents = cache(async (token: string, limit = 50) => {
  const { res, data } = await inkaiFetch(`/v1/events?limit=${Math.max(limit, 20)}`, {}, token);
  if (!res.ok) return [];
  const events = (data.data as Array<Record<string, unknown>>) ?? [];
  return events
    .sort((a, b) => new Date(String(b.startDate)).getTime() - new Date(String(a.startDate)).getTime())
    .slice(0, limit);
});

export const fetchOrgStructure = cache(async (token: string) => {
  try {
    // Full org tree can be slow under load — longer timeout + one retry.
    const { res, data } = await inkaiFetch("/v1/org/provinces", {}, token, {
      timeoutMs: 25_000,
      retries: 1,
    });
    if (!res.ok) return { provinces: [], branches: [], dojos: [] };

    const provinces = (data.data as Array<Record<string, unknown>>) ?? [];
    const branches: Array<Record<string, unknown>> = [];
    const dojos: Array<Record<string, unknown>> = [];
    for (const p of provinces) {
      for (const b of (p.branches as Array<Record<string, unknown>>) ?? []) {
        branches.push({ ...b, province: { id: p.id, name: p.name } });
        for (const d of (b.dojos as Array<Record<string, unknown>>) ?? []) {
          dojos.push({
            ...d,
            branch: {
              id: b.id,
              name: b.name,
              province: { id: p.id, name: p.name },
            },
            _count: {
              members: (d._count as { members?: number })?.members ?? 0,
            },
          });
        }
      }
    }
    return { provinces, branches, dojos };
  } catch (error) {
    console.error("[fetchOrgStructure]", error);
    return { provinces: [], branches: [], dojos: [] };
  }
});

export const fetchAdminDojos = cache(async (token: string) => {
  const { res, data } = await inkaiFetch("/v1/org/dojos/all", {}, token);
  if (!res.ok) return [];
  return ((data.data as Array<{ id: string; name: string }>) ?? []).map((d) => ({
    id: String(d.id),
    name: String(d.name),
  }));
});

/**
 * Daftar dojo scoped RBAC via Prisma — cepat untuk filter/form admin
 * (hindari round-trip Inkai `/v1/org/dojos/all` di setiap navigasi filter).
 */
export async function fetchAdminDojosScoped(user: SessionUser) {
  try {
    return await prisma.dojo.findMany({
      where: buildDojoFilter(user),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("[fetchAdminDojosScoped]", error);
    return [] as Array<{ id: string; name: string }>;
  }
}

export async function fetchCarouselItems(): Promise<
  Array<{
    id: string;
    title: string;
    imageUrl: string;
    targetUrl: string | null;
    order: number;
    isActive: boolean;
  }>
> {
  const { res, data } = await inkaiFetch("/v1/news-carousel", {}, null);
  if (!res.ok) return [];
  const items = (data.data as Array<Record<string, unknown>>) ?? [];
  return items
    .map((i) => ({
      id: String(i.id),
      title: String(i.title ?? ""),
      imageUrl: String(i.imageUrl ?? ""),
      targetUrl: (i.targetUrl as string | null) ?? null,
      order: Number(i.order ?? 0),
      isActive: i.isActive === true,
    }))
    .sort((a, b) => a.order - b.order);
}

export async function fetchAuditLogs(token: string, limit = 100) {
  const { res, data } = await inkaiFetch(`/v1/audit-logs?limit=${limit}`, {}, token);
  if (!res.ok) return [];
  const payload = (data.data as { logs?: Array<Record<string, unknown>> }) ?? {};
  return payload.logs ?? [];
}

export async function fetchUktPeriods(token: string) {
  const { res, data } = await inkaiFetch("/v1/events?limit=200", {}, token);
  if (!res.ok) return [];
  return filterUktEvents((data.data as Array<Record<string, unknown>>) ?? []);
}

export async function fetchEventDetail(token: string, eventId: string) {
  const { res, data } = await inkaiFetch(`/v1/events/${eventId}`, {}, token);
  if (!res.ok) return null;
  return (data.data as Record<string, unknown>) ?? null;
}

function periodOptionFromEvent(event: Record<string, unknown>, idFallback?: string) {
  return {
    id: String(event.id ?? idFallback ?? ""),
    title: String(event.title ?? ""),
    startDate: String(event.startDate ?? ""),
    endDate: String(event.endDate ?? ""),
    registrationCloseAt: event.registrationCloseAt
      ? String(event.registrationCloseAt)
      : null,
  };
}

function upsertPeriodOption(
  periods: ReturnType<typeof periodOptionFromEvent>[],
  next: ReturnType<typeof periodOptionFromEvent>,
) {
  const idx = periods.findIndex((p) => p.id === next.id);
  if (idx < 0) return [...periods, next];
  return periods.map((p, i) => (i === idx ? { ...p, ...next } : p));
}

export async function fetchUktKomisiRanting(token: string, key: string, fallback: number) {
  const { res, data } = await inkaiFetch(`/v1/settings/${encodeURIComponent(key)}`, {}, token);
  if (!res.ok) return fallback;
  const value = (data.data as { value?: unknown } | undefined)?.value;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  return fallback;
}

export async function fetchSettingsByPrefix(token: string, prefix: string) {
  const { res, data } = await inkaiFetch(
    `/v1/settings?prefix=${encodeURIComponent(prefix)}`,
    {},
    token,
  );
  if (!res.ok) return [];
  return (data.data as Array<{ key: string; value: unknown }>) ?? [];
}

export async function fetchAdminDashboardBundle(
  token: string,
  user?: SessionUser,
) {
  const [stats, recent, pendingCount, pendingVerifications, pendingBillings, events, notifications] =
    await Promise.all([
      fetchDashboardStats(token),
      fetchRecentMembers(token),
      fetchPendingMembersCount(token),
      fetchPendingVerificationsCount(token),
      fetchPendingBillingsCount(token),
      fetchUpcomingEvents(token, 10),
      fetchMyNotifications(token, user),
    ]);

  return {
    stats,
    recentMembers: recent,
    pendingCount,
    pendingVerifications,
    pendingBillings,
    upcomingEvents: events.slice(0, 3),
    notifications,
  };
}

function buildBillingCountMap(billings: Array<Record<string, unknown>>) {
  const counts = new Map<string, number>();
  for (const b of billings) {
    const status = String(b.status ?? "");
    if (status !== "PENDING" && status !== "WAITING_VERIFICATION") continue;
    const memberId = String(b.memberId ?? "");
    if (memberId) counts.set(memberId, (counts.get(memberId) ?? 0) + 1);
  }
  return counts;
}

function buildVerificationCountMap(verifications: Array<Record<string, unknown>>) {
  const counts = new Map<string, number>();
  for (const v of verifications) {
    const member = v.member as { id?: string } | undefined;
    const memberId = String(member?.id ?? "");
    if (memberId) counts.set(memberId, (counts.get(memberId) ?? 0) + 1);
  }
  return counts;
}

export async function fetchUktDashboardData(
  token: string,
  user: SessionUser,
  opts: {
    periodFromUrl?: string | null;
    semester: UktSemester;
    year: number;
    /** Mode buat periode: jangan auto-pilih event yang sudah ada. */
    forceNoPeriod?: boolean;
  },
) {
  const { periodFromUrl = null, semester, year, forceNoPeriod = false } = opts;
  const { semesterStart, semesterEnd } = buildUktSemesterWindow(semester, year);
  const attendanceFrom = semesterStart.toISOString();
  const attendanceTo = semesterEnd.toISOString();
  const primaryRole = getPrimaryAdminRole(user.roles);
  const dojoAllowlist =
    primaryRole === "ADMIN_DOJO"
      ? user.managedDojoIds && user.managedDojoIds.length > 0
        ? user.managedDojoIds
        : user.managedDojoId
          ? [user.managedDojoId]
          : []
      : [];

  const membersPromise =
    dojoAllowlist.length > 1
      ? fetchAdminMembersForDojoIds(token, dojoAllowlist, {
          limit: 500,
          page: 1,
        })
      : fetchAdminMembers(token, {
          limit: dojoAllowlist.length === 1 ? 250 : 500,
          page: 1,
          dojoId: dojoAllowlist[0],
        });

  const [
    eventsRes,
    dojosRaw,
    membersResult,
    feesRes,
    komisiRanting,
    billingsRes,
    pendingVerificationsRes,
    attendanceRes,
    eventDetailInitial,
    examSettingsInitial,
    waiverSettingsInitial,
    examAttendanceInitial,
    depositSettingsInitial,
    periodMetaInitial,
  ] = await Promise.all([
    inkaiFetch("/v1/events?limit=200", {}, token),
    fetchAdminDojos(token),
    membersPromise,
    inkaiFetch("/v1/events/rank-fee-templates", {}, token),
    fetchUktKomisiRanting(token, UKT_KOMISI_SETTING_KEY, DEFAULT_KOMISI_RANTING),
    inkaiFetch("/v1/billing?limit=250", {}, token),
    inkaiFetch("/v1/verifications/pending", {}, token),
    fetchAttendanceLogs(token, {
      from: attendanceFrom,
      to: attendanceTo,
      limit: 800,
    }),
    periodFromUrl ? fetchEventDetail(token, periodFromUrl) : Promise.resolve(null),
    periodFromUrl
      ? fetchSettingsByPrefix(token, `ukt-exam-result:${periodFromUrl}:`)
      : Promise.resolve([]),
    periodFromUrl
      ? fetchSettingsByPrefix(token, `ukt-registration-waiver:${periodFromUrl}:`)
      : Promise.resolve([]),
    periodFromUrl
      ? fetchSettingsByPrefix(token, `ukt-exam-attendance:${periodFromUrl}:`)
      : Promise.resolve([]),
    periodFromUrl
      ? fetchSettingsByPrefix(token, `ukt-deposit:${periodFromUrl}:`)
      : Promise.resolve([]),
    periodFromUrl
      ? inkaiFetch(
          `/v1/settings/${encodeURIComponent(uktPeriodMetaKey(periodFromUrl))}`,
          {},
          token,
        ).then(({ res, data }) =>
          res.ok ? ((data.data as { value?: unknown })?.value ?? null) : null,
        )
      : Promise.resolve(null),
  ]);

  const dojos =
    dojoAllowlist.length > 0
      ? dojosRaw.filter((d) => dojoAllowlist.includes(d.id))
      : dojosRaw;

  let periods = eventsRes.res.ok
    ? filterUktEvents((eventsRes.data.data as Array<Record<string, unknown>>) ?? []).map((p) =>
        periodOptionFromEvent(p),
      )
    : [];

  // Pastikan periode dari URL masuk daftar (list events bisa miss).
  if (
    periodFromUrl &&
    eventDetailInitial &&
    String(eventDetailInitial.title ?? "")
      .toUpperCase()
      .includes("UKT")
  ) {
    periods = upsertPeriodOption(
      periods,
      periodOptionFromEvent(eventDetailInitial, periodFromUrl),
    );
  }

  let selectedPeriodId = forceNoPeriod
    ? null
    : resolveUktSelectedPeriodId(periods, semester, year, periodFromUrl);
  let eventDetail = eventDetailInitial;
  let examSettings = examSettingsInitial;
  let waiverSettings = waiverSettingsInitial;
  let examAttendanceSettings = examAttendanceInitial;
  let depositSettings = depositSettingsInitial;
  let periodMetaValue = periodMetaInitial;

  if (selectedPeriodId && selectedPeriodId !== periodFromUrl) {
    const [detail, exams, waivers, attendance, deposits, metaRes] =
      await Promise.all([
        fetchEventDetail(token, selectedPeriodId),
        fetchSettingsByPrefix(token, `ukt-exam-result:${selectedPeriodId}:`),
        fetchSettingsByPrefix(token, `ukt-registration-waiver:${selectedPeriodId}:`),
        fetchSettingsByPrefix(token, `ukt-exam-attendance:${selectedPeriodId}:`),
        fetchSettingsByPrefix(token, `ukt-deposit:${selectedPeriodId}:`),
        inkaiFetch(
          `/v1/settings/${encodeURIComponent(uktPeriodMetaKey(selectedPeriodId))}`,
          {},
          token,
        ),
      ]);
    eventDetail = detail;
    examSettings = exams;
    waiverSettings = waivers;
    examAttendanceSettings = attendance;
    depositSettings = deposits;
    periodMetaValue = metaRes.res.ok
      ? ((metaRes.data.data as { value?: unknown })?.value ?? null)
      : null;
  }

  // Sinkronkan tanggal/batas pendaftaran dari detail event agar kartu "Atur" akurat.
  if (selectedPeriodId && eventDetail) {
    periods = upsertPeriodOption(
      periods,
      periodOptionFromEvent(eventDetail, selectedPeriodId),
    );
  }

  const attendanceLogs = attendanceRes.map((log) => {
    const member = log.member as { id?: string } | undefined;
    return {
      checkInAt: String(log.checkInAt ?? log.createdAt ?? ""),
      memberId: String(member?.id ?? log.memberId ?? ""),
    };
  });
  const { countByMember, pctByMember } = computeSemesterAttendance(
    attendanceLogs,
    semester,
    year,
  );
  const examResultMap = selectedPeriodId
    ? buildUktExamResultMap(examSettings, selectedPeriodId)
    : new Map<string, UktExamResult>();
  const examAttendanceMap = selectedPeriodId
    ? buildUktExamAttendanceMap(examAttendanceSettings, selectedPeriodId)
    : new Map<string, boolean>();
  const depositMap = selectedPeriodId
    ? buildUktDepositMap(depositSettings, selectedPeriodId)
    : new Map<string, UktDepositRecord>();
  const periodMeta: UktPeriodMeta = parseUktPeriodMetaValue(periodMetaValue);
  const waiverMap = selectedPeriodId
    ? buildUktWaiverMap(waiverSettings, selectedPeriodId)
    : new Map<string, UktRegistrationWaiver>();

  const beltFees = feesRes.res.ok
    ? beltFeesFromTemplates(
        (feesRes.data.data as Array<{ rankName: string; fee: number }>) ?? [],
      )
    : beltFeesFromTemplates([]);

  const members = (membersResult.ok ? membersResult.members : []) as Array<
    AdminMemberRow & Record<string, unknown>
  >;

  const billingCountByMember = billingsRes.res.ok
    ? buildBillingCountMap((billingsRes.data.data as Array<Record<string, unknown>>) ?? [])
    : new Map<string, number>();

  const verificationCountByMember = pendingVerificationsRes.res.ok
    ? buildVerificationCountMap(
        (pendingVerificationsRes.data.data as Array<Record<string, unknown>>) ?? [],
      )
    : new Map<string, number>();

  const regMap = new Map<string, Record<string, unknown>>();
  const billingMap = new Map<string, Record<string, unknown>>();

  if (selectedPeriodId && eventDetail) {
    const registrations = (eventDetail.registrations as Array<Record<string, unknown>>) ?? [];
    for (const reg of registrations) {
      regMap.set(String((reg.member as { id?: string })?.id ?? reg.memberId), reg);
      const member = reg.member as Record<string, unknown> | undefined;
      const billings = (member?.billings as Array<Record<string, unknown>>) ?? [];
      const billing = billings.find((b) => b.registrationId === reg.id) ?? billings[0];
      if (billing?.registrationId) billingMap.set(String(billing.registrationId), billing);
    }
  }

  const allRows: UktMemberRow[] = members.map((m) => {
    const reg = regMap.get(m.id);
    const regBilling = reg ? billingMap.get(String(reg.id)) : null;
    const category = reg?.category as { name?: string } | null | undefined;
    const memberUser = reg?.member as { user?: { photoUrl?: string } } | undefined;
    const memberData = (reg?.member as Record<string, unknown> | undefined) ?? m;
    const { kyuLama, kyuBaru } = resolveUktRankColumns(
      typeof reg?.registeredRank === "string" ? reg.registeredRank : null,
      m.currentRank,
      category?.name,
    );

    return {
      memberId: m.id,
      registrationId: reg?.id ? String(reg.id) : null,
      photoUrl: memberUser?.user?.photoUrl ?? null,
      nia: m.nia,
      fullName: m.fullName,
      birthPlace: (memberData.birthPlace as string | null) ?? null,
      birthDate: memberData.birthDate ? String(memberData.birthDate) : null,
      gender: (memberData.gender as string | null) ?? null,
      address: (memberData.address as string | null) ?? null,
      kyuLama,
      kyuBaru,
      birthCertificateUrl: (memberData.birthCertificateUrl as string | null) ?? null,
      bpjsCardUrl: (memberData.bpjsCardUrl as string | null) ?? null,
      dojoName: m.dojo?.name ?? "—",
      dojoId: String((m as Record<string, unknown>).dojoId ?? ""),
      status: reg?.status ? String(reg.status) : "BELUM_DAFTAR",
      billingId: regBilling?.id ? String(regBilling.id) : null,
      billingStatus: regBilling?.status ? String(regBilling.status) : null,
      billingAmount: uktBaseFeeAmount(
        regBilling?.amount != null ? Number(regBilling.amount) : null,
        regBilling?.baseFeeAmount != null
          ? Number(regBilling.baseFeeAmount)
          : null,
      ),
      outstandingDues: billingCountByMember.get(m.id) ?? 0,
      pendingVerifications: verificationCountByMember.get(m.id) ?? 0,
      attendanceCount: countByMember.get(m.id) ?? 0,
      attendancePct: pctByMember.get(m.id) ?? null,
      examResult: reg?.id ? examResultMap.get(String(reg.id)) ?? null : null,
      examPresent: reg?.id ? examAttendanceMap.get(String(reg.id)) ?? null : null,
      registrationWaiver: waiverMap.get(m.id) ?? null,
    };
  });

  return {
    periods,
    selectedPeriodId,
    dojos,
    allRows,
    beltFees,
    komisiRanting,
    depositMap: Object.fromEntries(depositMap.entries()) as Record<
      string,
      UktDepositRecord
    >,
    periodMeta,
    ok: eventsRes.res.ok || membersResult.ok,
  };
}

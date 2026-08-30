import { cache } from "react";
import { unstable_cache } from "next/cache";
import { inkaiFetch } from "./server";
import {
  getPrimaryAdminRole,
  buildMemberFilter,
  buildDojoFilter,
  type SessionUser,
} from "@/lib/rbac";
import { resolveAdminDojoClusterAllowlist } from "@/lib/account-peers";
import { SITE_BRANCH_NAME } from "@/lib/site";
import {
  decodeUktRegisteredRank,
  formatRankLabel,
  ranksEqual,
  resolveUktRankColumns,
} from "@/lib/belt";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { fetchDuesExemptMemberIds } from "@/lib/member-local-fields";
import { resolveMemberPhotoUrl } from "@/lib/member-photo";
import { memberPhotoSelect } from "@/lib/prisma-columns";
import { loadUktSelfRegistrationMetaMap } from "@/lib/ukt-self-registration";
import {
  memberOrderBy,
  parseMemberSortKey,
  parseSortDir,
} from "@/lib/table-sort";
import {
  beltFeesFromTemplates,
  DEFAULT_BELT_FEES,
  DEFAULT_KOMISI_RANTING,
  UKT_KOMISI_SETTING_KEY,
  uktBaseFeeAmount,
  resolveUktSelectedPeriodId,
  resolveUktPeriodFees,
  type UktAdminViewMode,
  findUktPeriodsForTerm,
  computeSemesterAttendance,
  buildUktSemesterWindow,
  buildUktEventDates,
  buildUktExamResultMap,
  buildUktExamAttendanceMap,
  buildUktDepositMap,
  buildUktWaiverMap,
  parseUktDepositValue,
  parseUktPeriodMetaValue,
  parseUktEventTitle,
  isUktAdminEventTitle,
  uktPeriodMetaKey,
  type UktExamResult,
  type UktMemberRow,
  type UktPeriodMeta,
  type UktDepositRecord,
  type UktRegistrationWaiver,
  type UktRegistrationSnapshotItem,
  type UktSemester,
} from "@/lib/ukt";

export type AdminMemberRow = {
  id: string;
  fullName: string;
  nia: string | null;
  /** No. MSH — khusus sabuk Hitam (DAN) */
  mshNumber?: string | null;
  currentRank: string;
  status: string;
  dojoId?: string | null;
  dojo: { name: string; isDeleted?: boolean; branch?: { name: string } };
  birthCertificateUrl?: string | null;
  bpjsCardUrl?: string | null;
  bpjsCardNumber?: string | null;
  photoUrl?: string | null;
  /** Waktu terdaftar di sistem (ISO dari API). */
  createdAt?: string | null;
  /** Nominal iuran bulanan per anggota. */
  monthlyDuesAmount?: number | null;
  /** Ada akun login terhubung. */
  hasAccount?: boolean;
};

function listMetaTotal(data: Record<string, unknown>, fallback: number) {
  const meta = (data.meta as { total?: number } | undefined) ?? {};
  return meta.total ?? fallback;
}

/** Admin beranda — fail fast; don't burn ~24s on cold backend. */
const HOME_INKAI = { timeoutMs: 8_000, retries: 0 } as const;

function filterUktEvents(events: Array<Record<string, unknown>>) {
  return events.filter((e) => isUktAdminEventTitle(String(e.title ?? "")));
}

export function normalizeCachedUktEventsResult(
  cached: unknown,
): { ok: boolean; events: Array<Record<string, unknown>> } {
  if (Array.isArray(cached)) {
    return { ok: true, events: cached as Array<Record<string, unknown>> };
  }
  if (
    cached &&
    typeof cached === "object" &&
    "events" in cached &&
    Array.isArray((cached as { events?: unknown }).events)
  ) {
    const next = cached as { ok?: unknown; events: Array<Record<string, unknown>> };
    return {
      ok: next.ok === false ? false : true,
      events: next.events,
    };
  }
  return { ok: false, events: [] };
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
  /** Ber-NIA tetapi belum punya User login. */
  withoutAccount: number;
  /** Terlibat bentrok NIA/NIK ternormalisasi. */
  duplicateIdentity: number;
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
  // Cukup null — create/sync menyimpan null (bukan ""). OR dengan "" memaksa seq-scan.
  return {
    OR: [{ birthCertificateUrl: null }, { bpjsCardUrl: null }],
  };
}

function missingNiaClause() {
  return { nia: null };
}

function withoutAccountClause() {
  return {
    userId: null,
    nia: { not: null },
  };
}

/**
 * Anggota non-arsip yang NIA/NIK-nya bentrok setelah normalisasi
 * dengan anggota lain (termasuk arsip).
 */
async function findDuplicateIdentityMemberIds(): Promise<string[]> {
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT m.id
      FROM "Member" m
      WHERE m."isDeleted" = false
        AND (
          (
            m.nia IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM "Member" o
              WHERE o.id <> m.id
                AND o.nia IS NOT NULL
                AND UPPER(TRIM(o.nia)) = UPPER(TRIM(m.nia))
            )
          )
          OR (
            m.nik IS NOT NULL
            AND TRIM(m.nik) <> ''
            AND EXISTS (
              SELECT 1
              FROM "Member" o
              WHERE o.id <> m.id
                AND o.nik IS NOT NULL
                AND TRIM(o.nik) <> ''
                AND TRIM(o.nik) = TRIM(m.nik)
            )
          )
        )
    `;
    return rows.map((r) => r.id);
  } catch (err) {
    console.error("[findDuplicateIdentityMemberIds]", err);
    return [];
  }
}

function duplicateIdentityClause(ids: string[]) {
  if (ids.length === 0) {
    return { id: { in: ["__no_duplicate_identity__"] } };
  }
  return { id: { in: ids } };
}

/** Satu query Prisma groupBy + count untuk KPI — selalu scoped RBAC. */
export async function fetchAdminMemberStatusCounts(
  user: SessionUser,
  opts: {
    dojoIds?: string[];
    dojoId?: string;
  } = {},
): Promise<MemberStatusCounts> {
  const where = memberScopeWhere(user, opts);
  const dupIds = await findDuplicateIdentityMemberIds();

  const [
    allResult,
    statusResult,
    docsResult,
    niaResult,
    accountResult,
    dupResult,
  ] = await Promise.all([
    withPrismaFallback(
      "admin-member-all-count",
      () => prisma.member.count({ where }),
      0,
    ),
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
    withPrismaFallback(
      "admin-member-without-account",
      () =>
        prisma.member.count({
          where: { AND: [where, withoutAccountClause()] },
        }),
      0,
    ),
    withPrismaFallback(
      "admin-member-duplicate-identity",
      () =>
        prisma.member.count({
          where: { AND: [where, duplicateIdentityClause(dupIds)] },
        }),
      0,
    ),
  ]);

  const counts: MemberStatusCounts = {
    // `all` dari count() — sama dengan total daftar (bukan jumlah groupBy yang bisa stale/cache).
    all: allResult.data,
    pending: 0,
    active: 0,
    inactive: 0,
    rejected: 0,
    docsIncomplete: docsResult.data,
    missingNia: niaResult.data,
    withoutAccount: accountResult.data,
    duplicateIdentity: dupResult.data,
  };

  for (const row of statusResult.data) {
    const n = row._count._all;
    const st = row.status.trim().toUpperCase();
    if (st === "PENDING") counts.pending += n;
    else if (st === "ACTIVE" || st === "AKTIF") counts.active += n;
    else if (st === "INACTIVE" || st === "SUSPENDED") counts.inactive += n;
    else if (st === "REJECTED") counts.rejected += n;
  }

  // Jaga konsistensi: jika groupBy gagal/parsial, all tetap dari count().
  const statusSum =
    counts.pending + counts.active + counts.inactive + counts.rejected;
  if (statusSum > counts.all) {
    counts.all = statusSum;
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
    /** Filter KPI: ber-NIA tanpa akun login. */
    withoutAccount?: boolean;
    /** Filter KPI: duplikat NIA/NIK ternormalisasi. */
    duplicateIdentity?: boolean;
    sort?: string;
    sortDir?: string;
  } = {},
) {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const search = opts.search?.trim();
  const status = opts.status?.trim();
  const sortKey = parseMemberSortKey(opts.sort);
  const sortDir = parseSortDir(opts.sortDir);
  const orderBy = memberOrderBy(sortKey, sortDir);
  const photoSelect = await memberPhotoSelect();

  const dupIds = opts.duplicateIdentity
    ? await findDuplicateIdentityMemberIds()
    : [];

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
      ...(opts.withoutAccount ? [withoutAccountClause()] : []),
      ...(opts.duplicateIdentity ? [duplicateIdentityClause(dupIds)] : []),
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
                {
                  mshNumber: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
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
        select: {
          id: true,
          fullName: true,
          nia: true,
          mshNumber: true,
          currentRank: true,
          status: true,
          dojoId: true,
          userId: true,
          birthCertificateUrl: true,
          bpjsCardUrl: true,
          bpjsCardNumber: true,
          ...(photoSelect),
          createdAt: true,
          monthlyDuesAmount: true,
          dojo: {
            select: {
              name: true,
              isDeleted: true,
              branch: { select: { name: true } },
            },
          },
          user: { select: { photoUrl: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const members: AdminMemberRow[] = rows.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      nia: m.nia,
      mshNumber: m.mshNumber,
      currentRank: m.currentRank,
      status: m.status,
      dojoId: m.dojoId,
      dojo: {
        name: m.dojo.name,
        isDeleted: m.dojo.isDeleted,
        branch: m.dojo.branch ? { name: m.dojo.branch.name } : undefined,
      },
      birthCertificateUrl: m.birthCertificateUrl,
      bpjsCardUrl: m.bpjsCardUrl,
      bpjsCardNumber: m.bpjsCardNumber,
      photoUrl: resolveMemberPhotoUrl(m.photoUrl, m.user?.photoUrl),
      createdAt: m.createdAt.toISOString(),
      monthlyDuesAmount: m.monthlyDuesAmount,
      hasAccount: Boolean(m.userId),
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
              isDeleted: true,
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
      dojoId: m.dojoId,
      dojo: {
        name: m.dojo.name,
        isDeleted: m.dojo.isDeleted,
        branch: m.dojo.branch ? { name: m.dojo.branch.name } : undefined,
      },
      birthCertificateUrl: m.birthCertificateUrl,
      bpjsCardUrl: m.bpjsCardUrl,
      bpjsCardNumber: m.bpjsCardNumber,
      photoUrl: resolveMemberPhotoUrl(m.photoUrl, m.user?.photoUrl),
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
  const { res, data } = await inkaiFetch("/v1/dashboard/stats", {}, token, HOME_INKAI);
  if (!res.ok) return null;
  return (data.data as Record<string, unknown>) ?? null;
}

export async function fetchRecentMembers(token: string) {
  const { res, data } = await inkaiFetch("/v1/dashboard/recent-activities", {}, token, HOME_INKAI);
  if (!res.ok) return [];
  return (data.data as AdminMemberRow[]) ?? [];
}

export async function fetchPendingMembersCount(token: string) {
  const { res, data } = await inkaiFetch("/v1/members?status=PENDING&limit=1&page=1", {}, token, HOME_INKAI);
  if (!res.ok) return 0;
  const members = (data.data as unknown[]) ?? [];
  return listMetaTotal(data, members.length);
}

export async function fetchPendingVerificationsCount(token: string) {
  const { res, data } = await inkaiFetch("/v1/verifications/pending?limit=1", {}, token, HOME_INKAI);
  if (!res.ok) return 0;
  const items = (data.data as unknown[]) ?? [];
  return listMetaTotal(data, items.length);
}

export async function fetchPendingBillingsCount(token: string) {
  const { res, data } = await inkaiFetch(
    "/v1/billing?status=WAITING_VERIFICATION&limit=1",
    {},
    token,
    HOME_INKAI,
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
  const { res, data } = await inkaiFetch(`/v1/events?limit=${limit + 10}`, {}, token, HOME_INKAI);
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
  const { res, data } = await inkaiFetch(
    "/v1/notifications/my?limit=100",
    {},
    token,
    HOME_INKAI,
  );
  if (!res.ok) return { items: [], unread: 0 };
  let items = (data.data as Array<Record<string, unknown>>) ?? [];
  if (user) {
    const { filterNotificationsForAdminScope, withFilterStats } = await import(
      "@/lib/admin-notify-scope"
    );
    const filtered = await filterNotificationsForAdminScope(user, items);
    const { items: out, stats } = withFilterStats(items, filtered);
    if (stats.dropped > 0) {
      console.info(
        `[admin-data:notifications] filtered dropped=${stats.dropped} input=${stats.input} output=${stats.output}`,
      );
    }
    items = out;
  }
  const unread = items.filter((n) => !n.isRead).length;
  return { items: items.slice(0, 5), unread };
}

export async function fetchAllNotifications(
  token: string,
  limit = 100,
  user?: SessionUser,
) {
  const { res, data } = await inkaiFetch(
    "/v1/notifications/my?limit=100",
    {},
    token,
  );
  if (!res.ok) return [];
  let items = (data.data as Array<Record<string, unknown>>) ?? [];
  if (user) {
    const { filterNotificationsForAdminScope, withFilterStats } = await import(
      "@/lib/admin-notify-scope"
    );
    const filtered = await filterNotificationsForAdminScope(user, items);
    const { items: out, stats } = withFilterStats(items, filtered);
    if (stats.dropped > 0) {
      console.info(
        `[admin-data:all-notifications] filtered dropped=${stats.dropped} input=${stats.input} output=${stats.output}`,
      );
    }
    items = out;
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
    // Full org tree can be slow under load — longer timeout + soft empty fallback.
    const { res, data } = await inkaiFetch("/v1/org/provinces", {}, token, {
      timeoutMs: 15_000,
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
  const rows = await prisma.dojo.findMany({
    where: buildDojoFilter(user),
    select: {
      id: true,
      name: true,
      isDeleted: true,
      branch: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
  return rows.map((d) => {
    const branchName = d.branch?.name?.trim() || "";
    const outsideSite =
      branchName.length > 0 &&
      branchName.toUpperCase() !== SITE_BRANCH_NAME.toUpperCase();
    const suffix = [
      outsideSite ? branchName : null,
      d.isDeleted ? "arsip" : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      id: d.id,
      name: suffix ? `${d.name} (${suffix})` : d.name,
    };
  });
}

/** Cache dojo list 60s — jarang berubah, dipanggil tiap filter. */
export function fetchAdminDojosScopedCached(user: SessionUser) {
  const role = getPrimaryAdminRole(user.roles);
  const key = [
    "admin-dojos-scoped",
    "v3",
    user.id,
    role,
    user.managedBranchId ?? "",
    user.managedProvinceId ?? "",
    user.managedDojoId ?? "",
  ];
  return unstable_cache(
    async () => {
      // Jangan tangkap error di dalam cache — hasil [] dari gagal query
      // sempat ter-cache dan mengosongkan filter ranting.
      return fetchAdminDojosScoped(user);
    },
    key,
    { revalidate: 60 },
  )().catch((error) => {
    console.error("[fetchAdminDojosScopedCached]", error);
    return [] as Array<{ id: string; name: string }>;
  });
}

/**
 * KPI counts — tanpa unstable_cache.
 * Cache 30s membuat Total tertinggal setelah tambah/hapus anggota (mis. 15 vs 18).
 */
export function fetchAdminMemberStatusCountsCached(
  user: SessionUser,
  opts: { dojoIds?: string[]; dojoId?: string } = {},
) {
  return fetchAdminMemberStatusCounts(user, opts);
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
  const items = await prisma.newsCarousel.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
  return items.map((i) => ({
    id: i.id,
    title: i.title,
    imageUrl: i.imageUrl,
    targetUrl: i.targetUrl,
    order: i.order,
    isActive: i.isActive,
  }));
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

/** Opsi Inkai ketat untuk load dashboard UKT (hindari retry 12s×2). */
const UKT_DASH_INKAI = { timeoutMs: 8_000, retries: 0 } as const;

function countActiveUktRegistrations(
  eventDetail: Record<string, unknown> | null | undefined,
): number {
  const registrations =
    (eventDetail?.registrations as Array<Record<string, unknown>> | undefined) ??
    [];
  let n = 0;
  for (const reg of registrations) {
    const st = String(reg.status ?? "").toUpperCase();
    if (st === "CANCELLED" || st === "REJECTED") continue;
    n += 1;
  }
  return n;
}

export async function fetchEventDetail(
  token: string,
  eventId: string,
  options?: { timeoutMs?: number; retries?: number },
) {
  const { res, data } = await inkaiFetch(
    `/v1/events/${eventId}`,
    {},
    token,
    options,
  );
  if (!res.ok) return null;
  return (data.data as Record<string, unknown>) ?? null;
}

function periodOptionFromEvent(
  event: Record<string, unknown>,
  idFallback?: string,
): {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  registrationCloseAt: string | null;
  createdAt?: string;
  archived?: boolean;
  locked?: boolean;
} {
  return {
    id: String(event.id ?? idFallback ?? ""),
    title: String(event.title ?? ""),
    startDate: String(event.startDate ?? ""),
    endDate: String(event.endDate ?? ""),
    registrationCloseAt: event.registrationCloseAt
      ? String(event.registrationCloseAt)
      : null,
    createdAt: event.createdAt ? String(event.createdAt) : undefined,
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

type UktPeriodOptionRow = ReturnType<typeof periodOptionFromEvent>;

/** Always merge Prisma Event so admin periods survive Inkai cache/API blips. */
export function shouldLoadUktPeriodsFromPrisma(
  _eventsOk: boolean,
  _uktPeriodCount: number,
): boolean {
  return true;
}

async function fetchUktPeriodOptionsFromPrisma(): Promise<UktPeriodOptionRow[]> {
  const { data } = await withPrismaFallback(
    "ukt-events-prisma",
    () =>
      prisma.event.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          registrationCloseAt: true,
          createdAt: true,
        },
        orderBy: { startDate: "desc" },
        take: 80,
      }),
    [] as Array<{
      id: string;
      title: string;
      startDate: Date;
      endDate: Date;
      registrationCloseAt: Date | null;
      createdAt: Date;
    }>,
  );

  return (data ?? [])
    .filter((e) => isUktAdminEventTitle(e.title))
    .map((e) =>
      periodOptionFromEvent({
        id: e.id,
        title: e.title,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        registrationCloseAt: e.registrationCloseAt?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
      }),
    );
}

/**
 * Isi daftar periode UKT dari Prisma bila Inkai kosong/gagal,
 * atau upsert satu event by URL id.
 */
async function ensureUktPeriodsFromPrisma(
  periods: UktPeriodOptionRow[],
  opts: {
    eventsOk: boolean;
    periodFromUrl?: string | null;
  },
): Promise<{ periods: UktPeriodOptionRow[]; fromPrisma: boolean }> {
  const needList = shouldLoadUktPeriodsFromPrisma(opts.eventsOk, periods.length);
  const needUrl =
    Boolean(opts.periodFromUrl) &&
    !periods.some((p) => p.id === opts.periodFromUrl);

  if (!needList && !needUrl) {
    return { periods, fromPrisma: false };
  }

  const prismaPeriods = await fetchUktPeriodOptionsFromPrisma();
  let next = periods;
  let fromPrisma = false;

  if (needList) {
    for (const p of prismaPeriods) {
      next = upsertPeriodOption(next, p);
      fromPrisma = true;
    }
  }

  if (needUrl && opts.periodFromUrl) {
    const fromList = prismaPeriods.find((p) => p.id === opts.periodFromUrl);
    if (fromList) {
      next = upsertPeriodOption(next, fromList);
      fromPrisma = true;
    } else {
      const { data: ev } = await withPrismaFallback(
        "ukt-event-by-id-prisma",
        () =>
          prisma.event.findFirst({
            where: { id: opts.periodFromUrl!, isDeleted: false },
            select: {
              id: true,
              title: true,
              startDate: true,
              endDate: true,
              registrationCloseAt: true,
              createdAt: true,
            },
          }),
        null as {
          id: string;
          title: string;
          startDate: Date;
          endDate: Date;
          registrationCloseAt: Date | null;
          createdAt: Date;
        } | null,
      );
      if (ev && isUktAdminEventTitle(ev.title)) {
        next = upsertPeriodOption(
          next,
          periodOptionFromEvent({
            id: ev.id,
            title: ev.title,
            startDate: ev.startDate.toISOString(),
            endDate: ev.endDate.toISOString(),
            registrationCloseAt: ev.registrationCloseAt?.toISOString() ?? null,
            createdAt: ev.createdAt.toISOString(),
          }),
        );
        fromPrisma = true;
      }
    }
  }

  return { periods: next, fromPrisma };
}

async function loadUktPeriodMetaFromPrisma(
  periodIds: string[],
): Promise<Map<string, UktPeriodMeta>> {
  const ids = [...new Set(periodIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const keys = ids.map((id) => uktPeriodMetaKey(id));
  const { data } = await withPrismaFallback(
    "ukt-period-meta-prisma",
    () =>
      prisma.appSetting.findMany({
        where: { key: { in: keys } },
        select: { key: true, value: true },
      }),
    [] as Array<{ key: string; value: unknown }>,
  );
  const map = new Map<string, UktPeriodMeta>();
  for (const row of data ?? []) {
    const id = row.key.slice("ukt-period-meta:".length);
    if (id) map.set(id, parseUktPeriodMetaValue(row.value));
  }
  return map;
}

async function applyUktPeriodMetaFlags(
  periods: UktPeriodOptionRow[],
  metaByPeriodId: Map<string, UktPeriodMeta>,
): Promise<{
  periods: UktPeriodOptionRow[];
  metaByPeriodId: Map<string, UktPeriodMeta>;
}> {
  const missingIds = periods
    .map((p) => p.id)
    .filter((id) => id && !metaByPeriodId.has(id));
  if (missingIds.length > 0) {
    const fromPrisma = await loadUktPeriodMetaFromPrisma(missingIds);
    for (const [id, meta] of fromPrisma) {
      metaByPeriodId.set(id, meta);
    }
  }
  return {
    periods: periods.map((p) => {
      const meta = metaByPeriodId.get(p.id);
      return {
        ...p,
        archived: meta?.archived === true,
        locked: meta?.locked === true,
      };
    }),
    metaByPeriodId,
  };
}

export async function fetchUktKomisiRanting(
  token: string,
  key: string,
  fallback: number,
  options?: { timeoutMs?: number; retries?: number },
) {
  const { res, data } = await inkaiFetch(
    `/v1/settings/${encodeURIComponent(key)}`,
    {},
    token,
    options,
  );
  if (!res.ok) return fallback;
  const value = (data.data as { value?: unknown } | undefined)?.value;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  return fallback;
}

export async function fetchSettingsByPrefix(
  token: string,
  prefix: string,
  options?: { timeoutMs?: number; retries?: number },
) {
  const { res, data } = await inkaiFetch(
    `/v1/settings?prefix=${encodeURIComponent(prefix)}`,
    {},
    token,
    options,
  );
  if (!res.ok) return [];
  return (data.data as Array<{ key: string; value: unknown }>) ?? [];
}

/** Baca AppSetting setoran UKT dari Prisma; merge ke map Inkai (Prisma menang untuk key yang sama). */
async function mergeUktDepositMapFromPrisma(
  periodId: string,
  inkaiMap: Map<string, UktDepositRecord>,
): Promise<Map<string, UktDepositRecord>> {
  const prefix = `ukt-deposit:${periodId}:`;
  const { data: rows } = await withPrismaFallback(
    "ukt-deposit-settings",
    () =>
      prisma.appSetting.findMany({
        where: { key: { startsWith: prefix } },
        select: { key: true, value: true },
      }),
    [] as Array<{ key: string; value: unknown }>,
  );
  if (!rows?.length) return inkaiMap;
  const merged = new Map(inkaiMap);
  for (const row of rows) {
    const dojoId = row.key.slice(prefix.length);
    const parsed = parseUktDepositValue(row.value);
    if (dojoId && parsed) merged.set(dojoId, parsed);
  }
  return merged;
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

export async function fetchUktEventsCached(
  token: string,
  options?: { timeoutMs?: number; retries?: number },
): Promise<{ ok: boolean; events: Array<Record<string, unknown>> }> {
  try {
    const cached = await unstable_cache(
      async () => {
        const { res, data } = await inkaiFetch("/v1/events?limit=200", {}, token, options);
        if (!res.ok) {
          throw new Error("Failed to fetch events from Inkai API");
        }
        const events = (data.data as Array<Record<string, unknown>>) ?? [];
        // Jangan cache list kosong — biarkan stale cache / Prisma fallback yang bertahan.
        if (events.length === 0) {
          throw new Error("Empty Inkai events list — keep stale cache");
        }
        return {
          ok: true,
          events,
        };
      },
      ["ukt-events-list-v5"],
      { revalidate: 600 },
    )();
    return normalizeCachedUktEventsResult(cached);
  } catch (error) {
    console.error("[fetchUktEventsCached]", error);
    return { ok: false, events: [] };
  }
}

export async function fetchBeltFeesTemplatesCached(
  token: string,
  options?: { timeoutMs?: number; retries?: number },
) {
  return unstable_cache(
    async () => {
      const { res, data } = await inkaiFetch("/v1/events/rank-fee-templates", {}, token, options);
      if (!res.ok) {
        throw new Error("Failed to fetch rank fee templates");
      }
      return (data.data as Array<{ rankName: string; fee: number }>) ?? [];
    },
    ["ukt-belt-fees-templates-v3"],
    { revalidate: 60 },
  )().catch((error) => {
    console.error("[fetchBeltFeesTemplatesCached]", error);
    return [] as Array<{ rankName: string; fee: number }>;
  });
}

export async function fetchUktKomisiRantingCached(
  token: string,
  key: string,
  fallback: number,
  options?: { timeoutMs?: number; retries?: number },
) {
  return unstable_cache(
    async () => {
      return fetchUktKomisiRanting(token, key, fallback, options);
    },
    ["ukt-komisi-ranting-global-v3", key],
    { revalidate: 60 },
  )().catch((error) => {
    console.error("[fetchUktKomisiRantingCached]", error);
    return fallback;
  });
}

/**
 * Resolve periode UKT ringan (events + period-meta saja) untuk redirect URL
 * canonical sebelum fetch berat (members/attendance/billing).
 */
export async function resolveUktAdminPeriodId(
  token: string,
  opts: {
    periodFromUrl?: string | null;
    semester: UktSemester;
    year: number;
    forceNoPeriod?: boolean;
    viewMode?: UktAdminViewMode;
  },
): Promise<{
  selectedPeriodId: string | null;
  targetSemester?: UktSemester;
  targetYear?: number;
}> {
  const {
    periodFromUrl = null,
    semester,
    year,
    forceNoPeriod = false,
    viewMode = "registration",
  } = opts;

  if (forceNoPeriod) {
    return { selectedPeriodId: null, targetSemester: semester, targetYear: year };
  }

  const [eventsResult, periodMetaRowsAll, eventDetailFromUrl] = await Promise.all([
    fetchUktEventsCached(token, {
      timeoutMs: 8_000,
      retries: 0,
    }),
    fetchSettingsByPrefix(token, "ukt-period-meta:"),
    periodFromUrl
      ? fetchEventDetail(token, periodFromUrl, { timeoutMs: 8_000, retries: 0 }).catch(() => null)
      : Promise.resolve(null),
  ]);

  let periods = filterUktEvents(eventsResult.events).map((p) => periodOptionFromEvent(p));

  if (
    periodFromUrl &&
    eventDetailFromUrl &&
    isUktAdminEventTitle(String(eventDetailFromUrl.title ?? ""))
  ) {
    periods = upsertPeriodOption(
      periods,
      periodOptionFromEvent(eventDetailFromUrl, periodFromUrl),
    );
  }

  const prismaHydrated = await ensureUktPeriodsFromPrisma(periods, {
    eventsOk: eventsResult.ok,
    periodFromUrl,
  });
  periods = prismaHydrated.periods;

  const metaByPeriodId = new Map<string, UktPeriodMeta>();
  for (const row of periodMetaRowsAll) {
    const id = row.key.slice("ukt-period-meta:".length);
    if (id) metaByPeriodId.set(id, parseUktPeriodMetaValue(row.value));
  }
  ({ periods } = await applyUktPeriodMetaFlags(periods, metaByPeriodId));

  let effectiveSemester = semester;
  let effectiveYear = year;
  if (periodFromUrl) {
    const urlPeriod = periods.find((p) => p.id === periodFromUrl);
    if (urlPeriod) {
      const parsed = parseUktEventTitle(urlPeriod.title);
      if (parsed) {
        effectiveSemester = parsed.semester;
        effectiveYear = parsed.year;
      }
    }
  }

  let selectedPeriodId = resolveUktSelectedPeriodId(
    periods,
    effectiveSemester,
    effectiveYear,
    periodFromUrl,
    viewMode,
  );

  if (selectedPeriodId) {
    const selected = periods.find((p) => p.id === selectedPeriodId);
    if (selected) {
      const parsed = parseUktEventTitle(selected.title);
      if (parsed) {
        effectiveSemester = parsed.semester;
        effectiveYear = parsed.year;
      }
    }
  }

  if (selectedPeriodId && viewMode === "registration") {
    const selected = periods.find((p) => p.id === selectedPeriodId);
    const hasActive = findUktPeriodsForTerm(periods, effectiveSemester, effectiveYear).some(
      (p) => !p.archived && !p.locked,
    );
    if (selected && (selected.archived || selected.locked) && !hasActive) {
      selectedPeriodId = null;
    }
  }

  return {
    selectedPeriodId,
    targetSemester: effectiveSemester,
    targetYear: effectiveYear,
  };
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
    /** Pendaftaran = periode aktif; archive = riwayat/arsip. */
    viewMode?: UktAdminViewMode;
  },
) {
  const {
    periodFromUrl = null,
    semester,
    year,
    forceNoPeriod = false,
    viewMode = "registration",
  } = opts;
  const { semesterStart, semesterEnd } = buildUktSemesterWindow(semester, year);
  const attendanceFrom = semesterStart.toISOString();
  const attendanceTo = semesterEnd.toISOString();
  const primaryRole = getPrimaryAdminRole(user.roles);
  const dojoAllowlist =
    primaryRole === "ADMIN_DOJO"
      ? await resolveAdminDojoClusterAllowlist(user)
      : [];

  const skipMemberPool = true;

  // Fail-closed: ranting tanpa allowlist tidak boleh melihat peserta lintas ranting.
  const rantingAllowlistEmpty =
    primaryRole === "ADMIN_DOJO" && dojoAllowlist.length === 0;

  const photoSelect = await memberPhotoSelect();
  let identityDegraded = false;

  // Ranting (termasuk multi): peserta diisi lewat registrasi-first merge Prisma.
  // Archive & registration: skip pool anggota penuh (250/500).
  const membersPromise = skipMemberPool
    ? Promise.resolve({
        ok: true as const,
        members: [] as AdminMemberRow[],
        total: 0,
        page: 1,
      })
    : primaryRole === "ADMIN_DOJO" && dojoAllowlist.length > 0
      ? fetchAdminMembersForDojoIds(token, dojoAllowlist, {
          limit: 500,
          page: 1,
        })
      : dojoAllowlist.length > 1
        ? fetchAdminMembersForDojoIds(token, dojoAllowlist, {
            limit: 500,
            page: 1,
          })
        : fetchAdminMembers(token, {
            limit: dojoAllowlist.length === 1 ? 250 : 500,
            page: 1,
            dojoId: dojoAllowlist[0],
          });

  // Placeholder resolved result untuk fetch yang di-skip
  // (hindari RTT tambahan untuk data yang tidak dipakai UI peserta-first).
  const skippedFetch: Promise<{ res: Response; data: Record<string, unknown> }> =
    Promise.resolve({
      res: { ok: false } as unknown as Response,
      data: {},
    });

  // Wave 1: events + dojos Prisma + period-meta prefix + event detail URL.
  // Prefix exam/waiver/deposit + fees global ditunda sampai tahu periode kosong /
  // snapshot biaya tersedia (hemat RTT saat 0 peserta).
  const [eventsResult, dojosScoped, membersResult, eventDetailInitial, periodMetaRowsAll] =
    await Promise.all([
      fetchUktEventsCached(token, UKT_DASH_INKAI),
      fetchAdminDojosScopedCached(user),
      membersPromise,
      periodFromUrl
        ? fetchEventDetail(token, periodFromUrl, UKT_DASH_INKAI).catch(() => null)
        : Promise.resolve(null),
      fetchSettingsByPrefix(token, "ukt-period-meta:", UKT_DASH_INKAI),
    ]);

  const eventsOk = eventsResult.ok;
  const eventsData = eventsResult.events;

  let dojos: Array<{ id: string; name: string }> = dojosScoped;
  if (dojoAllowlist.length > 0) {
    dojos = dojosScoped.filter((d) => dojoAllowlist.includes(d.id));
    if (dojos.length === 0) {
      const localDojos = await withPrismaFallback(
        "ukt-dojos-allowlist",
        () =>
          prisma.dojo.findMany({
            where: { id: { in: dojoAllowlist }, isDeleted: false },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
        [] as Array<{ id: string; name: string }>,
      );
      dojos = localDojos.data ?? [];
    }
  }

  let periods = filterUktEvents(eventsData).map((p) => periodOptionFromEvent(p));

  // Pastikan periode dari URL masuk daftar SEBELUM apply metaByPeriodId
  if (
    periodFromUrl &&
    eventDetailInitial &&
    isUktAdminEventTitle(String(eventDetailInitial.title ?? ""))
  ) {
    periods = upsertPeriodOption(
      periods,
      periodOptionFromEvent(eventDetailInitial, periodFromUrl),
    );
  }

  const prismaHydrated = await ensureUktPeriodsFromPrisma(periods, {
    eventsOk,
    periodFromUrl,
  });
  periods = prismaHydrated.periods;
  const periodsFromPrisma = prismaHydrated.fromPrisma;

  const periodMetaRows = periodMetaRowsAll;
  let metaByPeriodId = new Map<string, UktPeriodMeta>();
  for (const row of periodMetaRows) {
    const id = row.key.slice("ukt-period-meta:".length);
    if (id) metaByPeriodId.set(id, parseUktPeriodMetaValue(row.value));
  }
  ({ periods, metaByPeriodId } = await applyUktPeriodMetaFlags(
    periods,
    metaByPeriodId,
  ));

  let effectiveSemester = semester;
  let effectiveYear = year;
  if (periodFromUrl) {
    const urlPeriod = periods.find((p) => p.id === periodFromUrl);
    if (urlPeriod) {
      const parsed = parseUktEventTitle(urlPeriod.title);
      if (parsed) {
        effectiveSemester = parsed.semester;
        effectiveYear = parsed.year;
      }
    }
  }

  let selectedPeriodId = forceNoPeriod
    ? null
    : resolveUktSelectedPeriodId(
        periods,
        effectiveSemester,
        effectiveYear,
        periodFromUrl,
        viewMode,
      );

  if (selectedPeriodId) {
    const selected = periods.find((p) => p.id === selectedPeriodId);
    if (selected) {
      const parsed = parseUktEventTitle(selected.title);
      if (parsed) {
        effectiveSemester = parsed.semester;
        effectiveYear = parsed.year;
      }
    }
  }

  // Pendaftaran: jika hanya ada arsip → biarkan null agar UI Buat Periode.
  if (selectedPeriodId && !forceNoPeriod && viewMode === "registration") {
    const selected = periods.find((p) => p.id === selectedPeriodId);
    const hasActive = findUktPeriodsForTerm(periods, effectiveSemester, effectiveYear).some(
      (p) => !p.archived && !p.locked,
    );
    if (selected && (selected.archived || selected.locked) && !hasActive) {
      selectedPeriodId = null;
    }
  }

  let eventDetail = eventDetailInitial;

  // Wave 2 hanya bila periode terpilih beda dari URL — hanya detail event
  // (meta ambil dari prefix map; jangan refetch 6 settings).
  if (selectedPeriodId && selectedPeriodId !== periodFromUrl) {
    eventDetail = await fetchEventDetail(token, selectedPeriodId, UKT_DASH_INKAI);
  }

  // Sinkronkan tanggal/batas pendaftaran dari detail event agar kartu "Atur" akurat.
  if (selectedPeriodId && eventDetail) {
    const prev = periods.find((p) => p.id === selectedPeriodId);
    periods = upsertPeriodOption(periods, {
      ...periodOptionFromEvent(eventDetail, selectedPeriodId),
      archived: prev?.archived,
      locked: prev?.locked,
    });
  }

  // Meta dari prefix saja (tanpa GET per-id ganda).
  let periodMeta: UktPeriodMeta = selectedPeriodId
    ? (metaByPeriodId.get(selectedPeriodId) ?? {
        archived: false,
        locked: false,
      })
    : { archived: false, locked: false };

  // Backfill registrationOpenAt in-memory saja.
  if (selectedPeriodId && !periodMeta.registrationOpenAt) {
    const selected = periods.find((p) => p.id === selectedPeriodId);
    const parsedTitle = selected ? parseUktEventTitle(selected.title) : null;
    if (parsedTitle) {
      const { registrationOpenAt } = buildUktEventDates(
        parsedTitle.semester,
        parsedTitle.year,
      );
      periodMeta = {
        ...periodMeta,
        registrationOpenAt: registrationOpenAt.toISOString(),
      };
    }
  }

  const feesProbe = resolveUktPeriodFees(
    DEFAULT_BELT_FEES,
    DEFAULT_KOMISI_RANTING,
    periodMeta,
  );
  const needGlobalFees = !feesProbe.fromSnapshot;

  // Periode kosong? Inkai regs + hitungan Prisma cepat (daftar mandiri PENDING).
  const inkaiRegCount = countActiveUktRegistrations(eventDetail);
  let prismaRegCount = 0;
  if (selectedPeriodId && !rantingAllowlistEmpty) {
    const counted = await withPrismaFallback(
      "ukt-regs-count",
      () =>
        prisma.eventRegistration.count({
          where: {
            eventId: selectedPeriodId,
            status: { notIn: ["CANCELLED", "REJECTED"] },
            member: {
              isDeleted: false,
              ...(dojoAllowlist.length > 0
                ? { dojoId: { in: dojoAllowlist } }
                : {}),
            },
          },
        }),
      0,
    );
    prismaRegCount = counted.data ?? 0;
  }
  const periodEmpty =
    !selectedPeriodId ||
    rantingAllowlistEmpty ||
    (inkaiRegCount === 0 && prismaRegCount === 0);

  const [
    feesData,
    komisiRanting,
    billingsRes,
    pendingVerificationsRes,
    attendanceRes,
    examSettings,
    waiverSettings,
    examAttendanceSettings,
    depositSettings,
  ] = await Promise.all([
    needGlobalFees
      ? fetchBeltFeesTemplatesCached(token, UKT_DASH_INKAI)
      : Promise.resolve([] as Array<{ rankName: string; fee: number }>),
    needGlobalFees
      ? fetchUktKomisiRantingCached(
          token,
          UKT_KOMISI_SETTING_KEY,
          DEFAULT_KOMISI_RANTING,
          UKT_DASH_INKAI,
        )
      : Promise.resolve(DEFAULT_KOMISI_RANTING),
    skipMemberPool ? skippedFetch : inkaiFetch("/v1/billing?limit=250", {}, token),
    skipMemberPool
      ? skippedFetch
      : inkaiFetch("/v1/verifications/pending", {}, token),
    skipMemberPool
      ? Promise.resolve([] as Array<Record<string, unknown>>)
      : fetchAttendanceLogs(token, {
          from: attendanceFrom,
          to: attendanceTo,
          limit: 800,
        }),
    periodEmpty || !selectedPeriodId
      ? Promise.resolve([] as Array<{ key: string; value: unknown }>)
      : fetchSettingsByPrefix(
          token,
          `ukt-exam-result:${selectedPeriodId}:`,
          UKT_DASH_INKAI,
        ),
    periodEmpty || !selectedPeriodId
      ? Promise.resolve([] as Array<{ key: string; value: unknown }>)
      : fetchSettingsByPrefix(
          token,
          `ukt-registration-waiver:${selectedPeriodId}:`,
          UKT_DASH_INKAI,
        ),
    periodEmpty || !selectedPeriodId
      ? Promise.resolve([] as Array<{ key: string; value: unknown }>)
      : fetchSettingsByPrefix(
          token,
          `ukt-exam-attendance:${selectedPeriodId}:`,
          UKT_DASH_INKAI,
        ),
    periodEmpty || !selectedPeriodId
      ? Promise.resolve([] as Array<{ key: string; value: unknown }>)
      : fetchSettingsByPrefix(
          token,
          `ukt-deposit:${selectedPeriodId}:`,
          UKT_DASH_INKAI,
        ),
  ]);

  const attendanceLogs = attendanceRes.map((log) => {
    const member = log.member as { id?: string } | undefined;
    return {
      checkInAt: String(log.checkInAt ?? log.createdAt ?? ""),
      memberId: String(member?.id ?? log.memberId ?? ""),
    };
  });
  // computeSemesterAttendance dijalankan di bawah setelah `members` final
  // (pool + registrasi-first merge) — hanya proses log milik member relevan.
  const examResultMap = selectedPeriodId
    ? buildUktExamResultMap(examSettings, selectedPeriodId)
    : new Map<string, UktExamResult>();
  const examAttendanceMap = selectedPeriodId
    ? buildUktExamAttendanceMap(examAttendanceSettings, selectedPeriodId)
    : new Map<string, boolean>();
  let depositMap = selectedPeriodId
    ? buildUktDepositMap(depositSettings, selectedPeriodId)
    : new Map<string, UktDepositRecord>();
  if (selectedPeriodId) {
    depositMap = await mergeUktDepositMapFromPrisma(selectedPeriodId, depositMap);
  }
  const waiverMap = selectedPeriodId
    ? buildUktWaiverMap(waiverSettings, selectedPeriodId)
    : new Map<string, UktRegistrationWaiver>();
  const beltFeesGlobal = beltFeesFromTemplates(feesData);

  const resolvedFees = resolveUktPeriodFees(
    beltFeesGlobal,
    komisiRanting,
    periodMeta,
  );
  const beltFees = resolvedFees.beltFees;
  const effectiveKomisi = resolvedFees.komisiRanting;

  const members = (membersResult.ok ? membersResult.members : []) as Array<
    AdminMemberRow & Record<string, unknown>
  >;

  // Lengkapi URL dokumen dari Prisma bila list Inkai tidak mengembalikannya
  // (agar gate Akte/BPJS di UI ranting akurat).
  const docMissingIds = members
    .filter((m) => !m.birthCertificateUrl?.trim() || !m.bpjsCardUrl?.trim())
    .map((m) => m.id)
    .filter(Boolean);

  // Perf A3: docs + dues exemption paralel (independen).
  const [localDocsResult, duesExemptResult] = await Promise.all([
    docMissingIds.length > 0
      ? withPrismaFallback(
          "ukt-member-docs",
          () =>
            prisma.member.findMany({
              where: { id: { in: docMissingIds } },
              select: {
                id: true,
                birthCertificateUrl: true,
                bpjsCardUrl: true,
              },
            }),
          [] as Array<{
            id: string;
            birthCertificateUrl: string | null;
            bpjsCardUrl: string | null;
          }>,
        )
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            birthCertificateUrl: string | null;
            bpjsCardUrl: string | null;
          }>,
        }),
    withPrismaFallback(
      "ukt-dues-exemption",
      () => fetchDuesExemptMemberIds(members.map((m) => m.id)),
      new Set<string>(),
    ),
  ]);

  if ((localDocsResult.data?.length ?? 0) > 0) {
    const docsById = new Map((localDocsResult.data ?? []).map((r) => [r.id, r]));
    for (const m of members) {
      const docs = docsById.get(m.id);
      if (!docs) continue;
      if (!m.birthCertificateUrl?.trim() && docs.birthCertificateUrl) {
        m.birthCertificateUrl = docs.birthCertificateUrl;
      }
      if (!m.bpjsCardUrl?.trim() && docs.bpjsCardUrl) {
        m.bpjsCardUrl = docs.bpjsCardUrl;
      }
    }
  }

  const billingCountByMember = billingsRes.res.ok
    ? buildBillingCountMap((billingsRes.data.data as Array<Record<string, unknown>>) ?? [])
    : new Map<string, number>();

  const duesExemptMemberIds = duesExemptResult;

  const verificationCountByMember = pendingVerificationsRes.res.ok
    ? buildVerificationCountMap(
        (pendingVerificationsRes.data.data as Array<Record<string, unknown>>) ?? [],
      )
    : new Map<string, number>();

  const regMap = new Map<string, Record<string, unknown>>();
  const billingMap = new Map<string, Record<string, unknown>>();

  if (selectedPeriodId && eventDetail && !rantingAllowlistEmpty) {
    const registrations = (eventDetail.registrations as Array<Record<string, unknown>>) ?? [];
    for (const reg of registrations) {
      const regStatus = String(reg.status ?? "").toUpperCase();
      // Tolak/batal: jangan ghost sebagai Belum Bayar
      if (regStatus === "CANCELLED" || regStatus === "REJECTED") continue;
      const mid = String((reg.member as { id?: string })?.id ?? reg.memberId ?? "");
      if (!mid) continue;
      if (dojoAllowlist.length > 0) {
        const memberDojoId = String(
          (reg.member as { dojoId?: string } | undefined)?.dojoId ?? "",
        );
        if (memberDojoId && !dojoAllowlist.includes(memberDojoId)) continue;
      }
      regMap.set(mid, reg);
      const member = reg.member as Record<string, unknown> | undefined;
      const billings = (member?.billings as Array<Record<string, unknown>>) ?? [];
      // Hanya tagihan yang tertaut ke registrasi ini — jangan ambil UKT lama (sering PAID)
      const billing = billings.find(
        (b) => String(b.registrationId ?? "") === String(reg.id),
      );
      if (billing?.id) {
        billingMap.set(String(reg.id), billing);
      }
    }
  }

  // Lengkapi billingMap dari daftar global /v1/billing (hanya by registrationId)
  if (billingsRes.res.ok) {
    const globalBillings =
      (billingsRes.data.data as Array<Record<string, unknown>>) ?? [];
    for (const b of globalBillings) {
      const rid = b.registrationId != null ? String(b.registrationId) : "";
      if (!rid || billingMap.has(rid)) continue;
      if (b.isDeleted === true) continue;
      billingMap.set(rid, b);
    }
    // Cadangan: tagihan UKT belum tertaut registrationId — hanya yang belum lunas
    if (selectedPeriodId && eventDetail) {
      const registrations =
        (eventDetail.registrations as Array<Record<string, unknown>>) ?? [];
      for (const reg of registrations) {
        const regId = String(reg.id ?? "");
        if (!regId || billingMap.has(regId)) continue;
        const mid = String(
          (reg.member as { id?: string } | undefined)?.id ?? reg.memberId ?? "",
        );
        if (!mid) continue;
        const match = globalBillings.find((b) => {
          if (b.isDeleted === true) return false;
          if (String(b.memberId ?? "") !== mid) return false;
          const rid = String(b.registrationId ?? "");
          if (rid && rid !== regId) return false;
          const st = String(b.status ?? "").toUpperCase();
          if (st === "PAID" || st === "SUCCESS" || st === "CANCELLED") return false;
          const type = String(b.type ?? "").toUpperCase();
          const desc = String(b.description ?? "").toUpperCase();
          return (
            type.includes("UKT") ||
            type === "EVENT" ||
            desc.includes("UKT")
          );
        });
        if (match?.id) billingMap.set(regId, match);
      }
    }
  }

  // Ranting multi: Inkai sering hanya kirim registrasi ranting utama.
  // Cabang + detail Inkai null: seed penuh dari Prisma (sama sumber /ukt publik).
  // Lengkapi dari Prisma — skip total jika periode kosong.
  if (
    selectedPeriodId &&
    !rantingAllowlistEmpty &&
    !periodEmpty &&
    (dojoAllowlist.length > 0 || !eventDetail)
  ) {
    const prismaRegs = await withPrismaFallback(
      "ukt-regs-allowlist",
      () =>
        prisma.eventRegistration.findMany({
          where: {
            eventId: selectedPeriodId,
            status: { notIn: ["CANCELLED", "REJECTED"] },
            member: {
              isDeleted: false,
              ...(dojoAllowlist.length > 0
                ? { dojoId: { in: dojoAllowlist } }
                : {}),
            },
          },
          select: {
            id: true,
            status: true,
            registeredRank: true,
            memberId: true,
            member: {
              select: {
                id: true,
                fullName: true,
                nia: true,
                currentRank: true,
                status: true,
                dojoId: true,
                birthPlace: true,
                birthDate: true,
                gender: true,
                address: true,
                birthCertificateUrl: true,
                bpjsCardUrl: true,
                bpjsCardNumber: true,
                ...(photoSelect),
                monthlyDuesAmount: true,
                createdAt: true,
                dojo: {
                  select: {
                    name: true,
                    isDeleted: true,
                    branch: { select: { name: true } },
                  },
                },
                user: { select: { photoUrl: true } },
              },
            },
          },
          take: 500,
        }),
      [] as Array<{
        id: string;
        status: string;
        registeredRank: string | null;
        memberId: string;
        member: {
          id: string;
          fullName: string;
          nia: string | null;
          currentRank: string;
          status: string;
          dojoId: string;
          birthPlace: string | null;
          birthDate: Date | null;
          gender: string | null;
          address: string | null;
          birthCertificateUrl: string | null;
          bpjsCardUrl: string | null;
          bpjsCardNumber: string | null;
          photoUrl: string | null;
          monthlyDuesAmount: number;
          createdAt: Date;
          dojo: {
            name: string;
            isDeleted: boolean;
            branch: { name: string } | null;
          };
          user: { photoUrl: string | null } | null;
        };
      }>,
    );

    if (prismaRegs.degraded) identityDegraded = true;
    const memberIds = new Set(members.map((m) => m.id));
    for (const reg of prismaRegs.data ?? []) {
      const mid = reg.memberId;
      if (!regMap.has(mid)) {
        regMap.set(mid, {
          id: reg.id,
          status: reg.status,
          registeredRank: reg.registeredRank,
          memberId: mid,
          member: {
            id: reg.member.id,
            currentRank: reg.member.currentRank,
            fullName: reg.member.fullName,
            birthPlace: reg.member.birthPlace,
            birthDate: reg.member.birthDate?.toISOString() ?? null,
            gender: reg.member.gender,
            address: reg.member.address,
            birthCertificateUrl: reg.member.birthCertificateUrl,
            bpjsCardUrl: reg.member.bpjsCardUrl,
          },
        });
      }
      if (!memberIds.has(mid)) {
        memberIds.add(mid);
        members.push({
          id: reg.member.id,
          fullName: reg.member.fullName,
          nia: reg.member.nia,
          currentRank: reg.member.currentRank,
          status: reg.member.status,
          dojoId: reg.member.dojoId,
          dojo: {
            name: reg.member.dojo.name,
            isDeleted: reg.member.dojo.isDeleted,
            branch: reg.member.dojo.branch
              ? { name: reg.member.dojo.branch.name }
              : undefined,
          },
          birthCertificateUrl: reg.member.birthCertificateUrl,
          bpjsCardUrl: reg.member.bpjsCardUrl,
          bpjsCardNumber: reg.member.bpjsCardNumber,
          photoUrl: resolveMemberPhotoUrl(
            reg.member.photoUrl,
            reg.member.user?.photoUrl,
          ),
          createdAt: reg.member.createdAt.toISOString(),
          monthlyDuesAmount: reg.member.monthlyDuesAmount,
        });
      }
    }

    const missingBillingRegIds = (prismaRegs.data ?? [])
      .map((r) => r.id)
      .filter((id) => id && !billingMap.has(id));
    if (missingBillingRegIds.length > 0) {
      const localBillings = await withPrismaFallback(
        "ukt-billings-allowlist",
        () =>
          prisma.billing.findMany({
            where: {
              registrationId: { in: missingBillingRegIds },
              isDeleted: false,
            },
            select: {
              id: true,
              status: true,
              amount: true,
              baseFeeAmount: true,
              registrationId: true,
            },
            take: 500,
          }),
        [] as Array<{
          id: string;
          status: string;
          amount: number;
          baseFeeAmount: number | null;
          registrationId: string | null;
        }>,
      );
      for (const b of localBillings.data ?? []) {
        const rid = b.registrationId ? String(b.registrationId) : "";
        if (!rid || billingMap.has(rid)) continue;
        billingMap.set(rid, {
          id: b.id,
          status: b.status,
          amount: b.amount,
          baseFeeAmount: b.baseFeeAmount,
          registrationId: rid,
        });
      }
    }
  }

  // Lengkapi registrasi PENDING (daftar mandiri) dari Prisma — skip bila kosong.
  if (selectedPeriodId && !rantingAllowlistEmpty && !periodEmpty) {
    const prismaSelfRegs = await withPrismaFallback(
      "ukt-self-regs",
      () =>
        prisma.eventRegistration.findMany({
          where: {
            eventId: selectedPeriodId,
            status: { notIn: ["CANCELLED", "REJECTED"] },
            member: {
              isDeleted: false,
              ...(dojoAllowlist.length > 0
                ? { dojoId: { in: dojoAllowlist } }
                : {}),
            },
          },
          select: {
            id: true,
            status: true,
            registeredRank: true,
            memberId: true,
          },
          take: 800,
        }),
      [] as Array<{
        id: string;
        status: string;
        registeredRank: string | null;
        memberId: string;
      }>,
    );
    for (const reg of prismaSelfRegs.data ?? []) {
      if (regMap.has(reg.memberId)) {
        const existing = regMap.get(reg.memberId)!;
        // Prefer Prisma PENDING jika Inkai belum sync
        if (
          String(existing.status ?? "") !== "PENDING" &&
          reg.status === "PENDING"
        ) {
          existing.status = reg.status;
        }
        continue;
      }
      regMap.set(reg.memberId, {
        id: reg.id,
        status: reg.status,
        registeredRank: reg.registeredRank,
        memberId: reg.memberId,
      });
    }
  }

  // Lengkapi billingMap by registrationId dari Prisma untuk semua registrasi
  // yang belum tertaut — termasuk cabang (dojoAllowlist kosong), dan wajib saat
  // archive (billing global di-skip di atas). Lebih murah & akurat daripada
  // bergantung ke /v1/billing?limit=250 yang bisa miss di cabang besar.
  if (selectedPeriodId) {
    const regIdsNeedingBilling = Array.from(regMap.values())
      .map((r) => String(r.id ?? ""))
      .filter((id) => id && !billingMap.has(id))
      .slice(0, 800);
    if (regIdsNeedingBilling.length > 0) {
      const localBillings = await withPrismaFallback(
        "ukt-billings-regmap",
        () =>
          prisma.billing.findMany({
            where: {
              registrationId: { in: regIdsNeedingBilling },
              isDeleted: false,
            },
            select: {
              id: true,
              status: true,
              amount: true,
              baseFeeAmount: true,
              registrationId: true,
            },
            take: 800,
          }),
        [] as Array<{
          id: string;
          status: string;
          amount: number;
          baseFeeAmount: number | null;
          registrationId: string | null;
        }>,
      );
      for (const b of localBillings.data ?? []) {
        const rid = b.registrationId ? String(b.registrationId) : "";
        if (!rid || billingMap.has(rid)) continue;
        billingMap.set(rid, {
          id: b.id,
          status: b.status,
          amount: b.amount,
          baseFeeAmount: b.baseFeeAmount,
          registrationId: rid,
        });
      }
    }
  }

  // Registrasi-first merge: peserta yang sudah terdaftar (ada di regMap) tapi
  // tidak ikut pool anggota (limit 250/500, atau kosong saat archive) tetap
  // harus tampil — ambil langsung per memberId dari Prisma agar tidak "hilang"
  // dari tabel UKT hanya karena limit pool. Berlaku untuk cabang & ranting.
  // RBAC: untuk ranting (dojoAllowlist terisi) tetap dibatasi ke dojo yang
  // dikelola — cegah peserta dojo lain "bocor" lewat regMap bersama.
  if (selectedPeriodId && regMap.size > 0) {
    const existingMemberIds = new Set(members.map((m) => m.id));
    const missingRegMemberIds = Array.from(regMap.keys())
      .filter((id) => id && !existingMemberIds.has(id))
      .slice(0, 800);
    if (missingRegMemberIds.length > 0) {
      const missingMembers = await withPrismaFallback(
        "ukt-regs-missing-members",
        () =>
          prisma.member.findMany({
            where: {
              id: { in: missingRegMemberIds },
              isDeleted: false,
              ...(dojoAllowlist.length > 0
                ? { dojoId: { in: dojoAllowlist } }
                : {}),
            },
            select: {
              id: true,
              fullName: true,
              nia: true,
              currentRank: true,
              status: true,
              dojoId: true,
              birthPlace: true,
              birthDate: true,
              gender: true,
              address: true,
              birthCertificateUrl: true,
              bpjsCardUrl: true,
              bpjsCardNumber: true,
              ...(photoSelect),
              monthlyDuesAmount: true,
              createdAt: true,
              dojo: {
                select: {
                  name: true,
                  isDeleted: true,
                  branch: { select: { name: true } },
                },
              },
              user: { select: { photoUrl: true } },
            },
            take: 800,
          }),
        [] as Array<{
          id: string;
          fullName: string;
          nia: string | null;
          currentRank: string;
          status: string;
          dojoId: string;
          birthPlace: string | null;
          birthDate: Date | null;
          gender: string | null;
          address: string | null;
          birthCertificateUrl: string | null;
          bpjsCardUrl: string | null;
          bpjsCardNumber: string | null;
          photoUrl: string | null;
          monthlyDuesAmount: number;
          createdAt: Date;
          dojo: {
            name: string;
            isDeleted: boolean;
            branch: { name: string } | null;
          };
          user: { photoUrl: string | null } | null;
        }>,
      );
      if (missingMembers.degraded) identityDegraded = true;
      for (const m of missingMembers.data ?? []) {
        if (existingMemberIds.has(m.id)) continue;
        existingMemberIds.add(m.id);
        members.push({
          id: m.id,
          fullName: m.fullName,
          nia: m.nia,
          currentRank: m.currentRank,
          status: m.status,
          dojoId: m.dojoId,
          dojo: {
            name: m.dojo.name,
            isDeleted: m.dojo.isDeleted,
            branch: m.dojo.branch ? { name: m.dojo.branch.name } : undefined,
          },
          birthPlace: m.birthPlace,
          birthDate: m.birthDate?.toISOString() ?? null,
          gender: m.gender,
          address: m.address,
          birthCertificateUrl: m.birthCertificateUrl,
          bpjsCardUrl: m.bpjsCardUrl,
          bpjsCardNumber: m.bpjsCardNumber,
          photoUrl: resolveMemberPhotoUrl(m.photoUrl, m.user?.photoUrl),
          createdAt: m.createdAt.toISOString(),
          monthlyDuesAmount: m.monthlyDuesAmount,
        });
      }
    }
  }

  // Hitung absensi hanya untuk member final (pool + hasil registrasi-first
  // merge) — hindari memproses log milik member yang tidak akan dirender.
  const relevantMemberIds = new Set(members.map((m) => m.id));
  const relevantAttendanceLogs = attendanceLogs.filter((log) =>
    relevantMemberIds.has(log.memberId),
  );
  const { countByMember, pctByMember } = computeSemesterAttendance(
    relevantAttendanceLogs,
    semester,
    year,
  );

  const selfRegMetaMap =
    selectedPeriodId && !periodEmpty
      ? await loadUktSelfRegistrationMetaMap(selectedPeriodId)
      : new Map();

  const allRows: UktMemberRow[] = members.map((m) => {
    const reg = regMap.get(m.id);
    const regBilling = reg ? billingMap.get(String(reg.id)) : null;
    const memberData = (reg?.member as Record<string, unknown> | undefined) ?? m;
    const registeredRank =
      typeof reg?.registeredRank === "string" ? reg.registeredRank : null;
    const decoded = decodeUktRegisteredRank(registeredRank);
    const kyuBaruHint = decoded.kyuBaru || null;
    const billingStatus = regBilling?.status ? String(regBilling.status) : null;
    const paid =
      billingStatus === "PAID" || billingStatus === "SUCCESS";
    const examResult = reg?.id
      ? examResultMap.get(String(reg.id)) ?? null
      : null;
    // Kunci snapshot bila dual Kyu Lama/Baru, atau sabuk anggota sudah naik ke Kyu Baru
    const lockSnapshot = Boolean(
      paid &&
        kyuBaruHint &&
        decoded.kyuLama &&
        !ranksEqual(decoded.kyuLama, kyuBaruHint) &&
        (ranksEqual(m.currentRank, kyuBaruHint) ||
          examResult === "LULUS"),
    );
    const { kyuLama, kyuBaru } = resolveUktRankColumns(
      registeredRank,
      m.currentRank,
      null,
      { lockSnapshot, examResult },
    );

    return {
      memberId: m.id,
      registrationId: reg?.id ? String(reg.id) : null,
      photoUrl: resolveMemberPhotoUrl(
        m.photoUrl,
        undefined,
        typeof memberData.photoUrl === "string" ? memberData.photoUrl : null,
      ),
      nia: m.nia,
      fullName: m.fullName,
      birthPlace:
        (memberData.birthPlace as string | null) ??
        ((m as { birthPlace?: string | null }).birthPlace ?? null),
      birthDate: memberData.birthDate
        ? String(memberData.birthDate)
        : ((m as { birthDate?: string | null }).birthDate ?? null),
      gender:
        (memberData.gender as string | null) ??
        ((m as { gender?: string | null }).gender ?? null),
      address:
        (memberData.address as string | null) ??
        ((m as { address?: string | null }).address ?? null),
      kyuLama,
      kyuBaru,
      memberCurrentRank: formatRankLabel(m.currentRank) || m.currentRank || null,
      birthCertificateUrl:
        (memberData.birthCertificateUrl as string | null) ??
        m.birthCertificateUrl ??
        null,
      bpjsCardUrl: (memberData.bpjsCardUrl as string | null) ?? null,
      dojoName: m.dojo?.name ?? "—",
      dojoId: String((m as Record<string, unknown>).dojoId ?? ""),
      status: reg?.status ? String(reg.status) : "BELUM_DAFTAR",
      billingId: regBilling?.id ? String(regBilling.id) : null,
      billingStatus,
      billingAmount: uktBaseFeeAmount(
        regBilling?.amount != null ? Number(regBilling.amount) : null,
        regBilling?.baseFeeAmount != null
          ? Number(regBilling.baseFeeAmount)
          : null,
      ),
      outstandingDues: duesExemptMemberIds.data?.has(m.id)
        ? 0
        : billingCountByMember.get(m.id) ?? 0,
      pendingVerifications: verificationCountByMember.get(m.id) ?? 0,
      attendanceCount: countByMember.get(m.id) ?? 0,
      // Belum absen di semester → 0% agar gate Syarat memblokir Daftar UKT
      attendancePct: pctByMember.get(m.id) ?? 0,
      examResult: examResult,
      examPresent: reg?.id ? examAttendanceMap.get(String(reg.id)) ?? null : null,
      registrationWaiver: waiverMap.get(m.id) ?? null,
      selfRegistration: selfRegMetaMap.has(m.id),
      memberPaymentConfirmedAt:
        selfRegMetaMap.get(m.id)?.memberPaymentConfirmedAt ?? null,
    };
  });

  if (selectedPeriodId && allRows.length > 0) {
    const dateRows = await withPrismaFallback(
      "ukt-reg-createdAt",
      () =>
        prisma.eventRegistration.findMany({
          where: { eventId: selectedPeriodId },
          select: { memberId: true, createdAt: true },
          take: 800,
        }),
      [] as Array<{ memberId: string; createdAt: Date }>,
    );
    const byMember = new Map(
      (dateRows.data ?? []).map((r) => [r.memberId, r.createdAt.toISOString()]),
    );
    for (const row of allRows) {
      row.registeredAt = byMember.get(row.memberId) ?? null;
    }
  }

  return {
    periods,
    selectedPeriodId,
    targetSemester: effectiveSemester,
    targetYear: effectiveYear,
    dojos,
    allRows,
    beltFees,
    komisiRanting: effectiveKomisi,
    feesFromSnapshot: resolvedFees.fromSnapshot,
    globalBeltFees: beltFeesGlobal,
    globalKomisiRanting: komisiRanting,
    depositMap: Object.fromEntries(depositMap.entries()) as Record<
      string,
      UktDepositRecord
    >,
    periodMeta,
    identityDegraded,
    ok: (eventsOk || periodsFromPrisma) && (Array.isArray(eventsData) || membersResult.ok),
  };
}

/** Snapshot peserta periode untuk refresh cepat (tanpa pool anggota penuh). */
export type { UktRegistrationSnapshotItem };

/**
 * Refresh ringan: hanya detail event + tagihan + setting periode.
 * Skip daftar events, fee templates, absensi semester, verifikasi pending, pool anggota.
 */
export async function fetchUktTableRefreshSnapshot(
  token: string,
  periodId: string,
  opts?: { dojoAllowlist?: string[] },
): Promise<{
  periodId: string;
  participants: UktRegistrationSnapshotItem[];
  depositMap: Record<string, UktDepositRecord>;
  identityDegraded?: boolean;
}> {
  const dojoAllowlist = opts?.dojoAllowlist?.filter(Boolean) ?? [];
  const photoSelect = await memberPhotoSelect();
  let identityDegraded = false;
  const [
    eventDetail,
    billingsRes,
    examSettings,
    waiverSettings,
    examAttendanceSettings,
    depositSettings,
  ] = await Promise.all([
    fetchEventDetail(token, periodId),
    inkaiFetch("/v1/billing?limit=250", {}, token, {
      timeoutMs: 8_000,
      retries: 0,
    }),
    fetchSettingsByPrefix(token, `ukt-exam-result:${periodId}:`),
    fetchSettingsByPrefix(token, `ukt-registration-waiver:${periodId}:`),
    fetchSettingsByPrefix(token, `ukt-exam-attendance:${periodId}:`),
    fetchSettingsByPrefix(token, `ukt-deposit:${periodId}:`),
  ]);

  const examResultMap = buildUktExamResultMap(examSettings, periodId);
  const examAttendanceMap = buildUktExamAttendanceMap(
    examAttendanceSettings,
    periodId,
  );
  let depositMap = buildUktDepositMap(depositSettings, periodId);
  depositMap = await mergeUktDepositMapFromPrisma(periodId, depositMap);
  const waiverMap = buildUktWaiverMap(waiverSettings, periodId);

  const billingMap = new Map<string, Record<string, unknown>>();
  const registrations = [
    ...((eventDetail?.registrations as Array<Record<string, unknown>>) ?? []),
  ];
  const seenRegIds = new Set(
    registrations.map((r) => String(r.id ?? "")).filter(Boolean),
  );

  // Cabang + ranting: selalu lengkapi dari Prisma agar refresh diam (visibility)
  // tidak mengosongkan tabel saat Inkai event detail gagal/timeout.
  {
    const prismaRegs = await withPrismaFallback(
      "ukt-refresh-regs-prisma",
      () =>
        prisma.eventRegistration.findMany({
          where: {
            eventId: periodId,
            status: { notIn: ["CANCELLED", "REJECTED"] },
            member: {
              isDeleted: false,
              ...(dojoAllowlist.length > 0
                ? { dojoId: { in: dojoAllowlist } }
                : {}),
            },
          },
          select: {
            id: true,
            status: true,
            registeredRank: true,
            memberId: true,
            member: {
              select: {
                id: true,
                currentRank: true,
                fullName: true,
                nia: true,
                dojoId: true,
                ...(photoSelect),
                dojo: { select: { name: true } },
                user: { select: { photoUrl: true } },
              },
            },
          },
          take: 800,
        }),
      [] as Array<{
        id: string;
        status: string;
        registeredRank: string | null;
        memberId: string;
        member: {
          id: string;
          currentRank: string;
          fullName: string;
          nia: string | null;
          dojoId: string;
          photoUrl: string | null;
          dojo: { name: string } | null;
          user: { photoUrl: string | null } | null;
        };
      }>,
    );
    if (prismaRegs.degraded) identityDegraded = true;
    for (const reg of prismaRegs.data ?? []) {
      if (seenRegIds.has(reg.id)) continue;
      seenRegIds.add(reg.id);
      registrations.push({
        id: reg.id,
        status: reg.status,
        registeredRank: reg.registeredRank,
        memberId: reg.memberId,
        member: {
          id: reg.member.id,
          currentRank: reg.member.currentRank,
          fullName: reg.member.fullName,
          nia: reg.member.nia,
          dojoId: reg.member.dojoId,
          dojoName: reg.member.dojo?.name,
          photoUrl: resolveMemberPhotoUrl(
            reg.member.photoUrl,
            reg.member.user?.photoUrl,
          ),
        },
      });
    }
  }

  const selfRegMetaMap = await loadUktSelfRegistrationMetaMap(periodId);

  for (const reg of registrations) {
    const regStatus = String(reg.status ?? "").toUpperCase();
    if (regStatus === "CANCELLED" || regStatus === "REJECTED") continue;
    const member = reg.member as Record<string, unknown> | undefined;
    const billings = (member?.billings as Array<Record<string, unknown>>) ?? [];
    const billing = billings.find(
      (b) => String(b.registrationId ?? "") === String(reg.id),
    );
    if (billing?.id) billingMap.set(String(reg.id), billing);
  }

  if (billingsRes.res.ok) {
    const globalBillings =
      (billingsRes.data.data as Array<Record<string, unknown>>) ?? [];
    for (const b of globalBillings) {
      const rid = b.registrationId != null ? String(b.registrationId) : "";
      if (!rid || billingMap.has(rid)) continue;
      if (b.isDeleted === true) continue;
      billingMap.set(rid, b);
    }
    for (const reg of registrations) {
      const regId = String(reg.id ?? "");
      if (!regId || billingMap.has(regId)) continue;
      const mid = String(
        (reg.member as { id?: string } | undefined)?.id ?? reg.memberId ?? "",
      );
      if (!mid) continue;
      const match = globalBillings.find((b) => {
        if (b.isDeleted === true) return false;
        if (String(b.memberId ?? "") !== mid) return false;
        const rid = String(b.registrationId ?? "");
        if (rid && rid !== regId) return false;
        const st = String(b.status ?? "").toUpperCase();
        if (st === "PAID" || st === "SUCCESS" || st === "CANCELLED") return false;
        const type = String(b.type ?? "").toUpperCase();
        const desc = String(b.description ?? "").toUpperCase();
        return (
          type.includes("UKT") || type === "EVENT" || desc.includes("UKT")
        );
      });
      if (match?.id) billingMap.set(regId, match);
    }
  }

  // Prisma billing untuk registrasi yang baru digabung
  const missingBillingIds = registrations
    .map((r) => String(r.id ?? ""))
    .filter((id) => id && !billingMap.has(id));
  if (missingBillingIds.length > 0) {
    const localBillings = await withPrismaFallback(
      "ukt-refresh-billings",
      () =>
        prisma.billing.findMany({
          where: {
            registrationId: { in: missingBillingIds },
            isDeleted: false,
          },
          select: {
            id: true,
            status: true,
            amount: true,
            baseFeeAmount: true,
            registrationId: true,
          },
          take: 500,
        }),
      [] as Array<{
        id: string;
        status: string;
        amount: number;
        baseFeeAmount: number | null;
        registrationId: string | null;
      }>,
    );
    for (const b of localBillings.data ?? []) {
      const rid = b.registrationId ? String(b.registrationId) : "";
      if (!rid || billingMap.has(rid)) continue;
      billingMap.set(rid, {
        id: b.id,
        status: b.status,
        amount: b.amount,
        baseFeeAmount: b.baseFeeAmount,
        registrationId: rid,
      });
    }
  }

  const participants: UktRegistrationSnapshotItem[] = [];
  for (const reg of registrations) {
    const regStatus = String(reg.status ?? "").toUpperCase();
    if (regStatus === "CANCELLED" || regStatus === "REJECTED") continue;
    const memberId = String(
      (reg.member as { id?: string } | undefined)?.id ?? reg.memberId ?? "",
    );
    const registrationId = String(reg.id ?? "");
    if (!memberId || !registrationId) continue;

    const member = reg.member as
      | {
          currentRank?: string;
          billings?: unknown;
          fullName?: string;
          nia?: string | null;
          dojoId?: string;
          dojoName?: string;
          photoUrl?: string | null;
        }
      | undefined;
    const registeredRank =
      typeof reg.registeredRank === "string" ? reg.registeredRank : null;
    const regBilling = billingMap.get(registrationId) ?? null;
    const billingStatus = regBilling?.status ? String(regBilling.status) : null;
    const paid =
      billingStatus === "PAID" || billingStatus === "SUCCESS";
    const decoded = decodeUktRegisteredRank(registeredRank);
    const kyuBaruHint = decoded.kyuBaru || null;
    const memberRank = String(member?.currentRank ?? "");
    const examResult = examResultMap.get(registrationId) ?? null;
    const lockSnapshot = Boolean(
      paid &&
        kyuBaruHint &&
        decoded.kyuLama &&
        !ranksEqual(decoded.kyuLama, kyuBaruHint) &&
        (ranksEqual(memberRank, kyuBaruHint) || examResult === "LULUS"),
    );
    const { kyuLama, kyuBaru } = resolveUktRankColumns(
      registeredRank,
      memberRank,
      null,
      { lockSnapshot, examResult },
    );

    const selfMeta = selfRegMetaMap.get(memberId);

    participants.push({
      memberId,
      registrationId,
      status: reg.status ? String(reg.status) : "APPROVED",
      kyuLama: kyuLama || null,
      kyuBaru: kyuBaru || null,
      billingId: regBilling?.id ? String(regBilling.id) : null,
      billingStatus,
      billingAmount: uktBaseFeeAmount(
        regBilling?.amount != null ? Number(regBilling.amount) : null,
        regBilling?.baseFeeAmount != null
          ? Number(regBilling.baseFeeAmount)
          : null,
      ),
      examResult,
      examPresent: examAttendanceMap.get(registrationId) ?? null,
      registrationWaiver: waiverMap.get(memberId) ?? null,
      selfRegistration: Boolean(selfMeta),
      memberPaymentConfirmedAt: selfMeta?.memberPaymentConfirmedAt ?? null,
      fullName: member?.fullName,
      nia: member?.nia ?? null,
      dojoId: member?.dojoId ?? null,
      dojoName: member?.dojoName ?? null,
      photoUrl: member?.photoUrl ?? null,
      memberCurrentRank: formatRankLabel(memberRank) || memberRank || null,
    });
  }

  // Hydrate identitas Prisma untuk semua peserta (Tempat/TTL/JK/Alamat/Foto/dokumen).
  // Inkai event detail sering tidak membawa field ini → Refresh tampil "-".
  const hydrateIds = [
    ...new Set(participants.map((p) => p.memberId).filter(Boolean)),
  ].slice(0, 800);
  if (hydrateIds.length > 0) {
    const identityRows = await withPrismaFallback(
      "ukt-refresh-identity",
      () =>
        prisma.member.findMany({
          where: { id: { in: hydrateIds }, isDeleted: false },
          select: {
            id: true,
            fullName: true,
            nia: true,
            currentRank: true,
            dojoId: true,
            birthPlace: true,
            birthDate: true,
            gender: true,
            address: true,
            birthCertificateUrl: true,
            bpjsCardUrl: true,
            ...(photoSelect),
            dojo: { select: { name: true } },
            user: { select: { photoUrl: true } },
          },
          take: 800,
        }),
      [] as Array<{
        id: string;
        fullName: string;
        nia: string | null;
        currentRank: string;
        dojoId: string;
        birthPlace: string | null;
        birthDate: Date | null;
        gender: string | null;
        address: string | null;
        birthCertificateUrl: string | null;
        bpjsCardUrl: string | null;
        photoUrl: string | null;
        dojo: { name: string } | null;
        user: { photoUrl: string | null } | null;
      }>,
    );
    if (identityRows.degraded) identityDegraded = true;
    const byId = new Map((identityRows.data ?? []).map((m) => [m.id, m]));
    for (const p of participants) {
      const m = byId.get(p.memberId);
      if (!m) continue;
      p.fullName = m.fullName || p.fullName;
      p.nia = m.nia ?? p.nia ?? null;
      p.dojoId = m.dojoId || p.dojoId || null;
      p.dojoName = m.dojo?.name || p.dojoName || null;
      p.photoUrl = resolveMemberPhotoUrl(
        m.photoUrl,
        m.user?.photoUrl,
        p.photoUrl,
      );
      p.memberCurrentRank =
        formatRankLabel(m.currentRank) ||
        m.currentRank ||
        p.memberCurrentRank ||
        null;
      p.birthPlace = m.birthPlace;
      p.birthDate = m.birthDate?.toISOString() ?? null;
      p.gender = m.gender;
      p.address = m.address;
      p.birthCertificateUrl = m.birthCertificateUrl;
      p.bpjsCardUrl = m.bpjsCardUrl;
    }
  }

  if (participants.length > 0) {
    const dateRows = await withPrismaFallback(
      "ukt-refresh-reg-createdAt",
      () =>
        prisma.eventRegistration.findMany({
          where: { eventId: periodId },
          select: { memberId: true, createdAt: true },
          take: 800,
        }),
      [] as Array<{ memberId: string; createdAt: Date }>,
    );
    const byMember = new Map(
      (dateRows.data ?? []).map((r) => [r.memberId, r.createdAt.toISOString()]),
    );
    for (const p of participants) {
      p.registeredAt = byMember.get(p.memberId) ?? null;
    }
  }

  return {
    periodId,
    participants,
    depositMap: Object.fromEntries(depositMap.entries()) as Record<
      string,
      UktDepositRecord
    >,
    identityDegraded,
  };
}


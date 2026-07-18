import { cache } from "react";
import { inkaiFetch } from "./server";
import { getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";
import { resolveUktRankColumns } from "@/lib/belt";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import {
  beltFeesFromTemplates,
  DEFAULT_KOMISI_RANTING,
  UKT_KOMISI_SETTING_KEY,
  uktBaseFeeAmount,
  resolveUktSelectedPeriodId,
  computeSemesterAttendance,
  buildUktExamResultMap,
  buildUktWaiverMap,
  type UktExamResult,
  type UktMemberRow,
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

    const members = (data.data as AdminMemberRow[]) ?? [];
    const meta =
      (data.meta as { total?: number; page?: number; limit?: number }) ?? {};
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

export async function fetchMyNotifications(token: string) {
  const { res, data } = await inkaiFetch("/v1/notifications/my", {}, token);
  if (!res.ok) return { items: [], unread: 0 };
  const items = (data.data as Array<Record<string, unknown>>) ?? [];
  const unread = items.filter((n) => !n.isRead).length;
  return { items: items.slice(0, 5), unread };
}

export async function fetchAllNotifications(token: string, limit = 100) {
  const { res, data } = await inkaiFetch("/v1/notifications/my", {}, token);
  if (!res.ok) return [];
  const items = (data.data as Array<Record<string, unknown>>) ?? [];
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
  opts: { date?: string; limit?: number } = {},
) {
  const qs = new URLSearchParams();
  qs.set("limit", String(opts.limit ?? 200));
  if (opts.date) qs.set("date", opts.date);
  const { res, data } = await inkaiFetch(`/v1/attendance?${qs}`, {}, token);
  if (!res.ok) return [];
  return (data.data as Array<Record<string, unknown>>) ?? [];
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

export async function fetchAdminDashboardBundle(token: string) {
  const [stats, recent, pendingCount, pendingVerifications, pendingBillings, events, notifications] =
    await Promise.all([
      fetchDashboardStats(token),
      fetchRecentMembers(token),
      fetchPendingMembersCount(token),
      fetchPendingVerificationsCount(token),
      fetchPendingBillingsCount(token),
      fetchUpcomingEvents(token, 10),
      fetchMyNotifications(token),
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
  const primaryRole = getPrimaryAdminRole(user.roles);
  const memberQuery: { limit: number; page: number; dojoId?: string } = {
    limit: 500,
    page: 1,
  };
  if (primaryRole === "ADMIN_DOJO" && user.managedDojoId) {
    memberQuery.dojoId = user.managedDojoId;
    memberQuery.limit = 250;
  }

  const [
    eventsRes,
    dojos,
    membersResult,
    feesRes,
    komisiRanting,
    billingsRes,
    pendingVerificationsRes,
    attendanceRes,
    eventDetailInitial,
    examSettingsInitial,
    waiverSettingsInitial,
  ] = await Promise.all([
    inkaiFetch("/v1/events?limit=200", {}, token),
    fetchAdminDojos(token),
    fetchAdminMembers(token, memberQuery),
    inkaiFetch("/v1/events/rank-fee-templates", {}, token),
    fetchUktKomisiRanting(token, UKT_KOMISI_SETTING_KEY, DEFAULT_KOMISI_RANTING),
    inkaiFetch("/v1/billing?limit=250", {}, token),
    inkaiFetch("/v1/verifications/pending", {}, token),
    inkaiFetch("/v1/attendance?limit=3000", {}, token),
    periodFromUrl ? fetchEventDetail(token, periodFromUrl) : Promise.resolve(null),
    periodFromUrl
      ? fetchSettingsByPrefix(token, `ukt-exam-result:${periodFromUrl}:`)
      : Promise.resolve([]),
    periodFromUrl
      ? fetchSettingsByPrefix(token, `ukt-registration-waiver:${periodFromUrl}:`)
      : Promise.resolve([]),
  ]);

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

  if (selectedPeriodId && selectedPeriodId !== periodFromUrl) {
    [eventDetail, examSettings, waiverSettings] = await Promise.all([
      fetchEventDetail(token, selectedPeriodId),
      fetchSettingsByPrefix(token, `ukt-exam-result:${selectedPeriodId}:`),
      fetchSettingsByPrefix(token, `ukt-registration-waiver:${selectedPeriodId}:`),
    ]);
  }

  // Sinkronkan tanggal/batas pendaftaran dari detail event agar kartu "Atur" akurat.
  if (selectedPeriodId && eventDetail) {
    periods = upsertPeriodOption(
      periods,
      periodOptionFromEvent(eventDetail, selectedPeriodId),
    );
  }

  const attendanceLogs = attendanceRes.res.ok
    ? ((attendanceRes.data.data as Array<Record<string, unknown>>) ?? []).map((log) => {
        const member = log.member as { id?: string } | undefined;
        return {
          checkInAt: String(log.checkInAt ?? log.createdAt ?? ""),
          memberId: String(member?.id ?? log.memberId ?? ""),
        };
      })
    : [];
  const { countByMember, pctByMember } = computeSemesterAttendance(
    attendanceLogs,
    semester,
    year,
  );
  const examResultMap = selectedPeriodId
    ? buildUktExamResultMap(examSettings, selectedPeriodId)
    : new Map<string, UktExamResult>();
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
    ok: eventsRes.res.ok || membersResult.ok,
  };
}

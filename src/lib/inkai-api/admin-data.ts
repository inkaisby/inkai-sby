import { inkaiFetch } from "./server";

export type AdminMemberRow = {
  id: string;
  fullName: string;
  nia: string | null;
  currentRank: string;
  status: string;
  dojo: { name: string; branch?: { name: string } };
};

export async function fetchAdminMembers(
  token: string,
  opts: { page?: number; limit?: number; search?: string; status?: string } = {},
) {
  const qs = new URLSearchParams();
  qs.set("page", String(opts.page ?? 1));
  qs.set("limit", String(opts.limit ?? 20));
  if (opts.search) qs.set("search", opts.search);
  if (opts.status) qs.set("status", opts.status);

  const { res, data } = await inkaiFetch(`/v1/members?${qs}`, {}, token);
  if (!res.ok) return { ok: false as const, error: "Gagal memuat anggota" };

  const members = (data.data as AdminMemberRow[]) ?? [];
  const meta = (data.meta as { total?: number; page?: number; limit?: number }) ?? {};
  return {
    ok: true as const,
    members,
    total: meta.total ?? members.length,
    page: meta.page ?? 1,
  };
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
  const result = await fetchAdminMembers(token, { status: "PENDING", limit: 1, page: 1 });
  if (!result.ok) return 0;
  return result.total;
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

export async function fetchUpcomingEvents(token: string) {
  const { res, data } = await inkaiFetch("/v1/events", {}, token);
  if (!res.ok) return [];
  const events = (data.data as Array<Record<string, unknown>>) ?? [];
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  return events
    .filter((e) => new Date(String(e.startDate)).getTime() >= cutoff)
    .sort((a, b) => new Date(String(a.startDate)).getTime() - new Date(String(b.startDate)).getTime())
    .slice(0, 10);
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
  if (!res.ok) return [];
  return (data.data as Array<Record<string, unknown>>) ?? [];
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

export async function fetchAdminEvents(token: string, limit = 50) {
  const { res, data } = await inkaiFetch("/v1/events", {}, token);
  if (!res.ok) return [];
  const events = (data.data as Array<Record<string, unknown>>) ?? [];
  return events
    .sort((a, b) => new Date(String(b.startDate)).getTime() - new Date(String(a.startDate)).getTime())
    .slice(0, limit);
}

export async function fetchOrgStructure(token: string) {
  const { res, data } = await inkaiFetch("/v1/org/provinces", {}, token);
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
          branch: { id: b.id, name: b.name, province: { id: p.id, name: p.name } },
          _count: { members: (d._count as { members?: number })?.members ?? 0 },
        });
      }
    }
  }
  return { provinces, branches, dojos };
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
  const events = await fetchAdminEvents(token, 100);
  return events.filter((e) => String(e.title).toUpperCase().includes("UKT"));
}

export async function fetchEventDetail(token: string, eventId: string) {
  const { res, data } = await inkaiFetch(`/v1/events/${eventId}`, {}, token);
  if (!res.ok) return null;
  return (data.data as Record<string, unknown>) ?? null;
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

import { inkaiFetch } from "./server";

export async function fetchMyMemberProfile(token: string) {
  const { res, data } = await inkaiFetch("/v1/members/me", {}, token);
  if (!res.ok) return null;
  return (data.data as Record<string, unknown>) ?? null;
}

export async function fetchMyBillings(token: string, limit = 50) {
  const { res, data } = await inkaiFetch(`/v1/billing/my`, {}, token);
  if (!res.ok) return [];
  const items = (data.data as Array<Record<string, unknown>>) ?? [];
  return items.slice(0, limit);
}

export async function fetchMyAttendance(token: string, limit = 100) {
  const { res, data } = await inkaiFetch("/v1/attendance/me", {}, token);
  if (!res.ok) return [];
  const items = (data.data as Array<Record<string, unknown>>) ?? [];
  return items.slice(0, limit);
}

export async function fetchMyEventRegistrations(token: string) {
  const { res, data } = await inkaiFetch("/v1/events/my/registrations", {}, token);
  if (!res.ok) return [];
  return (data.data as Array<Record<string, unknown>>) ?? [];
}

export async function fetchMyNotifications(token: string, limit = 100) {
  const { res, data } = await inkaiFetch("/v1/notifications/my", {}, token);
  if (!res.ok) return [];
  const items = (data.data as Array<Record<string, unknown>>) ?? [];
  return items.slice(0, limit);
}

export async function fetchPublicUpcomingEvents(limit = 3) {
  const { res, data } = await inkaiFetch("/v1/events", {}, null);
  if (!res.ok) return [];
  const now = Date.now();
  return ((data.data as Array<Record<string, unknown>>) ?? [])
    .filter((e) => new Date(String(e.startDate)).getTime() >= now)
    .sort((a, b) => new Date(String(a.startDate)).getTime() - new Date(String(b.startDate)).getTime())
    .slice(0, limit);
}

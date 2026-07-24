import { cache } from "react";
import { inkaiFetch } from "./server";
import {
  applyMemberLocalOverlay,
  fetchMemberLocalOverlay,
  overlayMemberLocalFields,
} from "@/lib/member-local-fields";
import { isCurrentlyImpersonating } from "@/lib/security/impersonation";

/**
 * Endpoint "/me" & "/my" Inkai selalu diresolusi dari token, yang selama
 * mode ambil alih tetap milik aktor (lihat impersonation.ts). Jangan pernah
 * kembalikan hasilnya sebagai data target — itu berarti membocorkan data
 * pribadi aktor sekaligus menampilkan info palsu ke UI. Halaman pemanggil
 * wajib menampilkan pesan jujur ("Tidak tersedia saat ambil alih"), bukan
 * data ini.
 */

async function safeCall<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[member-data:${label}]`, error);
    return fallback;
  }
}

async function fetchMyMemberProfileUncached(
  token: string,
  memberIdHint?: string | null,
) {
  if (await isCurrentlyImpersonating()) return null;
  return safeCall(
    "profile",
    async () => {
      const hint = memberIdHint?.trim() || "";
      const [{ res, data }, localPrefetch] = await Promise.all([
        inkaiFetch("/v1/members/me", {}, token),
        hint ? fetchMemberLocalOverlay(hint) : Promise.resolve(null),
      ]);
      if (!res.ok) return null;
      const member = (data.data as Record<string, unknown>) ?? null;
      if (!member) return null;
      if (localPrefetch && String(member.id ?? "") === hint) {
        return applyMemberLocalOverlay(member, localPrefetch);
      }
      return overlayMemberLocalFields(member);
    },
    null,
  );
}

/** Dedup per request (layout + page). */
export const fetchMyMemberProfile = cache(fetchMyMemberProfileUncached);

export async function fetchMyBillings(token: string, limit = 50) {
  if (await isCurrentlyImpersonating()) return [];
  return safeCall(
    "billings",
    async () => {
      const { res, data } = await inkaiFetch(`/v1/billing/my`, {}, token);
      if (!res.ok) return [];
      const items = (data.data as Array<Record<string, unknown>>) ?? [];
      return items.slice(0, limit);
    },
    [],
  );
}

async function fetchMyAttendanceUncached(token: string, limit = 100) {
  if (await isCurrentlyImpersonating()) return [];
  return safeCall(
    "attendance",
    async () => {
      const { res, data } = await inkaiFetch("/v1/attendance/me", {}, token);
      if (!res.ok) return [];
      const items = (data.data as Array<Record<string, unknown>>) ?? [];
      return items.slice(0, limit);
    },
    [],
  );
}

/** Dedup per request (dashboard + absensi). */
export const fetchMyAttendance = cache(fetchMyAttendanceUncached);

export async function fetchMyEventRegistrations(token: string) {
  if (await isCurrentlyImpersonating()) return [];
  return safeCall(
    "registrations",
    async () => {
      const { res, data } = await inkaiFetch(
        "/v1/events/my/registrations",
        {},
        token,
      );
      if (!res.ok) return [];
      return (data.data as Array<Record<string, unknown>>) ?? [];
    },
    [],
  );
}

export async function fetchMyNotifications(
  token: string,
  limit = 100,
  userId?: string,
) {
  if (await isCurrentlyImpersonating()) return [];
  return safeCall(
    "notifications",
    async () => {
      const { res, data } = await inkaiFetch(
        `/v1/notifications/my?limit=${Math.min(Math.max(limit, 1), 100)}`,
        {},
        token,
      );
      if (!res.ok) return [];
      let items = (data.data as Array<Record<string, unknown>>) ?? [];
      if (userId) {
        const { filterNotificationsForMemberInbox, withFilterStats } =
          await import("@/lib/admin-notify-scope");
        const filtered = filterNotificationsForMemberInbox(userId, items);
        const { items: out, stats } = withFilterStats(items, filtered);
        if (stats.dropped > 0) {
          console.info(
            `[member-data:notifications] filtered dropped=${stats.dropped} input=${stats.input} output=${stats.output}`,
          );
        }
        items = out;
      }
      return items.slice(0, limit);
    },
    [],
  );
}

export async function fetchPublicUpcomingEvents(limit = 3) {
  return safeCall(
    "public-events",
    async () => {
      const { res, data } = await inkaiFetch("/v1/events", {}, null);
      if (!res.ok) return [];
      const now = Date.now();
      return ((data.data as Array<Record<string, unknown>>) ?? [])
        .filter((e) => new Date(String(e.startDate)).getTime() >= now)
        .sort(
          (a, b) =>
            new Date(String(a.startDate)).getTime() -
            new Date(String(b.startDate)).getTime(),
        )
        .slice(0, limit);
    },
    [],
  );
}

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildUktAdminUrlFromEvent } from "@/lib/ukt";

export type OpenEventSummary = {
  id: string;
  title: string;
  location: string | null;
  startDate: string;
  endDate: string;
  registrationCloseAt: string | null;
  registrationOpenAt: string | null;
  isUkt: boolean;
  href: string;
  closesAt: string;
  remainingMs: number;
};

export type PublicOpenEventSummary = {
  id: string;
  title: string;
  location: string | null;
  startDate: string;
  endDate: string;
  closesAt: string;
  remainingMs: number;
  registrationOpen: boolean;
  ongoing: boolean;
  isUkt: boolean;
  href: string;
};

function isUktTitle(title: string) {
  return title.toUpperCase().includes("UKT");
}

/** Pendaftaran masih terbuka: sekarang ∈ [openAt?, closeAt]. */
export function getEventRegistrationWindow(event: {
  startDate: Date;
  endDate: Date;
  registrationCloseAt: Date | null;
  registrationOpenAt?: Date | null;
}) {
  const closesAt = event.registrationCloseAt ?? event.endDate;
  const opensAt = event.registrationOpenAt ?? null;
  return { opensAt, closesAt };
}

export function isEventRegistrationOpen(
  event: {
    startDate: Date;
    endDate: Date;
    registrationCloseAt: Date | null;
    registrationOpenAt?: Date | null;
  },
  now = new Date(),
) {
  const { opensAt, closesAt } = getEventRegistrationWindow(event);
  if (opensAt && now.getTime() < opensAt.getTime()) return false;
  return now.getTime() <= closesAt.getTime();
}

/** Kegiatan sedang berlangsung: sekarang ∈ [startDate, endDate]. */
export function isEventOngoing(
  event: { startDate: Date; endDate: Date },
  now = new Date(),
) {
  const t = now.getTime();
  return t >= event.startDate.getTime() && t <= event.endDate.getTime();
}

export function formatRemainingShort(ms: number): string {
  if (ms <= 0) return "Ditutup";
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days >= 2) return `${days} hari lagi`;
  if (days === 1) return hours > 0 ? `1 hari ${hours} jam` : "1 hari lagi";
  if (hours >= 1) return mins > 0 ? `${hours} jam ${mins} mnt` : `${hours} jam lagi`;
  if (mins >= 1) return `${mins} menit lagi`;
  return "Sebentar lagi";
}

export async function listOpenEventsForAdmin(
  limit = 12,
): Promise<OpenEventSummary[]> {
  const now = new Date();
  // Ambil kandidat (belum lewat endDate jauh) lalu filter di memori untuk window open/close.
  const rows = await prisma.event.findMany({
    where: {
      isDeleted: false,
      endDate: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: [{ registrationCloseAt: "asc" }, { endDate: "asc" }],
    take: 80,
    select: {
      id: true,
      title: true,
      location: true,
      startDate: true,
      endDate: true,
      registrationCloseAt: true,
    },
  });

  const open: OpenEventSummary[] = [];
  for (const e of rows) {
    if (!isEventRegistrationOpen(e, now)) continue;
    const { closesAt } = getEventRegistrationWindow(e);
    const remainingMs = closesAt.getTime() - now.getTime();
    const isUkt = isUktTitle(e.title);
    open.push({
      id: e.id,
      title: e.title,
      location: e.location,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
      registrationCloseAt: e.registrationCloseAt?.toISOString() ?? null,
      registrationOpenAt: null,
      isUkt,
      href: isUkt
        ? buildUktAdminUrlFromEvent(e.title, e.id)
        : `/admin/kegiatan`,
      closesAt: closesAt.toISOString(),
      remainingMs,
    });
  }

  open.sort((a, b) => a.remainingMs - b.remainingMs);
  return open.slice(0, limit);
}

async function listOpenOrOngoingEventsForPublicUncached(
  limit = 5,
): Promise<PublicOpenEventSummary[]> {
  const now = new Date();
  const rows = await prisma.event.findMany({
    where: {
      isDeleted: false,
      endDate: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: [{ registrationCloseAt: "asc" }, { endDate: "asc" }],
    take: 80,
    select: {
      id: true,
      title: true,
      location: true,
      startDate: true,
      endDate: true,
      registrationCloseAt: true,
    },
  });

  const out: PublicOpenEventSummary[] = [];
  for (const e of rows) {
    const registrationOpen = isEventRegistrationOpen(e, now);
    const ongoing = isEventOngoing(e, now);
    if (!registrationOpen && !ongoing) continue;
    const { closesAt } = getEventRegistrationWindow(e);
    const remainingMs = Math.max(0, closesAt.getTime() - now.getTime());
    const isUkt = isUktTitle(e.title);
    out.push({
      id: e.id,
      title: e.title,
      location: e.location,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
      closesAt: closesAt.toISOString(),
      remainingMs,
      registrationOpen,
      ongoing,
      isUkt,
      href: isUkt ? `/undangan/ukt/${e.id}` : `/kegiatan/${e.id}`,
    });
  }

  out.sort((a, b) => {
    if (a.registrationOpen !== b.registrationOpen) {
      return a.registrationOpen ? -1 : 1;
    }
    return a.remainingMs - b.remainingMs;
  });
  return out.slice(0, limit);
}

export const listOpenOrOngoingEventsForPublic = unstable_cache(
  listOpenOrOngoingEventsForPublicUncached,
  ["public-open-or-ongoing-events"],
  { revalidate: 60, tags: ["events"] },
);

/** Status open/ongoing untuk set id (badge list publik). */
export async function getPublicEventStatusMap(
  ids: string[],
): Promise<
  Map<string, { registrationOpen: boolean; ongoing: boolean; isUkt: boolean }>
> {
  const map = new Map<
    string,
    { registrationOpen: boolean; ongoing: boolean; isUkt: boolean }
  >();
  if (ids.length === 0) return map;
  const now = new Date();
  const rows = await prisma.event.findMany({
    where: { id: { in: ids }, isDeleted: false },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      registrationCloseAt: true,
    },
  });
  for (const e of rows) {
    map.set(e.id, {
      registrationOpen: isEventRegistrationOpen(e, now),
      ongoing: isEventOngoing(e, now),
      isUkt: isUktTitle(e.title),
    });
  }
  return map;
}

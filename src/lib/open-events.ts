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

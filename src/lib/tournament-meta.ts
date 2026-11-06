import { prisma } from "@/lib/prisma";

export type TournamentEventMeta = {
  isArchived: boolean;
  archivedAt?: string | null;
};

const META_PREFIX = "tournament-meta:";

export function tournamentMetaKey(eventId: string): string {
  return `${META_PREFIX}${eventId}`;
}

export function parseTournamentMeta(val: unknown): TournamentEventMeta {
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    return {
      isArchived: Boolean(obj.isArchived),
      archivedAt: typeof obj.archivedAt === "string" ? obj.archivedAt : null,
    };
  }
  return {
    isArchived: false,
    archivedAt: null,
  };
}

export async function getTournamentMeta(eventId: string): Promise<TournamentEventMeta> {
  if (!eventId) return { isArchived: false, archivedAt: null };
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: tournamentMetaKey(eventId) },
      select: { value: true },
    });
    return parseTournamentMeta(setting?.value);
  } catch (error) {
    console.error("[getTournamentMeta] error:", error);
    return { isArchived: false, archivedAt: null };
  }
}

export async function getTournamentMetaMap(eventIds: string[]): Promise<Map<string, TournamentEventMeta>> {
  const map = new Map<string, TournamentEventMeta>();
  const validIds = [...new Set(eventIds.filter(Boolean))];
  if (validIds.length === 0) return map;

  try {
    const keys = validIds.map(tournamentMetaKey);
    const settings = await prisma.appSetting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });

    for (const s of settings) {
      const eventId = s.key.slice(META_PREFIX.length);
      if (eventId) {
        map.set(eventId, parseTournamentMeta(s.value));
      }
    }
  } catch (error) {
    console.error("[getTournamentMetaMap] error:", error);
  }

  // Ensure every requested eventId has an entry in map
  for (const id of validIds) {
    if (!map.has(id)) {
      map.set(id, { isArchived: false, archivedAt: null });
    }
  }

  return map;
}

export async function setTournamentEventArchived(
  eventId: string,
  isArchived: boolean
): Promise<TournamentEventMeta> {
  const meta: TournamentEventMeta = {
    isArchived,
    archivedAt: isArchived ? new Date().toISOString() : null,
  };

  try {
    await prisma.appSetting.upsert({
      where: { key: tournamentMetaKey(eventId) },
      create: {
        key: tournamentMetaKey(eventId),
        value: meta,
      },
      update: {
        value: meta,
      },
    });
  } catch (error) {
    console.error("[setTournamentEventArchived] error:", error);
    throw error;
  }

  return meta;
}

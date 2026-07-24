import { unstable_cache } from "next/cache";
import type { AppreciationKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AppreciationPublic = {
  id: string;
  kind: AppreciationKind;
  name: string;
  title: string | null;
  summary: string;
  photoUrl: string | null;
  eventDate: string | null;
  order: number;
};

function mapRow(row: {
  id: string;
  kind: AppreciationKind;
  name: string;
  title: string | null;
  summary: string;
  photoUrl: string | null;
  eventDate: Date | null;
  order: number;
}): AppreciationPublic {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    title: row.title,
    summary: row.summary,
    photoUrl: row.photoUrl,
    eventDate: row.eventDate?.toISOString() ?? null,
    order: row.order,
  };
}

const selectFields = {
  id: true,
  kind: true,
  name: true,
  title: true,
  summary: true,
  photoUrl: true,
  eventDate: true,
  order: true,
} as const;

export async function listActiveAppreciations(
  kind?: AppreciationKind | null,
): Promise<AppreciationPublic[]> {
  const cacheKey = kind ?? "all";
  return unstable_cache(
    async () => {
      const rows = await prisma.appreciationEntry.findMany({
        where: {
          isActive: true,
          ...(kind ? { kind } : {}),
        },
        orderBy: [{ order: "asc" }, { eventDate: "desc" }, { createdAt: "desc" }],
        take: 100,
        select: selectFields,
      });
      return rows.map(mapRow);
    },
    ["active-appreciations", cacheKey],
    { revalidate: 60, tags: ["appreciations"] },
  )();
}

export const listHomeAppreciationSnippet = unstable_cache(
  async (limit = 4): Promise<AppreciationPublic[]> => {
    const rows = await prisma.appreciationEntry.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { eventDate: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: selectFields,
    });
    return rows.map(mapRow);
  },
  ["home-appreciation-snippet"],
  { revalidate: 60, tags: ["appreciations"] },
);

export function appreciationKindLabel(kind: AppreciationKind): string {
  return kind === "KENANGAN" ? "Kenangan" : "Prestasi";
}

export function formatAppreciationDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Slug URL-friendly dari nama tokoh (untuk ?tokoh=). */
export function appreciationSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function appreciationKindQuery(
  kind: AppreciationKind,
): "kenangan" | "prestasi" {
  return kind === "KENANGAN" ? "kenangan" : "prestasi";
}

/** Path relatif yang bisa di-paste, mis. /apresiasi?jenis=kenangan&tokoh=sensei-maria-… */
export function appreciationPublicPath(item: {
  kind: AppreciationKind;
  name: string;
}): string {
  const jenis = appreciationKindQuery(item.kind);
  const tokoh = appreciationSlug(item.name);
  const params = new URLSearchParams({ jenis });
  if (tokoh) params.set("tokoh", tokoh);
  return `/apresiasi?${params.toString()}`;
}

export function findAppreciationByTokoh(
  items: AppreciationPublic[],
  tokoh: string | undefined,
): AppreciationPublic | null {
  if (!tokoh) return null;
  const needle = appreciationSlug(tokoh);
  if (!needle) return null;
  return items.find((i) => appreciationSlug(i.name) === needle) ?? null;
}

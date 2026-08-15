import { unstable_cache } from "next/cache";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { youtubeVideoId } from "@/lib/youtube";

export type ArticleMediaItem = {
  type: "IMAGE" | "VIDEO";
  url: string;
  caption?: string;
};

export type ArticlePublic = {
  id: string;
  title: string;
  summary: string;
  photoUrl: string | null;
  media: ArticleMediaItem[];
  publishedAt: string | null;
  order: number;
};

export function parseArticleMedia(raw: unknown): ArticleMediaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ArticleMediaItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const type = rec.type === "VIDEO" ? "VIDEO" : rec.type === "IMAGE" ? "IMAGE" : null;
    const url = typeof rec.url === "string" ? rec.url.trim() : "";
    if (!type || !url) continue;
    if (type === "VIDEO" && !youtubeVideoId(url)) continue;
    if (type === "IMAGE") {
      try {
        const u = new URL(url);
        if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      } catch {
        continue;
      }
    }
    const caption =
      typeof rec.caption === "string" && rec.caption.trim()
        ? rec.caption.trim().slice(0, 200)
        : undefined;
    out.push(caption ? { type, url, caption } : { type, url });
    if (out.length >= 20) break;
  }
  return out;
}

function mapRow(row: {
  id: string;
  title: string;
  summary: string;
  photoUrl: string | null;
  media?: unknown;
  publishedAt: Date | null;
  order: number;
}): ArticlePublic {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    photoUrl: row.photoUrl,
    media: parseArticleMedia(row.media),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    order: row.order,
  };
}

const selectFields = {
  id: true,
  title: true,
  summary: true,
  photoUrl: true,
  media: true,
  publishedAt: true,
  order: true,
} as const;

export async function listActiveArticles(): Promise<ArticlePublic[]> {
  return unstable_cache(
    async () => {
      const { data: rows } = await withPrismaFallback(
        "active-articles",
        () =>
          prisma.articleEntry.findMany({
            where: { isActive: true },
            orderBy: [
              { order: "asc" },
              { publishedAt: "desc" },
              { createdAt: "desc" },
            ],
            take: 100,
            select: selectFields,
          }),
        [],
      );
      return rows.map(mapRow);
    },
    ["active-articles"],
    { revalidate: 60, tags: ["articles"] },
  )();
}

export const listHomeArticlesPreview = unstable_cache(
  async (limit = 8): Promise<ArticlePublic[]> => {
    const { data: rows } = await withPrismaFallback(
      "home-articles-preview",
      () =>
        prisma.articleEntry.findMany({
          where: { isActive: true },
          orderBy: [
            { order: "asc" },
            { publishedAt: "desc" },
            { createdAt: "desc" },
          ],
          take: limit,
          select: selectFields,
        }),
      [],
    );
    return rows.map(mapRow);
  },
  ["home-articles-preview"],
  { revalidate: 60, tags: ["articles"] },
);

export function formatArticleDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Slug URL-friendly dari judul (untuk /artikel/[slug]). */
export function articleSlug(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Path relatif kanonis, mis. /artikel/latihan-bersama-… */
export function articlePublicPath(item: { title: string }): string {
  const slug = articleSlug(item.title);
  if (!slug) return "/artikel";
  return `/artikel/${encodeURIComponent(slug)}`;
}

export function findArticleBySlug(
  items: ArticlePublic[],
  slug: string | undefined,
): ArticlePublic | null {
  if (!slug) return null;
  const needle = articleSlug(slug);
  if (!needle) return null;
  return (
    items.find((i) => articleSlug(i.title) === needle) ??
    items.find((i) => i.id === slug) ??
    null
  );
}

export async function getArticleBySlug(
  slug: string,
): Promise<ArticlePublic | null> {
  const items = await listActiveArticles();
  return findArticleBySlug(items, slug);
}

/** Kutipan singkat untuk daftar / kartu beranda. */
export function articleExcerpt(summary: string, max = 220): string {
  const flat = summary.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

export function countArticleMedia(media: ArticleMediaItem[]): {
  images: number;
  videos: number;
} {
  let images = 0;
  let videos = 0;
  for (const m of media) {
    if (m.type === "IMAGE") images += 1;
    else videos += 1;
  }
  return { images, videos };
}

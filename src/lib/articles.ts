import { unstable_cache } from "next/cache";
import {
  emptyReactionCounts,
  isArticleReactionEmoji,
  type ArticleReactionCounts,
} from "@/lib/article-reactions";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { youtubeVideoId } from "@/lib/youtube";

export type ArticleMediaItem = {
  type: "IMAGE" | "VIDEO";
  url: string;
  caption?: string;
};

export type ArticleStatus = "DRAFT" | "PENDING" | "PUBLISHED" | "REJECTED";

export type ArticlePublic = {
  id: string;
  title: string;
  summary: string;
  photoUrl: string | null;
  media: ArticleMediaItem[];
  publishedAt: string | null;
  order: number;
  authorName: string | null;
  authorDojoName: string | null;
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
  authorName?: string | null;
  authorDojoName?: string | null;
}): ArticlePublic {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    photoUrl: row.photoUrl,
    media: parseArticleMedia(row.media),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    order: row.order,
    authorName: row.authorName ?? null,
    authorDojoName: row.authorDojoName ?? null,
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
  authorName: true,
  authorDojoName: true,
} as const;

/** Prefer published+active; fall back to isActive-only if status column missing (P2022). */
async function findPublishedArticles(take: number) {
  try {
    return await prisma.articleEntry.findMany({
      where: { isActive: true, status: "PUBLISHED" },
      orderBy: [
        { order: "asc" },
        { publishedAt: "desc" },
        { createdAt: "desc" },
      ],
      take,
      select: selectFields,
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "P2022") {
      return prisma.articleEntry.findMany({
        where: { isActive: true },
        orderBy: [
          { order: "asc" },
          { publishedAt: "desc" },
          { createdAt: "desc" },
        ],
        take,
        select: {
          id: true,
          title: true,
          summary: true,
          photoUrl: true,
          media: true,
          publishedAt: true,
          order: true,
        },
      });
    }
    throw error;
  }
}

export async function listActiveArticles(): Promise<ArticlePublic[]> {
  return unstable_cache(
    async () => {
      const { data: rows } = await withPrismaFallback(
        "active-articles",
        () => findPublishedArticles(100),
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
      () => findPublishedArticles(limit),
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

/** Short id suffix for stable unique public paths when titles collide. */
export function articleSlugWithId(item: { id: string; title: string }): string {
  const base = articleSlug(item.title);
  const suffix = item.id.replace(/-/g, "").slice(0, 8);
  if (!base) return suffix;
  return `${base}-${suffix}`;
}

/** Path relatif kanonis — pakai suffix id agar slug bentrok aman. */
export function articlePublicPath(item: { id: string; title: string }): string {
  const slug = articleSlugWithId(item);
  if (!slug) return "/artikel";
  return `/artikel/${encodeURIComponent(slug)}`;
}

export function findArticleBySlug(
  items: ArticlePublic[],
  slug: string | undefined,
): ArticlePublic | null {
  if (!slug) return null;
  const raw = decodeURIComponent(slug).trim();
  if (!raw) return null;

  // Exact match on id-suffixed slug (preferred, unique).
  const bySuffix = items.find((i) => articleSlugWithId(i) === raw);
  if (bySuffix) return bySuffix;

  // Legacy: bare title slug — pick newest published (first in list order).
  const needle = articleSlug(raw);
  if (needle) {
    const byTitle = items.find((i) => articleSlug(i.title) === needle);
    if (byTitle) return byTitle;
  }

  return items.find((i) => i.id === raw) ?? null;
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

export async function getReactionCountsForArticles(
  articleIds: string[],
): Promise<Record<string, ArticleReactionCounts>> {
  const result: Record<string, ArticleReactionCounts> = {};
  for (const id of articleIds) {
    result[id] = emptyReactionCounts();
  }
  if (articleIds.length === 0) return result;

  const { data: rows } = await withPrismaFallback(
    "article-reaction-counts",
    () =>
      prisma.articleReaction.groupBy({
        by: ["articleId", "emoji"],
        where: { articleId: { in: articleIds } },
        _count: { _all: true },
      }),
    [],
  );

  for (const row of rows) {
    if (!isArticleReactionEmoji(row.emoji)) continue;
    const bucket = result[row.articleId] ?? emptyReactionCounts();
    bucket[row.emoji] = row._count._all;
    result[row.articleId] = bucket;
  }
  return result;
}

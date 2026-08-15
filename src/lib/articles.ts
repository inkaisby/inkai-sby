import { unstable_cache } from "next/cache";
import { prisma, withPrismaFallback } from "@/lib/prisma";

export type ArticlePublic = {
  id: string;
  title: string;
  summary: string;
  photoUrl: string | null;
  publishedAt: string | null;
  order: number;
};

function mapRow(row: {
  id: string;
  title: string;
  summary: string;
  photoUrl: string | null;
  publishedAt: Date | null;
  order: number;
}): ArticlePublic {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    photoUrl: row.photoUrl,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    order: row.order,
  };
}

const selectFields = {
  id: true,
  title: true,
  summary: true,
  photoUrl: true,
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

/** Slug URL-friendly dari judul (untuk ?slug=). */
export function articleSlug(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Path relatif yang bisa di-paste, mis. /artikel?slug=latihan-bersama-… */
export function articlePublicPath(item: { title: string }): string {
  const slug = articleSlug(item.title);
  if (!slug) return "/artikel";
  return `/artikel?slug=${encodeURIComponent(slug)}`;
}

export function findArticleBySlug(
  items: ArticlePublic[],
  slug: string | undefined,
): ArticlePublic | null {
  if (!slug) return null;
  const needle = articleSlug(slug);
  if (!needle) return null;
  return items.find((i) => articleSlug(i.title) === needle) ?? null;
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArticleCopyLink } from "@/components/articles/ArticleDeepLink";
import { ArticlePhotoLightbox } from "@/components/articles/ArticleMediaGallery";
import { ArticleReactions } from "@/components/articles/ArticleReactions";
import { PublicPageHeader } from "@/components/layout/PublicPageHeader";
import { Badge } from "@/components/ui/badge";
import {
  articleExcerpt,
  articlePublicPath,
  articleSlug,
  countArticleMedia,
  findArticleBySlug,
  formatArticleDate,
  getReactionCountsForArticles,
  listActiveArticles,
} from "@/lib/articles";
import { cn } from "@/lib/utils";

const PAGE_DESCRIPTION =
  "Berita dan kegiatan terkini INKAI Cabang Surabaya.";
const PAGE_SIZE = 12;

export const revalidate = 60;

type Props = {
  searchParams: Promise<{ slug?: string; page?: string }>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const params = await searchParams;
  if (params.slug) {
    const items = await listActiveArticles();
    const focused = findArticleBySlug(items, params.slug);
    if (focused) {
      return {
        title: focused.title,
        description: articleExcerpt(focused.summary, 160) || PAGE_DESCRIPTION,
      };
    }
  }

  return {
    title: "Artikel",
    description: PAGE_DESCRIPTION,
  };
}

export default async function ArtikelPage({ searchParams }: Props) {
  const params = await searchParams;
  const items = await listActiveArticles();

  if (params.slug) {
    const focused = findArticleBySlug(items, params.slug);
    if (focused) {
      redirect(articlePublicPath(focused));
    }
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageRaw = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(pageRaw)
    ? Math.min(Math.max(1, pageRaw), totalPages)
    : 1;
  const slice = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const reactionMap = await getReactionCountsForArticles(
    slice.map((item) => item.id),
  );

  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-inkai-red/[0.04] via-transparent to-inkai-yellow/[0.03]"
        aria-hidden
      />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <PublicPageHeader
          badge="Artikel"
          title="Berita & Kegiatan"
          description={PAGE_DESCRIPTION}
        />

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/50 px-6 py-14 text-center">
            <span
              className="mx-auto mb-4 block h-px w-16 bg-gradient-to-r from-transparent via-inkai-red/40 to-transparent"
              aria-hidden
            />
            <p className="text-sm text-muted-foreground">
              Belum ada artikel yang dipublikasikan.
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-4">
              {slice.map((item) => {
                const dateLabel = formatArticleDate(item.publishedAt);
                const path = articlePublicPath(item);
                const slug = articleSlug(item.title);
                const counts = countArticleMedia(item.media);
                const mediaHint = [
                  counts.images > 0 ? `${counts.images} foto` : null,
                  counts.videos > 0 ? `${counts.videos} video` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <li key={item.id} id={slug ? `artikel-${slug}` : undefined}>
                    <article
                      id={`artikel-entry-${item.id}`}
                      className={cn(
                        "scroll-mt-24 overflow-hidden rounded-2xl border border-inkai-red/15 bg-card/90 transition-colors hover:border-inkai-red/30",
                      )}
                    >
                      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:gap-5 sm:p-6">
                        <span
                          className="mt-1 hidden w-1 shrink-0 self-stretch rounded-full bg-gradient-to-b from-inkai-red to-inkai-yellow/80 sm:block"
                          aria-hidden
                        />
                        <ArticlePhotoLightbox
                          title={item.title}
                          photoUrl={item.photoUrl}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className="border-inkai-red/25 bg-inkai-red/5 text-inkai-red"
                            >
                              Artikel
                            </Badge>
                            {dateLabel ? (
                              <span className="text-xs text-muted-foreground">
                                {dateLabel}
                              </span>
                            ) : null}
                            {mediaHint ? (
                              <span className="text-xs text-muted-foreground">
                                {mediaHint}
                              </span>
                            ) : null}
                            <ArticleCopyLink
                              path={path}
                              className="ml-auto sm:ml-0"
                            />
                          </div>
                          <h2 className="text-lg font-semibold tracking-tight">
                            <Link
                              href={path}
                              prefetch
                              className="transition-colors hover:text-inkai-red"
                            >
                              {item.title}
                            </Link>
                          </h2>
                          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                            {articleExcerpt(item.summary)}
                          </p>
                          <Link
                            href={path}
                            prefetch
                            className="mt-3 inline-block text-sm font-medium text-inkai-red hover:underline"
                          >
                            Baca selengkapnya →
                          </Link>
                          <ArticleReactions
                            articleId={item.id}
                            initialCounts={reactionMap[item.id]}
                            compact
                          />
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>

            {totalPages > 1 ? (
              <nav
                className="mt-8 flex items-center justify-center gap-3"
                aria-label="Paginasi artikel"
              >
                {page > 1 ? (
                  <Link
                    href={page === 2 ? "/artikel" : `/artikel?page=${page - 1}`}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    Sebelumnya
                  </Link>
                ) : (
                  <span className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground opacity-50">
                    Sebelumnya
                  </span>
                )}
                <span className="text-sm text-muted-foreground">
                  Halaman {page} / {totalPages}
                </span>
                {page < totalPages ? (
                  <Link
                    href={`/artikel?page=${page + 1}`}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    Berikutnya
                  </Link>
                ) : (
                  <span className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground opacity-50">
                    Berikutnya
                  </span>
                )}
              </nav>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

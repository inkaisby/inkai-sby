import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArticleCopyLink,
  ArticleScrollTarget,
} from "@/components/articles/ArticleDeepLink";
import { PublicPageHeader } from "@/components/layout/PublicPageHeader";
import { Badge } from "@/components/ui/badge";
import {
  articlePublicPath,
  articleSlug,
  findArticleBySlug,
  formatArticleDate,
  listActiveArticles,
} from "@/lib/articles";
import { cn } from "@/lib/utils";

const PAGE_DESCRIPTION =
  "Berita dan kegiatan terkini INKAI Cabang Surabaya.";

export const revalidate = 60;

type Props = {
  searchParams: Promise<{ slug?: string }>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const params = await searchParams;
  const items = await listActiveArticles();
  const focused = findArticleBySlug(items, params.slug);

  if (focused) {
    const excerpt =
      focused.summary.replace(/\s+/g, " ").trim().slice(0, 160) ||
      PAGE_DESCRIPTION;
    return {
      title: focused.title,
      description: excerpt,
      openGraph: {
        title: focused.title,
        description: excerpt,
      },
    };
  }

  return {
    title: "Artikel",
    description: PAGE_DESCRIPTION,
  };
}

export default async function ArtikelPage({ searchParams }: Props) {
  const params = await searchParams;
  const items = await listActiveArticles();
  const focused = findArticleBySlug(items, params.slug);
  const highlightId = focused?.id ?? null;

  return (
    <div className="relative overflow-hidden">
      <ArticleScrollTarget targetId={highlightId} />
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
          <ul className="space-y-4">
            {items.map((item) => {
              const dateLabel = formatArticleDate(item.publishedAt);
              const isFocused = highlightId === item.id;
              const path = articlePublicPath(item);
              const slug = articleSlug(item.title);
              return (
                <li key={item.id} id={slug ? `artikel-${slug}` : undefined}>
                  <article
                    id={`artikel-entry-${item.id}`}
                    className={cn(
                      "scroll-mt-24 overflow-hidden rounded-2xl border border-inkai-red/15 bg-card/90 transition-colors hover:border-inkai-red/30",
                      isFocused &&
                        "border-inkai-red/40 ring-2 ring-inkai-red/35",
                    )}
                  >
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:gap-5 sm:p-6">
                      <span
                        className="mt-1 hidden w-1 shrink-0 self-stretch rounded-full bg-gradient-to-b from-inkai-red to-inkai-yellow/80 sm:block"
                        aria-hidden
                      />
                      <Link
                        href={path}
                        prefetch
                        className="relative block aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-inkai-red/10 to-inkai-yellow/10 sm:w-44"
                      >
                        {item.photoUrl ? (
                          <Image
                            src={item.photoUrl}
                            alt={item.title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-2xl font-semibold text-inkai-red/70">
                            {item.title.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </Link>
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
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                          {item.summary}
                        </p>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ArticleCopyLink } from "@/components/articles/ArticleDeepLink";
import {
  ArticleMediaGallery,
  ArticlePhotoLightbox,
} from "@/components/articles/ArticleMediaGallery";
import { ArticleReactions } from "@/components/articles/ArticleReactions";
import { Badge } from "@/components/ui/badge";
import {
  articleExcerpt,
  articlePublicPath,
  formatArticleDate,
  getArticleBySlug,
  getReactionCountsForArticles,
} from "@/lib/articles";
import { SITE_URL } from "@/lib/site";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await getArticleBySlug(slug);
  if (!item) {
    return { title: "Artikel tidak ditemukan" };
  }

  const excerpt = articleExcerpt(item.summary, 160);
  const path = articlePublicPath(item);
  const canonical = `${SITE_URL}${path}`;

  return {
    title: item.title,
    description: excerpt,
    alternates: { canonical: path },
    openGraph: {
      title: item.title,
      description: excerpt,
      type: "article",
      url: canonical,
      publishedTime: item.publishedAt ?? undefined,
      locale: "id_ID",
    },
    twitter: {
      card: "summary_large_image",
      title: item.title,
      description: excerpt,
    },
  };
}

export default async function ArtikelDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getArticleBySlug(slug);
  if (!item) notFound();

  const dateLabel = formatArticleDate(item.publishedAt);
  const path = articlePublicPath(item);
  const reactionMap = await getReactionCountsForArticles([item.id]);

  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-inkai-red/[0.04] via-transparent to-inkai-yellow/[0.03]"
        aria-hidden
      />
      <article
        lang="id"
        className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16"
      >
        <Link
          href="/artikel"
          prefetch
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-inkai-red"
        >
          <ArrowLeft className="h-4 w-4" />
          Semua artikel
        </Link>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-inkai-red/25 bg-inkai-red/5 text-inkai-red"
          >
            Artikel
          </Badge>
          {dateLabel ? (
            <span className="text-xs text-muted-foreground">{dateLabel}</span>
          ) : null}
          <ArticleCopyLink path={path} className="ml-auto sm:ml-0" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {item.title}
        </h1>

        {item.authorName ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Ditulis oleh {item.authorName}
            {item.authorDojoName ? ` · ${item.authorDojoName}` : ""}
          </p>
        ) : null}

        {item.photoUrl ? (
          <div className="mt-6">
            <ArticlePhotoLightbox
              title={item.title}
              photoUrl={item.photoUrl}
              className="w-full sm:w-full"
            />
          </div>
        ) : null}

        <div className="mt-6 whitespace-pre-line text-justify text-base leading-relaxed hyphens-auto text-foreground/90 sm:text-[1.05rem]">
          {item.summary}
        </div>

        <ArticleReactions
          articleId={item.id}
          initialCounts={reactionMap[item.id]}
        />

        {item.media.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Media
            </h2>
            <ArticleMediaGallery media={item.media} />
          </section>
        ) : null}
      </article>
    </div>
  );
}

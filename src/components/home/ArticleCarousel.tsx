import { getActiveNewsCarouselPreview } from "@/lib/public-data";
import {
  articlePublicPath,
  formatArticleDate,
  listHomeArticlesPreview,
  type ArticlePublic,
} from "@/lib/articles";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";

type CarouselSlide = {
  id: string;
  title: string;
  imageUrl: string | null;
  summary: string | null;
  dateLabel: string | null;
  href: string | null;
  external: boolean;
  source: "article" | "carousel";
};

export default async function ArticleCarousel() {
  let slides: CarouselSlide[] = [];

  try {
    const articles = await listHomeArticlesPreview(8);
    if (articles.length > 0) {
      slides = articles.map((item: ArticlePublic) => ({
        id: item.id,
        title: item.title,
        imageUrl: item.photoUrl,
        summary: item.summary,
        dateLabel: formatArticleDate(item.publishedAt),
        href: articlePublicPath(item),
        external: false,
        source: "article" as const,
      }));
    } else {
      const carousel = await getActiveNewsCarouselPreview();
      slides = carousel.map((item) => ({
        id: item.id,
        title: item.title,
        imageUrl: item.imageUrl,
        summary: null,
        dateLabel: item.createdAt
          ? new Date(item.createdAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : null,
        href: item.targetUrl,
        external: Boolean(item.targetUrl?.startsWith("http")),
        source: "carousel" as const,
      }));
    }
  } catch (error) {
    console.error("[ArticleCarousel]", error);
    return null;
  }

  if (slides.length === 0) return null;

  return (
    <section className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <Badge
            variant="outline"
            className="mb-4 border-inkai-red/20 bg-inkai-red/5 text-inkai-red"
          >
            Artikel Terbaru
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Berita & Kegiatan
          </h2>
          <span
            className="mx-auto mt-5 block h-px w-20 bg-gradient-to-r from-transparent via-inkai-red/40 to-transparent"
            aria-hidden
          />
        </div>

        <Carousel opts={{ align: "start", loop: true }} className="w-full">
          <CarouselContent className="-ml-4">
            {slides.map((item) => (
              <CarouselItem
                key={item.id}
                className="pl-4 md:basis-1/2 lg:basis-1/3"
              >
                <Card className="inkai-card-hover group overflow-hidden border-border/70 bg-card/90 shadow-sm backdrop-blur-sm">
                  <div className="relative h-52 overflow-hidden bg-gradient-to-br from-inkai-red/10 to-inkai-yellow/10">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl font-semibold text-inkai-red/40">
                        {item.title.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <CardContent className="p-5">
                    {item.dateLabel ? (
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {item.dateLabel}
                      </p>
                    ) : null}
                    <h3 className="mb-2 line-clamp-2 font-semibold leading-snug tracking-tight transition-colors group-hover:text-inkai-red">
                      {item.title}
                    </h3>
                    {item.summary ? (
                      <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                        {item.summary}
                      </p>
                    ) : (
                      <div className="mb-4" />
                    )}
                    {item.href ? (
                      <Link
                        href={item.href}
                        target={item.external ? "_blank" : undefined}
                        className="inline-flex items-center gap-1 text-sm font-medium text-inkai-red hover:underline"
                      >
                        Baca selengkapnya
                        <span aria-hidden>→</span>
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        INKAI Surabaya
                      </span>
                    )}
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden sm:flex" />
          <CarouselNext className="hidden sm:flex" />
        </Carousel>

        {slides[0]?.source === "article" ? (
          <div className="mt-8 text-center">
            <Link
              href="/artikel"
              prefetch
              className="text-sm font-medium text-inkai-red hover:underline"
            >
              Lihat semua artikel →
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

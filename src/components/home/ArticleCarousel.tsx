import { getActiveNewsCarouselPreview } from "@/lib/public-data";
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

export default async function ArticleCarousel() {
  const items = await getActiveNewsCarouselPreview();

  if (items.length === 0) return null;

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <Badge
            variant="outline"
            className="mb-4 border-inkai-red/20 bg-inkai-red/5 text-inkai-red"
          >
            Artikel Terbaru
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Berita & Kegiatan
          </h2>
        </div>

        <Carousel opts={{ align: "start", loop: true }} className="w-full">
          <CarouselContent className="-ml-4">
            {items.map((item) => (
              <CarouselItem
                key={item.id}
                className="pl-4 md:basis-1/2 lg:basis-1/3"
              >
                <Card className="inkai-card-hover group overflow-hidden border shadow-sm">
                  <div className="relative h-52 overflow-hidden bg-gradient-to-br from-inkai-red/10 to-inkai-yellow/10">
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <CardContent className="p-5">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <h3 className="mb-4 line-clamp-2 font-semibold leading-snug group-hover:text-inkai-red transition-colors">
                      {item.title}
                    </h3>
                    {item.targetUrl ? (
                      <Link
                        href={item.targetUrl}
                        target={item.targetUrl.startsWith("http") ? "_blank" : undefined}
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
      </div>
    </section>
  );
}

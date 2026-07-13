import { prisma } from "@/lib/prisma";
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
  const items = await prisma.newsCarousel.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    take: 8,
  });

  if (items.length === 0) return null;

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <Badge className="mb-3 bg-inkai-red/10 text-inkai-red hover:bg-inkai-red/10">
              Artikel Terbaru
            </Badge>
            <h2 className="text-2xl font-bold sm:text-3xl">Berita & Kegiatan</h2>
          </div>
        </div>

        <Carousel opts={{ align: "start", loop: true }} className="w-full">
          <CarouselContent className="-ml-4">
            {items.map((item) => (
              <CarouselItem
                key={item.id}
                className="pl-4 md:basis-1/2 lg:basis-1/3"
              >
                <Card className="overflow-hidden border-0 shadow-md transition-shadow hover:shadow-lg">
                  <div className="relative h-48 bg-gradient-to-br from-inkai-red/10 to-inkai-yellow/10">
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <CardContent className="p-5">
                    <p className="mb-2 text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <h3 className="mb-4 line-clamp-2 font-semibold leading-snug">
                      {item.title}
                    </h3>
                    {item.targetUrl ? (
                      <Link
                        href={item.targetUrl}
                        target={item.targetUrl.startsWith("http") ? "_blank" : undefined}
                        className="text-sm font-medium text-inkai-red hover:underline"
                      >
                        Baca selengkapnya →
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

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Berita",
  description: "Berita dan artikel INKAI Cabang Surabaya.",
};

export const dynamic = "force-dynamic";

export default async function BeritaPage() {
  const items = await prisma.newsCarousel.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <Badge className="mb-4 bg-inkai-red/10 text-inkai-red hover:bg-inkai-red/10">
        Berita
      </Badge>
      <h1 className="mb-4 text-3xl font-bold">Berita & Artikel</h1>
      <p className="mb-10 text-muted-foreground">
        Informasi terbaru seputar kegiatan INKAI Surabaya.
      </p>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Belum ada berita. Kembali lagi nanti.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="relative h-48">
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <CardContent className="p-5">
                <h2 className="mb-2 font-semibold">{item.title}</h2>
                {item.targetUrl ? (
                  <Link
                    href={item.targetUrl}
                    className="text-sm text-inkai-red hover:underline"
                  >
                    Baca selengkapnya →
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">INKAI Surabaya</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

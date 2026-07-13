import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SITE_BRANCH_NAME } from "@/lib/site";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "Kegiatan",
  description: "Kegiatan dan event INKAI Cabang Surabaya.",
};

export const dynamic = "force-dynamic";

export default async function KegiatanPage() {
  const branch = await prisma.branch.findFirst({
    where: { name: { equals: SITE_BRANCH_NAME, mode: "insensitive" }, isDeleted: false },
  });

  const events = await prisma.event.findMany({
    where: {
      isDeleted: false,
      ...(branch ? { branchId: branch.id } : {}),
      startDate: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { startDate: "asc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <Badge className="mb-4 bg-inkai-red/10 text-inkai-red hover:bg-inkai-red/10">
        Kegiatan
      </Badge>
      <h1 className="mb-4 text-3xl font-bold">Kegiatan INKAI Surabaya</h1>
      <p className="mb-10 text-muted-foreground">
        Jadwal kegiatan, latihan bersama, dan kompetisi Cabang Surabaya.
      </p>

      {events.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Belum ada kegiatan terjadwal. Pantau halaman ini secara berkala.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Link key={event.id} href={`/kegiatan/${event.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex gap-4 p-6">
                  <Calendar className="h-5 w-5 text-inkai-red shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-semibold">{event.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.startDate).toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      {event.location && ` · ${event.location}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

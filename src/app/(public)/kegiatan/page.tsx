import type { Metadata } from "next";
import Link from "next/link";
import { getUpcomingEvents } from "@/lib/public-data";
import { PublicPageHeader } from "@/components/layout/PublicPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "Kegiatan",
  description: "Kegiatan dan event INKAI Cabang Surabaya.",
};

export const revalidate = 60;

export default async function KegiatanPage() {
  const events = await getUpcomingEvents();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <PublicPageHeader
        badge="Kegiatan"
        title="Kegiatan INKAI Surabaya"
        description="Jadwal kegiatan, latihan bersama, dan kompetisi Cabang Surabaya."
      />

      {events.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Belum ada kegiatan terjadwal. Pantau halaman ini secara berkala.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Link key={event.id} href={`/kegiatan/${event.id}`} prefetch>
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

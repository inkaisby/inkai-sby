import type { Metadata } from "next";
import Link from "next/link";
import { getUpcomingEvents } from "@/lib/public-data";
import { getPublicEventStatusMap } from "@/lib/open-events";
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
  const statusMap = await getPublicEventStatusMap(events.map((e) => e.id));

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
          {events.map((event) => {
            const status = statusMap.get(event.id);
            const href =
              status?.isUkt && (status.registrationOpen || status.ongoing)
                ? `/undangan/ukt/${event.id}`
                : `/kegiatan/${event.id}`;
            return (
              <Link key={event.id} href={href} prefetch>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex gap-4 p-6">
                    <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-inkai-red" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <h2 className="font-semibold">{event.title}</h2>
                        {status?.registrationOpen ? (
                          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                            Masih terbuka
                          </span>
                        ) : null}
                        {status?.ongoing ? (
                          <span className="rounded-md bg-inkai-yellow/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-inkai-yellow">
                            Berlangsung
                          </span>
                        ) : null}
                      </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
}

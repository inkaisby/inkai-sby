import type { Metadata } from "next";
import Link from "next/link";
import { getUpcomingEvents } from "@/lib/public-data";
import { getPublicEventStatusMap, getEventTargetHref } from "@/lib/open-events";
import { PublicPageHeader } from "@/components/layout/PublicPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Zap, Trophy, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Kegiatan",
  description: "Kegiatan dan event INKAI Cabang Surabaya.",
};

export const revalidate = 60;

export default async function KegiatanPage() {
  const events = await getUpcomingEvents();
  const statusMap = await getPublicEventStatusMap(events.map((e) => e.id));

  const featuredEvent = events.find(
    (e) => statusMap.get(e.id)?.registrationOpen || statusMap.get(e.id)?.ongoing
  ) || events[0];

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
        <div className="space-y-6">
          {/* Featured Active Event Banner */}
          {featuredEvent && (
            <div className="rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-amber-600 p-6 text-white shadow-xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-bold backdrop-blur-xs">
                <Zap className="w-4 h-4 text-yellow-300" /> Kegiatan Utama & Pendaftaran Aktif
              </div>
              <h2 className="text-xl font-extrabold">{featuredEvent.title}</h2>
              <p className="text-xs text-red-100">
                {new Date(featuredEvent.startDate).toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {featuredEvent.location && ` · ${featuredEvent.location}`}
              </p>
              <div className="pt-2">
                <Link
                  href={getEventTargetHref(featuredEvent)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-red-700 hover:bg-zinc-100 font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition transform hover:-translate-y-0.5"
                >
                  <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Buka Pendaftaran & Daftar Peserta Sekarang</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
              Daftar Seluruh Kegiatan Terjadwal ({events.length})
            </h3>

            {events.map((event) => {
              const status = statusMap.get(event.id);
              const href = getEventTargetHref(event);
              return (
                <Link key={event.id} href={href} prefetch>
                  <Card className="transition-all hover:shadow-md hover:border-red-200 dark:hover:border-red-900/50">
                    <CardContent className="flex gap-4 p-6">
                      <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-inkai-red" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <h2 className="font-semibold text-zinc-900 dark:text-white">{event.title}</h2>
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
        </div>
      )}
    </div>
  );
}

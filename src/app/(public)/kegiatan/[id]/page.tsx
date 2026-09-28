import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getEventDetail } from "@/lib/public-data";
import { isLatberEventTitle } from "@/lib/latber";
import { isUktAdminEventTitle } from "@/lib/ukt";
import { PublicPageHeader } from "@/components/layout/PublicPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, MapPin, Tag } from "lucide-react";

export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventDetail(id);
  if (!event) {
    return { title: "Kegiatan Tidak Ditemukan" };
  }
  return {
    title: `${event.title} | INKAI Surabaya`,
    description:
      event.description ||
      `Informasi detail kegiatan ${event.title} INKAI Cabang Surabaya.`,
  };
}

export default async function KegiatanDetailPage({ params }: Props) {
  const { id } = await params;
  const event = await getEventDetail(id);

  if (!event) notFound();

  if (isLatberEventTitle(event.title)) {
    redirect(`/latber?period=${event.id}`);
  }

  if (isUktAdminEventTitle(event.title)) {
    redirect(`/undangan/ukt/${event.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <PublicPageHeader
        badge="Detail Kegiatan"
        title={event.title}
        description={event.location ? `Lokasi: ${event.location}` : undefined}
      />

      <Card className="mt-6 border-inkai-red/10 shadow-sm">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 text-sm">
              <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-inkai-red" />
              <div>
                <p className="font-semibold text-foreground">Waktu & Tanggal</p>
                <p className="text-muted-foreground">
                  {new Date(event.startDate).toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {event.endDate &&
                    ` — ${new Date(event.endDate).toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}`}
                </p>
              </div>
            </div>

            {event.location ? (
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-inkai-red" />
                <div>
                  <p className="font-semibold text-foreground">Lokasi Perhelatan</p>
                  <p className="text-muted-foreground">{event.location}</p>
                </div>
              </div>
            ) : null}
          </div>

          {event.description ? (
            <div className="border-t pt-4">
              <h2 className="mb-2 font-semibold text-foreground">Keterangan & Deskripsi</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {event.description}
              </p>
            </div>
          ) : null}

          {event.categories && event.categories.length > 0 ? (
            <div className="border-t pt-4">
              <div className="mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4 text-inkai-red" />
                <h2 className="font-semibold text-foreground">Kategori Pendaftaran</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {event.categories.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border bg-muted/40 px-3.5 py-2 text-sm"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="font-bold text-inkai-red">
                      Rp {c.fee.toLocaleString("id-ID")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

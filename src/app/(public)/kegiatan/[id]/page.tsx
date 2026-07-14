import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEventDetail } from "@/lib/public-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventDetail(id);
  return { title: event?.title || "Kegiatan" };
}

export default async function KegiatanDetailPage({ params }: Props) {
  const { id } = await params;
  const event = await getEventDetail(id);

  if (!event) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Badge className="mb-4 bg-inkai-red/10 text-inkai-red hover:bg-inkai-red/10">
        Detail Kegiatan
      </Badge>
      <h1 className="mb-4 text-3xl font-bold">{event.title}</h1>
      <Card>
        <CardContent className="space-y-4 p-6">
          <p>
            <span className="font-medium">Tanggal:</span>{" "}
            {new Date(event.startDate).toLocaleString("id-ID")} —{" "}
            {new Date(event.endDate).toLocaleString("id-ID")}
          </p>
          {event.location && (
            <p>
              <span className="font-medium">Lokasi:</span> {event.location}
            </p>
          )}
          {event.description && (
            <p className="whitespace-pre-wrap text-muted-foreground">
              {event.description}
            </p>
          )}
          {event.categories.length > 0 && (
            <div>
              <p className="mb-2 font-medium">Kategori:</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {event.categories.map((c) => (
                  <li key={c.id}>
                    {c.name} — Rp {c.fee.toLocaleString("id-ID")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

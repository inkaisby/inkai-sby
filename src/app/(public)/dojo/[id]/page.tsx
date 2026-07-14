import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDojoDetail } from "@/lib/public-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Phone, Clock, Users } from "lucide-react";

export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const dojo = await getDojoDetail(id);
  return { title: dojo ? `Dojo ${dojo.name.trim()}` : "Dojo" };
}

export default async function DojoDetailPage({ params }: Props) {
  const { id } = await params;
  const dojo = await getDojoDetail(id);

  if (!dojo) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Badge className="mb-4 bg-inkai-red/10 text-inkai-red hover:bg-inkai-red/10">
        Dojo/Ranting
      </Badge>
      <h1 className="mb-2 text-3xl font-bold">{dojo.name.trim()}</h1>
      <p className="mb-8 text-muted-foreground">
        Cabang {dojo.branch.name} · INKAI Surabaya
      </p>

      <Card className="mb-6">
        <CardContent className="space-y-4 p-6">
          {dojo.headName && (
            <p>
              <span className="font-medium">Pelatih/Ketua:</span> {dojo.headName}
            </p>
          )}
          {dojo.address && (
            <p className="flex gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-inkai-red" />
              {dojo.address}
              {dojo.kecamatan && `, Kec. ${dojo.kecamatan}`}
            </p>
          )}
          {dojo.phoneNumber && (
            <p className="flex gap-2">
              <Phone className="h-4 w-4 mt-0.5 text-inkai-red" />
              {dojo.phoneNumber}
            </p>
          )}
          {dojo.schedule && (
            <p className="flex gap-2">
              <Clock className="h-4 w-4 mt-0.5 text-inkai-red" />
              Jadwal: {dojo.schedule}
            </p>
          )}
          {dojo.tempatLatihan && (
            <p className="text-sm text-muted-foreground">
              Tempat latihan: {dojo.tempatLatihan}
            </p>
          )}
          <p className="flex gap-2">
            <Users className="h-4 w-4 mt-0.5 text-inkai-red" />
            {dojo._count.members} anggota terdaftar
          </p>
        </CardContent>
      </Card>

      <Link
        href={`/daftar?dojo=${dojo.id}`}
        prefetch
        className="inline-flex rounded-lg bg-inkai-red px-4 py-2 text-sm font-medium text-white hover:bg-inkai-red/90"
      >
        Daftar di dojo ini
      </Link>
    </div>
  );
}

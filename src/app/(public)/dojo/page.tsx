import type { Metadata } from "next";
import Link from "next/link";
import { getBranchDojosList } from "@/lib/public-data";
import { SITE_BRANCH_NAME } from "@/lib/site";
import { PublicPageHeader } from "@/components/layout/PublicPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, MapPin, Phone, User } from "lucide-react";

export const metadata: Metadata = {
  title: "Dojo / Ranting",
  description: `Daftar dojo dan ranting INKAI Cabang ${SITE_BRANCH_NAME} beserta alamat, kontak, dan jadwal latihan.`,
};

export const revalidate = 60;

function leaderLine(dojo: {
  headName: string | null;
  contactPerson: string | null;
}) {
  return dojo.headName?.trim() || dojo.contactPerson?.trim() || null;
}

export default async function DojoListPage() {
  const dojos = await getBranchDojosList();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <PublicPageHeader
        badge={`Wilayah ${SITE_BRANCH_NAME}`}
        title="Dojo / Ranting"
        description={`Daftar lengkap dojo dan ranting di bawah INKAI Cabang ${SITE_BRANCH_NAME}. Pilih dojo untuk mendaftar atau melihat detail.`}
      />

      {dojos.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            Belum ada data dojo/ranting.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {dojos.map((dojo) => {
            const leader = leaderLine(dojo);

            return (
              <Card key={dojo.id} className="overflow-hidden">
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold">{dojo.name.trim()}</h2>
                      <p className="text-sm text-muted-foreground">
                        Cabang {SITE_BRANCH_NAME} · INKAI Surabaya
                      </p>
                    </div>
                    <Link
                      href={`/daftar?dojo=${dojo.id}`}
                      prefetch
                      className="inline-flex shrink-0 rounded-lg bg-inkai-red px-3 py-1.5 text-sm font-medium text-white hover:bg-inkai-red/90"
                    >
                      Daftar di sini
                    </Link>
                  </div>

                  <div className="space-y-3 text-sm">
                    {leader && (
                      <p className="flex gap-2">
                        <User className="mt-0.5 h-4 w-4 shrink-0 text-inkai-red" />
                        <span>
                          <span className="font-medium">Pelatih/Ketua:</span>{" "}
                          {leader}
                        </span>
                      </p>
                    )}
                    {dojo.address && (
                      <p className="flex gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-inkai-red" />
                        <span>
                          {dojo.address.trim()}
                          {dojo.kecamatan
                            ? `, Kec. ${dojo.kecamatan.trim()}`
                            : ""}
                        </span>
                      </p>
                    )}
                    {dojo.phoneNumber?.trim() && (
                      <p className="flex gap-2">
                        <Phone className="mt-0.5 h-4 w-4 shrink-0 text-inkai-red" />
                        {dojo.phoneNumber.trim()}
                      </p>
                    )}
                    {dojo.schedule?.trim() && (
                      <p className="flex gap-2">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-inkai-red" />
                        <span>
                          <span className="font-medium">Jadwal:</span>{" "}
                          {dojo.schedule.trim()}
                        </span>
                      </p>
                    )}
                    {dojo.tempatLatihan?.trim() && (
                      <p className="rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Tempat latihan:
                        </span>{" "}
                        {dojo.tempatLatihan.trim()}
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/dojo/${dojo.id}`}
                    prefetch
                    className="inline-block text-sm font-medium text-inkai-red hover:underline"
                  >
                    Lihat halaman dojo →
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

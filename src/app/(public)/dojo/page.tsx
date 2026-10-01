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
        <Card className="border-border/60 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-inkai-red/10 text-inkai-red ring-8 ring-inkai-red/5">
              <MapPin className="h-7 w-7" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h3 className="text-base font-bold text-foreground sm:text-lg">
                Daftar Dojo / Ranting INKAI Surabaya
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Data lokasi latihan & pengurus ranting sedang disinkronkan. Anda tetap dapat melakukan pendaftaran anggota baru atau menghubungi Pengurus Cabang untuk rekomendasi dojo terdekat.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <Link
                href="/daftar"
                prefetch
                className="inline-flex items-center gap-1.5 rounded-xl bg-inkai-red px-4 py-2 text-xs font-semibold text-white shadow-md shadow-inkai-red/20 transition-all hover:bg-inkai-red/90"
              >
                🥋 Form Pendaftaran Anggota
              </Link>
              <a
                href="https://wa.me/6285731241840?text=Halo%20Pengurus%20INKAI%20Surabaya,%20saya%20ingin%20tanya%20informasi%20lokasi%20dojo%20/%20ranting%20latihan"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-muted"
              >
                💬 Hubungi Sekretariat WA
              </a>
            </div>
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

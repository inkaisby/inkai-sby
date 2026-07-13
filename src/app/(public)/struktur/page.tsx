import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_BRANCH_NAME, SITE_PROVINCE_NAME } from "@/lib/site";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  MapPin,
  Users,
  Home,
  ChevronRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Struktur Organisasi",
  description:
    "Struktur organisasi INKAI Cabang Surabaya — dojo dan ranting di bawah Provinsi Jawa Timur.",
};

export const dynamic = "force-dynamic";

export default async function StrukturPage() {
  const branch = await prisma.branch.findFirst({
    where: {
      isDeleted: false,
      name: { equals: SITE_BRANCH_NAME, mode: "insensitive" },
      province: {
        isDeleted: false,
        name: { equals: SITE_PROVINCE_NAME, mode: "insensitive" },
      },
    },
    include: {
      province: true,
      dojos: {
        where: { isDeleted: false },
        include: { _count: { select: { members: true } } },
        orderBy: { name: "asc" },
      },
    },
  });

  const totalMembers =
    branch?.dojos.reduce((sum, dojo) => sum + dojo._count.members, 0) ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <Badge className="mb-4 bg-inkai-black/5 text-inkai-black hover:bg-inkai-black/5">
        Struktur Organisasi
      </Badge>
      <h1 className="mb-4 text-3xl font-bold sm:text-4xl">
        Struktur Organisasi INKAI Surabaya
      </h1>
      <p className="mb-10 max-w-2xl text-muted-foreground">
        Hierarki organisasi Cabang Surabaya di bawah INKAI Provinsi Jawa Timur,
        dari tingkat cabang hingga dojo/ranting.
      </p>

      <div className="mb-8 flex flex-wrap items-center justify-center gap-2 text-sm">
        {["Pusat (Nasional)", "Provinsi Jatim", "Cabang Surabaya", "Dojo/Ranting"].map(
          (level, i) => (
            <div key={level} className="flex items-center gap-2">
              <span className="rounded-full bg-inkai-red/10 px-3 py-1 font-medium text-inkai-red">
                {level}
              </span>
              {i < 3 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          )
        )}
      </div>

      <Card className="mb-6 border-inkai-red/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-inkai-red" />
            <CardTitle className="text-lg">INKAI Pusat (Nasional)</CardTitle>
          </div>
        </CardHeader>
      </Card>

      {!branch ? (
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            Data cabang Surabaya belum tersedia.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6 ml-4 sm:ml-8">
            <Card className="border-inkai-yellow/30">
              <CardContent className="flex items-center gap-3 p-4">
                <MapPin className="h-5 w-5 text-inkai-yellow" />
                <div>
                  <p className="font-semibold">
                    Provinsi {branch.province.name}
                  </p>
                  {branch.province.headName && (
                    <p className="text-sm text-muted-foreground">
                      Ketua: {branch.province.headName}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mb-8 ml-8 space-y-4 sm:ml-16">
            <Card className="border-inkai-red/20">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <Home className="h-5 w-5 text-inkai-red" />
                  <div>
                    <p className="font-semibold">Cabang {branch.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {branch.city ?? "Surabaya, Jawa Timur"}
                    </p>
                    {branch.headName && (
                      <p className="text-sm text-muted-foreground">
                        Ketua: {branch.headName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Badge variant="secondary">
                    {branch.dojos.length} dojo/ranting
                  </Badge>
                  <Badge variant="secondary">{totalMembers} anggota</Badge>
                </div>
              </CardContent>
            </Card>

            <div className="ml-4 space-y-3 sm:ml-8">
              <p className="text-sm font-medium text-muted-foreground">
                Dojo & Ranting di Surabaya
              </p>
              {branch.dojos.map((dojo) => (
                <Card key={dojo.id} className="bg-muted/30">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{dojo.name.trim()}</p>
                        {dojo.headName && (
                          <p className="text-xs text-muted-foreground">
                            Pelatih/Ketua: {dojo.headName}
                          </p>
                        )}
                        {dojo.address && (
                          <p className="text-xs text-muted-foreground">
                            {dojo.address}
                          </p>
                        )}
                        {dojo.kecamatan && (
                          <p className="text-xs text-muted-foreground">
                            Kec. {dojo.kecamatan}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {dojo._count.members} anggota
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

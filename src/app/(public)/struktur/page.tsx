import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
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
};

export const dynamic = "force-dynamic";

export default async function StrukturPage() {
  const provinces = await prisma.province.findMany({
    where: { isDeleted: false },
    include: {
      branches: {
        where: { isDeleted: false },
        include: {
          dojos: {
            where: { isDeleted: false },
            include: { _count: { select: { members: true } } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <Badge className="mb-4 bg-inkai-black/5 text-inkai-black hover:bg-inkai-black/5">
        Struktur Organisasi
      </Badge>
      <h1 className="mb-4 text-3xl font-bold sm:text-4xl">
        Struktur Organisasi INKAI
      </h1>
      <p className="mb-10 max-w-2xl text-muted-foreground">
        Hierarki organisasi INKAI dari tingkat nasional hingga dojo/ranting.
      </p>

      <div className="mb-8 flex flex-wrap items-center justify-center gap-2 text-sm">
        {["Pusat (Nasional)", "Provinsi", "Cabang", "Dojo/Ranting", "Anggota"].map(
          (level, i) => (
            <div key={level} className="flex items-center gap-2">
              <span className="rounded-full bg-inkai-red/10 px-3 py-1 font-medium text-inkai-red">
                {level}
              </span>
              {i < 4 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
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

      {provinces.map((province) => (
        <div key={province.id} className="mb-8 space-y-4">
          <div className="ml-4 sm:ml-8">
            <Card className="border-inkai-yellow/30">
              <CardContent className="flex items-center gap-3 p-4">
                <MapPin className="h-5 w-5 text-inkai-yellow" />
                <div>
                  <p className="font-semibold">Provinsi {province.name}</p>
                  {province.headName && (
                    <p className="text-sm text-muted-foreground">
                      Ketua: {province.headName}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {province.branches.map((branch) => (
            <div key={branch.id} className="ml-8 space-y-3 sm:ml-16">
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <Home className="h-5 w-5 text-inkai-red" />
                  <div>
                    <p className="font-semibold">{branch.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {branch.city || "-"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="ml-4 space-y-3 sm:ml-8">
                {branch.dojos.map((dojo) => (
                  <Card key={dojo.id} className="bg-muted/30">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{dojo.name}</p>
                          {dojo.address && (
                            <p className="text-xs text-muted-foreground">
                              {dojo.address}
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
          ))}
        </div>
      ))}
    </div>
  );
}

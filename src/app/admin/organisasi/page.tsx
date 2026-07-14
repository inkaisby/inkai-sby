import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  buildProvinceFilter,
  buildBranchFilter,
  buildDojoFilter,
  canAccessAdmin,
  getPrimaryAdminRole,
} from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Home, MapPin, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOrganisasiPage() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const role = getPrimaryAdminRole(session.user.roles);

  const [provinces, branches, dojos] = await Promise.all([
    ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN"].includes(role)
      ? prisma.province.findMany({
          where: buildProvinceFilter(session.user),
          include: { _count: { select: { branches: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(
      role
    )
      ? prisma.branch.findMany({
          where: buildBranchFilter(session.user),
          include: {
            province: true,
            _count: { select: { dojos: true } },
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    prisma.dojo.findMany({
      where: buildDojoFilter(session.user),
      include: {
        branch: { include: { province: true } },
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Organisasi & Ranting</h2>
        <p className="text-muted-foreground">
          Struktur organisasi dari Supabase sesuai hak akses Anda
        </p>
      </div>

      {provinces.length > 0 && (
        <section className="mb-8">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <MapPin className="h-4 w-4" />
            Provinsi
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {provinces.map((p) => (
              <Card key={p.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Ketua: {p.headName || "—"}
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    {p._count.branches} cabang
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {branches.length > 0 && (
        <section className="mb-8">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Building2 className="h-4 w-4" />
            Cabang
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <Card key={b.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{b.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {b.province.name}
                    {b.city && ` · ${b.city}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ketua: {b.headName || "—"}
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    {b._count.dojos} dojo/ranting
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Home className="h-4 w-4" />
          Dojo / Ranting
        </h3>
        {dojos.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Tidak ada dojo dalam scope Anda.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dojos.map((d) => (
              <Card key={d.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{d.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {d.branch.name} · {d.branch.province.name}
                  </p>
                  {d.address && (
                    <p className="text-xs text-muted-foreground">{d.address}</p>
                  )}
                  {d.headName && (
                    <p className="text-xs text-muted-foreground">
                      PIC: {d.headName}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      <Users className="mr-1 inline h-3 w-3" />
                      {d._count.members} anggota
                    </Badge>
                    <a
                      href={`/dojo/${d.id}`}
                      className="text-xs text-inkai-red hover:underline"
                    >
                      Lihat publik →
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

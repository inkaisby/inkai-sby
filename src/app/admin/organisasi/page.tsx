import { Suspense } from "react";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { canAccessAdmin, getPrimaryAdminRole } from "@/lib/rbac";
import { fetchOrgStructure } from "@/lib/inkai-api/admin-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Home, MapPin, Users } from "lucide-react";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";

export const dynamic = "force-dynamic";

export default function AdminOrganisasiPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={4} />}>
      <AdminOrganisasiContent />
    </Suspense>
  );
}

async function AdminOrganisasiContent() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const role = getPrimaryAdminRole(session.user.roles);
  const { provinces, branches, dojos } = await fetchOrgStructure(token);

  const showProvinces = ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN"].includes(role);
  const showBranches = ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(role);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Organisasi & Ranting</h2>
        <p className="text-muted-foreground">
          Struktur organisasi dari API backend sesuai hak akses Anda
        </p>
      </div>

      {showProvinces && provinces.length > 0 && (
        <section className="mb-8">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <MapPin className="h-4 w-4" />
            Provinsi
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {provinces.map((p) => (
              <Card key={String(p.id)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{String(p.name)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Ketua: {String(p.headName || "—")}
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    {(p._count as { branches?: number })?.branches ?? 0} cabang
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {showBranches && branches.length > 0 && (
        <section className="mb-8">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Building2 className="h-4 w-4" />
            Cabang
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => {
              const province = b.province as { name?: string } | undefined;
              return (
              <Card key={String(b.id)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{String(b.name)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {province?.name}
                    {b.city != null && b.city !== "" && ` · ${String(b.city)}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ketua: {String(b.headName || "—")}
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    {(b._count as { dojos?: number })?.dojos ?? 0} dojo/ranting
                  </Badge>
                </CardContent>
              </Card>
              );
            })}
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
            {dojos.map((d) => {
              const branch = d.branch as { name?: string; province?: { name?: string } } | undefined;
              return (
              <Card key={String(d.id)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{String(d.name)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {branch?.name} · {branch?.province?.name}
                  </p>
                  {d.address != null && d.address !== "" && (
                    <p className="text-xs text-muted-foreground">{String(d.address)}</p>
                  )}
                  {d.headName != null && d.headName !== "" && (
                    <p className="text-xs text-muted-foreground">
                      PIC: {String(d.headName)}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      <Users className="mr-1 inline h-3 w-3" />
                      {(d._count as { members?: number })?.members ?? 0} anggota
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
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

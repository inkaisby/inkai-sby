import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { canAccessAdmin, canEditPengurus, getPrimaryAdminRole } from "@/lib/rbac";
import {
  adminFallbackPath,
  canAccessAdminPath,
} from "@/lib/admin-page-access";
import { fetchOrgStructure } from "@/lib/inkai-api/admin-data";
import { fetchPengurusStore } from "@/lib/pengurus-settings";
import { fetchPengurusHistory } from "@/lib/pengurus-history";
import { resolveSurabayaBranch } from "@/lib/pengurus-sync";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Home, MapPin, Users } from "lucide-react";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { PengurusEditor } from "./PengurusEditor";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

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
  if (!canAccessAdminPath(session.user.roles ?? [], "/admin/organisasi")) {
    redirect(adminFallbackPath(session.user.roles ?? []));
  }
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const role = getPrimaryAdminRole(session.user.roles);
  const canEdit = canEditPengurus(session.user.roles);
  const [{ provinces, branches, dojos }, store, history, branch] =
    await Promise.all([
      fetchOrgStructure(token),
      fetchPengurusStore(true),
      fetchPengurusHistory(),
      resolveSurabayaBranch(token),
    ]);

  const showProvinces = ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN"].includes(role);
  const showBranches = ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(role);

  return (
    <>
      <AdminPageHeader
        title="Organisasi & Ranting"
        description="Kelola susunan pengurus cabang (arsip periode, SK, sinkron ketua) dan struktur wilayah"
      />

      <Tabs defaultValue="pengurus" className="gap-6">
        <TabsList className="h-auto w-full max-w-md rounded-xl bg-muted p-1">
          <TabsTrigger
            value="pengurus"
            className="flex-1 rounded-lg py-2.5 text-sm font-medium data-active:shadow-sm"
          >
            Susunan Pengurus
          </TabsTrigger>
          <TabsTrigger
            value="wilayah"
            className="flex-1 rounded-lg py-2.5 text-sm font-medium data-active:shadow-sm"
          >
            Wilayah & Ranting
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pengurus" className="mt-0">
          <PengurusEditor
            initialStore={store}
            canEdit={canEdit}
            initialHistory={history}
            branchHeadName={branch?.headName ?? null}
          />
        </TabsContent>

        <TabsContent value="wilayah" className="mt-0 space-y-8">
          {showProvinces && provinces.length > 0 && (
            <section>
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
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <Building2 className="h-4 w-4" />
                Cabang
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {branches.map((b) => {
                  const province = b.province as { name?: string } | undefined;
                  const name = String(b.name);
                  return (
                    <Card key={String(b.id)}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {province?.name}
                          {b.city != null && b.city !== "" && ` · ${String(b.city)}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Ketua: {String(b.headName || "—")}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            {(b._count as { dojos?: number })?.dojos ?? 0} dojo/ranting
                          </Badge>
                          <Link
                            href={`/admin/pengaturan/cabang?q=${encodeURIComponent(name)}`}
                            className="text-xs text-inkai-red hover:underline"
                          >
                            Kelola di Pengaturan →
                          </Link>
                        </div>
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
                  const branch = d.branch as {
                    id?: string;
                    name?: string;
                    province?: { name?: string };
                  } | undefined;
                  const name = String(d.name);
                  const branchId = branch?.id ? String(branch.id) : "";
                  const rantingHref = branchId
                    ? `/admin/pengaturan/ranting?q=${encodeURIComponent(name)}&branchId=${encodeURIComponent(branchId)}`
                    : `/admin/pengaturan/ranting?q=${encodeURIComponent(name)}`;
                  return (
                    <Card key={String(d.id)}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{name}</CardTitle>
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
                          <Link
                            href={rantingHref}
                            className="text-xs text-inkai-red hover:underline"
                          >
                            Kelola di Pengaturan →
                          </Link>
                          <Link
                            href={`/dojo/${d.id}`}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            Lihat publik →
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </>
  );
}

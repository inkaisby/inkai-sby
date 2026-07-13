import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  buildAnggotaFilter,
  buildCabangFilter,
  buildDojoFilter,
  canAccessAdmin,
  getAdminScopeLabel,
  ROLE_LABELS,
} from "@/lib/rbac";
import { AppSidebar, UserMenu } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, MapPin, Home } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const user = session.user;
  const anggotaFilter = buildAnggotaFilter(user);
  const dojoFilter = buildDojoFilter(user);
  const cabangFilter = buildCabangFilter(user);

  const [totalAnggota, totalDojo, totalCabang, recentAnggota] =
    await Promise.all([
      prisma.anggota.count({ where: anggotaFilter }),
      prisma.dojo.count({ where: dojoFilter }),
      user.role === "PUSAT" || user.role === "PROVINSI"
        ? prisma.cabang.count({ where: cabangFilter })
        : Promise.resolve(0),
      prisma.anggota.findMany({
        where: anggotaFilter,
        include: { dojo: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const stats = [
    {
      label: "Total Anggota",
      value: totalAnggota,
      icon: Users,
      show: true,
    },
    {
      label: "Dojo/Ranting",
      value: totalDojo,
      icon: Home,
      show: user.role !== "DOJO",
    },
    {
      label: "Cabang",
      value: totalCabang,
      icon: Building2,
      show: user.role === "PUSAT" || user.role === "PROVINSI",
    },
  ].filter((s) => s.show);

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        title="Admin Panel"
        links={[
          { href: "/admin", label: "Beranda Admin", active: true },
          { href: "/admin/anggota", label: "Kelola Anggota" },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 sm:px-6">
          <h1 className="text-lg font-bold lg:hidden">Beranda Admin</h1>
          <UserMenu
            name={session.user.name}
            email={session.user.email}
            showAdmin
          />
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <div className="mb-6">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold">Beranda Admin</h2>
              <Badge className="bg-inkai-red text-white hover:bg-inkai-red">
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>
            <p className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Scope: {getAdminScopeLabel(user)}
            </p>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-inkai-red" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Anggota Terbaru</CardTitle>
            </CardHeader>
            <CardContent>
              {recentAnggota.length === 0 ? (
                <p className="text-muted-foreground">Belum ada anggota.</p>
              ) : (
                <div className="space-y-3">
                  {recentAnggota.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{a.nama}</p>
                        <p className="text-sm text-muted-foreground">
                          {a.nomorInduk} · {a.dojo.nama}
                        </p>
                      </div>
                      <Badge variant="secondary">{a.sabuk}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Hierarki RBAC</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {[
                  {
                    role: "Administrator Pusat",
                    scope: "Akses penuh seluruh nasional",
                  },
                  {
                    role: "Admin Provinsi",
                    scope: "Kelola cabang & ranting di provinsinya",
                  },
                  {
                    role: "Admin Cabang",
                    scope: "Kelola dojo/ranting di cabangnya",
                  },
                  {
                    role: "Admin Dojo/Ranting",
                    scope: "Kelola anggota di rantingnya",
                  },
                ].map((item) => (
                  <div
                    key={item.role}
                    className={`rounded-lg border p-3 ${
                      ROLE_LABELS[user.role] === item.role
                        ? "border-inkai-red bg-inkai-red/5"
                        : ""
                    }`}
                  >
                    <p className="font-medium">{item.role}</p>
                    <p className="text-muted-foreground">{item.scope}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

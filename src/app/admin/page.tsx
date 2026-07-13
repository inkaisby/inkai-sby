import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  buildMemberFilter,
  buildDojoFilter,
  buildBranchFilter,
  canAccessAdmin,
  getAdminScopeLabel,
  getPrimaryAdminRole,
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
  const memberFilter = buildMemberFilter(user);
  const dojoFilter = buildDojoFilter(user);
  const branchFilter = buildBranchFilter(user);
  const primaryRole = getPrimaryAdminRole(user.roles);

  const [totalMembers, totalDojos, totalBranches, recentMembers] =
    await Promise.all([
      prisma.member.count({ where: memberFilter }),
      prisma.dojo.count({ where: dojoFilter }),
      ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN"].includes(
        primaryRole
      )
        ? prisma.branch.count({ where: branchFilter })
        : Promise.resolve(0),
      prisma.member.findMany({
        where: memberFilter,
        include: { dojo: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const stats = [
    { label: "Total Anggota", value: totalMembers, icon: Users, show: true },
    {
      label: "Dojo/Ranting",
      value: totalDojos,
      icon: Home,
      show: primaryRole !== "ADMIN_DOJO",
    },
    {
      label: "Cabang",
      value: totalBranches,
      icon: Building2,
      show: ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN"].includes(
        primaryRole
      ),
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
                {ROLE_LABELS[primaryRole] || primaryRole}
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
              {recentMembers.length === 0 ? (
                <p className="text-muted-foreground">Belum ada anggota.</p>
              ) : (
                <div className="space-y-3">
                  {recentMembers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{m.fullName}</p>
                        <p className="text-sm text-muted-foreground">
                          {m.nia || "NIA belum ada"} · {m.dojo.name}
                        </p>
                      </div>
                      <Badge variant="secondary">{m.currentRank}</Badge>
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
                  { role: "ADMIN_PUSAT", scope: "Akses penuh seluruh nasional" },
                  {
                    role: "ADMIN_PROVINCE",
                    scope: "Kelola cabang & ranting di provinsinya",
                  },
                  { role: "ADMIN_BRANCH", scope: "Kelola dojo/ranting di cabangnya" },
                  { role: "ADMIN_DOJO", scope: "Kelola anggota di rantingnya" },
                ].map((item) => (
                  <div
                    key={item.role}
                    className={`rounded-lg border p-3 ${
                      primaryRole === item.role
                        ? "border-inkai-red bg-inkai-red/5"
                        : ""
                    }`}
                  >
                    <p className="font-medium">
                      {ROLE_LABELS[item.role] || item.role}
                    </p>
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

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppSidebar, UserMenu } from "@/components/layout/AppShell";
import {
  MEMBER_LINKS,
  MobileDashboardNav,
} from "@/components/layout/MobileDashboardNav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, MapPin, Calendar, Bell } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MemberDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const member = session.user.memberId
    ? await prisma.member.findFirst({
        where: { id: session.user.memberId, isDeleted: false },
        include: {
          dojo: { include: { branch: { include: { province: true } } } },
        },
      })
    : null;

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const links = MEMBER_LINKS.map((l) => ({
    ...l,
    active: l.href === "/dashboard",
  }));

  return (
    <div className="flex min-h-screen">
      <AppSidebar title="Dashboard Anggota" links={links} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <MobileDashboardNav title="Dashboard Anggota" links={links} />
            <h1 className="text-lg font-bold hidden sm:block">Dashboard</h1>
          </div>
          <UserMenu name={session.user.name} email={session.user.email} />
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Selamat datang, {session.user.name}</h2>
            <p className="text-muted-foreground">Dashboard anggota INKAI Surabaya</p>
          </div>

          {member?.status === "PENDING" && (
            <Card className="mb-6 border-inkai-yellow/40 bg-inkai-yellow/10">
              <CardContent className="p-4">
                Pendaftaran Anda sedang menunggu persetujuan admin. Anda akan
                menerima notifikasi setelah disetujui.
              </CardContent>
            </Card>
          )}

          {notifications.length > 0 && (
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="h-4 w-4" />
                  Notifikasi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {notifications.map((n) => (
                  <div key={n.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{n.title}</p>
                    <p className="text-muted-foreground">{n.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {member ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    NIA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-inkai-red">
                    {member.nia || "Belum ada"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Award className="h-4 w-4" />
                    Sabuk / Kyu
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className="bg-inkai-yellow text-inkai-black hover:bg-inkai-yellow">
                    {member.currentRank}
                  </Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    Dojo/Ranting
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Link
                    href={`/dojo/${member.dojoId}`}
                    className="font-semibold hover:text-inkai-red"
                  >
                    {member.dojo.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {member.dojo.branch.name}
                  </p>
                </CardContent>
              </Card>
              <Card className="sm:col-span-2 lg:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-inkai-red" />
                    Informasi Keanggotaan
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium">{member.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bergabung Sejak</p>
                    <p className="font-medium">
                      {new Date(member.createdAt).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap gap-2">
                    <Link href="/dashboard/profil" className="text-sm text-inkai-red hover:underline">
                      Edit profil →
                    </Link>
                    <Link href="/dashboard/absensi" className="text-sm text-inkai-red hover:underline">
                      Lihat absensi →
                    </Link>
                    <Link href="/dashboard/iuran" className="text-sm text-inkai-red hover:underline">
                      Lihat iuran →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Data anggota belum tersedia. Hubungi admin cabang/dojo Anda.
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

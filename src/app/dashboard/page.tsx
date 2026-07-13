import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppSidebar, UserMenu } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, MapPin, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MemberDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const member = session.user.memberId
    ? await prisma.member.findFirst({
        where: { id: session.user.memberId, isDeleted: false },
        include: {
          dojo: {
            include: {
              branch: { include: { province: true } },
            },
          },
        },
      })
    : null;

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        title="Dashboard Anggota"
        links={[{ href: "/dashboard", label: "Beranda", active: true }]}
      />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 sm:px-6">
          <h1 className="text-lg font-bold lg:hidden">Dashboard Anggota</h1>
          <UserMenu
            name={session.user.name}
            email={session.user.email}
            showAdmin={false}
          />
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              Selamat datang, {session.user.name}
            </h2>
            <p className="text-muted-foreground">
              Dashboard anggota INKAI Surabaya
            </p>
          </div>

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
                  <p className="font-semibold">{member.dojo.name}</p>
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
                    <p className="text-sm text-muted-foreground">Provinsi</p>
                    <p className="font-medium">{member.dojo.branch.province.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cabang</p>
                    <p className="font-medium">{member.dojo.branch.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium">{member.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Alamat Dojo</p>
                    <p className="font-medium">{member.dojo.address || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bergabung Sejak</p>
                    <p className="font-medium">
                      {new Date(member.createdAt).toLocaleDateString("id-ID")}
                    </p>
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

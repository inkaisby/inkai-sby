import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppSidebar, UserMenu } from "@/components/layout/AppShell";
import {
  MEMBER_LINKS,
  MobileDashboardNav,
} from "@/components/layout/MobileDashboardNav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AbsensiPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");

  const attendances = await prisma.attendance.findMany({
    where: { memberId: session.user.memberId, isDeleted: false },
    include: { dojo: true, event: true },
    orderBy: { checkInAt: "desc" },
    take: 50,
  });

  const links = MEMBER_LINKS.map((l) => ({
    ...l,
    active: l.href === "/dashboard/absensi",
  }));

  return (
    <div className="flex min-h-screen">
      <AppSidebar title="Dashboard Anggota" links={links} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 sm:px-6">
          <MobileDashboardNav title="Dashboard Anggota" links={links} />
          <UserMenu name={session.user.name} email={session.user.email} />
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <h2 className="mb-6 text-2xl font-bold">Riwayat Absensi</h2>
          {attendances.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Belum ada riwayat absensi.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {attendances.map((a) => (
                <Card key={a.id}>
                  <CardContent className="flex justify-between p-4">
                    <div>
                      <p className="font-medium">{a.dojo.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {a.event?.title || a.method}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {new Date(a.checkInAt).toLocaleString("id-ID")}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

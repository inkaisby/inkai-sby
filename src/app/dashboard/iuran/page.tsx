import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppSidebar, UserMenu } from "@/components/layout/AppShell";
import {
  MEMBER_LINKS,
  MobileDashboardNav,
} from "@/components/layout/MobileDashboardNav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function IuranPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");

  const billings = await prisma.billing.findMany({
    where: { memberId: session.user.memberId, isDeleted: false },
    include: { payment: true },
    orderBy: { dueDate: "desc" },
    take: 50,
  });

  const links = MEMBER_LINKS.map((l) => ({
    ...l,
    active: l.href === "/dashboard/iuran",
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
          <h2 className="mb-6 text-2xl font-bold">Iuran & Tagihan</h2>
          {billings.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Tidak ada tagihan iuran.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {billings.map((b) => (
                <Card key={b.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div>
                      <p className="font-medium">{b.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {b.description || "Iuran anggota"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Jatuh tempo:{" "}
                        {new Date(b.dueDate).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">
                        Rp {b.amount.toLocaleString("id-ID")}
                      </p>
                      <Badge
                        variant={b.status === "PAID" ? "default" : "secondary"}
                      >
                        {b.status}
                      </Badge>
                    </div>
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

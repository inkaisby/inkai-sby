import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin } from "@/lib/rbac";
import { AppSidebar, UserMenu } from "@/components/layout/AppShell";
import {
  ADMIN_LINKS,
  MobileDashboardNav,
} from "@/components/layout/MobileDashboardNav";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const links = ADMIN_LINKS.map((l) => ({
    ...l,
    active: l.href === "/admin/audit",
  }));

  return (
    <div className="flex min-h-screen">
      <AppSidebar title="Admin Panel" links={links} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <MobileDashboardNav title="Admin Panel" links={links} />
            <h1 className="text-lg font-bold hidden sm:block">Log Audit</h1>
          </div>
          <UserMenu name={session.user.name} email={session.user.email} showAdmin />
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <h2 className="mb-6 text-2xl font-bold">Log Audit Keamanan</h2>
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{log.action}</span>
                  <span className="text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("id-ID")}
                  </span>
                </div>
                <p className="text-muted-foreground">{log.email || log.userId || "-"}</p>
                {log.details && <p>{log.details}</p>}
                {log.ip && <p className="text-xs text-muted-foreground">IP: {log.ip}</p>}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

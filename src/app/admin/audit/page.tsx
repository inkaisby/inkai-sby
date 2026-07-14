import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
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
            <p className="text-muted-foreground">
              {log.email || log.userId || "-"}
            </p>
            {log.details && <p>{log.details}</p>}
            {log.ip && (
              <p className="text-xs text-muted-foreground">IP: {log.ip}</p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

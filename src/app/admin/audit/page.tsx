import { Suspense } from "react";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { fetchAuditLogs } from "@/lib/inkai-api/admin-data";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";

export const dynamic = "force-dynamic";

export default function AdminAuditPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={6} />}>
      <AdminAuditContent />
    </Suspense>
  );
}

async function AdminAuditContent() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const logs = await fetchAuditLogs(token, 100);

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">Log Audit Keamanan</h2>
      {logs.length === 0 ? (
        <p className="text-muted-foreground">
          Tidak ada log audit atau akses ditolak (hanya ADMINISTRATOR / ADMIN_PUSAT).
        </p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={String(log.id)} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{String(log.action)}</span>
                <span className="text-muted-foreground">
                  {new Date(String(log.createdAt)).toLocaleString("id-ID")}
                </span>
              </div>
              <p className="text-muted-foreground">
                {String(log.email || log.userId || "-")}
              </p>
              {log.details != null && log.details !== "" && (
                <p>{String(log.details)}</p>
              )}
              {log.ip != null && log.ip !== "" && (
                <p className="text-xs text-muted-foreground">IP: {String(log.ip)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

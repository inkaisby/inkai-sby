import { Suspense } from "react";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import {
  adminFallbackPath,
  canAccessAdminPath,
} from "@/lib/admin-page-access";
import { fetchAuditLogs } from "@/lib/inkai-api/admin-data";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AuditLogsClient } from "./AuditLogsClient";

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
  if (!canAccessAdminPath(session.user.roles ?? [], "/admin/audit")) {
    redirect(adminFallbackPath(session.user.roles ?? []));
  }
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const raw = await fetchAuditLogs(token, 100);
  const logs = raw.map((log) => ({
    id: String(log.id ?? `${log.createdAt}-${log.action}`),
    action: String(log.action ?? ""),
    email: String(log.email || log.userId || ""),
    details:
      log.details == null || log.details === ""
        ? ""
        : typeof log.details === "string"
          ? log.details
          : JSON.stringify(log.details),
    ip: log.ip != null && log.ip !== "" ? String(log.ip) : "",
    createdAt: String(log.createdAt ?? ""),
  }));

  return (
    <>
      <h2 className="mb-2 text-2xl font-bold">Log Audit Keamanan</h2>
      <p className="mb-6 text-muted-foreground">
        Filter dan export jejak aksi sensitif (pusat).
      </p>
      <AuditLogsClient logs={logs} />
    </>
  );
}

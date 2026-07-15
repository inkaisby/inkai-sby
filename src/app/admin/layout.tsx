import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_LINKS } from "@/lib/dashboard-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");
  if (!canAccessAdmin(session.user)) redirect("/dashboard");

  return (
    <DashboardShell
      title="Admin Panel"
      links={ADMIN_LINKS}
      userName={session.user.name || session.user.email || "Admin"}
      userEmail={session.user.email || ""}
      showAdmin
    >
      {children}
    </DashboardShell>
  );
}

import { requireAdminSession } from "@/lib/admin-session";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_LINKS } from "@/lib/dashboard-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = await requireAdminSession();

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

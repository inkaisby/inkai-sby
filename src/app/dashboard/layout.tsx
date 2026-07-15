import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { MEMBER_LINKS } from "@/lib/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");
  if (canAccessAdmin(session.user)) redirect("/admin");

  return (
    <DashboardShell
      title="Dashboard Anggota"
      links={MEMBER_LINKS}
      userName={session.user.name || session.user.email || "Anggota"}
      userEmail={session.user.email || ""}
    >
      {children}
    </DashboardShell>
  );
}

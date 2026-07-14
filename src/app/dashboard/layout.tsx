import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { MEMBER_LINKS } from "@/components/layout/MobileDashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (canAccessAdmin(session.user)) redirect("/admin");

  return (
    <DashboardShell
      title="Dashboard Anggota"
      links={MEMBER_LINKS}
      userName={session.user.name}
      userEmail={session.user.email}
    >
      {children}
    </DashboardShell>
  );
}

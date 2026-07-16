import { requireAdminSession } from "@/lib/admin-session";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_LINKS } from "@/lib/dashboard-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
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
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest || "").startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    console.error("[AdminLayout]", error);
    throw error;
  }
}

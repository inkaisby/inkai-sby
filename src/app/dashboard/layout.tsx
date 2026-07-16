import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { MemberMobileShell } from "@/components/member/MemberMobileShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const session = await auth();
    if (!session) redirect("/login");
    const token = await getInkaiAccessToken();
    if (!token) redirect("/login");
    if (canAccessAdmin(session.user)) redirect("/admin");

    return <MemberMobileShell>{children}</MemberMobileShell>;
  } catch (error) {
    // Next.js redirect() throws; rethrow those.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest || "").startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    console.error("[DashboardLayout]", error);
    redirect("/login");
  }
}

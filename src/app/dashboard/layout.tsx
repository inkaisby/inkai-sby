import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessAdmin, hasMemberPortal } from "@/lib/rbac";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { MemberMobileShell } from "@/components/member/MemberMobileShell";
import { authBounceReason, logAuthBounce } from "@/lib/auth/auth-bounce";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const [session, token] = await Promise.all([
      auth(),
      getInkaiAccessToken(),
    ]);
    const bounce = authBounceReason({
      hasSession: Boolean(session),
      hasInkaiToken: Boolean(token),
    });
    if (bounce) {
      logAuthBounce("dashboard.layout", bounce);
      redirect("/login");
    }
    if (canAccessAdmin(session!.user) && !hasMemberPortal(session!.user)) {
      redirect("/admin");
    }

    return (
      <MemberMobileShell
        impersonating={Boolean(session!.impersonatorId)}
        userName={session!.user.name || session!.user.email || ""}
        userEmail={session!.user.email || ""}
      >
        {children}
      </MemberMobileShell>
    );
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
    // Data/runtime errors → error.tsx (not a fake logout to /login).
    console.error("[DashboardLayout]", error);
    throw error;
  }
}

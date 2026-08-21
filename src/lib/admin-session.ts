import { cache } from "react";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { enrichSessionUser } from "@/lib/managed-dojos";
import { loadAdminDojoGrantsForUser } from "@/lib/admin-dojo-grants";
import { logAuthBounce } from "@/lib/auth/auth-bounce";

/** Dedupe auth + token lookup within the same server request. */
export const requireAdminSession = cache(async () => {
  const session = await auth();
  if (!session) {
    logAuthBounce("admin.session", "missing_session");
    redirect("/login");
  }
  if (!canAccessAdmin(session.user)) redirect("/dashboard");
  const [token, user] = await Promise.all([
    getInkaiAccessToken(),
    enrichSessionUser(session.user),
  ]);
  if (!token) {
    logAuthBounce("admin.session", "missing_inkai_token");
    redirect("/login");
  }
  const adminDojoGrants = await loadAdminDojoGrantsForUser(user);
  return { session: { ...session, user }, token, user, adminDojoGrants };
});

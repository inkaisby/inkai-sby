import { cache } from "react";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { enrichSessionUser } from "@/lib/managed-dojos";
import { loadAdminDojoGrantsForUser } from "@/lib/admin-dojo-grants";

/** Dedupe auth + token lookup within the same server request. */
export const requireAdminSession = cache(async () => {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canAccessAdmin(session.user)) redirect("/dashboard");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");
  const user = await enrichSessionUser(session.user);
  const adminDojoGrants = await loadAdminDojoGrantsForUser(user);
  return { session: { ...session, user }, token, user, adminDojoGrants };
});

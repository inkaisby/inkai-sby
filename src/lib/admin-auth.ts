import { auth } from "@/auth";
import { canAccessAdmin, type SessionUser } from "@/lib/rbac";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { enrichSessionUser } from "@/lib/managed-dojos";
import {
  loadAdminDojoGrantsForUser,
  type AdminDojoGrants,
} from "@/lib/admin-dojo-grants";
import { NextResponse } from "next/server";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/session-expired";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || !canAccessAdmin(session.user)) {
    return {
      error: NextResponse.json(
        { error: SESSION_EXPIRED_MESSAGE },
        { status: 401 },
      ),
    };
  }
  const token = await getInkaiAccessToken();
  if (!token) {
    return {
      error: NextResponse.json(
        { error: SESSION_EXPIRED_MESSAGE },
        { status: 401 },
      ),
    };
  }
  const user = await enrichSessionUser(session.user as SessionUser);
  const adminDojoGrants = await loadAdminDojoGrantsForUser(user);
  return { user, token, adminDojoGrants: adminDojoGrants as AdminDojoGrants | null };
}

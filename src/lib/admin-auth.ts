import { auth } from "@/auth";
import { canAccessAdmin, type SessionUser } from "@/lib/rbac";
import { NextResponse } from "next/server";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || !canAccessAdmin(session.user)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user: session.user as SessionUser };
}

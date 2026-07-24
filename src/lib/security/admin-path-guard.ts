import { NextResponse } from "next/server";
import type { AdminDojoGrants } from "@/lib/admin-dojo-grants";
import { canAccessAdminPath } from "@/lib/admin-page-access";

/** Return 403 JSON when ADMIN_DOJO (or grants) cannot access this admin path. */
export function forbidUnlessAdminPath(
  roles: string[],
  path: string,
  grants?: AdminDojoGrants | null,
): NextResponse | null {
  if (canAccessAdminPath(roles, path, grants)) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

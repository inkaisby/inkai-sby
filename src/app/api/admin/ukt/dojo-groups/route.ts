import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { loadUktDojoFilterGroups } from "@/lib/managed-dojos";

/** Lazy filter gabungan multi-ranting (cabang) — di luar critical path load UKT. */
export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const primaryRole = getPrimaryAdminRole(authResult.user.roles);
  if (primaryRole === "ADMIN_DOJO") {
    return NextResponse.json({ groups: [] });
  }

  const groups = await loadUktDojoFilterGroups(authResult.user);
  return NextResponse.json({ groups });
}

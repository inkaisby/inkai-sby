import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { canManageRoles } from "@/lib/pengaturan";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageRoles(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const [rolesRes, permsRes] = await Promise.all([
    inkaiFetch("/v1/roles", {}, authResult.token),
    inkaiFetch("/v1/roles/permissions", {}, authResult.token),
  ]);

  if (!rolesRes.res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(rolesRes.data, "Gagal memuat roles") },
      { status: rolesRes.res.status },
    );
  }

  return NextResponse.json({
    data: {
      roles: (rolesRes.data.data as unknown[]) ?? [],
      permissions: permsRes.res.ok
        ? ((permsRes.data.data as unknown[]) ?? [])
        : [],
    },
  });
}

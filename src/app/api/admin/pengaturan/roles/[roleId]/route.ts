import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { canManageRoles } from "@/lib/pengaturan";
import { rolePermissionsSchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";

type RouteContext = { params: Promise<{ roleId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageRoles(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { roleId } = await context.params;
  const parsed = rolePermissionsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { res, data } = await inkaiFetch(
    `/v1/roles/${roleId}/permissions`,
    {
      method: "PUT",
      body: JSON.stringify({ permissionIds: parsed.data.permissionIds }),
    },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal menyimpan hak akses") },
      { status: res.status },
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "SETTINGS_ROLE_PERMISSIONS_UPDATE",
    details: JSON.stringify({
      roleId,
      permissionCount: parsed.data.permissionIds.length,
    }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    message: "Hak akses berhasil diperbarui",
  });
}

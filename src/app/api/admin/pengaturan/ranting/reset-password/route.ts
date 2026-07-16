import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { assertDojoInScope, canManageRanting } from "@/lib/pengaturan";
import { getClientIp } from "@/lib/security/request";
import { rantingResetPasswordSchema } from "@/lib/security/schemas";
import { validatePassword } from "@/lib/security/password";
import { prisma } from "@/lib/prisma";

/** Reset password saja — tanpa ganti username/email */
export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageRanting(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const parsed = rantingResetPasswordSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  const pwCheck = validatePassword(parsed.data.adminPassword);
  if (!pwCheck.valid) {
    return NextResponse.json({ error: pwCheck.error }, { status: 400 });
  }

  const dojo = await assertDojoInScope(authResult.user, parsed.data.dojoId);
  if (!dojo) {
    return NextResponse.json(
      { error: "Ranting tidak ditemukan dalam cakupan Anda" },
      { status: 404 },
    );
  }

  const admin = await prisma.user.findFirst({
    where: {
      managedDojoId: dojo.id,
      isDeleted: false,
      roles: { some: { name: "ADMIN_DOJO" } },
    },
    select: { id: true, email: true },
  });

  if (!admin?.email) {
    return NextResponse.json(
      {
        error:
          "Ranting belum punya akun login. Gunakan 'Buat Login' terlebih dahulu.",
      },
      { status: 400 },
    );
  }

  const { res, data } = await inkaiFetch(
    `/v1/org/dojos/${dojo.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        adminEmail: admin.email,
        adminPassword: parsed.data.adminPassword,
      }),
    },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal reset password ranting") },
      { status: res.status },
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "SETTINGS_RANTING_PASSWORD_RESET",
    details: JSON.stringify({
      dojoId: dojo.id,
      dojoName: dojo.name,
      adminEmail: admin.email,
    }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    message: `Password login "${admin.email}" berhasil direset`,
    loginEmail: admin.email,
    loginPassword: parsed.data.adminPassword,
    dojoName: dojo.name,
  });
}

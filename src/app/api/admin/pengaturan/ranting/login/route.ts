import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import {
  assertDojoInScope,
  canAdministerRantingAccounts,
  canManageRanting,
} from "@/lib/pengaturan";
import { getClientIp } from "@/lib/security/request";
import { rantingLoginSchema } from "@/lib/security/schemas";
import { validatePassword } from "@/lib/security/password";
import { prisma } from "@/lib/prisma";

/** Cabang membuat / mengganti username+password login admin ranting */
export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageRanting(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  if (!canAdministerRantingAccounts(authResult.user)) {
    return NextResponse.json(
      { error: "Gunakan menu Akun Saya untuk mengubah password Anda" },
      { status: 403 },
    );
  }

  const parsed = rantingLoginSchema.safeParse(await request.json());
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
      { error: "Ranting tidak ditemukan dalam cakupan cabang Anda" },
      { status: 404 },
    );
  }

  const conflict = await prisma.user.findFirst({
    where: {
      email: { equals: parsed.data.adminEmail, mode: "insensitive" },
      isDeleted: false,
      NOT: { managedDojoId: dojo.id },
    },
    select: { id: true },
  });
  if (conflict) {
    return NextResponse.json(
      { error: `Email ${parsed.data.adminEmail} sudah dipakai akun lain` },
      { status: 409 },
    );
  }

  const { res, data } = await inkaiFetch(
    `/v1/org/dojos/${dojo.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        adminEmail: parsed.data.adminEmail,
        adminPassword: parsed.data.adminPassword,
      }),
    },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal membuat akun login ranting") },
      { status: res.status },
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "SETTINGS_RANTING_LOGIN_UPSERT",
    details: JSON.stringify({
      dojoId: dojo.id,
      dojoName: dojo.name,
      adminEmail: parsed.data.adminEmail,
    }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    message: `Akun login ranting "${dojo.name}" siap. Username: ${parsed.data.adminEmail}`,
    loginEmail: parsed.data.adminEmail,
    loginPassword: parsed.data.adminPassword,
    dojoName: dojo.name,
  });
}

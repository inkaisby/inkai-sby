import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/rbac";
import { getClientIp } from "@/lib/security/request";
import {
  akunPasswordSchema,
  akunProfileSchema,
} from "@/lib/security/schemas";
import { validatePassword } from "@/lib/security/password";
import { findEmailConflict } from "@/lib/pengaturan";
import { forbidIfImpersonating } from "@/lib/security/impersonation-guard";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const dbUser = await prisma.user.findUnique({
    where: { id: authResult.user.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      phoneNumber: true,
      isActive: true,
      roles: { select: { name: true } },
      managedProvince: { select: { name: true } },
      managedBranch: { select: { name: true } },
      managedDojo: { select: { name: true } },
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      ...dbUser,
      roleLabels: dbUser.roles.map((r) => ROLE_LABELS[r.name] || r.name),
      scopeLabel:
        dbUser.managedDojo?.name ||
        dbUser.managedBranch?.name ||
        dbUser.managedProvince?.name ||
        "—",
    },
  });
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const body = await request.json();
  const action = typeof body.action === "string" ? body.action : "profile";

  if (action === "password") {
    const blocked = await forbidIfImpersonating();
    if (blocked) return blocked;

    const parsed = akunPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak valid" },
        { status: 400 },
      );
    }
    const pwCheck = validatePassword(parsed.data.newPassword);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.error }, { status: 400 });
    }

    const { res, data } = await inkaiFetch(
      "/v1/auth/change-password",
      {
        method: "PUT",
        body: JSON.stringify({
          oldPassword: parsed.data.oldPassword,
          newPassword: parsed.data.newPassword,
        }),
      },
      authResult.token,
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: inkaiErrorMessage(data, "Gagal mengubah password") },
        { status: res.status },
      );
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "SETTINGS_AKUN_PASSWORD_CHANGE",
      details: "Admin mengubah password sendiri",
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    return NextResponse.json({
      success: true,
      message: "Password berhasil diubah",
    });
  }

  const parsed = akunProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  const nextEmail = parsed.data.email?.trim().toLowerCase() || "";
  const emailChanged =
    Boolean(nextEmail) &&
    nextEmail !== authResult.user.email.trim().toLowerCase();

  if (emailChanged) {
    const blocked = await forbidIfImpersonating();
    if (blocked) return blocked;

    const conflict = await findEmailConflict(nextEmail, authResult.user.id);
    if (conflict) {
      return NextResponse.json(
        { error: `Email ${nextEmail} sudah dipakai akun lain` },
        { status: 409 },
      );
    }

    await prisma.user.update({
      where: { id: authResult.user.id },
      data: { email: nextEmail },
    });

    // Sinkron username PIC ranting bila akun ini admin dojo
    if (authResult.user.managedDojoId && authResult.token) {
      try {
        await inkaiFetch(
          `/v1/org/dojos/${authResult.user.managedDojoId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ adminEmail: nextEmail }),
          },
          authResult.token,
        );
      } catch {
        // email lokal sudah diubah
      }
    }
  }

  const { res } = await inkaiFetch(
    "/v1/auth/profile",
    {
      method: "PUT",
      body: JSON.stringify({
        fullName: parsed.data.fullName,
        phoneNumber: parsed.data.phoneNumber || undefined,
      }),
    },
    authResult.token,
  );

  if (!res.ok) {
    // Fallback lokal jika API gagal
    await prisma.user.update({
      where: { id: authResult.user.id },
      data: {
        fullName: parsed.data.fullName,
        phoneNumber: parsed.data.phoneNumber || null,
      },
    });
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: emailChanged ? nextEmail : authResult.user.email,
    action: "SETTINGS_AKUN_PROFILE_UPDATE",
    details: JSON.stringify({
      fullName: parsed.data.fullName,
      phoneNumber: parsed.data.phoneNumber || null,
      emailChanged,
      viaApi: res.ok,
    }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    message: emailChanged
      ? "Profil dan email login berhasil diperbarui"
      : "Profil berhasil diperbarui",
  });
}

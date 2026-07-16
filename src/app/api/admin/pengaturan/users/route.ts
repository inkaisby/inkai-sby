import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { buildAdminUserWhere, canManageUsers } from "@/lib/pengaturan";
import { adminUserPatchSchema } from "@/lib/security/schemas";
import { ROLE_LABELS } from "@/lib/rbac";
import { getClientIp } from "@/lib/security/request";

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageUsers(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";

  const users = await prisma.user.findMany({
    where: {
      AND: [
        buildAdminUserWhere(authResult.user),
        q
          ? {
              OR: [
                { email: { contains: q, mode: "insensitive" } },
                { fullName: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      phoneNumber: true,
      isActive: true,
      createdAt: true,
      managedProvinceId: true,
      managedBranchId: true,
      managedDojoId: true,
      roles: { select: { name: true } },
      managedProvince: { select: { name: true } },
      managedBranch: { select: { name: true } },
      managedDojo: { select: { name: true } },
    },
    orderBy: { email: "asc" },
    take: 200,
  });

  return NextResponse.json({
    data: users.map((u) => ({
      ...u,
      roleLabels: u.roles.map((r) => ROLE_LABELS[r.name] || r.name),
      scopeLabel:
        u.managedDojo?.name ||
        u.managedBranch?.name ||
        u.managedProvince?.name ||
        "—",
    })),
  });
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageUsers(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const parsed = adminUserPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const allowed = await prisma.user.findFirst({
    where: {
      AND: [{ id: parsed.data.userId }, buildAdminUserWhere(authResult.user)],
    },
    select: { id: true, email: true },
  });
  if (!allowed) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  if (parsed.data.userId === authResult.user.id && parsed.data.isActive === false) {
    return NextResponse.json(
      { error: "Tidak dapat menonaktifkan akun sendiri" },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: {
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      ...(parsed.data.fullName !== undefined ? { fullName: parsed.data.fullName } : {}),
    },
    select: { id: true, isActive: true, fullName: true, email: true },
  });

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action:
      parsed.data.isActive === false
        ? "SETTINGS_USER_DEACTIVATE"
        : parsed.data.isActive === true
          ? "SETTINGS_USER_ACTIVATE"
          : "SETTINGS_USER_UPDATE",
    details: JSON.stringify({
      targetUserId: updated.id,
      targetEmail: updated.email,
      isActive: updated.isActive,
    }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    data: updated,
    message: "User berhasil diperbarui",
  });
}

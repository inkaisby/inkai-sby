import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  assertBranchInScope,
  assertDojoInScope,
  buildAdminUserWhere,
  canManageUsers,
} from "@/lib/pengaturan";
import {
  adminUserCreateSchema,
  adminUserPatchSchema,
} from "@/lib/security/schemas";
import { getPrimaryAdminRole, ROLE_LABELS } from "@/lib/rbac";
import { getClientIp } from "@/lib/security/request";
import { validatePassword } from "@/lib/security/password";
import { isCabangAdmin, isNationalAdmin } from "@/lib/wilayah-rbac";

const ASSIGNABLE_ROLES = new Set([
  "ADMINISTRATOR",
  "ADMIN_PUSAT",
  "ADMIN_PROVINCE",
  "ADMIN_BRANCH",
  "ADMIN_DOJO",
  "ADMIN",
]);

function canAssignRole(actorRoles: string[], targetRole: string) {
  if (!ASSIGNABLE_ROLES.has(targetRole)) return false;
  if (isNationalAdmin(actorRoles)) return true;
  if (targetRole === "ADMINISTRATOR" || targetRole === "ADMIN_PUSAT") {
    return false;
  }
  if (isCabangAdmin(actorRoles)) {
    return targetRole === "ADMIN_BRANCH" || targetRole === "ADMIN_DOJO";
  }
  const primary = getPrimaryAdminRole(actorRoles);
  if (primary === "ADMIN_PROVINCE") {
    return (
      targetRole === "ADMIN_PROVINCE" ||
      targetRole === "ADMIN_BRANCH" ||
      targetRole === "ADMIN_DOJO"
    );
  }
  return false;
}

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
      primaryRole: u.roles[0]?.name ?? null,
      scopeLabel:
        u.managedDojo?.name ||
        u.managedBranch?.name ||
        u.managedProvince?.name ||
        "—",
    })),
  });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageUsers(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const parsed = adminUserCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  if (!canAssignRole(authResult.user.roles, parsed.data.role)) {
    return NextResponse.json(
      { error: "Anda tidak berwenang menetapkan role tersebut" },
      { status: 403 },
    );
  }

  const pwCheck = validatePassword(parsed.data.password);
  if (!pwCheck.valid) {
    return NextResponse.json({ error: pwCheck.error }, { status: 400 });
  }

  if (parsed.data.role === "ADMIN_BRANCH" && parsed.data.managedBranchId) {
    const ok = await assertBranchInScope(
      authResult.user,
      parsed.data.managedBranchId,
    );
    if (!ok) {
      return NextResponse.json({ error: "Cabang di luar cakupan" }, { status: 403 });
    }
  }
  if (parsed.data.role === "ADMIN_DOJO" && parsed.data.managedDojoId) {
    const ok = await assertDojoInScope(
      authResult.user,
      parsed.data.managedDojoId,
    );
    if (!ok) {
      return NextResponse.json({ error: "Ranting di luar cakupan" }, { status: 403 });
    }
  }

  const existing = await prisma.user.findFirst({
    where: {
      email: { equals: parsed.data.email, mode: "insensitive" },
      isDeleted: false,
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Email sudah terpakai" }, { status: 409 });
  }

  const role = await prisma.role.findUnique({
    where: { name: parsed.data.role },
    select: { id: true },
  });
  if (!role) {
    return NextResponse.json({ error: "Role tidak ditemukan" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const created = await prisma.user.create({
    data: {
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      phoneNumber: parsed.data.phoneNumber || null,
      passwordHash,
      isActive: true,
      managedProvinceId:
        parsed.data.role === "ADMIN_PROVINCE"
          ? parsed.data.managedProvinceId || null
          : null,
      managedBranchId:
        parsed.data.role === "ADMIN_BRANCH"
          ? parsed.data.managedBranchId || null
          : null,
      managedDojoId:
        parsed.data.role === "ADMIN_DOJO"
          ? parsed.data.managedDojoId || null
          : null,
      roles: { connect: [{ id: role.id }] },
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      roles: { select: { name: true } },
    },
  });

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "SETTINGS_USER_CREATE",
    details: JSON.stringify({
      targetUserId: created.id,
      email: created.email,
      role: parsed.data.role,
    }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    data: created,
    message: "User admin berhasil dibuat",
    loginEmail: parsed.data.email,
    loginPassword: parsed.data.password,
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  const allowed = await prisma.user.findFirst({
    where: {
      AND: [{ id: parsed.data.userId }, buildAdminUserWhere(authResult.user)],
    },
    select: {
      id: true,
      email: true,
      roles: { select: { name: true } },
    },
  });
  if (!allowed) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  if (
    parsed.data.userId === authResult.user.id &&
    parsed.data.isActive === false
  ) {
    return NextResponse.json(
      { error: "Tidak dapat menonaktifkan akun sendiri" },
      { status: 400 },
    );
  }

  if (parsed.data.action === "reset_password") {
    if (!parsed.data.newPassword || !parsed.data.newPasswordConfirm) {
      return NextResponse.json({ error: "Password baru wajib" }, { status: 400 });
    }
    if (parsed.data.newPassword !== parsed.data.newPasswordConfirm) {
      return NextResponse.json(
        { error: "Konfirmasi password tidak cocok" },
        { status: 400 },
      );
    }
    const pwCheck = validatePassword(parsed.data.newPassword);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.error }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: { passwordHash },
    });
    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "SETTINGS_USER_RESET_PASSWORD",
      details: JSON.stringify({
        targetUserId: allowed.id,
        targetEmail: allowed.email,
      }),
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });
    return NextResponse.json({
      success: true,
      message: "Password berhasil direset",
      loginEmail: allowed.email,
      loginPassword: parsed.data.newPassword,
    });
  }

  if (parsed.data.role && !canAssignRole(authResult.user.roles, parsed.data.role)) {
    return NextResponse.json(
      { error: "Anda tidak berwenang menetapkan role tersebut" },
      { status: 403 },
    );
  }

  if (parsed.data.managedBranchId) {
    const ok = await assertBranchInScope(
      authResult.user,
      parsed.data.managedBranchId,
    );
    if (!ok) {
      return NextResponse.json({ error: "Cabang di luar cakupan" }, { status: 403 });
    }
  }
  if (parsed.data.managedDojoId) {
    const ok = await assertDojoInScope(authResult.user, parsed.data.managedDojoId);
    if (!ok) {
      return NextResponse.json({ error: "Ranting di luar cakupan" }, { status: 403 });
    }
  }

  let roleConnect: { id: string } | null = null;
  if (parsed.data.role) {
    const role = await prisma.role.findUnique({
      where: { name: parsed.data.role },
      select: { id: true },
    });
    if (!role) {
      return NextResponse.json({ error: "Role tidak ditemukan" }, { status: 400 });
    }
    roleConnect = role;
  }

  const updated = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: {
      ...(parsed.data.isActive !== undefined
        ? { isActive: parsed.data.isActive }
        : {}),
      ...(parsed.data.fullName !== undefined
        ? { fullName: parsed.data.fullName }
        : {}),
      ...(parsed.data.phoneNumber !== undefined
        ? { phoneNumber: parsed.data.phoneNumber || null }
        : {}),
      ...(parsed.data.managedProvinceId !== undefined
        ? { managedProvinceId: parsed.data.managedProvinceId }
        : {}),
      ...(parsed.data.managedBranchId !== undefined
        ? { managedBranchId: parsed.data.managedBranchId }
        : {}),
      ...(parsed.data.managedDojoId !== undefined
        ? { managedDojoId: parsed.data.managedDojoId }
        : {}),
      ...(roleConnect
        ? { roles: { set: [{ id: roleConnect.id }] } }
        : {}),
    },
    select: {
      id: true,
      isActive: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      managedProvinceId: true,
      managedBranchId: true,
      managedDojoId: true,
      roles: { select: { name: true } },
    },
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
      role: updated.roles[0]?.name,
      managedBranchId: updated.managedBranchId,
      managedDojoId: updated.managedDojoId,
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

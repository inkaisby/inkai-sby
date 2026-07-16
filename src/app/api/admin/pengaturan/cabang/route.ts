import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import {
  assertBranchInScope,
  canManageBranches,
  findEmailConflict,
} from "@/lib/pengaturan";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { getClientIp } from "@/lib/security/request";
import {
  branchCreateSchema,
  branchUpdateSchema,
  softDeleteSchema,
} from "@/lib/security/schemas";
import { validatePassword } from "@/lib/security/password";
import { fetchOrgStructure } from "@/lib/inkai-api/admin-data";
import { prisma } from "@/lib/prisma";
import { SITE_BRANCH_NAME } from "@/lib/site";
import { syncKetuaFromBranch } from "@/lib/pengurus-sync";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageBranches(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { provinces, branches } = await fetchOrgStructure(authResult.token);
  return NextResponse.json({ data: { provinces, branches } });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageBranches(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const parsed = branchCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  const role = getPrimaryAdminRole(authResult.user.roles);
  if (
    role === "ADMIN_PROVINCE" &&
    authResult.user.managedProvinceId &&
    parsed.data.provinceId !== authResult.user.managedProvinceId
  ) {
    return NextResponse.json(
      { error: "Hanya bisa menambah cabang di provinsi Anda" },
      { status: 403 },
    );
  }

  if (parsed.data.adminPassword) {
    const pwCheck = validatePassword(parsed.data.adminPassword);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.error }, { status: 400 });
    }
  }

  const conflict = await findEmailConflict(parsed.data.adminEmail);
  if (conflict) {
    return NextResponse.json(
      {
        error: `Email ${parsed.data.adminEmail} sudah dipakai akun lain${
          conflict.managedBranch?.name
            ? ` (admin cabang ${conflict.managedBranch.name})`
            : conflict.managedDojo?.name
              ? ` (admin ranting ${conflict.managedDojo.name})`
              : ""
        }`,
      },
      { status: 409 },
    );
  }

  const body = {
    name: parsed.data.name,
    provinceId: parsed.data.provinceId,
    headName: parsed.data.headName || undefined,
    adminEmail: parsed.data.adminEmail,
    ...(parsed.data.adminPassword ? { adminPassword: parsed.data.adminPassword } : {}),
  };

  const { res, data } = await inkaiFetch(
    "/v1/org/branches",
    { method: "POST", body: JSON.stringify(body) },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal menambah cabang") },
      { status: res.status },
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "SETTINGS_BRANCH_CREATE",
    details: JSON.stringify({
      name: parsed.data.name,
      provinceId: parsed.data.provinceId,
      adminEmail: parsed.data.adminEmail,
    }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    data: data.data,
    message: "Cabang berhasil ditambahkan",
    loginEmail: parsed.data.adminEmail,
  });
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageBranches(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const payload = await request.json();
  const id = typeof payload.id === "string" ? payload.id : "";
  if (!id) {
    return NextResponse.json({ error: "ID cabang wajib" }, { status: 400 });
  }

  const scoped = await assertBranchInScope(authResult.user, id);
  if (!scoped) {
    return NextResponse.json(
      { error: "Cabang tidak ditemukan dalam cakupan Anda" },
      { status: 404 },
    );
  }

  const parsed = branchUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  if (parsed.data.adminPassword) {
    const pwCheck = validatePassword(parsed.data.adminPassword);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.error }, { status: 400 });
    }
  }

  if (parsed.data.adminEmail) {
    const existing = await prisma.user.findFirst({
      where: {
        email: { equals: parsed.data.adminEmail, mode: "insensitive" },
        isDeleted: false,
        NOT: { managedBranchId: id },
      },
      select: { id: true, email: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Email ${parsed.data.adminEmail} sudah dipakai akun lain` },
        { status: 409 },
      );
    }
  }

  const body = {
    ...(parsed.data.name ? { name: parsed.data.name } : {}),
    ...(parsed.data.headName !== undefined
      ? { headName: parsed.data.headName || undefined }
      : {}),
    ...(parsed.data.adminEmail ? { adminEmail: parsed.data.adminEmail } : {}),
    ...(parsed.data.adminPassword ? { adminPassword: parsed.data.adminPassword } : {}),
  };

  const { res, data } = await inkaiFetch(
    `/v1/org/branches/${id}`,
    { method: "PATCH", body: JSON.stringify(body) },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal memperbarui cabang") },
      { status: res.status },
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "SETTINGS_BRANCH_UPDATE",
    details: JSON.stringify({ branchId: id, name: parsed.data.name }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  let pengurusSync: { ok: boolean; updated?: boolean; error?: string } | null =
    null;
  if (parsed.data.headName !== undefined) {
    const branchRow = data.data as { name?: string } | undefined;
    let name = parsed.data.name || branchRow?.name || "";
    if (!name) {
      const local = await prisma.branch.findUnique({
        where: { id },
        select: { name: true },
      });
      name = local?.name || "";
    }
    if (String(name).toUpperCase() === SITE_BRANCH_NAME.toUpperCase()) {
      pengurusSync = await syncKetuaFromBranch(parsed.data.headName || "");
    }
  }

  return NextResponse.json({
    success: true,
    data: data.data,
    message: "Cabang berhasil diperbarui",
    pengurusSync,
  });
}

export async function DELETE(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageBranches(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const parsed = softDeleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const role = getPrimaryAdminRole(authResult.user.roles);
  const provinceFilter =
    role === "ADMIN_PROVINCE" && authResult.user.managedProvinceId
      ? { provinceId: authResult.user.managedProvinceId }
      : {};

  const branch = await prisma.branch.findFirst({
    where: {
      id: parsed.data.id,
      ...provinceFilter,
      ...(role === "ADMINISTRATOR" || role === "ADMIN_PUSAT" || role === "ADMIN"
        ? {}
        : provinceFilter),
    },
    select: { id: true, name: true, isDeleted: true },
  });

  if (!branch) {
    return NextResponse.json({ error: "Cabang tidak ditemukan" }, { status: 404 });
  }

  const restore = parsed.data.restore === true;
  if (restore && !branch.isDeleted) {
    return NextResponse.json({ error: "Cabang tidak dalam arsip" }, { status: 400 });
  }
  if (!restore && branch.isDeleted) {
    return NextResponse.json({ error: "Cabang sudah diarsipkan" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.branch.update({
      where: { id: branch.id },
      data: { isDeleted: !restore },
    });
    if (!restore) {
      await tx.dojo.updateMany({
        where: { branchId: branch.id, isDeleted: false },
        data: { isDeleted: true },
      });
      await tx.user.updateMany({
        where: {
          OR: [
            { managedBranchId: branch.id },
            { managedDojo: { branchId: branch.id } },
          ],
        },
        data: { isActive: false },
      });
    }
  });

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: restore ? "SETTINGS_BRANCH_RESTORE" : "SETTINGS_BRANCH_ARCHIVE",
    details: JSON.stringify({ branchId: branch.id, name: branch.name }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    message: restore
      ? "Cabang berhasil dipulihkan"
      : "Cabang diarsipkan beserta ranting di bawahnya",
  });
}

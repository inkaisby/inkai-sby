import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import {
  assertDojoInScope,
  canAdministerRantingAccounts,
  canManageRanting,
  findEmailConflict,
} from "@/lib/pengaturan";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { getClientIp } from "@/lib/security/request";
import {
  rantingCreateSchema,
  rantingUpdateSchema,
  softDeleteSchema,
} from "@/lib/security/schemas";
import { validatePassword } from "@/lib/security/password";
import { fetchOrgStructure } from "@/lib/inkai-api/admin-data";
import { prisma } from "@/lib/prisma";

function cleanOptional(value: string | undefined) {
  return value ? value : undefined;
}

function resolveBranchIdForCreate(
  user: { roles: string[]; managedBranchId?: string | null },
  requestedBranchId: string,
) {
  const role = getPrimaryAdminRole(user.roles);
  if (role === "ADMIN_BRANCH") {
    if (!user.managedBranchId) {
      return { error: "Cabang Anda belum terhubung ke akun" as const };
    }
    return { branchId: user.managedBranchId };
  }
  return { branchId: requestedBranchId };
}

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageRanting(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { branches, dojos } = await fetchOrgStructure(authResult.token);
  return NextResponse.json({ data: { branches, dojos } });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageRanting(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  if (!canAdministerRantingAccounts(authResult.user)) {
    return NextResponse.json(
      { error: "Admin ranting tidak dapat menambah ranting baru" },
      { status: 403 },
    );
  }

  const parsed = rantingCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  const d = parsed.data;

  if (d.adminPassword) {
    const pwCheck = validatePassword(d.adminPassword);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.error }, { status: 400 });
    }
  }

  const branchResolved = resolveBranchIdForCreate(
    authResult.user,
    parsed.data.branchId,
  );
  if ("error" in branchResolved) {
    return NextResponse.json({ error: branchResolved.error }, { status: 400 });
  }

  if (d.adminEmail) {
    const conflict = await findEmailConflict(d.adminEmail);
    if (conflict) {
      return NextResponse.json(
        {
          error: `Email ${d.adminEmail} sudah dipakai akun lain${
            conflict.managedDojo?.name
              ? ` (admin ranting ${conflict.managedDojo.name})`
              : conflict.managedBranch?.name
                ? ` (admin cabang ${conflict.managedBranch.name})`
                : ""
          }`,
        },
        { status: 409 },
      );
    }
  }

  const body = {
    name: d.name,
    branchId: branchResolved.branchId,
    headName: cleanOptional(d.headName),
    contactPerson: cleanOptional(d.contactPerson),
    address: cleanOptional(d.address),
    kecamatan: cleanOptional(d.kecamatan),
    tempatLatihan: cleanOptional(d.tempatLatihan),
    phoneNumber: cleanOptional(d.phoneNumber),
    schedule: cleanOptional(d.schedule),
    bankName: cleanOptional(d.bankName),
    bankAccountNumber: cleanOptional(d.bankAccountNumber),
    bankAccountName: cleanOptional(d.bankAccountName),
    ...(d.adminEmail
      ? {
          adminEmail: d.adminEmail,
          ...(d.adminPassword ? { adminPassword: d.adminPassword } : {}),
        }
      : {}),
  };

  const { res, data } = await inkaiFetch(
    "/v1/org/dojos",
    { method: "POST", body: JSON.stringify(body) },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal menambah ranting") },
      { status: res.status },
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "SETTINGS_RANTING_CREATE",
    details: JSON.stringify({
      name: d.name,
      branchId: branchResolved.branchId,
      adminEmail: d.adminEmail,
    }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    data: data.data,
    message: d.adminEmail
      ? `Ranting berhasil ditambahkan. Admin ranting bisa login dengan ${d.adminEmail}`
      : "Ranting berhasil ditambahkan. Tambahkan akun pengurus lewat tombol Akun.",
    ...(d.adminEmail
      ? {
          loginEmail: d.adminEmail,
          loginPassword: d.adminPassword,
        }
      : {}),
  });
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageRanting(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const payload = await request.json();
  const id = typeof payload.id === "string" ? payload.id : "";
  if (!id) {
    return NextResponse.json({ error: "ID ranting wajib" }, { status: 400 });
  }

  const scoped = await assertDojoInScope(authResult.user, id);
  if (!scoped) {
    return NextResponse.json(
      { error: "Ranting tidak ditemukan dalam cakupan Anda" },
      { status: 404 },
    );
  }

  const parsed = rantingUpdateSchema.safeParse(payload);
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
        NOT: { managedDojoId: id },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Email ${parsed.data.adminEmail} sudah dipakai akun lain` },
        { status: 409 },
      );
    }
  }

  const d = parsed.data;

  // Admin ranting hanya boleh ubah data profil ranting, bukan kredensial login
  if (!canAdministerRantingAccounts(authResult.user)) {
    if (d.adminEmail || d.adminPassword) {
      return NextResponse.json(
        { error: "Gunakan menu Akun Saya untuk mengubah kredensial login" },
        { status: 403 },
      );
    }
  }

  const body = {
    ...(d.name ? { name: d.name } : {}),
    ...(d.headName !== undefined ? { headName: cleanOptional(d.headName) } : {}),
    ...(d.contactPerson !== undefined
      ? { contactPerson: cleanOptional(d.contactPerson) }
      : {}),
    ...(d.address !== undefined ? { address: cleanOptional(d.address) } : {}),
    ...(d.kecamatan !== undefined ? { kecamatan: cleanOptional(d.kecamatan) } : {}),
    ...(d.tempatLatihan !== undefined
      ? { tempatLatihan: cleanOptional(d.tempatLatihan) }
      : {}),
    ...(d.phoneNumber !== undefined
      ? { phoneNumber: cleanOptional(d.phoneNumber) }
      : {}),
    ...(d.schedule !== undefined ? { schedule: cleanOptional(d.schedule) } : {}),
    ...(d.bankName !== undefined ? { bankName: cleanOptional(d.bankName) } : {}),
    ...(d.bankAccountNumber !== undefined
      ? { bankAccountNumber: cleanOptional(d.bankAccountNumber) }
      : {}),
    ...(d.bankAccountName !== undefined
      ? { bankAccountName: cleanOptional(d.bankAccountName) }
      : {}),
    ...(canAdministerRantingAccounts(authResult.user) && d.adminEmail
      ? { adminEmail: d.adminEmail }
      : {}),
    ...(canAdministerRantingAccounts(authResult.user) && d.adminPassword
      ? { adminPassword: d.adminPassword }
      : {}),
  };

  const { res, data } = await inkaiFetch(
    `/v1/org/dojos/${id}`,
    { method: "PATCH", body: JSON.stringify(body) },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal memperbarui ranting") },
      { status: res.status },
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "SETTINGS_RANTING_UPDATE",
    details: JSON.stringify({ dojoId: id, name: d.name }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    data: data.data,
    message: "Ranting berhasil diperbarui",
  });
}

export async function DELETE(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageRanting(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  if (!canAdministerRantingAccounts(authResult.user)) {
    return NextResponse.json(
      { error: "Admin ranting tidak dapat mengarsipkan ranting" },
      { status: 403 },
    );
  }

  const parsed = softDeleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const scoped = await assertDojoInScope(authResult.user, parsed.data.id);
  const role = getPrimaryAdminRole(authResult.user.roles);

  let dojo = scoped;
  if (!dojo && parsed.data.restore) {
    dojo = await prisma.dojo.findFirst({
      where: {
        id: parsed.data.id,
        isDeleted: true,
        ...(role === "ADMIN_BRANCH" && authResult.user.managedBranchId
          ? { branchId: authResult.user.managedBranchId }
          : {}),
        ...(role === "ADMIN_PROVINCE" && authResult.user.managedProvinceId
          ? { branch: { provinceId: authResult.user.managedProvinceId } }
          : {}),
      },
      select: { id: true, name: true, branchId: true, isDeleted: true },
    });
  }

  if (!dojo) {
    return NextResponse.json({ error: "Ranting tidak ditemukan" }, { status: 404 });
  }

  const restore = parsed.data.restore === true;

  await prisma.$transaction(async (tx) => {
    await tx.dojo.update({
      where: { id: dojo!.id },
      data: { isDeleted: !restore },
    });
    if (!restore) {
      await tx.user.updateMany({
        where: { managedDojoId: dojo!.id },
        data: { isActive: false },
      });
    }
  });

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: restore ? "SETTINGS_RANTING_RESTORE" : "SETTINGS_RANTING_ARCHIVE",
    details: JSON.stringify({ dojoId: dojo.id, name: dojo.name }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    message: restore ? "Ranting berhasil dipulihkan" : "Ranting diarsipkan",
  });
}

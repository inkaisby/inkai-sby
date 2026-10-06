import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";
import {
  assertBranchInScope,
  assertDojoInScope,
  canAdministerRantingAccounts,
  canManageBranches,
  canManageRanting,
  canManageUsers,
} from "@/lib/pengaturan";
import {
  countActiveWilayahAccounts,
  getPrimaryAccountId,
  listWilayahAccounts,
  notifyWilayahAdmins,
  performHandover,
  setAccountJabatan,
  setAccountBidang,
  setPrimaryAccountId,
  WILAYAH_JABATAN,
  type WilayahScope,
} from "@/lib/wilayah-accounts";
import {
  addManagedDojo,
  findUserIdsManagingDojo,
  removeManagedDojo,
  setManagedDojoIds,
} from "@/lib/managed-dojos";
import { promoteUserToAdminDojo } from "@/lib/promote-admin-dojo";
import { promoteUserToAdminBranch } from "@/lib/promote-admin-branch";
import {
  adminDojoGrantsFromInput,
  parseAdminDojoGrants,
  setAdminDojoGrants,
} from "@/lib/admin-dojo-grants";
import {
  wilayahAccountCreateSchema,
  wilayahAccountPatchSchema,
} from "@/lib/security/schemas";
import { validatePassword } from "@/lib/security/password";
import { getClientIp } from "@/lib/security/request";

async function assertWilayahAccess(
  user: Parameters<typeof canManageBranches>[0],
  scope: WilayahScope,
  wilayahId: string,
) {
  if (scope === "branch") {
    if (!canManageBranches(user) && !canManageUsers(user)) return null;
    return assertBranchInScope(user, wilayahId);
  }
  if (!canManageRanting(user) || !canAdministerRantingAccounts(user)) {
    return null;
  }
  return assertDojoInScope(user, wilayahId);
}

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") as WilayahScope | null;
  const wilayahId = searchParams.get("wilayahId")?.trim() || "";

  if ((scope !== "branch" && scope !== "dojo") || !wilayahId) {
    return NextResponse.json({ error: "Parameter tidak valid" }, { status: 400 });
  }

  const scoped = await assertWilayahAccess(authResult.user, scope, wilayahId);
  if (!scoped) {
    return NextResponse.json(
      { error: "Akses ditolak / wilayah tidak ditemukan" },
      { status: 403 },
    );
  }

  const result = await listWilayahAccounts({ scope, wilayahId });

  let siblingDojos: Array<{ id: string; name: string }> = [];
  if (scope === "dojo" && "branchId" in scoped && scoped.branchId) {
    siblingDojos = await prisma.dojo.findMany({
      where: { branchId: scoped.branchId, isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  return NextResponse.json({
    data: result.accounts.map((a) => {
      const { adminGrantsRaw, ...rest } = a as typeof a & {
        adminGrantsRaw?: unknown;
      };
      return {
        ...rest,
        adminGrants: adminGrantsRaw ? parseAdminDojoGrants(adminGrantsRaw) : null,
      };
    }),
    handovers: result.handovers,
    primaryContact: result.primaryContact,
    jabatanOptions: WILAYAH_JABATAN,
    wilayahName: scoped.name,
    siblingDojos,
  });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const parsed = wilayahAccountCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  const { scope, wilayahId } = parsed.data;
  const scoped = await assertWilayahAccess(authResult.user, scope, wilayahId);
  if (!scoped) {
    return NextResponse.json(
      { error: "Akses ditolak / wilayah tidak ditemukan" },
      { status: 403 },
    );
  }

  const pwCheck = validatePassword(parsed.data.password);
  if (!pwCheck.valid) {
    return NextResponse.json({ error: pwCheck.error }, { status: 400 });
  }

  const roleName = scope === "branch" ? "ADMIN_BRANCH" : "ADMIN_DOJO";
  const role = await prisma.role.findUnique({
    where: { name: roleName },
    select: { id: true },
  });
  if (!role) {
    return NextResponse.json({ error: "Role tidak ditemukan" }, { status: 400 });
  }

  const conflict = await prisma.user.findFirst({
    where: {
      email: { equals: parsed.data.email, mode: "insensitive" },
      isDeleted: false,
    },
    select: { id: true, email: true },
  });
  if (conflict) {
    return NextResponse.json(
      { error: `Email ${parsed.data.email} sudah terdaftar` },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const activeCount = await countActiveWilayahAccounts({ scope, wilayahId });
  const makePrimary =
    parsed.data.setAsPrimary === true || activeCount === 0;

  const created = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      fullName: parsed.data.fullName?.trim() || null,
      phoneNumber: parsed.data.phoneNumber?.trim() || null,
      passwordHash,
      isActive: true,
      ...(scope === "branch"
        ? { managedBranchId: wilayahId }
        : { managedDojoId: wilayahId }),
      roles: { connect: [{ id: role.id }] },
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      phoneNumber: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (parsed.data.jabatan || parsed.data.bidang || makePrimary) {
    await setAccountJabatan({
      scope,
      wilayahId,
      userId: created.id,
      jabatan: parsed.data.jabatan || (makePrimary ? "KETUA" : "PENGURUS"),
      bidang: parsed.data.bidang || null,
    });
  }

  if (parsed.data.adminGrants) {
    await setAdminDojoGrants(
      wilayahId,
      created.id,
      adminDojoGrantsFromInput(parsed.data.adminGrants),
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "WILAYAH_ACCOUNT_CREATE",
    details: JSON.stringify({
      scope,
      wilayahId,
      wilayahName: scoped.name,
      targetUserId: created.id,
      targetEmail: created.email,
      isPrimary: makePrimary,
      jabatan: parsed.data.jabatan || (makePrimary ? "KETUA" : null),
      bidang: parsed.data.bidang || null,
      adminGrants: parsed.data.adminGrants ?? null,
    }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  await notifyWilayahAdmins({
    scope,
    wilayahId,
    token: authResult.token,
    excludeUserId: created.id,
    title: "Akun admin wilayah baru",
    content: `Akun ${created.email} ditambahkan ke ${scope === "branch" ? "cabang" : "ranting"} ${scoped.name} oleh ${authResult.user.email}.`,
  });

  return NextResponse.json({
    success: true,
    message: `Akun ${created.email} ditambahkan ke ${scoped.name}`,
    loginEmail: parsed.data.email,
    loginPassword: parsed.data.password,
    data: created,
  });
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const parsed = wilayahAccountPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  const { scope, wilayahId, action } = parsed.data;
  const scoped = await assertWilayahAccess(authResult.user, scope, wilayahId);
  if (!scoped) {
    return NextResponse.json(
      { error: "Akses ditolak / wilayah tidak ditemukan" },
      { status: 403 },
    );
  }

  if (action === "promote_existing") {
    const linkEmail = parsed.data.linkEmail?.trim().toLowerCase();
    if (!linkEmail) {
      return NextResponse.json({ error: "Email wajib diisi" }, { status: 400 });
    }
    const targetUser = await prisma.user.findFirst({
      where: {
        email: { equals: linkEmail, mode: "insensitive" },
        isDeleted: false,
      },
      select: { id: true, email: true, fullName: true },
    });
    if (!targetUser) {
      return NextResponse.json(
        { error: "Akun pengguna dengan email tersebut tidak ditemukan" },
        { status: 404 },
      );
    }

    if (scope === "branch") {
      await promoteUserToAdminBranch({
        email: targetUser.email,
        branchId: wilayahId,
      });
    } else {
      const branchId =
        "branchId" in scoped && typeof scoped.branchId === "string"
          ? scoped.branchId
          : null;
      if (!branchId) {
        return NextResponse.json(
          { error: "Cabang ranting tidak ditemukan" },
          { status: 400 },
        );
      }
      await promoteUserToAdminDojo({
        email: targetUser.email,
        dojoId: wilayahId,
        branchId,
      });
    }

    if (parsed.data.jabatan || parsed.data.bidang) {
      await setAccountJabatan({
        scope,
        wilayahId,
        userId: targetUser.id,
        jabatan: parsed.data.jabatan || "PENGURUS",
        bidang: parsed.data.bidang || null,
      });
    }

    if (parsed.data.setAsPrimary) {
      await setPrimaryAccountId(scope, wilayahId, targetUser.id);
    }

    if (parsed.data.adminGrants) {
      await setAdminDojoGrants(
        wilayahId,
        targetUser.id,
        adminDojoGrantsFromInput(parsed.data.adminGrants),
      );
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "WILAYAH_ACCOUNT_PROMOTE_EXISTING",
      details: JSON.stringify({
        scope,
        wilayahId,
        wilayahName: scoped.name,
        targetUserId: targetUser.id,
        targetEmail: targetUser.email,
        jabatan: parsed.data.jabatan,
        bidang: parsed.data.bidang,
        setAsPrimary: parsed.data.setAsPrimary,
      }),
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    return NextResponse.json({
      success: true,
      message: `Akun ${targetUser.email} berhasil dijadikan admin pengurus`,
    });
  }

  const managingIds =
    scope === "dojo" ? await findUserIdsManagingDojo(wilayahId) : [];

  const target = await prisma.user.findFirst({
    where: {
      id: parsed.data.userId,
      isDeleted: false,
      ...(scope === "branch"
        ? {
            managedBranchId: wilayahId,
            roles: { some: { name: "ADMIN_BRANCH" } },
          }
        : {
            roles: { some: { name: "ADMIN_DOJO" } },
            OR: [
              { managedDojoId: wilayahId },
              ...(parsed.data.userId && managingIds.includes(parsed.data.userId) ? [{ id: parsed.data.userId }] : []),
            ],
          }),
    },
    select: {
      id: true,
      email: true,
      isActive: true,
      fullName: true,
      managedDojoId: true,
    },
  });
  if (!target) {
    return NextResponse.json(
      { error: "Akun tidak ditemukan di wilayah ini" },
      { status: 404 },
    );
  }

  let message = "Berhasil";
  let loginPassword: string | undefined;

  if (action === "deactivate") {
    if (target.id === authResult.user.id) {
      return NextResponse.json(
        { error: "Tidak dapat menonaktifkan akun sendiri dari sini" },
        { status: 400 },
      );
    }
    const remaining = await countActiveWilayahAccounts({
      scope,
      wilayahId,
      excludeUserId: target.id,
    });
    if (target.isActive && remaining < 1) {
      return NextResponse.json(
        {
          error:
            "Tidak dapat menonaktifkan akun aktif terakhir di wilayah ini. Tambah akun lain dulu.",
        },
        { status: 400 },
      );
    }
    await prisma.user.update({
      where: { id: target.id },
      data: { isActive: false },
    });
    message = "Akun dinonaktifkan";
  } else if (action === "activate") {
    await prisma.user.update({
      where: { id: target.id },
      data: { isActive: true },
    });
    message = "Akun diaktifkan";
  } else if (action === "set_primary") {
    if (!target.isActive) {
      return NextResponse.json(
        { error: "Hanya akun aktif yang dapat jadi PIC utama" },
        { status: 400 },
      );
    }
    await setPrimaryAccountId(scope, wilayahId, target.id);
    message = "PIC utama diperbarui";
  } else if (action === "set_jabatan") {
    const jabatan = parsed.data.jabatan;
    const bidang = parsed.data.bidang;
    await setAccountJabatan({
      scope,
      wilayahId,
      userId: target.id,
      jabatan: jabatan || null,
      bidang: bidang || null,
    });
    message = "Jabatan & Bidang diperbarui";
  } else if (action === "set_bidang") {
    const bidang = parsed.data.bidang;
    await setAccountBidang({
      scope,
      wilayahId,
      userId: target.id,
      bidang: bidang || null,
    });
    message = "Bidang Pengurus diperbarui";
  } else if (action === "set_admin_grants") {
    if (parsed.data.adminGrants) {
      await setAdminDojoGrants(
        wilayahId,
        target.id,
        adminDojoGrantsFromInput(parsed.data.adminGrants),
      );
      message = "Hak akses & izin CRUD diperbarui";
    }
  } else if (action === "reset_password") {
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
      where: { id: target.id },
      data: { passwordHash },
    });
    message = "Password berhasil direset";
    loginPassword = parsed.data.newPassword;
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: `WILAYAH_ACCOUNT_${action.toUpperCase()}`,
    details: JSON.stringify({
      scope,
      wilayahId,
      wilayahName: scoped.name,
      targetUserId: target.id,
      targetEmail: target.email,
      jabatan: parsed.data.jabatan,
      bidang: parsed.data.bidang,
      note: parsed.data.note,
    }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    message,
    ...(action === "reset_password"
      ? {
          loginEmail: target.email,
          loginPassword,
        }
      : {}),
  });
}

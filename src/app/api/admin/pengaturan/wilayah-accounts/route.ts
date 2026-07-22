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
  setPrimaryAccountId,
  WILAYAH_JABATAN,
  type WilayahJabatan,
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
      const raw = (a as { adminGrantsRaw?: unknown }).adminGrantsRaw;
      const rest = { ...(a as typeof a & { adminGrantsRaw?: unknown }) };
      delete rest.adminGrantsRaw;
      return {
        ...rest,
        adminGrants: raw ? parseAdminDojoGrants(raw) : null,
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
    select: { id: true },
  });
  if (conflict) {
    return NextResponse.json({ error: "Email sudah terpakai" }, { status: 409 });
  }

  const existingCount = await prisma.user.count({
    where: {
      isDeleted: false,
      ...(scope === "branch"
        ? {
            managedBranchId: wilayahId,
            roles: { some: { name: "ADMIN_BRANCH" } },
          }
        : {
            managedDojoId: wilayahId,
            roles: { some: { name: "ADMIN_DOJO" } },
          }),
    },
  });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const created = await prisma.user.create({
    data: {
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      phoneNumber: parsed.data.phoneNumber || null,
      passwordHash,
      isActive: true,
      managedBranchId: scope === "branch" ? wilayahId : null,
      managedDojoId: scope === "dojo" ? wilayahId : null,
      roles: { connect: [{ id: role.id }] },
    },
    select: { id: true, email: true, fullName: true },
  });

  const makePrimary = parsed.data.setAsPrimary === true || existingCount === 0;
  if (makePrimary) {
    await setPrimaryAccountId(scope, wilayahId, created.id);
  }

  if (parsed.data.jabatan) {
    await setAccountJabatan({
      scope,
      wilayahId,
      userId: created.id,
      jabatan: parsed.data.jabatan as WilayahJabatan,
    });
  } else if (makePrimary) {
    await setAccountJabatan({
      scope,
      wilayahId,
      userId: created.id,
      jabatan: "KETUA",
    });
  }

  if (scope === "dojo" && parsed.data.adminGrants) {
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
      adminGrants: scope === "dojo" ? parsed.data.adminGrants ?? null : null,
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

  // --- Multi-ranting: tautkan akun existing ke ranting ini ---
  if (action === "link_existing") {
    if (scope !== "dojo") {
      return NextResponse.json(
        { error: "Tautkan multi-ranting hanya untuk ranting" },
        { status: 400 },
      );
    }
    const linkEmail = parsed.data.linkEmail?.trim().toLowerCase();
    if (!linkEmail) {
      return NextResponse.json({ error: "Email wajib" }, { status: 400 });
    }
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

    const existing = await prisma.user.findFirst({
      where: {
        email: { equals: linkEmail, mode: "insensitive" },
        isDeleted: false,
        roles: { some: { name: "ADMIN_DOJO" } },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        managedDojoId: true,
        isActive: true,
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Akun ADMIN_DOJO dengan email itu tidak ditemukan" },
        { status: 404 },
      );
    }

    try {
      const result = await addManagedDojo({
        userId: existing.id,
        dojoId: wilayahId,
        branchId,
        makePrimary: false,
      });
      writeAuditLog({
        userId: authResult.user.id,
        email: authResult.user.email,
        action: "WILAYAH_ACCOUNT_LINK_EXISTING",
        details: JSON.stringify({
          scope,
          wilayahId,
          wilayahName: scoped.name,
          targetUserId: existing.id,
          targetEmail: existing.email,
          managedDojoIds: result.dojoIds,
        }),
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        token: authResult.token,
      });
      return NextResponse.json({
        success: true,
        message: `${existing.email} sekarang juga mengelola ${scoped.name}`,
        data: result,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Gagal menautkan akun" },
        { status: 400 },
      );
    }
  }

  // --- Jadikan admin ranting: akun login existing (anggota / user lain) ---
  if (action === "promote_existing") {
    const linkEmail = parsed.data.linkEmail?.trim().toLowerCase();
    if (!linkEmail) {
      return NextResponse.json({ error: "Email wajib" }, { status: 400 });
    }

    try {
      const result =
        scope === "dojo"
          ? await (async () => {
              const branchId =
                "branchId" in scoped && typeof scoped.branchId === "string"
                  ? scoped.branchId
                  : null;
              if (!branchId) {
                throw new Error("Cabang ranting tidak ditemukan");
              }
              return promoteUserToAdminDojo({
                email: linkEmail,
                dojoId: wilayahId,
                branchId,
                jabatan: parsed.data.jabatan ?? undefined,
                setAsPrimary: parsed.data.setAsPrimary,
                adminGrants: parsed.data.adminGrants,
              });
            })()
          : await promoteUserToAdminBranch({
              email: linkEmail,
              branchId: wilayahId,
              jabatan: parsed.data.jabatan ?? undefined,
              setAsPrimary: parsed.data.setAsPrimary,
            });

      if (result.alreadyManaging && !result.roleGranted) {
        return NextResponse.json({
          success: true,
          message: `${result.email} sudah admin ${scope === "dojo" ? "ranting" : "cabang"} ${scoped.name}`,
          data: result,
        });
      }

      writeAuditLog({
        userId: authResult.user.id,
        email: authResult.user.email,
        action: "WILAYAH_ACCOUNT_PROMOTE_ADMIN_DOJO",
        details: JSON.stringify({
          scope,
          wilayahId,
          wilayahName: scoped.name,
          targetUserId: result.userId,
          targetEmail: result.email,
          roleGranted: result.roleGranted,
          memberLinked: result.memberLinked,
        }),
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        token: authResult.token,
      });

      await notifyWilayahAdmins({
        token: authResult.token,
        scope,
        wilayahId,
        excludeUserId: authResult.user.id,
        title: `Admin ${scope === "dojo" ? "ranting" : "cabang"} — akun ditambahkan`,
        content: `${result.email} dijadikan admin ${scope === "dojo" ? "ranting" : "cabang"} ${scoped.name} oleh ${authResult.user.email}.${result.memberLinked ? " Akun dual-role (anggota + pengurus)." : ""}`,
      });

      const dualHint = result.memberLinked
        ? " Akun dual-role: bisa login ke dashboard anggota dan panel admin."
        : "";

      return NextResponse.json({
        success: true,
        message: `${result.email} sekarang admin ${scope === "dojo" ? "ranting" : "cabang"} ${scoped.name}.${dualHint}`,
        data: result,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menjadikan admin ranting";
      const status = msg.includes("tidak ditemukan") ? 404 : 400;
      return NextResponse.json({ error: msg }, { status });
    }
  }

  if (action === "set_admin_grants") {
    if (scope !== "dojo") {
      return NextResponse.json(
        { error: "Hak akses admin hanya untuk ranting" },
        { status: 400 },
      );
    }
    const userId = parsed.data.userId;
    if (!userId) {
      return NextResponse.json({ error: "userId wajib" }, { status: 400 });
    }
    if (!parsed.data.adminGrants) {
      return NextResponse.json(
        { error: "adminGrants wajib diisi" },
        { status: 400 },
      );
    }
    const managingIds = await findUserIdsManagingDojo(wilayahId);
    if (!managingIds.includes(userId)) {
      return NextResponse.json(
        { error: "Akun tidak mengelola ranting ini" },
        { status: 404 },
      );
    }
    await setAdminDojoGrants(
      wilayahId,
      userId,
      adminDojoGrantsFromInput(parsed.data.adminGrants),
    );
    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "WILAYAH_ACCOUNT_SET_ADMIN_GRANTS",
      details: JSON.stringify({
        scope,
        wilayahId,
        targetUserId: userId,
        grants: parsed.data.adminGrants,
      }),
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });
    return NextResponse.json({
      success: true,
      message: "Hak akses admin ranting disimpan",
    });
  }

  const userId = parsed.data.userId;
  if (!userId) {
    return NextResponse.json({ error: "userId wajib" }, { status: 400 });
  }

  const managingIds =
    scope === "dojo" ? await findUserIdsManagingDojo(wilayahId) : [];

  const target = await prisma.user.findFirst({
    where: {
      id: userId,
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
              ...(managingIds.includes(userId) ? [{ id: userId }] : []),
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

  if (action === "set_managed_dojos") {
    if (scope !== "dojo") {
      return NextResponse.json(
        { error: "Multi-ranting hanya untuk akun ranting" },
        { status: 400 },
      );
    }
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
    const managedDojoIds = parsed.data.managedDojoIds ?? [];
    const primaryDojoId = parsed.data.primaryDojoId;
    if (!primaryDojoId || !managedDojoIds.includes(primaryDojoId)) {
      return NextResponse.json(
        { error: "Ranting utama harus ada dalam daftar" },
        { status: 400 },
      );
    }
    // Pastikan ranting sheet saat ini selalu termasuk
    const withCurrent = managedDojoIds.includes(wilayahId)
      ? managedDojoIds
      : [...managedDojoIds, wilayahId];
    try {
      const result = await setManagedDojoIds({
        userId: target.id,
        dojoIds: withCurrent,
        primaryDojoId: withCurrent.includes(primaryDojoId)
          ? primaryDojoId
          : wilayahId,
        branchId,
      });
      message = `Cakupan ranting diperbarui (${result.dojoIds.length} ranting)`;
      writeAuditLog({
        userId: authResult.user.id,
        email: authResult.user.email,
        action: "WILAYAH_ACCOUNT_SET_MANAGED_DOJOS",
        details: JSON.stringify({
          scope,
          wilayahId,
          targetUserId: target.id,
          targetEmail: target.email,
          ...result,
        }),
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        token: authResult.token,
      });
      return NextResponse.json({ success: true, message, data: result });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Gagal menyimpan" },
        { status: 400 },
      );
    }
  }

  if (action === "unlink_dojo") {
    if (scope !== "dojo") {
      return NextResponse.json(
        { error: "Cabut ranting hanya untuk scope dojo" },
        { status: 400 },
      );
    }
    try {
      const result = await removeManagedDojo({
        userId: target.id,
        dojoId: wilayahId,
      });
      message = `Akses ke ${scoped.name} dicabut`;
      writeAuditLog({
        userId: authResult.user.id,
        email: authResult.user.email,
        action: "WILAYAH_ACCOUNT_UNLINK_DOJO",
        details: JSON.stringify({
          scope,
          wilayahId,
          targetUserId: target.id,
          targetEmail: target.email,
          remaining: result?.dojoIds,
        }),
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        token: authResult.token,
      });
      return NextResponse.json({ success: true, message, data: result });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Gagal mencabut" },
        { status: 400 },
      );
    }
  }

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
    if (
      jabatan &&
      jabatan !== "KETUA" &&
      jabatan !== "SEKRETARIS" &&
      jabatan !== "BENDAHARA" &&
      jabatan !== "PENGURUS"
    ) {
      return NextResponse.json({ error: "Jabatan tidak valid" }, { status: 400 });
    }
    await setAccountJabatan({
      scope,
      wilayahId,
      userId: target.id,
      jabatan: (jabatan as WilayahJabatan | null | undefined) || null,
    });
    message = "Jabatan diperbarui";
  } else if (action === "handover") {
    if (!target.isActive) {
      return NextResponse.json(
        { error: "Penerima serah terima harus akun aktif" },
        { status: 400 },
      );
    }
    const { previousId } = await performHandover({
      scope,
      wilayahId,
      toUserId: target.id,
      note: parsed.data.note,
      byUserId: authResult.user.id,
      byEmail: authResult.user.email,
      deactivatePrevious: parsed.data.deactivatePrevious === true,
    });
    message =
      previousId && previousId !== target.id
        ? `Serah terima PIC ke ${target.email} selesai`
        : `PIC utama ditetapkan: ${target.email}`;
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
  } else if (action === "change_email") {
    const newEmail = parsed.data.newEmail?.trim().toLowerCase();
    if (!newEmail) {
      return NextResponse.json({ error: "Email baru wajib diisi" }, { status: 400 });
    }
    if (newEmail === target.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Email baru sama dengan email saat ini" },
        { status: 400 },
      );
    }
    const conflict = await prisma.user.findFirst({
      where: {
        email: { equals: newEmail, mode: "insensitive" },
        isDeleted: false,
        NOT: { id: target.id },
      },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json(
        { error: `Email ${newEmail} sudah dipakai akun lain` },
        { status: 409 },
      );
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { email: newEmail },
    });

    // Sinkron ke Inkai bila PIC utama ranting (username login dojo)
    if (scope === "dojo" && authResult.token) {
      const primaryId = await getPrimaryAccountId(scope, wilayahId);
      if (primaryId === target.id) {
        try {
          await inkaiFetch(
            `/v1/org/dojos/${wilayahId}`,
            {
              method: "PATCH",
              body: JSON.stringify({ adminEmail: newEmail }),
            },
            authResult.token,
          );
        } catch {
          // non-blocking — email lokal sudah diubah
        }
      }
    }

    message = `Email diperbarui: ${newEmail}`;
    target.email = newEmail;
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
      note: parsed.data.note,
      deactivatePrevious: parsed.data.deactivatePrevious,
    }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  if (
    action === "deactivate" ||
    action === "activate" ||
    action === "set_primary" ||
    action === "handover" ||
    action === "set_jabatan" ||
    action === "change_email"
  ) {
    await notifyWilayahAdmins({
      scope,
      wilayahId,
      token: authResult.token,
      excludeUserId: authResult.user.id,
      title: "Perubahan akun wilayah",
      content: `Akun ${target.email} di ${scoped.name}: ${action.replace(/_/g, " ")} oleh ${authResult.user.email}.`,
    });
  }

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

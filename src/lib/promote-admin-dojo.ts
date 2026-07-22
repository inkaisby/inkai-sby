import { prisma } from "@/lib/prisma";
import {
  addManagedDojo,
  findUserIdsManagingDojo,
  loadManagedDojoIds,
} from "@/lib/managed-dojos";
import {
  setAccountJabatan,
  setPrimaryAccountId,
  type WilayahJabatan,
} from "@/lib/wilayah-accounts";

export type PromoteAdminDojoResult = {
  userId: string;
  email: string;
  fullName: string | null;
  /** Baru ditambahkan role ADMIN_DOJO (bukan hanya ranting). */
  roleGranted: boolean;
  /** Sudah mengelola ranting ini sebelumnya. */
  alreadyManaging: boolean;
  /** Punya record Member terhubung (dual-role anggota + admin). */
  memberLinked: boolean;
};

/**
 * Jadikan akun login yang sudah ada (mis. anggota) sebagai admin ranting.
 * Email tetap sama — tidak buat User baru.
 */
export async function promoteUserToAdminDojo(opts: {
  email: string;
  dojoId: string;
  branchId: string;
  jabatan?: WilayahJabatan | null;
  setAsPrimary?: boolean;
}): Promise<PromoteAdminDojoResult> {
  const email = opts.email.trim().toLowerCase();
  if (!email) {
    throw new Error("Email wajib diisi");
  }

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      isDeleted: false,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      managedDojoId: true,
      isActive: true,
      roles: { select: { name: true } },
      member: { select: { id: true, fullName: true } },
    },
  });

  if (!user) {
    throw new Error(
      "Email tidak ditemukan. Gunakan «Tambah akun» untuk email baru, atau pastikan anggota sudah punya akun login.",
    );
  }

  const hasAdminDojo = user.roles.some((r) => r.name === "ADMIN_DOJO");
  const managingIds = await findUserIdsManagingDojo(opts.dojoId);
  const alreadyManaging = managingIds.includes(user.id);

  if (alreadyManaging && hasAdminDojo) {
    return {
      userId: user.id,
      email: user.email,
      fullName:
        user.fullName || user.member?.fullName || null,
      roleGranted: false,
      alreadyManaging: true,
      memberLinked: Boolean(user.member),
    };
  }

  const adminRole = await prisma.role.findUnique({
    where: { name: "ADMIN_DOJO" },
    select: { id: true },
  });
  if (!adminRole) {
    throw new Error("Role ADMIN_DOJO tidak ditemukan");
  }

  if (!hasAdminDojo) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        roles: { connect: [{ id: adminRole.id }] },
        isActive: true,
        ...(!user.managedDojoId ? { managedDojoId: opts.dojoId } : {}),
      },
    });
  } else if (!user.isActive) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: true },
    });
  }

  if (!alreadyManaging) {
    await addManagedDojo({
      userId: user.id,
      dojoId: opts.dojoId,
      branchId: opts.branchId,
      makePrimary: opts.setAsPrimary || !user.managedDojoId,
    });
  } else if (opts.setAsPrimary) {
    const ids = await loadManagedDojoIds(user.id, user.managedDojoId);
    if (ids.includes(opts.dojoId)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { managedDojoId: opts.dojoId },
      });
    }
  }

  if (opts.jabatan) {
    await setAccountJabatan({
      scope: "dojo",
      wilayahId: opts.dojoId,
      userId: user.id,
      jabatan: opts.jabatan,
    });
  }

  if (opts.setAsPrimary) {
    await setPrimaryAccountId("dojo", opts.dojoId, user.id);
  }

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName || user.member?.fullName || null,
    roleGranted: !hasAdminDojo,
    alreadyManaging,
    memberLinked: Boolean(user.member),
  };
}

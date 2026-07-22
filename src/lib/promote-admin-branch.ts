import { prisma } from "@/lib/prisma";
import {
  setAccountJabatan,
  setPrimaryAccountId,
  type WilayahJabatan,
} from "@/lib/wilayah-accounts";

export type PromoteAdminBranchResult = {
  userId: string;
  email: string;
  fullName: string | null;
  roleGranted: boolean;
  alreadyManaging: boolean;
  memberLinked: boolean;
};

/**
 * Jadikan akun login existing sebagai admin cabang tanpa membuat user baru.
 * Cocok untuk ketua cabang yang sudah punya akun anggota/login sendiri.
 */
export async function promoteUserToAdminBranch(opts: {
  email: string;
  branchId: string;
  jabatan?: WilayahJabatan | null;
  setAsPrimary?: boolean;
}): Promise<PromoteAdminBranchResult> {
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
      managedBranchId: true,
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

  const hasAdminBranch = user.roles.some((r) => r.name === "ADMIN_BRANCH");
  const alreadyManaging = user.managedBranchId === opts.branchId;

  if (hasAdminBranch && user.managedBranchId && user.managedBranchId !== opts.branchId) {
    throw new Error(
      "Akun ini sudah menjadi admin cabang lain. Lepas dulu dari cabang sebelumnya sebelum dipindah.",
    );
  }

  if (alreadyManaging && hasAdminBranch) {
    if (opts.jabatan) {
      await setAccountJabatan({
        scope: "branch",
        wilayahId: opts.branchId,
        userId: user.id,
        jabatan: opts.jabatan,
      });
    }
    if (opts.setAsPrimary) {
      await setPrimaryAccountId("branch", opts.branchId, user.id);
    }
    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName || user.member?.fullName || null,
      roleGranted: false,
      alreadyManaging: true,
      memberLinked: Boolean(user.member),
    };
  }

  const adminRole = await prisma.role.findUnique({
    where: { name: "ADMIN_BRANCH" },
    select: { id: true },
  });
  if (!adminRole) {
    throw new Error("Role ADMIN_BRANCH tidak ditemukan");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isActive: true,
      managedBranchId: opts.branchId,
      ...(hasAdminBranch ? {} : { roles: { connect: [{ id: adminRole.id }] } }),
    },
  });

  if (opts.jabatan) {
    await setAccountJabatan({
      scope: "branch",
      wilayahId: opts.branchId,
      userId: user.id,
      jabatan: opts.jabatan,
    });
  }

  if (opts.setAsPrimary) {
    await setPrimaryAccountId("branch", opts.branchId, user.id);
  }

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName || user.member?.fullName || null,
    roleGranted: !hasAdminBranch,
    alreadyManaging,
    memberLinked: Boolean(user.member),
  };
}

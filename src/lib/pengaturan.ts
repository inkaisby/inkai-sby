import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLES, getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";
import { buildDefaultUktAdminUrl } from "@/lib/ukt";

export const SETTINGS_HUB = [
  {
    href: "/admin/pengaturan/cabang",
    title: "Pengaturan Cabang",
    description: "Tambah, ubah, arsipkan, atau pulihkan data cabang beserta admin.",
    group: "wilayah" as const,
  },
  {
    href: "/admin/pengaturan/ranting",
    title: "Pengaturan Ranting & User",
    description:
      "Kelola ranting, akun login admin ranting (email/password), rekening, dan arsip.",
    group: "wilayah" as const,
  },
  {
    href: "/admin/pengaturan/kebijakan",
    title: "Profil & Kebijakan",
    description: "Kontak sekretariat, rekening cabang, iuran default, instruksi bayar.",
    group: "kebijakan" as const,
  },
  {
    href: "/admin/pengaturan/ukt",
    title: "Pengaturan UKT",
    description: "Centang syarat pendaftaran UKT (iuran, dokumen, absensi) per peran.",
    group: "kebijakan" as const,
  },
  {
    href: "/admin/pengaturan/peran",
    title: "Role & Hak Akses",
    description: "Atur permission menu per role (Administrator).",
    group: "akun" as const,
  },
  {
    href: "/admin/pengaturan/geofencing",
    title: "Geofencing Absensi",
    description: "Atur koordinat dan radius absensi per ranting (dengan lokasi perangkat).",
    group: "operasional" as const,
  },
  {
    href: "/admin/pengaturan/akun",
    title: "Akun Saya",
    description: "Ubah profil dan password akun yang sedang login.",
    group: "akun" as const,
  },
] as const;

export const SETTINGS_SHORTCUTS = [
  {
    href: "/admin/pengaturan/ukt",
    title: "Syarat pendaftaran UKT",
    description: "Centang iuran / dokumen / absensi & berlaku ranting/cabang",
    kind: "kebijakan" as const,
  },
  {
    href: buildDefaultUktAdminUrl(),
    title: "Tarif UKT & Komisi",
    description: "Biaya sabuk & komisi ranting (modul UKT)",
    kind: "kebijakan" as const,
  },
  {
    href: "/admin/carousel",
    title: "Carousel Beranda",
    description: "Konten visual beranda publik",
    kind: "konten" as const,
  },
  {
    href: "/admin/audit",
    title: "Log Audit",
    description: "Jejak aksi sensitif admin",
    kind: "audit" as const,
  },
] as const;

export const SETTINGS_GROUP_LABELS: Record<string, string> = {
  akun: "Akun & akses",
  wilayah: "Wilayah",
  kebijakan: "Kebijakan organisasi",
  operasional: "Operasional lapangan",
};

export function canManageUsers(user: SessionUser) {
  const role = getPrimaryAdminRole(user.roles);
  return ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(
    role,
  );
}

export function canManageBranches(user: SessionUser) {
  const role = getPrimaryAdminRole(user.roles);
  return ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN"].includes(role);
}

export function canManageRanting(user: SessionUser) {
  const role = getPrimaryAdminRole(user.roles);
  return [
    "ADMINISTRATOR",
    "ADMIN_PUSAT",
    "ADMIN_PROVINCE",
    "ADMIN_BRANCH",
    "ADMIN_DOJO",
    "ADMIN",
  ].includes(role);
}

/** Tambah / arsip ranting & kelola akun login ranting lain — bukan admin ranting sendiri. */
export function canAdministerRantingAccounts(user: SessionUser) {
  const role = getPrimaryAdminRole(user.roles);
  return ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(
    role,
  );
}

export function canManageRoles(user: SessionUser) {
  return user.roles.includes("ADMINISTRATOR");
}

export function canManageKebijakan(user: SessionUser) {
  const role = getPrimaryAdminRole(user.roles);
  return [
    "ADMINISTRATOR",
    "ADMIN_PUSAT",
    "ADMIN_PROVINCE",
    "ADMIN_BRANCH",
    "ADMIN",
  ].includes(role);
}

export function canManageGeofencing(user: SessionUser) {
  return ADMIN_ROLES.some((r) => user.roles.includes(r));
}

export function canAccessAkunSaya(_user: SessionUser) {
  return true;
}

export function buildAdminUserWhere(user: SessionUser) {
  const role = getPrimaryAdminRole(user.roles);
  const base = {
    isDeleted: false,
    roles: { some: { name: { in: [...ADMIN_ROLES] } } },
  };

  if (role === "ADMINISTRATOR" || role === "ADMIN_PUSAT" || role === "ADMIN") {
    return base;
  }
  if (role === "ADMIN_PROVINCE" && user.managedProvinceId) {
    return {
      ...base,
      OR: [
        { managedProvinceId: user.managedProvinceId },
        { managedBranch: { provinceId: user.managedProvinceId } },
        { managedDojo: { branch: { provinceId: user.managedProvinceId } } },
      ],
    };
  }
  if (role === "ADMIN_BRANCH" && user.managedBranchId) {
    return {
      ...base,
      OR: [
        { managedBranchId: user.managedBranchId },
        { managedDojo: { branchId: user.managedBranchId } },
      ],
    };
  }
  return { ...base, id: user.id };
}

export function buildScopedDojoWhere(user: SessionUser): Prisma.DojoWhereInput {
  const role = getPrimaryAdminRole(user.roles);
  const base: Prisma.DojoWhereInput = { isDeleted: false };

  if (role === "ADMINISTRATOR" || role === "ADMIN_PUSAT" || role === "ADMIN") {
    return base;
  }
  if (role === "ADMIN_PROVINCE" && user.managedProvinceId) {
    return { ...base, branch: { provinceId: user.managedProvinceId, isDeleted: false } };
  }
  if (role === "ADMIN_BRANCH" && user.managedBranchId) {
    return { ...base, branchId: user.managedBranchId };
  }
  if (role === "ADMIN_DOJO") {
    const ids =
      user.managedDojoIds && user.managedDojoIds.length > 0
        ? user.managedDojoIds
        : user.managedDojoId
          ? [user.managedDojoId]
          : [];
    if (ids.length === 1) return { ...base, id: ids[0] };
    if (ids.length > 1) return { ...base, id: { in: ids } };
  }
  return { ...base, id: "__none__" };
}

export function buildScopedBranchWhere(user: SessionUser): Prisma.BranchWhereInput {
  const role = getPrimaryAdminRole(user.roles);
  const base: Prisma.BranchWhereInput = { isDeleted: false };

  if (role === "ADMINISTRATOR" || role === "ADMIN_PUSAT" || role === "ADMIN") {
    return base;
  }
  if (role === "ADMIN_PROVINCE" && user.managedProvinceId) {
    return { ...base, provinceId: user.managedProvinceId };
  }
  if (role === "ADMIN_BRANCH" && user.managedBranchId) {
    return { ...base, id: user.managedBranchId };
  }
  return { ...base, id: "__none__" };
}

export async function assertDojoInScope(user: SessionUser, dojoId: string) {
  return prisma.dojo.findFirst({
    where: { AND: [{ id: dojoId }, buildScopedDojoWhere(user)] },
    select: {
      id: true,
      name: true,
      branchId: true,
      isDeleted: true,
    },
  });
}

export async function assertBranchInScope(user: SessionUser, branchId: string) {
  return prisma.branch.findFirst({
    where: { AND: [{ id: branchId }, buildScopedBranchWhere(user)] },
    select: {
      id: true,
      name: true,
      provinceId: true,
      isDeleted: true,
    },
  });
}

export async function findEmailConflict(email: string, excludeUserId?: string) {
  return prisma.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      isDeleted: false,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: {
      id: true,
      email: true,
      roles: { select: { name: true } },
      managedDojo: { select: { name: true } },
      managedBranch: { select: { name: true } },
    },
  });
}

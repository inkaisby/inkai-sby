import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLES, getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";

export const SETTINGS_HUB = [
  {
    href: "/admin/pengaturan/user",
    title: "Pengaturan User",
    description: "Kelola akun admin, status aktif, dan cakupan wilayah.",
  },
  {
    href: "/admin/pengaturan/cabang",
    title: "Pengaturan Cabang",
    description: "Tambah atau ubah data cabang beserta akun admin cabang.",
  },
  {
    href: "/admin/pengaturan/ranting",
    title: "Pengaturan Ranting",
    description: "Kelola ranting dan buat username/password login admin ranting.",
  },
  {
    href: "/admin/pengaturan/peran",
    title: "Role & Hak Akses",
    description: "Atur permission menu per role (Administrator).",
  },
  {
    href: "/admin/pengaturan/geofencing",
    title: "Geofencing Absensi",
    description: "Atur koordinat dan radius maksimal absensi per ranting.",
  },
  {
    href: "/admin/pengaturan/akun",
    title: "Akun Saya",
    description: "Ubah profil dan password akun admin yang sedang login.",
  },
] as const;

export const SETTINGS_SHORTCUTS = [
  { href: "/admin/ukt", title: "UKT & Iuran Ujian", description: "Tarif sabuk & komisi ranting" },
  { href: "/admin/carousel", title: "Carousel Beranda", description: "Konten visual beranda publik" },
  { href: "/admin/audit", title: "Log Audit", description: "Jejak aksi sensitif admin" },
] as const;

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
  return ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(
    role,
  );
}

export function canManageRoles(user: SessionUser) {
  return user.roles.includes("ADMINISTRATOR");
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
  if (role === "ADMIN_DOJO" && user.managedDojoId) {
    return { ...base, id: user.managedDojoId };
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

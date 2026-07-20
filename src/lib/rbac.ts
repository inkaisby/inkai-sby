import { SITE_BRANCH_NAME } from "@/lib/site";

export const ADMIN_ROLES = [
  "ADMINISTRATOR",
  "ADMIN_PUSAT",
  "ADMIN_PROVINCE",
  "ADMIN_BRANCH",
  "ADMIN_DOJO",
  "ADMIN",
] as const;

/** Anggota di DB lokal yang dojo/cabangnya di luar Cabang Surabaya (data bocor/sync). */
function outsideSiteBranchDojoClause() {
  // Prisma: `mode` harus di level StringFilter, bukan di dalam `not: { equals }`.
  return {
    branch: {
      name: {
        not: SITE_BRANCH_NAME,
        mode: "insensitive" as const,
      },
    },
  };
}

/** Ranting aktif ATAU terarsip tapi masih punya anggota hidup. */
function dojoVisibleClause() {
  return {
    OR: [
      { isDeleted: false as const },
      { members: { some: { isDeleted: false as const } } },
    ],
  };
}

export const ROLE_LABELS: Record<string, string> = {
  ADMINISTRATOR: "Administrator",
  ADMIN_PUSAT: "Administrator Pusat",
  ADMIN_PROVINCE: "Admin Provinsi",
  ADMIN_BRANCH: "Admin Cabang",
  ADMIN_DOJO: "Admin Dojo/Ranting",
  ADMIN: "Admin",
  MEMBER: "Anggota",
  PARENT: "Orang Tua",
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  roles: string[];
  managedProvinceId?: string | null;
  managedBranchId?: string | null;
  managedDojoId?: string | null;
  /** Ranting yang dikelola (primary + ekstra). Diisi lewat enrichSessionUser. */
  managedDojoIds?: string[];
  memberId?: string | null;
};

function dojoAllowlist(user: SessionUser): string[] {
  if (user.managedDojoIds && user.managedDojoIds.length > 0) {
    return user.managedDojoIds;
  }
  return user.managedDojoId ? [user.managedDojoId] : [];
}

export function isAdmin(roles: string[]) {
  return roles.some((r) => ADMIN_ROLES.includes(r as (typeof ADMIN_ROLES)[number]));
}

export function canAccessAdmin(user: SessionUser) {
  return isAdmin(user.roles);
}

export function canEditPengurus(roles: string[]) {
  const role = getPrimaryAdminRole(roles);
  return [
    "ADMINISTRATOR",
    "ADMIN_PUSAT",
    "ADMIN_PROVINCE",
    "ADMIN_BRANCH",
    "ADMIN",
  ].includes(role);
}

export function getPrimaryAdminRole(roles: string[]) {
  const order = [
    "ADMINISTRATOR",
    "ADMIN_PUSAT",
    "ADMIN_PROVINCE",
    "ADMIN_BRANCH",
    "ADMIN_DOJO",
    "ADMIN",
  ];
  return order.find((r) => roles.includes(r)) ?? "MEMBER";
}

export function getAdminScopeLabel(user: SessionUser) {
  const role = getPrimaryAdminRole(user.roles);
  switch (role) {
    case "ADMINISTRATOR":
    case "ADMIN_PUSAT":
      return "Seluruh Nasional";
    case "ADMIN_PROVINCE":
      return "Provinsi";
    case "ADMIN_BRANCH":
      return "Cabang";
    case "ADMIN_DOJO": {
      const n = dojoAllowlist(user).length;
      return n > 1 ? `Dojo/Ranting (${n})` : "Dojo/Ranting";
    }
    default:
      return "Anggota";
  }
}

export function buildMemberFilter(
  user: SessionUser,
  opts?: { includeDeleted?: boolean; anyDeleted?: boolean },
) {
  const role = getPrimaryAdminRole(user.roles);
  const deletedClause = opts?.anyDeleted
    ? {}
    : opts?.includeDeleted
      ? { isDeleted: true as const }
      : { isDeleted: false as const };

  if (role === "ADMINISTRATOR" || role === "ADMIN_PUSAT" || role === "ADMIN") {
    return { ...deletedClause };
  }
  if (role === "ADMIN_PROVINCE" && user.managedProvinceId) {
    return {
      ...deletedClause,
      OR: [
        {
          dojo: {
            branch: { provinceId: user.managedProvinceId },
          },
        },
        // Portal cabang: tampilkan juga anggota luar site yang nyangkut di DB lokal.
        { dojo: outsideSiteBranchDojoClause() },
      ],
    };
  }
  if (role === "ADMIN_BRANCH" && user.managedBranchId) {
    return {
      ...deletedClause,
      OR: [
        // Termasuk ranting terarsip di cabang sendiri (jangan hilangkan anggota aktif).
        { dojo: { branchId: user.managedBranchId } },
        { dojo: outsideSiteBranchDojoClause() },
      ],
    };
  }
  if (role === "ADMIN_DOJO") {
    const ids = dojoAllowlist(user);
    if (ids.length === 1) return { ...deletedClause, dojoId: ids[0] };
    if (ids.length > 1) return { ...deletedClause, dojoId: { in: ids } };
  }
  if (user.memberId) {
    return { id: user.memberId, ...deletedClause };
  }
  return { id: "none", ...deletedClause };
}

export function buildDojoFilter(user: SessionUser) {
  const role = getPrimaryAdminRole(user.roles);
  const visible = dojoVisibleClause();

  if (role === "ADMINISTRATOR" || role === "ADMIN_PUSAT" || role === "ADMIN") {
    return visible;
  }
  if (role === "ADMIN_PROVINCE" && user.managedProvinceId) {
    return {
      AND: [
        visible,
        {
          OR: [
            { branch: { provinceId: user.managedProvinceId } },
            outsideSiteBranchDojoClause(),
          ],
        },
      ],
    };
  }
  if (role === "ADMIN_BRANCH" && user.managedBranchId) {
    return {
      AND: [
        visible,
        {
          OR: [
            { branchId: user.managedBranchId },
            outsideSiteBranchDojoClause(),
          ],
        },
      ],
    };
  }
  if (role === "ADMIN_DOJO") {
    const ids = dojoAllowlist(user);
    if (ids.length === 1) return { id: ids[0], ...visible };
    if (ids.length > 1) return { id: { in: ids }, ...visible };
  }
  return { id: "none", isDeleted: false };
}

export function buildBranchFilter(user: SessionUser) {
  const role = getPrimaryAdminRole(user.roles);

  if (role === "ADMINISTRATOR" || role === "ADMIN_PUSAT" || role === "ADMIN") {
    return { isDeleted: false };
  }
  if (role === "ADMIN_PROVINCE" && user.managedProvinceId) {
    return { isDeleted: false, provinceId: user.managedProvinceId };
  }
  if (role === "ADMIN_BRANCH" && user.managedBranchId) {
    return { id: user.managedBranchId, isDeleted: false };
  }
  return { id: "none", isDeleted: false };
}

export function buildProvinceFilter(user: SessionUser) {
  const role = getPrimaryAdminRole(user.roles);

  if (role === "ADMINISTRATOR" || role === "ADMIN_PUSAT" || role === "ADMIN") {
    return { isDeleted: false };
  }
  if (role === "ADMIN_PROVINCE" && user.managedProvinceId) {
    return { id: user.managedProvinceId, isDeleted: false };
  }
  return { id: "none", isDeleted: false };
}

export function buildEventFilter(user: SessionUser) {
  const role = getPrimaryAdminRole(user.roles);

  if (role === "ADMINISTRATOR" || role === "ADMIN_PUSAT" || role === "ADMIN") {
    return { isDeleted: false };
  }
  if (role === "ADMIN_PROVINCE" && user.managedProvinceId) {
    return {
      isDeleted: false,
      branch: { provinceId: user.managedProvinceId, isDeleted: false },
    };
  }
  if (role === "ADMIN_BRANCH" && user.managedBranchId) {
    return { isDeleted: false, branchId: user.managedBranchId };
  }
  if (role === "ADMIN_DOJO") {
    const ids = dojoAllowlist(user);
    if (ids.length === 0) return { id: "none", isDeleted: false };
    return {
      isDeleted: false,
      branch: {
        isDeleted: false,
        dojos: { some: { id: { in: ids }, isDeleted: false } },
      },
    };
  }
  return { id: "none", isDeleted: false };
}

export function buildBillingFilter(user: SessionUser) {
  return { isDeleted: false, member: buildMemberFilter(user) };
}

export function buildVerificationFilter(user: SessionUser) {
  return { member: buildMemberFilter(user) };
}

export function buildAttendanceFilter(user: SessionUser) {
  return { isDeleted: false, member: buildMemberFilter(user) };
}

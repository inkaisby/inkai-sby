export const ADMIN_ROLES = [
  "ADMINISTRATOR",
  "ADMIN_PUSAT",
  "ADMIN_PROVINCE",
  "ADMIN_BRANCH",
  "ADMIN_DOJO",
  "ADMIN",
] as const;

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
  memberId?: string | null;
};

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
    case "ADMIN_DOJO":
      return "Dojo/Ranting";
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
      dojo: { branch: { provinceId: user.managedProvinceId, isDeleted: false } },
    };
  }
  if (role === "ADMIN_BRANCH" && user.managedBranchId) {
    return {
      ...deletedClause,
      dojo: { branchId: user.managedBranchId, isDeleted: false },
    };
  }
  if (role === "ADMIN_DOJO" && user.managedDojoId) {
    return { ...deletedClause, dojoId: user.managedDojoId };
  }
  if (user.memberId) {
    return { id: user.memberId, ...deletedClause };
  }
  return { id: "none", ...deletedClause };
}

export function buildDojoFilter(user: SessionUser) {
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
  if (role === "ADMIN_DOJO" && user.managedDojoId) {
    return { id: user.managedDojoId, isDeleted: false };
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
  if (role === "ADMIN_DOJO" && user.managedDojoId) {
    return {
      isDeleted: false,
      branch: {
        isDeleted: false,
        dojos: { some: { id: user.managedDojoId, isDeleted: false } },
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

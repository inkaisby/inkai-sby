import { Role } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  scopeProvinsiId?: string | null;
  scopeCabangId?: string | null;
  scopeDojoId?: string | null;
  anggotaId?: string | null;
};

export const ROLE_LABELS: Record<Role, string> = {
  PUSAT: "Administrator Pusat",
  PROVINSI: "Admin Provinsi",
  CABANG: "Admin Cabang",
  DOJO: "Admin Dojo/Ranting",
  ANGGOTA: "Anggota",
};

export function isAdmin(role: Role) {
  return role !== "ANGGOTA";
}

export function canAccessAdmin(user: SessionUser) {
  return isAdmin(user.role);
}

export function getAdminScopeLabel(user: SessionUser) {
  switch (user.role) {
    case "PUSAT":
      return "Seluruh Nasional";
    case "PROVINSI":
      return "Provinsi";
    case "CABANG":
      return "Cabang";
    case "DOJO":
      return "Dojo/Ranting";
    default:
      return "Anggota";
  }
}

export function buildAnggotaFilter(user: SessionUser) {
  switch (user.role) {
    case "PUSAT":
      return {};
    case "PROVINSI":
      return { dojo: { cabang: { provinsiId: user.scopeProvinsiId! } } };
    case "CABANG":
      return { dojo: { cabangId: user.scopeCabangId! } };
    case "DOJO":
      return { dojoId: user.scopeDojoId! };
    case "ANGGOTA":
      return { id: user.anggotaId! };
    default:
      return { id: "none" };
  }
}

export function buildDojoFilter(user: SessionUser) {
  switch (user.role) {
    case "PUSAT":
      return {};
    case "PROVINSI":
      return { cabang: { provinsiId: user.scopeProvinsiId! } };
    case "CABANG":
      return { cabangId: user.scopeCabangId! };
    case "DOJO":
      return { id: user.scopeDojoId! };
    default:
      return { id: "none" };
  }
}

export function buildCabangFilter(user: SessionUser) {
  switch (user.role) {
    case "PUSAT":
      return {};
    case "PROVINSI":
      return { provinsiId: user.scopeProvinsiId! };
    case "CABANG":
      return { id: user.scopeCabangId! };
    default:
      return { id: "none" };
  }
}

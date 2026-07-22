import { getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";
import { getWilayahMeta, persistWilayahMeta } from "@/lib/wilayah-accounts";
import type { NavItem } from "@/lib/dashboard-nav";
import { isNavGroup } from "@/lib/dashboard-nav";

export type AdminDojoGrants = {
  editProfile: boolean;
  crud: boolean;
  sidebarPaths: string[];
};

/** Menu sidebar yang bisa di-centang per admin ranting. */
export const ADMIN_DOJO_SIDEBAR_OPTIONS = [
  { path: "/admin", label: "Beranda Admin" },
  { path: "/admin/anggota", label: "Kelola Anggota" },
  { path: "/admin/verifikasi", label: "Verifikasi" },
  { path: "/admin/iuran", label: "Iuran Anggota" },
  { path: "/admin/ukt", label: "UKT — Pendaftaran" },
  { path: "/admin/ukt/arsip", label: "UKT — Arsip" },
  { path: "/admin/kegiatan", label: "Event & Kegiatan" },
  { path: "/admin/absensi", label: "Absensi" },
  { path: "/admin/materi", label: "Materi Digital" },
  { path: "/admin/store", label: "Store" },
  { path: "/admin/pesan", label: "Pesan" },
  { path: "/admin/notifikasi", label: "Notifikasi" },
  { path: "/admin/pengaturan", label: "Pengaturan" },
] as const;

export const DEFAULT_ADMIN_DOJO_SIDEBAR_PATHS = ADMIN_DOJO_SIDEBAR_OPTIONS.map(
  (o) => o.path,
);

export const DEFAULT_ADMIN_DOJO_GRANTS: AdminDojoGrants = {
  editProfile: true,
  crud: true,
  sidebarPaths: [...DEFAULT_ADMIN_DOJO_SIDEBAR_PATHS],
};

export const ADMIN_DOJO_GRANT_PRESETS = [
  {
    id: "ketua",
    label: "Ketua",
    grants: DEFAULT_ADMIN_DOJO_GRANTS,
  },
  {
    id: "sekretaris",
    label: "Sekretaris",
    grants: {
      editProfile: true,
      crud: false,
      sidebarPaths: [
        "/admin",
        "/admin/anggota",
        "/admin/verifikasi",
        "/admin/pesan",
        "/admin/notifikasi",
        "/admin/pengaturan",
      ],
    } satisfies AdminDojoGrants,
  },
  {
    id: "bendahara",
    label: "Bendahara",
    grants: {
      editProfile: true,
      crud: false,
      sidebarPaths: [
        "/admin",
        "/admin/iuran",
        "/admin/ukt",
        "/admin/notifikasi",
        "/admin/pengaturan",
      ],
    } satisfies AdminDojoGrants,
  },
] as const;

function normalizeSidebarPaths(paths: unknown): string[] {
  if (!Array.isArray(paths)) return [...DEFAULT_ADMIN_DOJO_SIDEBAR_PATHS];
  const allowed = new Set<string>(DEFAULT_ADMIN_DOJO_SIDEBAR_PATHS);
  const out: string[] = [];
  for (const p of paths) {
    if (typeof p === "string" && allowed.has(p) && !out.includes(p)) {
      out.push(p);
    }
  }
  return out.length ? out : ["/admin"];
}

export function parseAdminDojoGrants(raw: unknown): AdminDojoGrants | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  return {
    editProfile: v.editProfile !== false,
    crud: v.crud !== false,
    sidebarPaths: normalizeSidebarPaths(v.sidebarPaths),
  };
}

export function adminDojoGrantsFromInput(input?: Partial<AdminDojoGrants> | null): AdminDojoGrants {
  if (!input) return { ...DEFAULT_ADMIN_DOJO_GRANTS };
  return {
    editProfile: input.editProfile !== false,
    crud: input.crud !== false,
    sidebarPaths: normalizeSidebarPaths(input.sidebarPaths),
  };
}

export async function getAdminDojoGrants(
  dojoId: string,
  userId: string,
): Promise<AdminDojoGrants> {
  const meta = await getWilayahMeta("dojo", dojoId);
  const stored = meta.grantsByUserId?.[userId];
  return stored ? adminDojoGrantsFromInput(parseAdminDojoGrants(stored) ?? undefined) : { ...DEFAULT_ADMIN_DOJO_GRANTS };
}

export async function setAdminDojoGrants(
  dojoId: string,
  userId: string,
  grants: AdminDojoGrants,
) {
  const meta = await getWilayahMeta("dojo", dojoId);
  meta.grantsByUserId = {
    ...(meta.grantsByUserId ?? {}),
    [userId]: adminDojoGrantsFromInput(grants),
  };
  await persistWilayahMeta("dojo", dojoId, meta);
}

/** Grants untuk sesi admin ranting (primary managed dojo). Null jika bukan ADMIN_DOJO. */
export async function loadAdminDojoGrantsForUser(
  user: SessionUser,
): Promise<AdminDojoGrants | null> {
  if (getPrimaryAdminRole(user.roles) !== "ADMIN_DOJO") return null;
  const dojoId =
    user.managedDojoId ??
    (user.managedDojoIds && user.managedDojoIds.length > 0
      ? user.managedDojoIds[0]
      : null);
  if (!dojoId) return { ...DEFAULT_ADMIN_DOJO_GRANTS };
  return getAdminDojoGrants(dojoId, user.id);
}

export function isAdminPathAllowedByGrants(
  pathname: string,
  grants: AdminDojoGrants,
): boolean {
  const path = pathname.split("?")[0].replace(/\/$/, "") || "/admin";
  if (
    path === "/admin/pengaturan/akun" ||
    path.startsWith("/admin/pengaturan/akun/")
  ) {
    return true;
  }
  return grants.sidebarPaths.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
}

export function filterNavByAdminDojoGrants(
  items: NavItem[],
  grants: AdminDojoGrants,
): NavItem[] {
  const allowed = new Set(grants.sidebarPaths);
  const keep = (href: string) =>
    allowed.has(href) ||
    [...allowed].some((p) => href.startsWith(`${p}/`));

  return items
    .map((item) => {
      if (isNavGroup(item)) {
        const children = item.children.filter((c) => keep(c.href));
        if (!children.length) return null;
        return { ...item, children };
      }
      return keep(item.href) ? item : null;
    })
    .filter(Boolean) as NavItem[];
}

export function grantsAllowEditProfile(grants: AdminDojoGrants | null | undefined) {
  if (!grants) return true;
  return grants.editProfile;
}

export function grantsAllowCrud(grants: AdminDojoGrants | null | undefined) {
  if (!grants) return true;
  return grants.crud;
}

export function summarizeAdminDojoGrants(
  grants: AdminDojoGrants | null | undefined,
): {
  editProfile: boolean;
  crud: boolean;
  menuCount: number;
} {
  const normalized = adminDojoGrantsFromInput(grants ?? undefined);
  return {
    editProfile: normalized.editProfile,
    crud: normalized.crud,
    menuCount: normalized.sidebarPaths.length,
  };
}

const EDIT_PROFILE_ACTIONS = new Set([
  "set_documents",
  "set_dues",
  "set_dues_exemption",
]);

const CRUD_ACTIONS = new Set([
  "deactivate",
  "activate",
  "delete",
  "restore",
]);

export function adminDojoGrantBlocksMemberAction(
  grants: AdminDojoGrants | null | undefined,
  action: string,
): string | null {
  if (!grants) return null;
  if (EDIT_PROFILE_ACTIONS.has(action) && !grants.editProfile) {
    return "Akun admin ranting Anda tidak diizinkan mengedit profil anggota";
  }
  if (CRUD_ACTIONS.has(action) && !grants.crud) {
    return "Akun admin ranting Anda tidak diizinkan CRUD anggota";
  }
  return null;
}

import { getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";
import { getWilayahMeta, persistWilayahMeta } from "@/lib/wilayah-accounts";
import type { NavItem } from "@/lib/dashboard-nav";
import { isNavGroup } from "@/lib/dashboard-nav";

export type CrudPermission = {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
};

export type AdminDojoGrants = {
  editProfile: boolean;
  crud: boolean;
  sidebarPaths: string[];
  crudPermissions?: Record<string, CrudPermission>;
};

/** Menu sidebar yang bisa di-centang per admin wilayah/ranting. */
export const ADMIN_DOJO_SIDEBAR_OPTIONS = [
  { path: "/admin", label: "Beranda Admin" },
  { path: "/admin/anggota", label: "Kelola Anggota" },
  { path: "/admin/sekretaris", label: "Sekretariat & Persuratan" },
  { path: "/admin/verifikasi", label: "Verifikasi" },
  { path: "/admin/iuran", label: "Iuran Anggota" },
  { path: "/admin/kas", label: "Kas Keuangan" },
  { path: "/admin/kwitansi", label: "Kwitansi" },
  { path: "/admin/kwitansi/arsip", label: "Kwitansi — Arsip" },
  { path: "/admin/ukt", label: "UKT — Pendaftaran" },
  { path: "/admin/ukt/arsip", label: "UKT — Arsip" },
  { path: "/admin/latber", label: "Latihan Bersama — Pendaftaran" },
  { path: "/admin/latber/arsip", label: "Latihan Bersama — Arsip" },
  { path: "/admin/pertandingan", label: "Pertandingan — Roster & Pendaftaran" },
  { path: "/admin/pertandingan/kategori", label: "Pertandingan — Kategori Kelas" },
  { path: "/admin/kegiatan", label: "Event & Kegiatan" },
  { path: "/admin/absensi", label: "Absensi GPS & Scan QR" },
  { path: "/admin/laporan", label: "Laporan Custom & Generator Kolom" },
  { path: "/admin/materi", label: "Materi Digital" },
  { path: "/admin/artikel", label: "Artikel & Berita" },
  { path: "/admin/store", label: "Produk Store" },
  { path: "/admin/pesan", label: "Pesan Inbox" },
  { path: "/admin/notifikasi", label: "Notifikasi" },
  { path: "/admin/audit", label: "Log Audit Sistem" },
  { path: "/admin/pengaturan", label: "Pengaturan" },
] as const;

export const DEFAULT_ADMIN_DOJO_SIDEBAR_PATHS = ADMIN_DOJO_SIDEBAR_OPTIONS.map(
  (o) => o.path,
);

export const DEFAULT_ADMIN_DOJO_GRANTS: AdminDojoGrants = {
  editProfile: true,
  crud: true,
  sidebarPaths: [...DEFAULT_ADMIN_DOJO_SIDEBAR_PATHS],
  crudPermissions: {},
};

export const ADMIN_DOJO_GRANT_PRESETS = [
  {
    id: "full",
    label: "Full Access",
    grants: DEFAULT_ADMIN_DOJO_GRANTS,
  },
  {
    id: "readonly",
    label: "Hanya Lihat (Read-Only)",
    grants: {
      editProfile: false,
      crud: false,
      sidebarPaths: [...DEFAULT_ADMIN_DOJO_SIDEBAR_PATHS],
      crudPermissions: Object.fromEntries(
        DEFAULT_ADMIN_DOJO_SIDEBAR_PATHS.map((p) => [
          p,
          { read: true, create: false, update: false, delete: false },
        ]),
      ),
    } satisfies AdminDojoGrants,
  },
  {
    id: "keorganisasian",
    label: "Bidang Keorganisasian",
    grants: {
      editProfile: true,
      crud: true,
      sidebarPaths: [
        "/admin",
        "/admin/anggota",
        "/admin/verifikasi",
        "/admin/absensi",
        "/admin/notifikasi",
        "/admin/pengaturan",
      ],
      crudPermissions: Object.fromEntries(
        [
          "/admin",
          "/admin/anggota",
          "/admin/verifikasi",
          "/admin/absensi",
          "/admin/notifikasi",
          "/admin/pengaturan",
        ].map((p) => [p, { read: true, create: true, update: true, delete: false }]),
      ),
    } satisfies AdminDojoGrants,
  },
  {
    id: "keuangan",
    label: "Bidang Keuangan",
    grants: {
      editProfile: true,
      crud: false,
      sidebarPaths: [
        "/admin",
        "/admin/iuran",
        "/admin/kas",
        "/admin/kwitansi",
        "/admin/kwitansi/arsip",
        "/admin/ukt",
        "/admin/latber",
        "/admin/laporan",
        "/admin/notifikasi",
        "/admin/pengaturan",
      ],
      crudPermissions: Object.fromEntries(
        [
          "/admin",
          "/admin/iuran",
          "/admin/kas",
          "/admin/kwitansi",
          "/admin/kwitansi/arsip",
          "/admin/ukt",
          "/admin/latber",
          "/admin/laporan",
          "/admin/notifikasi",
          "/admin/pengaturan",
        ].map((p) => [p, { read: true, create: true, update: true, delete: false }]),
      ),
    } satisfies AdminDojoGrants,
  },
  {
    id: "sekretariat",
    label: "Bidang Sekretariat",
    grants: {
      editProfile: true,
      crud: false,
      sidebarPaths: [
        "/admin",
        "/admin/sekretaris",
        "/admin/materi",
        "/admin/artikel",
        "/admin/pesan",
        "/admin/notifikasi",
      ],
      crudPermissions: Object.fromEntries(
        [
          "/admin",
          "/admin/sekretaris",
          "/admin/materi",
          "/admin/artikel",
          "/admin/pesan",
          "/admin/notifikasi",
        ].map((p) => [p, { read: true, create: true, update: true, delete: false }]),
      ),
    } satisfies AdminDojoGrants,
  },
  {
    id: "pertandingan",
    label: "Bidang Kejuaraan & UKT",
    grants: {
      editProfile: true,
      crud: true,
      sidebarPaths: [
        "/admin",
        "/admin/ukt",
        "/admin/latber",
        "/admin/pertandingan",
        "/admin/pertandingan/kategori",
        "/admin/kegiatan",
        "/admin/laporan",
      ],
      crudPermissions: Object.fromEntries(
        [
          "/admin",
          "/admin/ukt",
          "/admin/latber",
          "/admin/pertandingan",
          "/admin/pertandingan/kategori",
          "/admin/kegiatan",
          "/admin/laporan",
        ].map((p) => [p, { read: true, create: true, update: true, delete: true }]),
      ),
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

function normalizeCrudPermissions(
  rawPerms: unknown,
): Record<string, CrudPermission> {
  if (!rawPerms || typeof rawPerms !== "object") return {};
  const map = rawPerms as Record<string, unknown>;
  const out: Record<string, CrudPermission> = {};
  for (const [path, val] of Object.entries(map)) {
    if (val && typeof val === "object") {
      const v = val as Record<string, unknown>;
      out[path] = {
        read: v.read !== false,
        create: Boolean(v.create),
        update: Boolean(v.update),
        delete: Boolean(v.delete),
      };
    }
  }
  return out;
}

export function parseAdminDojoGrants(raw: unknown): AdminDojoGrants | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  return {
    editProfile: v.editProfile !== false,
    crud: v.crud !== false,
    sidebarPaths: normalizeSidebarPaths(v.sidebarPaths),
    crudPermissions: normalizeCrudPermissions(v.crudPermissions),
  };
}

export function adminDojoGrantsFromInput(
  input?: Partial<AdminDojoGrants> | Record<string, any> | null,
): AdminDojoGrants {
  if (!input) return { ...DEFAULT_ADMIN_DOJO_GRANTS };
  return {
    editProfile: input.editProfile !== false,
    crud: input.crud !== false,
    sidebarPaths: normalizeSidebarPaths(input.sidebarPaths),
    crudPermissions: normalizeCrudPermissions(input.crudPermissions),
  };
}

export async function getAdminDojoGrants(
  dojoId: string,
  userId: string,
): Promise<AdminDojoGrants> {
  const meta = await getWilayahMeta("dojo", dojoId);
  const stored = meta.grantsByUserId?.[userId];
  return stored
    ? adminDojoGrantsFromInput(parseAdminDojoGrants(stored) ?? undefined)
    : { ...DEFAULT_ADMIN_DOJO_GRANTS };
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

/** Grants untuk sesi admin ranting/cabang. Null jika bukan admin. */
export async function loadAdminDojoGrantsForUser(
  user: SessionUser,
): Promise<AdminDojoGrants | null> {
  const role = getPrimaryAdminRole(user.roles);
  if (role === "ADMINISTRATOR" || role === "ADMIN_PUSAT") return null;

  const wilayahId =
    role === "ADMIN_BRANCH"
      ? user.managedBranchId
      : user.managedDojoId ?? user.managedDojoIds?.[0];

  if (!wilayahId) return { ...DEFAULT_ADMIN_DOJO_GRANTS };
  const scope = role === "ADMIN_BRANCH" ? "branch" : "dojo";
  const meta = await getWilayahMeta(scope, wilayahId);
  const stored = meta.grantsByUserId?.[user.id];
  return stored
    ? adminDojoGrantsFromInput(parseAdminDojoGrants(stored) ?? undefined)
    : { ...DEFAULT_ADMIN_DOJO_GRANTS };
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
    allowed.has(href) || [...allowed].some((p) => href.startsWith(`${p}/`));

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

export function getModuleCrudPermission(
  grants: AdminDojoGrants | null | undefined,
  modulePath: string,
): CrudPermission {
  if (!grants) {
    return { read: true, create: true, update: true, delete: true };
  }
  const isEnabled = grants.sidebarPaths.includes(modulePath);
  if (!isEnabled) {
    return { read: false, create: false, update: false, delete: false };
  }
  const explicit = grants.crudPermissions?.[modulePath];
  if (explicit) {
    return explicit;
  }
  return {
    read: true,
    create: grants.crud,
    update: grants.crud,
    delete: grants.crud,
  };
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
  "set_photo",
  "set_dues",
  "set_dues_exemption",
  "set_msh",
  "set_name",
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
    return "Akun pengurus Anda tidak diizinkan mengedit profil anggota";
  }
  if (CRUD_ACTIONS.has(action) && !grants.crud) {
    return "Akun pengurus Anda tidak diizinkan CRUD anggota";
  }
  return null;
}

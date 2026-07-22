import { getPrimaryAdminRole } from "@/lib/rbac";

/** Prefix paths yang boleh diakses per role (ADMIN_DOJO lebih ketat). */
const DOJO_ALLOWED_PREFIXES = [
  "/admin",
  "/admin/anggota",
  "/admin/iuran",
  "/admin/ukt",
  "/admin/verifikasi",
  "/admin/kegiatan",
  "/admin/materi",
  "/admin/store",
  "/admin/pesan",
  "/admin/absensi",
  "/admin/notifikasi",
  "/admin/pengaturan",
];

const DOJO_BLOCKED_EXACT = new Set([
  "/admin/organisasi",
  "/admin/carousel",
  "/admin/audit",
  "/admin/online",
]);

const DOJO_BLOCKED_PENGATURAN_CHILDREN = [
  "/admin/pengaturan/user",
  "/admin/pengaturan/cabang",
  "/admin/pengaturan/peran",
  "/admin/pengaturan/geofencing",
  "/admin/pengaturan/kebijakan",
  "/admin/pengaturan/ukt",
];

export function canAccessAdminPath(roles: string[], pathname: string): boolean {
  const role = getPrimaryAdminRole(roles);
  const path = pathname.split("?")[0].replace(/\/$/, "") || "/admin";

  if (role !== "ADMIN_DOJO") return true;

  if (DOJO_BLOCKED_EXACT.has(path)) return false;
  if (DOJO_BLOCKED_PENGATURAN_CHILDREN.some((p) => path === p || path.startsWith(`${p}/`))) {
    return false;
  }

  // Ranting/akun lama diarahkan ke hub; tetap boleh diload (redirect di page)
  if (
    path === "/admin/pengaturan/ranting" ||
    path.startsWith("/admin/pengaturan/ranting/") ||
    path === "/admin/pengaturan/akun" ||
    path.startsWith("/admin/pengaturan/akun/")
  ) {
    return true;
  }

  if (path === "/admin") return true;

  return DOJO_ALLOWED_PREFIXES.some(
    (prefix) =>
      prefix !== "/admin" &&
      (path === prefix || path.startsWith(`${prefix}/`)),
  );
}

export function adminFallbackPath(roles: string[]): string {
  const role = getPrimaryAdminRole(roles);
  if (role === "ADMIN_DOJO") return "/admin/pengaturan";
  return "/admin";
}

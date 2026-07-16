import { getPrimaryAdminRole } from "@/lib/rbac";

/** Prefix paths yang boleh diakses per role (ADMIN_DOJO lebih ketat). */
const DOJO_ALLOWED_PREFIXES = [
  "/admin",
  "/admin/anggota",
  "/admin/iuran",
  "/admin/ukt",
  "/admin/verifikasi",
  "/admin/kegiatan",
  "/admin/absensi",
  "/admin/notifikasi",
  "/admin/pengaturan/ranting",
  "/admin/pengaturan/akun",
];

const DOJO_BLOCKED_EXACT = new Set([
  "/admin/pengaturan",
  "/admin/organisasi",
  "/admin/carousel",
  "/admin/audit",
]);

export function canAccessAdminPath(roles: string[], pathname: string): boolean {
  const role = getPrimaryAdminRole(roles);
  const path = pathname.split("?")[0].replace(/\/$/, "") || "/admin";

  if (role !== "ADMIN_DOJO") return true;

  if (DOJO_BLOCKED_EXACT.has(path)) return false;

  // Exact /admin home is allowed
  if (path === "/admin") return true;

  return DOJO_ALLOWED_PREFIXES.some(
    (prefix) =>
      prefix !== "/admin" &&
      (path === prefix || path.startsWith(`${prefix}/`)),
  );
}

export function adminFallbackPath(roles: string[]): string {
  const role = getPrimaryAdminRole(roles);
  if (role === "ADMIN_DOJO") return "/admin/pengaturan/ranting";
  return "/admin";
}

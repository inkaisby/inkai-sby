import { isAdmin } from "@/lib/rbac";

const ADMIN_TO_MEMBER: Record<string, string> = {
  "/admin": "/dashboard",
  "/admin/anggota": "/dashboard/profil",
  "/admin/iuran": "/dashboard/iuran",
  "/admin/ukt": "/dashboard/prestasi",
  "/admin/kegiatan": "/dashboard/kegiatan",
  "/admin/absensi": "/dashboard/absensi",
  "/admin/notifikasi": "/dashboard/notifikasi",
};

const MEMBER_TO_ADMIN: Record<string, string> = {
  "/dashboard": "/admin",
  "/dashboard/profil": "/admin/anggota",
  "/dashboard/iuran": "/admin/iuran",
  "/dashboard/prestasi": "/admin/ukt",
  "/dashboard/kegiatan": "/admin/kegiatan",
  "/dashboard/absensi": "/admin/absensi",
  "/dashboard/notifikasi": "/admin/notifikasi",
  "/dashboard/dokumen": "/admin",
};

function longestPrefixMatch(pathname: string, map: Record<string, string>): string | null {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (pathname === key || pathname.startsWith(`${key}/`)) {
      return map[key];
    }
  }
  return null;
}

/** Keep the user on an equivalent page after switching accounts (e.g. cabang UKT → ranting UKT). */
export function resolvePageForNewAccount(pathname: string, roles: string[]): string {
  const userIsAdmin = isAdmin(roles);

  if (pathname.startsWith("/admin")) {
    if (!userIsAdmin) {
      return longestPrefixMatch(pathname, ADMIN_TO_MEMBER) ?? "/dashboard";
    }
    return pathname;
  }

  if (pathname.startsWith("/dashboard")) {
    if (userIsAdmin) {
      return longestPrefixMatch(pathname, MEMBER_TO_ADMIN) ?? "/admin";
    }
    return pathname;
  }

  return userIsAdmin ? "/admin" : "/dashboard";
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MobileDashboardNav } from "@/components/layout/MobileDashboardNav";
import { UserMenu } from "@/components/layout/AppShell";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useNavigation } from "@/components/layout/NavigationProvider";
import { ThemeToggle } from "@/components/theme-toggle";
import type { NavItem } from "@/lib/dashboard-nav";

const ADMIN_TITLES: Record<string, string> = {
  "/admin": "Beranda Admin",
  "/admin/anggota": "Kelola Anggota",
  "/admin/iuran": "Iuran Anggota",
  "/admin/ukt": "Ujian Kenaikan Tingkat",
  "/admin/organisasi": "Organisasi",
  "/admin/verifikasi": "Verifikasi",
  "/admin/kegiatan": "Event & Kegiatan",
  "/admin/absensi": "Absensi",
  "/admin/carousel": "Carousel Beranda",
  "/admin/audit": "Log Audit",
  "/admin/notifikasi": "Notifikasi",
  "/admin/pengaturan": "Pengaturan",
  "/admin/pengaturan/user": "Pengaturan Ranting & User",
  "/admin/pengaturan/cabang": "Pengaturan Cabang",
  "/admin/pengaturan/ranting": "Pengaturan Ranting & User",
  "/admin/pengaturan/peran": "Role & Hak Akses",
  "/admin/pengaturan/geofencing": "Geofencing Absensi",
  "/admin/pengaturan/akun": "Akun Saya",
};

const MEMBER_TITLES: Record<string, string> = {
  "/dashboard": "Beranda",
  "/dashboard/profil": "Profil Saya",
  "/dashboard/absensi": "Absensi",
  "/dashboard/iuran": "Iuran",
  "/dashboard/kegiatan": "Kegiatan Saya",
  "/dashboard/prestasi": "Prestasi & Sabuk",
  "/dashboard/dokumen": "Dokumen",
  "/dashboard/notifikasi": "Notifikasi",
};

function resolveTitle(pathname: string, showAdmin: boolean) {
  const map = showAdmin ? ADMIN_TITLES : MEMBER_TITLES;
  if (map[pathname]) return map[pathname];
  const match = Object.keys(map)
    .filter((k) => k !== (showAdmin ? "/admin" : "/dashboard"))
    .sort((a, b) => b.length - a.length)
    .find((k) => pathname.startsWith(k));
  return match ? map[match] : showAdmin ? "Admin Panel" : "Dashboard Anggota";
}

/** Parent path for admin back: `/admin` → `/`; `/admin/pengaturan/ranting` → `/admin/pengaturan`. */
function resolveAdminBackHref(pathname: string): string {
  if (!pathname.startsWith("/admin") || pathname === "/admin") return "/";
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return "/admin";
  segments.pop();
  return `/${segments.join("/")}`;
}

export function DashboardTopbar({
  title,
  links,
  userName,
  userEmail,
  showAdmin = false,
}: {
  title: string;
  links: NavItem[];
  userName: string;
  userEmail: string;
  showAdmin?: boolean;
}) {
  const pathname = usePathname();
  const { startNavigation } = useNavigation();
  const pageTitle = resolveTitle(pathname, showAdmin);
  const notificationsHref = showAdmin ? "/admin/notifikasi" : "/dashboard/notifikasi";
  const backHref = showAdmin ? resolveAdminBackHref(pathname) : null;

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <MobileDashboardNav title={title} links={links} />
        {backHref ? (
          <Link
            href={backHref}
            prefetch={backHref.startsWith("/admin")}
            onClick={() => {
              if (backHref.startsWith("/admin")) startNavigation(backHref);
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/80 text-foreground transition-colors hover:bg-muted"
            aria-label="Kembali"
          >
            <ArrowLeft size={18} />
          </Link>
        ) : null}
        <h1 className="truncate text-base font-bold sm:text-lg">{pageTitle}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <NotificationBell viewAllHref={notificationsHref} />
        <ThemeToggle />
        <UserMenu name={userName} email={userEmail} showAdmin={showAdmin} />
      </div>
    </header>
  );
}

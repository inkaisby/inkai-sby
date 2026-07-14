"use client";

import { usePathname } from "next/navigation";
import { MobileDashboardNav } from "@/components/layout/MobileDashboardNav";
import { UserMenu } from "@/components/layout/AppShell";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { ThemeToggle } from "@/components/theme-toggle";

const ADMIN_TITLES: Record<string, string> = {
  "/admin": "Beranda Admin",
  "/admin/anggota": "Kelola Anggota",
  "/admin/iuran": "Iuran Anggota",
  "/admin/organisasi": "Organisasi",
  "/admin/verifikasi": "Verifikasi",
  "/admin/kegiatan": "Event & Kegiatan",
  "/admin/absensi": "Absensi",
  "/admin/carousel": "Carousel Beranda",
  "/admin/audit": "Log Audit",
  "/admin/notifikasi": "Notifikasi",
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
    .find((k) => pathname.startsWith(k));
  return match ? map[match] : showAdmin ? "Admin Panel" : "Dashboard Anggota";
}

export function DashboardTopbar({
  title,
  links,
  userName,
  userEmail,
  showAdmin = false,
}: {
  title: string;
  links: { href: string; label: string }[];
  userName: string;
  userEmail: string;
  showAdmin?: boolean;
}) {
  const pathname = usePathname();
  const pageTitle = resolveTitle(pathname, showAdmin);
  const notificationsHref = showAdmin ? "/admin/notifikasi" : "/dashboard/notifikasi";

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <MobileDashboardNav title={title} links={links} />
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

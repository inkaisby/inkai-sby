"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavLink = { href: string; label: string; active?: boolean };

export function MobileDashboardNav({
  title,
  links,
}: {
  title: string;
  links: NavLink[];
}) {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 lg:hidden">
          <Menu className="h-4 w-4" />
          Menu
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetTitle className="text-base font-bold">{title}</SheetTitle>
        <nav className="mt-6 flex flex-col gap-1">
          {links.map((link) => {
            const isActive =
              link.active ??
              (pathname === link.href ||
                (link.href !== "/dashboard" &&
                  link.href !== "/admin" &&
                  pathname.startsWith(link.href)));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive
                    ? "bg-inkai-red text-white"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export const ADMIN_LINKS = [
  { href: "/admin", label: "Beranda Admin" },
  { href: "/admin/anggota", label: "Kelola Anggota" },
  { href: "/admin/iuran", label: "Iuran Anggota" },
  { href: "/admin/ukt", label: "UKT" },
  { href: "/admin/organisasi", label: "Organisasi" },
  { href: "/admin/verifikasi", label: "Verifikasi" },
  { href: "/admin/kegiatan", label: "Event & Kegiatan" },
  { href: "/admin/absensi", label: "Absensi" },
  { href: "/admin/carousel", label: "Carousel Beranda" },
  { href: "/admin/audit", label: "Log Audit" },
];

export const MEMBER_LINKS = [
  { href: "/dashboard", label: "Beranda" },
  { href: "/dashboard/profil", label: "Profil Saya" },
  { href: "/dashboard/absensi", label: "Absensi" },
  { href: "/dashboard/iuran", label: "Iuran" },
  { href: "/dashboard/kegiatan", label: "Kegiatan Saya" },
  { href: "/dashboard/prestasi", label: "Prestasi & Sabuk" },
  { href: "/dashboard/dokumen", label: "Dokumen" },
  { href: "/dashboard/notifikasi", label: "Notifikasi" },
];

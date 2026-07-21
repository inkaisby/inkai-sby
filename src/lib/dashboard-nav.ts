import { getPrimaryAdminRole } from "@/lib/rbac";
import { buildDefaultUktAdminUrl } from "@/lib/ukt";

export type NavLink = {
  href: string;
  label: string;
  badge?: number;
};

export type NavGroup = {
  label: string;
  children: NavLink[];
};

export type NavItem = NavLink | NavGroup;

export function isNavGroup(item: NavItem): item is NavGroup {
  return "children" in item && Array.isArray(item.children);
}

export function flattenNavLinks(items: NavItem[]): NavLink[] {
  return items.flatMap((item) => (isNavGroup(item) ? item.children : [item]));
}

/** Tempel badge angka ke href tertentu (mis. unread pesan). */
export function applyNavBadges(
  items: NavItem[],
  badges: Record<string, number>,
): NavItem[] {
  return items.map((item) => {
    if (isNavGroup(item)) {
      return {
        ...item,
        children: item.children.map((c) => ({
          ...c,
          badge: badges[c.href] || undefined,
        })),
      };
    }
    return { ...item, badge: badges[item.href] || undefined };
  });
}

function withFreshUktHref(items: NavItem[]): NavItem[] {
  const uktHref = buildDefaultUktAdminUrl();
  return items.map((item) => {
    if (isNavGroup(item)) {
      return {
        ...item,
        children: item.children.map((c) =>
          c.label === "Pendaftaran" && c.href.startsWith("/admin/ukt")
            ? { ...c, href: uktHref }
            : c,
        ),
      };
    }
    return item;
  });
}

const UKT_NAV_GROUP: NavGroup = {
  label: "UKT",
  children: [
    { href: "/admin/ukt", label: "Pendaftaran" },
    { href: "/admin/ukt/arsip", label: "Arsip UKT" },
  ],
};

export const ADMIN_LINKS: NavItem[] = [
  { href: "/admin", label: "Beranda Admin" },
  {
    label: "Keanggotaan",
    children: [
      { href: "/admin/anggota", label: "Kelola Anggota" },
      { href: "/admin/verifikasi", label: "Verifikasi" },
      { href: "/admin/organisasi", label: "Organisasi" },
    ],
  },
  { href: "/admin/iuran", label: "Iuran Anggota" },
  UKT_NAV_GROUP,
  { href: "/admin/kegiatan", label: "Event & Kegiatan" },
  { href: "/admin/absensi", label: "Absensi" },
  {
    label: "Konten & Layanan",
    children: [
      { href: "/admin/materi", label: "Materi Digital" },
      { href: "/admin/store", label: "Store" },
      { href: "/admin/pesan", label: "Pesan" },
      { href: "/admin/carousel", label: "Carousel Beranda" },
      { href: "/admin/notifikasi", label: "Notifikasi" },
    ],
  },
  {
    label: "Sistem",
    children: [
      { href: "/admin/audit", label: "Log Audit" },
      { href: "/admin/pengaturan", label: "Ringkasan Pengaturan" },
      { href: "/admin/pengaturan/cabang", label: "Pengaturan Cabang" },
      { href: "/admin/pengaturan/ranting", label: "Pengaturan Ranting & User" },
      { href: "/admin/pengaturan/kebijakan", label: "Profil & Kebijakan" },
      { href: "/admin/pengaturan/ukt", label: "Pengaturan UKT" },
      { href: "/admin/pengaturan/peran", label: "Role & Hak Akses" },
      { href: "/admin/pengaturan/geofencing", label: "Geofencing Absensi" },
      { href: "/admin/pengaturan/akun", label: "Akun Saya" },
    ],
  },
];

/** Sidebar links filtered by admin role. */
export function getAdminNavLinks(roles: string[]): NavItem[] {
  const role = getPrimaryAdminRole(roles);

  if (role !== "ADMIN_DOJO") return withFreshUktHref(ADMIN_LINKS);

  // Ranting: tanpa organisasi/carousel/audit/sistem cabang
  return withFreshUktHref([
    { href: "/admin", label: "Beranda Admin" },
    {
      label: "Keanggotaan",
      children: [
        { href: "/admin/anggota", label: "Kelola Anggota" },
        { href: "/admin/verifikasi", label: "Verifikasi" },
      ],
    },
    { href: "/admin/iuran", label: "Iuran Anggota" },
    UKT_NAV_GROUP,
    { href: "/admin/kegiatan", label: "Event & Kegiatan" },
    { href: "/admin/absensi", label: "Absensi" },
    {
      label: "Konten & Layanan",
      children: [
        { href: "/admin/materi", label: "Materi Digital" },
        { href: "/admin/store", label: "Store" },
        { href: "/admin/pesan", label: "Pesan" },
        { href: "/admin/notifikasi", label: "Notifikasi" },
      ],
    },
    { href: "/admin/pengaturan", label: "Pengaturan" },
  ]);
}

export const MEMBER_LINKS: NavItem[] = [
  { href: "/dashboard", label: "Beranda" },
  { href: "/dashboard/profil", label: "Profil Saya" },
  { href: "/dashboard/absensi", label: "Absensi" },
  { href: "/dashboard/iuran", label: "Iuran" },
  { href: "/dashboard/kegiatan", label: "Kegiatan Saya" },
  { href: "/dashboard/prestasi", label: "Prestasi & Sabuk" },
  { href: "/dashboard/materi", label: "Materi Digital" },
  { href: "/dashboard/store", label: "Store" },
  { href: "/dashboard/pesan", label: "Pesan" },
  { href: "/dashboard/pindah", label: "Pindah Dojo" },
  { href: "/dashboard/dokumen", label: "Dokumen" },
  { href: "/dashboard/notifikasi", label: "Notifikasi" },
];

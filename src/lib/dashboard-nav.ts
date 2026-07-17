import { getPrimaryAdminRole } from "@/lib/rbac";

export type NavLink = {
  href: string;
  label: string;
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

export const ADMIN_LINKS: NavItem[] = [
  { href: "/admin", label: "Beranda Admin" },
  { href: "/admin/anggota", label: "Kelola Anggota" },
  { href: "/admin/iuran", label: "Iuran Anggota" },
  { href: "/admin/ukt", label: "UKT" },
  { href: "/admin/organisasi", label: "Organisasi" },
  { href: "/admin/verifikasi", label: "Verifikasi" },
  { href: "/admin/kegiatan", label: "Event & Kegiatan" },
  { href: "/admin/materi", label: "Materi Digital" },
  { href: "/admin/store", label: "Store" },
  { href: "/admin/pesan", label: "Pesan" },
  { href: "/admin/absensi", label: "Absensi" },
  { href: "/admin/carousel", label: "Carousel Beranda" },
  { href: "/admin/audit", label: "Log Audit" },
  {
    label: "Pengaturan",
    children: [
      { href: "/admin/pengaturan", label: "Ringkasan" },
      { href: "/admin/pengaturan/user", label: "Pengaturan User" },
      { href: "/admin/pengaturan/cabang", label: "Pengaturan Cabang" },
      { href: "/admin/pengaturan/ranting", label: "Pengaturan Ranting" },
      { href: "/admin/pengaturan/peran", label: "Role & Hak Akses" },
      { href: "/admin/pengaturan/geofencing", label: "Geofencing Absensi" },
      { href: "/admin/pengaturan/akun", label: "Akun Saya" },
    ],
  },
];

/** Sidebar links filtered by admin role. */
export function getAdminNavLinks(roles: string[]): NavItem[] {
  const role = getPrimaryAdminRole(roles);

  if (role !== "ADMIN_DOJO") return ADMIN_LINKS;

  // Ranting: satu menu Pengaturan (data ranting + akun digabung)
  return [
    { href: "/admin", label: "Beranda Admin" },
    { href: "/admin/anggota", label: "Kelola Anggota" },
    { href: "/admin/iuran", label: "Iuran Anggota" },
    { href: "/admin/ukt", label: "UKT" },
    { href: "/admin/verifikasi", label: "Verifikasi" },
    { href: "/admin/kegiatan", label: "Event & Kegiatan" },
    { href: "/admin/materi", label: "Materi Digital" },
    { href: "/admin/store", label: "Store" },
    { href: "/admin/pesan", label: "Pesan" },
    { href: "/admin/absensi", label: "Absensi" },
    { href: "/admin/pengaturan", label: "Pengaturan" },
  ];
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

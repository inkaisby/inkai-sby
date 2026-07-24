export const publicNavLinks = [
  { href: "/", label: "Beranda", matchPrefix: false },
  { href: "/tutorial", label: "Tutorial", matchPrefix: false },
  { href: "/sejarah", label: "Sejarah", matchPrefix: false },
  { href: "/struktur", label: "Struktur", matchPrefix: false },
  { href: "/dojo", label: "Dojo / Ranting", matchPrefix: true },
  { href: "/kegiatan", label: "Kegiatan", matchPrefix: false },
  { href: "/apresiasi", label: "Apresiasi", matchPrefix: false },
  { href: "/kontak", label: "Kontak", matchPrefix: false },
] as const;

export function isPublicNavActive(
  pathname: string,
  href: string,
  matchPrefix: boolean,
): boolean {
  if (matchPrefix) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return pathname === href;
}

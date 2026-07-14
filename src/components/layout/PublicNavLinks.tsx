"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "Beranda" },
  { href: "/sejarah", label: "Sejarah" },
  { href: "/struktur", label: "Struktur" },
  { href: "/kegiatan", label: "Kegiatan" },
  { href: "/berita", label: "Berita" },
  { href: "/kontak", label: "Kontak" },
];

export default function PublicNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-0.5 lg:flex">
      {navLinks.map((link) => {
        const active = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors hover:bg-inkai-red/5 hover:text-inkai-red ${
              active
                ? "bg-inkai-red/5 text-inkai-red"
                : "text-foreground/70"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

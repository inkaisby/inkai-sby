import Link from "next/link";

const navLinks = [
  { href: "#beranda", label: "Beranda" },
  { href: "#tentang", label: "Tentang" },
  { href: "#layanan", label: "Layanan" },
  { href: "#kontak", label: "Kontak" },
];

export default function Header() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-white">
          Inkai<span className="text-accent">SBY</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-zinc-300 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <a
          href="#kontak"
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90"
        >
          Hubungi Kami
        </a>
      </div>
    </header>
  );
}

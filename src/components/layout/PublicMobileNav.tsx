"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { PublicHeaderAuthMobile } from "@/components/layout/PublicHeaderAuth";

const navLinks = [
  { href: "/", label: "Beranda" },
  { href: "/sejarah", label: "Sejarah" },
  { href: "/struktur", label: "Struktur" },
  { href: "/kegiatan", label: "Kegiatan" },
  { href: "/berita", label: "Berita" },
  { href: "/kontak", label: "Kontak" },
];

export default function PublicMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild className="lg:hidden">
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
        <nav className="mt-8 flex flex-col gap-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch
              onClick={() => setOpen(false)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted ${
                pathname === link.href ? "bg-inkai-red/5 text-inkai-red" : ""
              }`}
            >
              {link.label}
            </Link>
          ))}
          <hr className="my-2" />
          <PublicHeaderAuthMobile />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

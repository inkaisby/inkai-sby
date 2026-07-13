import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { canAccessAdmin } from "@/lib/rbac";

const navLinks = [
  { href: "/", label: "Beranda" },
  { href: "/sejarah", label: "Sejarah" },
  { href: "/makna-lambang", label: "Makna Lambang" },
  { href: "/struktur", label: "Struktur Organisasi" },
  { href: "/visi-misi", label: "Visi & Misi" },
];

export default async function PublicHeader() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo-inkai.png"
            alt="Logo INKAI"
            width={44}
            height={44}
            className="rounded-full"
          />
          <div className="hidden sm:block">
            <p className="text-sm font-bold leading-tight text-inkai-black">
              INKAI Surabaya
            </p>
            <p className="text-xs text-muted-foreground">
              Institut Karate-Do Indonesia
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-inkai-red/5 hover:text-inkai-red"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {session ? (
            <>
              {canAccessAdmin(session.user) ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin">Admin</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              )}
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Masuk</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-inkai-red hover:bg-inkai-red/90 text-white"
              >
                <Link href="/daftar">Daftar</Link>
              </Button>
            </>
          )}
        </div>

        <Sheet>
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
                  className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  {link.label}
                </Link>
              ))}
              <hr className="my-2" />
              {session ? (
                <Link
                  href={canAccessAdmin(session.user) ? "/admin" : "/dashboard"}
                  className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  {canAccessAdmin(session.user) ? "Admin" : "Dashboard"}
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    Masuk
                  </Link>
                  <Link
                    href="/daftar"
                    className="rounded-lg bg-inkai-red px-3 py-2 text-sm font-medium text-white"
                  >
                    Daftar
                  </Link>
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

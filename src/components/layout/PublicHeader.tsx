import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";
import PublicNavLinks from "@/components/layout/PublicNavLinks";
import PublicMobileNav from "@/components/layout/PublicMobileNav";
import { PublicHeaderAuthDesktop } from "@/components/layout/PublicHeaderAuth";

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 shadow-sm shadow-black/[0.03] backdrop-blur-lg supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" prefetch className="group flex items-center gap-3">
          <Image
            src="/logo-inkai.png"
            alt="Logo INKAI"
            width={44}
            height={44}
            className="rounded-full ring-2 ring-transparent transition-all group-hover:ring-inkai-red/20"
            priority
          />
          <div className="hidden sm:block">
            <p className="text-sm font-bold leading-tight tracking-tight text-foreground">
              INKAI Surabaya
            </p>
            <p className="text-xs text-muted-foreground">
              Institut Karate-Do Indonesia
            </p>
          </div>
        </Link>

        <PublicNavLinks />

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <PublicHeaderAuthDesktop />
          <PublicMobileNav />
        </div>
      </div>
    </header>
  );
}

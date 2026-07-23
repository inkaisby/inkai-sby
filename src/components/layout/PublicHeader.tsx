import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";
import PublicNavLinks from "@/components/layout/PublicNavLinks";
import PublicMobileNav from "@/components/layout/PublicMobileNav";
import { PublicHeaderAuthDesktop } from "@/components/layout/PublicHeaderAuth";

export default function PublicHeader() {
  return (
    <header className="public-topbar sticky top-0 z-50 border-b border-border/50 bg-background/75 shadow-sm shadow-black/[0.04] backdrop-blur-xl supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <Link href="/" prefetch className="group flex min-w-0 items-center gap-2.5 sm:gap-3">
          <Image
            src="/logo-inkai.png"
            alt="Logo INKAI"
            width={44}
            height={44}
            className="size-9 rounded-full shadow-sm ring-2 ring-inkai-red/10 transition-all group-hover:ring-inkai-red/25 sm:size-11"
            priority
          />
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold leading-tight tracking-tight text-foreground">
              INKAI Surabaya
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              Institut Karate-Do Indonesia
            </p>
          </div>
        </Link>

        <PublicNavLinks />

        <div className="flex shrink-0 items-center gap-0.5 rounded-xl bg-muted/35 p-0.5 ring-1 ring-black/[0.03] dark:ring-white/5 sm:gap-1">
          <ThemeToggle />
          <PublicHeaderAuthDesktop />
          <PublicMobileNav />
        </div>
      </div>
    </header>
  );
}

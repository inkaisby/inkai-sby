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
import { isPublicNavActive, publicNavLinks } from "@/lib/public-nav";

export default function PublicMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild className="lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Menu navigasi"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[min(18rem,88vw)] border-border/60 bg-background/95 backdrop-blur-xl"
      >
        <SheetTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span
            className="h-5 w-1 rounded-full bg-gradient-to-b from-inkai-red to-inkai-yellow/80"
            aria-hidden
          />
          Menu
        </SheetTitle>
        <nav className="mt-6 flex flex-col gap-1">
          {publicNavLinks.map((link) => {
            const active = isPublicNavActive(
              pathname,
              link.href,
              link.matchPrefix,
            );
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch
                onClick={() => setOpen(false)}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-inkai-red text-white shadow-md shadow-inkai-red/20"
                    : "text-foreground/80 hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <hr className="my-3 border-border/60" />
          <PublicHeaderAuthMobile onLoginClick={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

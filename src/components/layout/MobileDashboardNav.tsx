"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { SidebarNavLink } from "@/components/layout/SidebarNavLink";
import { SidebarNavGroup } from "@/components/layout/SidebarNavGroup";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isNavGroup, type NavItem } from "@/lib/dashboard-nav";

export function MobileDashboardNav({
  title,
  links,
}: {
  title: string;
  links: NavItem[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 border-border/70 bg-background/80 shadow-sm ring-1 ring-black/[0.03] lg:hidden dark:ring-white/5"
          aria-label="Menu navigasi"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex h-dvh max-h-dvh w-[min(20rem,88vw)] flex-col gap-0 border-r border-border/60 bg-background/95 p-0 backdrop-blur-xl shadow-2xl"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/logo-inkai.png"
              alt="INKAI"
              width={28}
              height={28}
              className="rounded-full shadow-sm ring-1 ring-inkai-red/20 shrink-0"
            />
            <div className="min-w-0">
              <SheetTitle className="truncate text-sm font-bold tracking-tight text-foreground">
                {title}
              </SheetTitle>
              <p className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                INKAI Surabaya
              </p>
            </div>
          </div>
        </div>
        <nav
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-1 scrollbar-ultrathin touch-pan-y"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {links.map((item) => {
            if (isNavGroup(item)) {
              return (
                <SidebarNavGroup
                  key={item.label}
                  label={item.label}
                  items={item.children}
                />
              );
            }
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                item.href !== "/admin" &&
                pathname.startsWith(item.href));
            return (
              <SidebarNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                isActive={isActive}
                badge={item.badge}
              />
            );
          })}
          <div className="h-10 shrink-0" aria-hidden />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export { ADMIN_LINKS, MEMBER_LINKS } from "@/lib/dashboard-nav";

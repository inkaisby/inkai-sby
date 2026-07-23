"use client";

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

  return (
    <Sheet>
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
      <SheetContent side="left" className="w-[min(18rem,88vw)] border-border/60 bg-background/95 backdrop-blur-xl">
        <SheetTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="h-5 w-1 rounded-full bg-gradient-to-b from-inkai-red to-inkai-yellow/80" aria-hidden />
          {title}
        </SheetTitle>
        <nav className="mt-6 flex flex-col gap-1">
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
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export { ADMIN_LINKS, MEMBER_LINKS } from "@/lib/dashboard-nav";

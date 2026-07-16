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
        <Button variant="outline" size="sm" className="gap-2 lg:hidden">
          <Menu className="h-4 w-4" />
          Menu
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetTitle className="text-base font-bold">{title}</SheetTitle>
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
              />
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export { ADMIN_LINKS, MEMBER_LINKS } from "@/lib/dashboard-nav";

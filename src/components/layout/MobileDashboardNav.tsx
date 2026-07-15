"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavLink = { href: string; label: string; active?: boolean };

export function MobileDashboardNav({
  title,
  links,
}: {
  title: string;
  links: NavLink[];
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
          {links.map((link) => {
            const isActive =
              link.active ??
              (pathname === link.href ||
                (link.href !== "/dashboard" &&
                  link.href !== "/admin" &&
                  pathname.startsWith(link.href)));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive
                    ? "bg-inkai-red text-white"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export { ADMIN_LINKS, MEMBER_LINKS } from "@/lib/dashboard-nav";

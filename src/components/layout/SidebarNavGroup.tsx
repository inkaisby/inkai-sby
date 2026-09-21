"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { SidebarNavLink } from "@/components/layout/SidebarNavLink";
import { getNavIcon } from "@/components/layout/nav-icons";
import type { NavLink } from "@/lib/dashboard-nav";

function hrefPathname(href: string) {
  return href.split("?")[0].split("#")[0];
}

function isLinkActive(
  linkHref: string,
  items: NavLink[],
  pathname: string,
): boolean {
  const currentPath = hrefPathname(linkHref);

  if (pathname === currentPath) {
    return true;
  }

  if (!pathname.startsWith(`${currentPath}/`)) {
    return false;
  }

  const hasBetterSiblingMatch = items.some((sibling) => {
    if (sibling.href === linkHref) return false;
    const siblingPath = hrefPathname(sibling.href);
    if (siblingPath === currentPath) return false;

    const isExact = pathname === siblingPath;
    const isPrefix = pathname.startsWith(`${siblingPath}/`);

    return (isExact || isPrefix) && siblingPath.length > currentPath.length;
  });

  return !hasBetterSiblingMatch;
}

export function SidebarNavGroup({
  label,
  items,
  collapsed = false,
}: {
  label: string;
  items: NavLink[];
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const childActive = items.some((c) => isLinkActive(c.href, items, pathname));
  const groupOpen = childActive;
  const [open, setOpen] = useState(groupOpen);
  const Icon = getNavIcon(label);

  useEffect(() => {
    if (groupOpen) setOpen(true);
  }, [groupOpen]);

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center ${
          collapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2.5 py-1.5"
        } rounded-md text-xs font-medium transition-colors ${
          groupOpen
            ? "bg-muted/80 text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
        aria-expanded={open}
        title={label}
      >
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 text-left leading-tight" title={label}>
              {label}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </>
        ) : null}
      </button>
      {open ? (
        <div
          className={
            collapsed
              ? "mt-0.5 space-y-0.5"
              : "ml-1.5 mt-0.5 space-y-0.5 border-l border-border/40 pl-1.5"
          }
        >
          {items.map((link) => {
            const isActive = isLinkActive(link.href, items, pathname);
            return (
              <SidebarNavLink
                key={link.href}
                href={link.href}
                label={link.label}
                isActive={isActive}
                badge={link.badge}
                collapsed={collapsed}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

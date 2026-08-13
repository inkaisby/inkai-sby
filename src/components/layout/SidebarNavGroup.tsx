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

export function SidebarNavGroup({
  label,
  items,
}: {
  label: string;
  items: NavLink[];
}) {
  const pathname = usePathname();
  const childActive = items.some((c) => {
    const path = hrefPathname(c.href);
    // /admin/ukt & /admin/latber (Pendaftaran) exact — jangan ikut arsip
    if (path === "/admin/ukt") return pathname === "/admin/ukt";
    if (path === "/admin/latber") return pathname === "/admin/latber";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
  // Buka grup jika di salah satu child (termasuk nested path di bawah UKT)
  const groupOpen =
    childActive ||
    items.some((c) => {
      const path = hrefPathname(c.href);
      return pathname === path || pathname.startsWith(`${path}/`);
    }) ||
    (label === "UKT" && pathname.startsWith("/admin/ukt")) ||
    (label === "Latihan Bersama" && pathname.startsWith("/admin/latber"));
  const [open, setOpen] = useState(groupOpen);
  const Icon = getNavIcon(label);

  useEffect(() => {
    if (groupOpen) setOpen(true);
  }, [groupOpen]);

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          groupOpen
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        aria-expanded={open}
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="ml-2 mt-0.5 space-y-0.5 border-l border-border pl-2">
          {items.map((link) => {
            const path = hrefPathname(link.href);
            // Exact-only: parent paths that have sibling sub-routes (UKT Pendaftaran vs Arsip)
            const exactOnly =
              path === "/admin/pengaturan" ||
              path === "/admin/ukt" ||
              path === "/admin/latber";
            const isActive =
              pathname === path ||
              (!exactOnly && pathname.startsWith(`${path}/`));
            return (
              <SidebarNavLink
                key={link.href}
                href={link.href}
                label={link.label}
                isActive={isActive}
                badge={link.badge}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

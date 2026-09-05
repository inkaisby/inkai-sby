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
  collapsed = false,
}: {
  label: string;
  items: NavLink[];
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const childActive = items.some((c) => {
    const path = hrefPathname(c.href);
    // /admin/ukt, /admin/latber, & /admin/kwitansi (Pendaftaran/Pembuatan) exact — jangan ikut arsip
    if (path === "/admin/ukt") return pathname === "/admin/ukt";
    if (path === "/admin/latber") return pathname === "/admin/latber";
    if (path === "/admin/kwitansi") return pathname === "/admin/kwitansi";
    if (path === "/admin/kas") return pathname === "/admin/kas";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
  // Buka grup jika di salah satu child (termasuk nested path di bawah UKT)
  const groupOpen =
    childActive ||
    items.some((c) => {
      const path = hrefPathname(c.href);
      return pathname === path || pathname.startsWith(`${path}/`);
    });
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
            const path = hrefPathname(link.href);
            // Exact-only: parent paths that have sibling sub-routes (UKT Pendaftaran vs Arsip, Kwitansi Pembuatan vs Arsip)
            const exactOnly =
              path === "/admin/pengaturan" ||
              path === "/admin/ukt" ||
              path === "/admin/latber" ||
              path === "/admin/kwitansi" ||
              path === "/admin/kas";
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
                collapsed={collapsed}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

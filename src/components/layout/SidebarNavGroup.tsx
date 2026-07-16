"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { SidebarNavLink } from "@/components/layout/SidebarNavLink";
import type { NavLink } from "@/lib/dashboard-nav";

export function SidebarNavGroup({
  label,
  items,
}: {
  label: string;
  items: NavLink[];
}) {
  const pathname = usePathname();
  const childActive = items.some(
    (c) => pathname === c.href || pathname.startsWith(`${c.href}/`),
  );
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          childActive
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="ml-2 mt-0.5 space-y-0.5 border-l border-border pl-2">
          {items.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/admin/pengaturan" &&
                pathname.startsWith(`${link.href}/`));
            return (
              <SidebarNavLink
                key={link.href}
                href={link.href}
                label={link.label}
                isActive={isActive}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

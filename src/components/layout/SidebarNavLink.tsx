"use client";

import Link from "next/link";
import { InkaiLogoLoader } from "@/components/ui/InkaiLogoLoader";
import { useNavigation } from "@/components/layout/NavigationProvider";
import { getNavIcon } from "@/components/layout/nav-icons";

export function SidebarNavLink({
  href,
  label,
  isActive,
  badge,
  collapsed = false,
}: {
  href: string;
  label: string;
  isActive: boolean;
  badge?: number;
  collapsed?: boolean;
}) {
  const { pendingHref, startNavigation } = useNavigation();
  const isPending = pendingHref === href;
  const Icon = getNavIcon(label);

  return (
    <Link
      href={href}
      prefetch
      onClick={() => startNavigation(href)}
      title={label}
      className={`relative mb-1 flex items-center ${
        collapsed ? "justify-center px-2 py-2.5" : "gap-2 px-3 py-2"
      } rounded-xl text-sm font-medium transition-all duration-200 ${
        isActive
          ? "bg-inkai-red text-white shadow-md shadow-inkai-red/25"
          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      } ${isPending ? "opacity-80" : ""}`}
      aria-busy={isPending}
    >
      {isPending ? (
        <InkaiLogoLoader size="sm" showDots={false} className="shrink-0" />
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
      ) : null}
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {badge && badge > 0 ? (
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-inkai-red text-white"
              }`}
            >
              {badge > 9 ? "9+" : badge}
            </span>
          ) : null}
        </>
      ) : badge && badge > 0 ? (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-inkai-red ring-2 ring-background" />
      ) : null}
    </Link>
  );
}

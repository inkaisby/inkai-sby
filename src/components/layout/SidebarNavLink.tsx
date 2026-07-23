"use client";

import Link from "next/link";
import { InkaiLogoLoader } from "@/components/ui/InkaiLogoLoader";
import { useNavigation } from "@/components/layout/NavigationProvider";

export function SidebarNavLink({
  href,
  label,
  isActive,
  badge,
}: {
  href: string;
  label: string;
  isActive: boolean;
  badge?: number;
}) {
  const { pendingHref, startNavigation } = useNavigation();
  const isPending = pendingHref === href;

  return (
    <Link
      href={href}
      prefetch
      onClick={() => startNavigation(href)}
      className={`mb-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
        isActive
          ? "bg-inkai-red text-white shadow-md shadow-inkai-red/25"
          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      } ${isPending ? "opacity-80" : ""}`}
      aria-busy={isPending}
    >
      {isPending ? (
        <InkaiLogoLoader size="sm" showDots={false} className="shrink-0" />
      ) : null}
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
    </Link>
  );
}

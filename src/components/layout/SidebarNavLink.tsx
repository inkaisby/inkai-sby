"use client";

import Link from "next/link";
import { InkaiLogoLoader } from "@/components/ui/InkaiLogoLoader";
import { useNavigation } from "@/components/layout/NavigationProvider";

export function SidebarNavLink({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  const { pendingHref, startNavigation } = useNavigation();
  const isPending = pendingHref === href;

  return (
    <Link
      href={href}
      prefetch
      onClick={() => startNavigation(href)}
      className={`mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-inkai-red text-white"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      } ${isPending ? "opacity-80" : ""}`}
      aria-busy={isPending}
    >
      {isPending ? (
        <InkaiLogoLoader size="sm" showDots={false} className="shrink-0" />
      ) : null}
      <span className="truncate">{label}</span>
    </Link>
  );
}

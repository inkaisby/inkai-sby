"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isPublicNavActive, publicNavLinks } from "@/lib/public-nav";

export default function PublicNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-0.5 lg:flex">
      {publicNavLinks.map((link) => {
        const active = isPublicNavActive(
          pathname,
          link.href,
          link.matchPrefix,
        );

        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors hover:bg-inkai-red/5 hover:text-inkai-red ${
              active
                ? "bg-inkai-red/5 text-inkai-red"
                : "text-foreground/70"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

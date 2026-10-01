"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { isPublicNavActive, publicNavLinks } from "@/lib/public-nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRIMARY_HREFS = ["/", "/dojo", "/ukt", "/pertandingan", "/kegiatan", "/artikel"];

export default function PublicNavLinks() {
  const pathname = usePathname();

  const primaryLinks = publicNavLinks.filter((l) => PRIMARY_HREFS.includes(l.href));
  const moreLinks = publicNavLinks.filter((l) => !PRIMARY_HREFS.includes(l.href));

  const isMoreActive = moreLinks.some((l) =>
    isPublicNavActive(pathname, l.href, l.matchPrefix),
  );

  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {primaryLinks.map((link) => {
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
            className={`whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all duration-200 xl:px-3 xl:text-sm ${
              active
                ? "bg-inkai-red text-white shadow-md shadow-inkai-red/25"
                : "text-foreground/75 hover:bg-inkai-red/5 hover:text-inkai-red"
            }`}
          >
            {link.label}
          </Link>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger
          className={`group inline-flex whitespace-nowrap items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium outline-none transition-all duration-200 xl:px-3 xl:text-sm ${
            isMoreActive
              ? "bg-inkai-red text-white shadow-md shadow-inkai-red/25"
              : "text-foreground/75 hover:bg-inkai-red/5 hover:text-inkai-red"
          }`}
        >
          <span>Lainnya</span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="z-[100] min-w-[150px] rounded-xl border border-border/60 bg-background/95 p-1.5 shadow-xl backdrop-blur-md"
        >
          {moreLinks.map((link) => {
            const active = isPublicNavActive(
              pathname,
              link.href,
              link.matchPrefix,
            );

            return (
              <DropdownMenuItem key={link.href} asChild className="rounded-lg p-0">
                <Link
                  href={link.href}
                  prefetch
                  className={`flex w-full items-center px-3 py-2 text-xs font-medium transition-colors ${
                    active
                      ? "bg-inkai-red/10 font-bold text-inkai-red"
                      : "text-foreground/80 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}

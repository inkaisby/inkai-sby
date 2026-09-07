"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeIconButton } from "@/components/member/ThemeIconButton";
import { MemberAdminPortalIconButton } from "@/components/member/MemberAdminPortalIconButton";

export function MemberPageHeader({
  title,
  subtitle,
  backHref = "/dashboard",
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 -mx-1 mb-5 flex items-center justify-between gap-2 border-b border-border/40 bg-background/95 px-1 pt-3 pb-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="z-[1] flex items-center gap-1.5">
        <Link
          href={backHref}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/80 text-foreground transition-colors hover:bg-muted"
          aria-label="Kembali"
        >
          <ArrowLeft size={20} />
        </Link>
      </div>
      <div className="pointer-events-none absolute inset-x-14 flex flex-col items-center justify-center text-center">
        <h1 className="truncate text-base font-extrabold sm:text-lg">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-xs font-semibold text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      <div className="z-[1] flex items-center justify-end gap-1.5">
        {rightSlot}
        <MemberAdminPortalIconButton />
        <ThemeIconButton />
      </div>
    </header>
  );
}

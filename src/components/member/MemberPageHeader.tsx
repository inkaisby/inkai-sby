"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeIconButton } from "@/components/member/ThemeIconButton";

export function MemberPageHeader({
  title,
  backHref = "/dashboard",
  rightSlot,
}: {
  title: string;
  backHref?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <header className="relative mb-5 flex items-center justify-between gap-2 pt-3">
      <div className="z-[1] flex items-center gap-1.5">
        <Link
          href={backHref}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/80 text-foreground transition-colors hover:bg-muted"
          aria-label="Kembali"
        >
          <ArrowLeft size={20} />
        </Link>
      </div>
      <h1 className="pointer-events-none absolute inset-x-14 truncate text-center text-base font-extrabold sm:text-lg">
        {title}
      </h1>
      <div className="z-[1] flex items-center justify-end gap-1.5">
        {rightSlot}
        <ThemeIconButton />
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Shield } from "lucide-react";
import { canChooseAdminPortal } from "@/lib/rbac";
import { cn } from "@/lib/utils";

export function MemberAdminPortalLink({
  className,
  compact = false,
  withBar = false,
}: {
  className?: string;
  compact?: boolean;
  /** Bungkus bar kanan atas (dashboard anggota). */
  withBar?: boolean;
}) {
  const { data: session, status } = useSession();

  if (status !== "authenticated" || !session?.user) return null;
  if (!canChooseAdminPortal(session.user)) return null;

  const link = (
    <Link
      href="/admin"
      prefetch
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl font-semibold text-inkai-red transition-colors hover:bg-inkai-red/10",
        compact
          ? "h-10 px-2.5 text-[11px]"
          : "border border-inkai-red/25 bg-inkai-red/5 px-3 py-2 text-xs",
        className,
      )}
    >
      <Shield size={compact ? 16 : 14} />
      Panel Admin
    </Link>
  );

  if (withBar) {
    return <div className="flex justify-end pt-2">{link}</div>;
  }

  return link;
}

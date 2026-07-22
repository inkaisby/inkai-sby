"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Shield } from "lucide-react";
import { canChooseAdminPortal } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/** Tombol ikon baku untuk pindah ke portal admin (dual-role). */
export function MemberAdminPortalIconButton({
  className,
}: {
  className?: string;
}) {
  const { data: session, status } = useSession();

  if (status !== "authenticated" || !session?.user) return null;
  if (!canChooseAdminPortal(session.user)) return null;

  return (
    <Link
      href="/admin"
      prefetch
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl bg-inkai-red/10 text-inkai-red transition-colors hover:bg-inkai-red/15",
        className,
      )}
      aria-label="Panel Admin"
      title="Panel Admin"
    >
      <Shield size={18} />
    </Link>
  );
}

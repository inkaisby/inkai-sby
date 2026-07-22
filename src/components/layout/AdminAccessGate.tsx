"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  adminFallbackPath,
  canAccessAdminPath,
} from "@/lib/admin-page-access";
import type { AdminDojoGrants } from "@/lib/admin-dojo-grants";

export function AdminAccessGate({
  roles,
  adminDojoGrants = null,
  children,
}: {
  roles: string[];
  adminDojoGrants?: AdminDojoGrants | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname?.startsWith("/admin")) return;
    if (!canAccessAdminPath(roles, pathname, adminDojoGrants)) {
      router.replace(adminFallbackPath(roles, adminDojoGrants));
    }
  }, [pathname, roles, adminDojoGrants, router]);

  if (
    pathname?.startsWith("/admin") &&
    !canAccessAdminPath(roles, pathname, adminDojoGrants)
  ) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Mengalihkan… halaman ini tidak tersedia untuk peran Anda.
      </div>
    );
  }

  return <>{children}</>;
}

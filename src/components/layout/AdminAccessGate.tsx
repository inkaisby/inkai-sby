"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  adminFallbackPath,
  canAccessAdminPath,
} from "@/lib/admin-page-access";

export function AdminAccessGate({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname?.startsWith("/admin")) return;
    if (!canAccessAdminPath(roles, pathname)) {
      router.replace(adminFallbackPath(roles));
    }
  }, [pathname, roles, router]);

  if (pathname?.startsWith("/admin") && !canAccessAdminPath(roles, pathname)) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Mengalihkan… halaman ini tidak tersedia untuk peran Anda.
      </div>
    );
  }

  return <>{children}</>;
}

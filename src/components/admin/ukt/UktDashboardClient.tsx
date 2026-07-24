"use client";

import nextDynamic from "next/dynamic";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";

/**
 * Client boundary agar `ssr: false` valid (Next.js 16 melarangnya di Server Components).
 * Shell halaman tetap SSR; chunk UktDashboard hanya di client.
 */
export const UktDashboardClient = nextDynamic(
  () =>
    import("@/components/admin/ukt/UktDashboard").then((m) => m.UktDashboard),
  {
    ssr: false,
    loading: () => (
      <AdminPageLoader rows={8} message="Memuat data UKT..." />
    ),
  },
);

export const UktArsipDashboardClient = nextDynamic(
  () =>
    import("@/components/admin/ukt/UktDashboard").then((m) => m.UktDashboard),
  {
    ssr: false,
    loading: () => (
      <AdminPageLoader rows={8} message="Memuat arsip UKT..." />
    ),
  },
);

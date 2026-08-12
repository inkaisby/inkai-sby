"use client";

import nextDynamic from "next/dynamic";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";

export const LatberDashboardClient = nextDynamic(
  () =>
    import("@/components/admin/latber/LatberDashboard").then((m) => m.LatberDashboard),
  {
    ssr: false,
    loading: () => (
      <AdminPageLoader rows={8} message="Memuat data Latber..." />
    ),
  },
);

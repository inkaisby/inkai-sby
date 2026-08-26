"use client";

/**
 * Re-export client dashboard — SSR enabled so Suspense fallback is the only loader
 * (hindari double AdminPageLoader dari dynamic ssr:false).
 */
export { LatberDashboard as LatberDashboardClient } from "@/components/admin/latber/LatberDashboard";

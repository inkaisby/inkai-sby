"use client";

/**
 * Re-export client dashboard — SSR enabled so Suspense fallback is the only loader
 * (hindari double AdminPageLoader dari dynamic ssr:false).
 */
export { UktDashboard as UktDashboardClient } from "@/components/admin/ukt/UktDashboard";
export { UktDashboard as UktArsipDashboardClient } from "@/components/admin/ukt/UktDashboard";

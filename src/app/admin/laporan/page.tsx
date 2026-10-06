import { Suspense } from "react";
import { requireAdminSession } from "@/lib/admin-session";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { LaporanClient } from "./LaporanClient";

export const dynamic = "force-dynamic";

export default async function LaporanPage() {
  await requireAdminSession();

  return (
    <Suspense fallback={<AdminPageLoader rows={6} />}>
      <LaporanClient />
    </Suspense>
  );
}

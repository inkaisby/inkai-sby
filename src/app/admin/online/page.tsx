import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import {
  adminFallbackPath,
  canAccessAdminPath,
} from "@/lib/admin-page-access";
import { canViewAccountPresence } from "@/lib/presence-constants";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { OnlinePresenceClient } from "./OnlinePresenceClient";

export const dynamic = "force-dynamic";

export default function AdminOnlinePage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={6} />}>
      <AdminOnlineContent />
    </Suspense>
  );
}

async function AdminOnlineContent() {
  const { user } = await requireAdminSession();
  if (!canAccessAdminPath(user.roles ?? [], "/admin/online")) {
    redirect(adminFallbackPath(user.roles ?? []));
  }
  if (!canViewAccountPresence(user.roles ?? [])) {
    redirect(adminFallbackPath(user.roles ?? []));
  }

  return (
    <>
      <h2 className="mb-2 text-2xl font-bold">Kehadiran akun</h2>
      <p className="mb-6 text-muted-foreground">
        Lihat siapa yang sedang aktif di portal (cakupan wilayah Anda).
      </p>
      <OnlinePresenceClient />
    </>
  );
}

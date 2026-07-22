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
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

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
      <AdminPageHeader
        title="Kehadiran akun"
        description="Lihat siapa yang sedang aktif di portal (cakupan wilayah Anda)."
      />
      <OnlinePresenceClient />
    </>
  );
}

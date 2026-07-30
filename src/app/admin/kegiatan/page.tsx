import { Suspense } from "react";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { fetchAdminEvents } from "@/lib/inkai-api/admin-data";
import { canCreateEventsByWilayah } from "@/lib/wilayah-rbac";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { KegiatanBrowser } from "./KegiatanBrowser";

export const dynamic = "force-dynamic";

export default function AdminKegiatanPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={4} />}>
      <AdminKegiatanContent />
    </Suspense>
  );
}

async function AdminKegiatanContent() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const events = await fetchAdminEvents(token, 50);
  const canCreate = canCreateEventsByWilayah(session.user.roles ?? []);

  const rows = events.map((e) => {
    const branch = e.branch as { name?: string } | undefined;
    const count =
      (e._count as { registrations?: number } | undefined)?.registrations ?? 0;
    return {
      id: String(e.id),
      title: String(e.title),
      location: e.location != null && e.location !== "" ? String(e.location) : null,
      startDate: String(e.startDate),
      endDate: String(e.endDate),
      branchName: branch?.name ?? null,
      registrationCount: count,
    };
  });

  return (
    <>
      <AdminPageHeader
        title="Event & Kegiatan"
        description={`Kelola event cabang (UKT, Gashuku, pertandingan, dll.) — ${rows.length} kegiatan`}
      />
      <KegiatanBrowser initialEvents={rows} canCreate={canCreate} />
    </>
  );
}

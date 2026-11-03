import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import {
  adminFallbackPath,
  canAccessAdminPath,
} from "@/lib/admin-page-access";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { resolveWasitJuriScopeContext } from "./scope-context";
import { SertifikasiWasitJuriWireframe } from "./SertifikasiWasitJuriWireframe";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  view?: string;
  create?: string;
}>;

export default function AdminSertifikasiWasitJuriPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageLoader rows={5} />}>
      <AdminSertifikasiWasitJuriContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminSertifikasiWasitJuriContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user, adminDojoGrants } = await requireAdminSession();
  if (
    !canAccessAdminPath(
      user.roles ?? [],
      "/admin/sertifikasi-wasit-juri",
      adminDojoGrants,
    )
  ) {
    redirect(adminFallbackPath(user.roles ?? [], adminDojoGrants));
  }

  const sp = await searchParams;
  const initialViewMode = sp.view === "arsip" ? "arsip" : "aktif";
  const initialCreateOpen = sp.create === "1";

  const {
    scopeLabel,
    lockedDojoId,
    lockedDojoName,
    canManagePeriod,
    crudPermission,
    dojoList,
    initialPeriods,
    initialRegistrations,
  } = await resolveWasitJuriScopeContext(user, adminDojoGrants);

  return (
    <SertifikasiWasitJuriWireframe
      scopeLabel={scopeLabel}
      lockedDojoId={lockedDojoId}
      lockedDojoName={lockedDojoName}
      canManagePeriod={canManagePeriod}
      crudPermission={crudPermission}
      dojoList={dojoList}
      initialPeriods={initialPeriods}
      initialRegistrations={initialRegistrations}
      initialViewMode={initialViewMode}
      initialCreateOpen={initialCreateOpen}
    />
  );
}

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import {
  adminFallbackPath,
  canAccessAdminPath,
} from "@/lib/admin-page-access";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { resolveWasitJuriScopeContext } from "../scope-context";
import { SertifikasiWasitJuriWireframe } from "../SertifikasiWasitJuriWireframe";

export const dynamic = "force-dynamic";

export default function AdminSertifikasiWasitJuriArsipPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={5} />}>
      <AdminSertifikasiWasitJuriArsipContent />
    </Suspense>
  );
}

async function AdminSertifikasiWasitJuriArsipContent() {
  const { user, adminDojoGrants } = await requireAdminSession();
  if (
    !canAccessAdminPath(
      user.roles ?? [],
      "/admin/sertifikasi-wasit-juri/arsip",
      adminDojoGrants,
    )
  ) {
    redirect(adminFallbackPath(user.roles ?? [], adminDojoGrants));
  }

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
      initialViewMode="arsip"
    />
  );
}

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPrimaryAdminRole, ROLE_LABELS } from "@/lib/rbac";
import { canCreateEventsByWilayah } from "@/lib/wilayah-rbac";
import { fetchLatberDashboardData } from "@/lib/latber-data";
import { requireAdminSession } from "@/lib/admin-session";
import { getBranchOrgProfile } from "@/lib/org-settings";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LatberDashboardClient } from "@/components/admin/latber/LatberDashboardClient";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type SearchParams = Promise<{ period?: string; create?: string }>;

async function LatberSection({ searchParams }: { searchParams: SearchParams }) {
  const { user, token } = await requireAdminSession();
  const params = await searchParams;
  const createMode = params.create === "1";
  const primaryRole = getPrimaryAdminRole(user.roles);
  const canCreatePeriod = canCreateEventsByWilayah(user.roles);

  const data = await fetchLatberDashboardData(token, user, {
    periodFromUrl: createMode ? null : params.period || null,
    forceNoPeriod: createMode,
    viewMode: "registration",
  });
  const orgProfile = await getBranchOrgProfile();

  return (
    <LatberDashboardClient
      periods={data.periods.filter((p) => !p.archived && !p.locked)}
      selectedPeriodId={data.selectedPeriodId}
      selectedPeriod={data.selectedPeriod}
      periodMeta={data.periodMeta}
      feeAmount={data.feeAmount}
      komisiRanting={data.komisiRanting}
      rows={data.rows}
      dojos={data.dojos}
      userRoles={user.roles}
      primaryRole={primaryRole}
      canCreatePeriod={canCreatePeriod}
      isArchiveView={false}
      dbError={data.dbError}
      orgProfile={{
        address: orgProfile.address,
        bendaharaCabangName: orgProfile.bendaharaCabangName,
      }}
    />
  );
}

export default async function LatberAdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  try {
    const { user } = await requireAdminSession();
    const primaryRole = getPrimaryAdminRole(user.roles);

    return (
      <>
        <AdminPageHeader
          title="Pendaftaran Latihan Bersama"
          description={`${ROLE_LABELS[primaryRole] || primaryRole} — Latihan bersama & pendaftaran anggota`}
        />
        <Suspense fallback={<AdminPageLoader rows={8} message="Memuat Latihan Bersama..." />}>
          <LatberSection searchParams={searchParams} />
        </Suspense>
      </>
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest || "").startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    redirect("/login");
  }
}

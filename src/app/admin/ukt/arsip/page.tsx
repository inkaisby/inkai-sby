import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  getPrimaryAdminRole,
  ROLE_LABELS,
} from "@/lib/rbac";
import { canCreateEventsByWilayah } from "@/lib/wilayah-rbac";
import { UktDashboard } from "@/components/admin/ukt/UktDashboard";
import {
  beltFeesFromTemplates,
  buildUktAdminUrl,
  currentSemester,
  isUktPeriodActiveView,
  type UktDepositRecord,
  type UktPeriodMeta,
  type UktSemester,
} from "@/lib/ukt";
import { fetchUktDashboardData } from "@/lib/inkai-api/admin-data";
import { getBranchOrgProfile } from "@/lib/org-settings";
import { requireAdminSession } from "@/lib/admin-session";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function isNextRedirectError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "digest" in error &&
    String((error as { digest?: string }).digest || "").startsWith("NEXT_REDIRECT")
  );
}

type SearchParams = Promise<{
  period?: string;
  semester?: string;
  year?: string;
}>;

async function UktArsipPageContent({ searchParams }: { searchParams: SearchParams }) {
  const { user, token } = await requireAdminSession();

  const params = await searchParams;
  const semester = (
    params.semester === "II" ? "II" : params.semester === "I" ? "I" : currentSemester()
  ) as UktSemester;
  const year = Math.min(
    2100,
    Math.max(2020, parseInt(params.year || String(new Date().getFullYear()), 10) || new Date().getFullYear()),
  );

  const primaryRole = getPrimaryAdminRole(user.roles);
  let dbError: string | null = null;

  let periods: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    registrationCloseAt?: string | null;
    createdAt?: string;
    archived?: boolean;
    locked?: boolean;
  }[] = [];
  let dojos: { id: string; name: string }[] = [];
  let selectedPeriodId: string | null = params.period || null;
  let allRows: Awaited<ReturnType<typeof fetchUktDashboardData>>["allRows"] = [];
  let beltFees = beltFeesFromTemplates([]);
  let komisiRanting = 0;
  let feesFromSnapshot = false;
  let depositMap: Record<string, UktDepositRecord> = {};
  let periodMeta: UktPeriodMeta = { archived: false, locked: false };

  const orgProfile = await getBranchOrgProfile();

  try {
    const data = await fetchUktDashboardData(token, user, {
      periodFromUrl: params.period || null,
      semester,
      year,
      viewMode: "archive",
    });
    periods = data.periods;
    dojos = data.dojos;
    selectedPeriodId = data.selectedPeriodId;

    // Periode aktif → kembali ke Pendaftaran
    if (selectedPeriodId) {
      const selected = periods.find((p) => p.id === selectedPeriodId);
      if (selected && isUktPeriodActiveView(selected)) {
        redirect(buildUktAdminUrl(semester, year, selectedPeriodId));
      }
    }

    const canonicalPeriod = data.selectedPeriodId;
    const urlNeedsSync =
      params.semester !== semester ||
      params.year !== String(year) ||
      (params.period ?? "") !== (canonicalPeriod ?? "");
    if (urlNeedsSync) {
      redirect(
        buildUktAdminUrl(semester, year, canonicalPeriod, {
          basePath: "/admin/ukt/arsip",
        }),
      );
    }

    allRows = data.allRows;
    beltFees = data.beltFees;
    komisiRanting = data.komisiRanting;
    feesFromSnapshot = Boolean(data.feesFromSnapshot);
    depositMap = data.depositMap ?? {};
    periodMeta = data.periodMeta ?? { archived: false, locked: false };
    if (!data.ok) dbError = "Gagal memuat data UKT dari API. Silakan coba lagi.";
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("[AdminUktArsip] API error:", error);
    dbError = "Gagal memuat data UKT dari API. Silakan coba lagi.";
  }

  const autoDojoId =
    primaryRole === "ADMIN_DOJO" && user.managedDojoIds?.length === 1
      ? user.managedDojoIds[0]
      : primaryRole === "ADMIN_DOJO" &&
          (!user.managedDojoIds || user.managedDojoIds.length <= 1) &&
          user.managedDojoId
        ? user.managedDojoId
        : "";

  const canCreatePeriod = canCreateEventsByWilayah(user.roles);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">UKT — Arsip</h2>
        <p className="text-muted-foreground">
          {ROLE_LABELS[primaryRole] || primaryRole} — Riwayat periode UKT yang sudah diarsipkan
        </p>
      </div>

      <UktDashboard
        periods={periods}
        selectedPeriodId={selectedPeriodId}
        allRows={allRows}
        dojos={dojos}
        userRoles={user.roles}
        primaryRole={primaryRole}
        semester={semester}
        year={year}
        canCreatePeriod={canCreatePeriod}
        dbError={dbError}
        defaultDojoFilter={autoDojoId}
        beltFees={beltFees}
        komisiRanting={komisiRanting}
        feesFromSnapshot={feesFromSnapshot}
        depositMap={depositMap}
        periodMeta={periodMeta}
        viewMode="archive"
        orgProfile={{
          address: orgProfile.address,
          bidangUjianName: orgProfile.bidangUjianName,
          bendaharaCabangName: orgProfile.bendaharaCabangName,
        }}
      />
    </>
  );
}

export default function AdminUktArsipPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageLoader rows={8} message="Memuat arsip UKT..." />}>
      <UktArsipPageContent searchParams={searchParams} />
    </Suspense>
  );
}

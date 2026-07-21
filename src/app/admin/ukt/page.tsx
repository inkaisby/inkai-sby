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
import { getUktRegistrationPolicy } from "@/lib/ukt-registration-policy";
import { requireAdminSession } from "@/lib/admin-session";
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";
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
  create?: string;
}>;

async function UktPageContent({ searchParams }: { searchParams: SearchParams }) {
  const { user, token } = await requireAdminSession();

  const params = await searchParams;
  const semester = (
    params.semester === "II" ? "II" : params.semester === "I" ? "I" : currentSemester()
  ) as UktSemester;
  const year = Math.min(
    2100,
    Math.max(2020, parseInt(params.year || String(new Date().getFullYear()), 10) || new Date().getFullYear()),
  );
  const createMode = params.create === "1";

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
  let selectedPeriodId: string | null = createMode ? null : params.period || null;
  let allRows: Awaited<ReturnType<typeof fetchUktDashboardData>>["allRows"] = [];
  let beltFees = beltFeesFromTemplates([]);
  let komisiRanting = 0;
  let feesFromSnapshot = false;
  let depositMap: Record<string, UktDepositRecord> = {};
  let periodMeta: UktPeriodMeta = { archived: false, locked: false };
  let orgProfile: Awaited<ReturnType<typeof getBranchOrgProfile>> | null = null;
  let registrationPolicy: Awaited<
    ReturnType<typeof getUktRegistrationPolicy>
  > | null = null;

  try {
    const [profile, policy, data] = await Promise.all([
      getBranchOrgProfile(),
      getUktRegistrationPolicy(),
      fetchUktDashboardData(token, user, {
        periodFromUrl: createMode ? null : params.period || null,
        semester,
        year,
        forceNoPeriod: createMode,
        viewMode: "registration",
      }),
    ]);
    orgProfile = profile;
    registrationPolicy = policy;
    periods = data.periods;
    dojos = data.dojos;
    selectedPeriodId = createMode ? null : data.selectedPeriodId;

    // Bookmark / deep-link periode arsip → menu Arsip UKT
    if (!createMode && params.period) {
      const fromUrl = periods.find((p) => p.id === params.period);
      if (fromUrl && !isUktPeriodActiveView(fromUrl)) {
        redirect(
          buildUktAdminUrl(semester, year, params.period, {
            basePath: "/admin/ukt/arsip",
          }),
        );
      }
    }

    if (createMode) {
      const urlNeedsSync =
        params.semester !== semester ||
        params.year !== String(year) ||
        Boolean(params.period) ||
        params.create !== "1";
      if (urlNeedsSync) {
        redirect(buildUktAdminUrl(semester, year, null, { create: true }));
      }
    } else {
      const canonicalPeriod = data.selectedPeriodId;
      const urlNeedsSync =
        params.semester !== semester ||
        params.year !== String(year) ||
        (params.period ?? "") !== (canonicalPeriod ?? "");
      if (urlNeedsSync) {
        redirect(buildUktAdminUrl(semester, year, canonicalPeriod));
      }
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
    console.error("[AdminUkt] API error:", error);
    dbError = "Gagal memuat data UKT dari API. Silakan coba lagi.";
  }

  const managedDojoIds = getManagedDojoIdsFromUser(user);
  const autoDojoId =
    primaryRole === "ADMIN_DOJO" && managedDojoIds.length === 1
      ? managedDojoIds[0]
      : "";
  const loginDojoId =
    primaryRole === "ADMIN_DOJO"
      ? (user.managedDojoId && managedDojoIds.includes(user.managedDojoId)
          ? user.managedDojoId
          : managedDojoIds[0] || user.managedDojoId || "")
      : "";
  const loginDojoName =
    loginDojoId
      ? dojos.find((d) => d.id === loginDojoId)?.name || ""
      : "";

  const canCreatePeriod = canCreateEventsByWilayah(user.roles);

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {ROLE_LABELS[primaryRole] || primaryRole} — Periode aktif & pendaftaran anggota
      </p>

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
        createMode={createMode}
        dbError={dbError}
        defaultDojoFilter={autoDojoId}
        loginDojoName={loginDojoName}
        beltFees={beltFees}
        komisiRanting={komisiRanting}
        feesFromSnapshot={feesFromSnapshot}
        depositMap={depositMap}
        periodMeta={periodMeta}
        viewMode="registration"
        registrationPolicy={registrationPolicy ?? undefined}
        orgProfile={{
          address: orgProfile?.address,
          bidangUjianName: orgProfile?.bidangUjianName,
          bendaharaCabangName: orgProfile?.bendaharaCabangName,
        }}
      />
    </>
  );
}

export default function AdminUktPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<AdminPageLoader rows={8} message="Memuat data UKT..." />}>
      <UktPageContent searchParams={searchParams} />
    </Suspense>
  );
}

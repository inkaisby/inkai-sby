import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import {
  getPrimaryAdminRole,
  ROLE_LABELS,
} from "@/lib/rbac";
import { canCreateEventsByWilayah } from "@/lib/wilayah-rbac";
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
import { getManagedDojoIdsFromUser, loadUktDojoFilterGroups } from "@/lib/managed-dojos";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { UktTermNav } from "@/components/admin/ukt/UktTermNav";

const UktDashboard = nextDynamic(
  () => import("@/components/admin/ukt/UktDashboard").then((m) => m.UktDashboard),
  { ssr: true, loading: () => <AdminPageLoader rows={8} message="Memuat arsip UKT..." /> },
);

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

function parseTerm(params: {
  semester?: string;
  year?: string;
}): { semester: UktSemester; year: number } {
  const semester = (
    params.semester === "II" ? "II" : params.semester === "I" ? "I" : currentSemester()
  ) as UktSemester;
  const year = Math.min(
    2100,
    Math.max(
      2020,
      parseInt(params.year || String(new Date().getFullYear()), 10) ||
        new Date().getFullYear(),
    ),
  );
  return { semester, year };
}

async function UktArsipShell({ searchParams }: { searchParams: SearchParams }) {
  const { user, token } = await requireAdminSession();
  const params = await searchParams;
  const { semester, year } = parseTerm(params);
  const primaryRole = getPrimaryAdminRole(user.roles);
  const canCreatePeriod = canCreateEventsByWilayah(user.roles);

  return (
    <>
      <AdminPageHeader
        title="Arsip UKT"
        description={`${ROLE_LABELS[primaryRole] || primaryRole} — Riwayat & periode terkunci`}
      />
      <UktTermNav
        semester={semester}
        year={year}
        basePath="/admin/ukt/arsip"
      />
      <Suspense
        fallback={<AdminPageLoader rows={8} message="Memuat arsip UKT..." />}
      >
        <UktArsipDashboardSection
          user={user}
          token={token}
          semester={semester}
          year={year}
          periodFromUrl={params.period || null}
          canCreatePeriod={canCreatePeriod}
          primaryRole={primaryRole}
          urlSemester={params.semester}
          urlYear={params.year}
        />
      </Suspense>
    </>
  );
}

async function UktArsipDashboardSection({
  user,
  token,
  semester,
  year,
  periodFromUrl,
  canCreatePeriod,
  primaryRole,
  urlSemester,
  urlYear,
}: {
  user: Awaited<ReturnType<typeof requireAdminSession>>["user"];
  token: string;
  semester: UktSemester;
  year: number;
  periodFromUrl: string | null;
  canCreatePeriod: boolean;
  primaryRole: ReturnType<typeof getPrimaryAdminRole>;
  urlSemester?: string;
  urlYear?: string;
}) {
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
  let selectedPeriodId: string | null = periodFromUrl;
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
        periodFromUrl,
        semester,
        year,
        viewMode: "archive",
      }),
    ]);
    orgProfile = profile;
    registrationPolicy = policy;
    periods = data.periods;
    dojos = data.dojos;
    selectedPeriodId = data.selectedPeriodId;

    if (selectedPeriodId) {
      const selected = periods.find((p) => p.id === selectedPeriodId);
      if (selected && isUktPeriodActiveView(selected)) {
        redirect(buildUktAdminUrl(semester, year, selectedPeriodId));
      }
    }

    const canonicalPeriod = data.selectedPeriodId;
    const urlNeedsSync =
      urlSemester !== semester ||
      urlYear !== String(year) ||
      (periodFromUrl ?? "") !== (canonicalPeriod ?? "");
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

  const managedDojoIds = getManagedDojoIdsFromUser(user);
  const autoDojoId =
    primaryRole === "ADMIN_DOJO" && managedDojoIds.length === 1
      ? managedDojoIds[0]
      : "";
  const loginDojoId =
    primaryRole === "ADMIN_DOJO"
      ? user.managedDojoId && managedDojoIds.includes(user.managedDojoId)
        ? user.managedDojoId
        : managedDojoIds[0] || user.managedDojoId || ""
      : "";
  const loginDojoName = loginDojoId
    ? dojos.find((d) => d.id === loginDojoId)?.name || ""
    : "";

  const dojoGroups =
    primaryRole === "ADMIN_DOJO" ? [] : await loadUktDojoFilterGroups(user);

  return (
    <UktDashboard
      hideStickyTermBar
      headerNote={`${ROLE_LABELS[primaryRole] || primaryRole} — Riwayat & periode terkunci`}
      periods={periods}
      selectedPeriodId={selectedPeriodId}
      allRows={allRows}
      dojos={dojos}
      dojoGroups={dojoGroups}
      userRoles={user.roles}
      primaryRole={primaryRole}
      semester={semester}
      year={year}
      canCreatePeriod={canCreatePeriod}
      dbError={dbError}
      defaultDojoFilter={autoDojoId}
      loginDojoName={loginDojoName}
      beltFees={beltFees}
      komisiRanting={komisiRanting}
      feesFromSnapshot={feesFromSnapshot}
      depositMap={depositMap}
      periodMeta={periodMeta}
      viewMode="archive"
      registrationPolicy={registrationPolicy ?? undefined}
      orgProfile={{
        address: orgProfile?.address,
        bidangUjianName: orgProfile?.bidangUjianName,
        bendaharaCabangName: orgProfile?.bendaharaCabangName,
      }}
    />
  );
}

export default function AdminUktArsipPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense
      fallback={
        <>
          <AdminPageHeader title="Arsip UKT" />
          <AdminPageLoader rows={4} message="Memuat arsip UKT..." />
        </>
      }
    >
      <UktArsipShell searchParams={searchParams} />
    </Suspense>
  );
}

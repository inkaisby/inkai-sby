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
import { fetchUktDashboardData, resolveUktAdminPeriodId } from "@/lib/inkai-api/admin-data";
import { getBranchOrgProfile } from "@/lib/org-settings";
import { getUktRegistrationPolicy } from "@/lib/ukt-registration-policy";
import { requireAdminSession } from "@/lib/admin-session";
import { getManagedDojoIdsFromUser, loadUktDojoFilterGroups } from "@/lib/managed-dojos";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { UktTermNav } from "@/components/admin/ukt/UktTermNav";

// UktDashboard besar — chunk terpisah; loading hanya di zona data (bawah shell).
const UktDashboard = nextDynamic(
  () => import("@/components/admin/ukt/UktDashboard").then((m) => m.UktDashboard),
  { ssr: true, loading: () => <AdminPageLoader rows={8} message="Memuat data UKT..." /> },
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
  create?: string;
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

/**
 * Shell ringan: header + semester/tahun tampil dulu (setelah sesi).
 * Data berat (KPI/tabel) streaming di Suspense di bawah — pola sama /admin/iuran.
 */
async function UktPageShell({ searchParams }: { searchParams: SearchParams }) {
  const { user, token } = await requireAdminSession();
  const params = await searchParams;
  const { semester, year } = parseTerm(params);
  const createMode = params.create === "1";
  const primaryRole = getPrimaryAdminRole(user.roles);
  const canCreatePeriod = canCreateEventsByWilayah(user.roles);

  return (
    <>
      <AdminPageHeader
        title="Pendaftaran UKT"
        description={`${ROLE_LABELS[primaryRole] || primaryRole} — Periode aktif & pendaftaran anggota`}
      />
      <UktTermNav
        semester={semester}
        year={year}
        createMode={createMode}
        basePath="/admin/ukt"
      />
      <Suspense
        fallback={<AdminPageLoader rows={8} message="Memuat data UKT..." />}
      >
        <UktDashboardSection
          user={user}
          token={token}
          semester={semester}
          year={year}
          createMode={createMode}
          periodFromUrl={createMode ? null : params.period || null}
          canCreatePeriod={canCreatePeriod}
          primaryRole={primaryRole}
          urlSemester={params.semester}
          urlYear={params.year}
          urlCreate={params.create}
        />
      </Suspense>
    </>
  );
}

async function UktDashboardSection({
  user,
  token,
  semester,
  year,
  createMode,
  periodFromUrl,
  canCreatePeriod,
  primaryRole,
  urlSemester,
  urlYear,
  urlCreate,
}: {
  user: Awaited<ReturnType<typeof requireAdminSession>>["user"];
  token: string;
  semester: UktSemester;
  year: number;
  createMode: boolean;
  periodFromUrl: string | null;
  canCreatePeriod: boolean;
  primaryRole: ReturnType<typeof getPrimaryAdminRole>;
  urlSemester?: string;
  urlYear?: string;
  urlCreate?: string;
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
  let selectedPeriodId: string | null = createMode ? null : periodFromUrl;
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
  let dojoGroups: Awaited<ReturnType<typeof loadUktDojoFilterGroups>> = [];

  try {
    // #region agent log
    const __pageDbgT0 = Date.now();
    const __pageDbgRun = `ukt-page-${__pageDbgT0}`;
    const __pageDbgLog = (
      hypothesisId: string,
      location: string,
      message: string,
      data: Record<string, unknown>,
    ) => {
      const payload = {
        sessionId: "f0acf0",
        runId: __pageDbgRun,
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now(),
      };
      fetch(
        "http://127.0.0.1:7385/ingest/dfa53adf-1e28-4ee0-ab88-bbc21b01308f",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "f0acf0",
          },
          body: JSON.stringify(payload),
        },
      ).catch(() => {});
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("fs").appendFileSync(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("path").join(process.cwd(), ".cursor", "debug-f0acf0.log"),
          JSON.stringify(payload) + "\n",
        );
      } catch {
        /* ignore */
      }
    };
    // #endregion

    // Perf A1: sync URL canonical SEBELUM fetch berat (hindari double full load).
    // Evidence: production GET /admin/ukt 307 setelah kerja penuh.
    if (!createMode) {
      const urlLooksComplete =
        urlSemester === semester &&
        urlYear === String(year) &&
        Boolean(periodFromUrl);
      if (!urlLooksComplete) {
        const light = await resolveUktAdminPeriodId(token, {
          periodFromUrl,
          semester,
          year,
          forceNoPeriod: false,
          viewMode: "registration",
        });
        const canonicalPeriod = light.selectedPeriodId;
        const urlNeedsSync =
          urlSemester !== semester ||
          urlYear !== String(year) ||
          (periodFromUrl ?? "") !== (canonicalPeriod ?? "");
        // #region agent log
        __pageDbgLog(
          "A",
          "admin/ukt/page.tsx:light-redirect",
          urlNeedsSync
            ? "UKT light resolve → redirect before heavy fetch"
            : "UKT light resolve — URL already synced",
          {
            lightMs: Date.now() - __pageDbgT0,
            urlNeedsSync,
            periodFromUrl: periodFromUrl ?? null,
            canonicalPeriod: canonicalPeriod ?? null,
            semester,
            year,
          },
        );
        // #endregion
        if (urlNeedsSync) {
          redirect(buildUktAdminUrl(semester, year, canonicalPeriod));
        }
      }
    } else {
      const urlNeedsSync =
        urlSemester !== semester ||
        urlYear !== String(year) ||
        Boolean(periodFromUrl) ||
        urlCreate !== "1";
      if (urlNeedsSync) {
        redirect(buildUktAdminUrl(semester, year, null, { create: true }));
      }
    }

    const [profile, policy, data, dojoGroupsResult] = await Promise.all([
      getBranchOrgProfile(),
      getUktRegistrationPolicy(),
      fetchUktDashboardData(token, user, {
        periodFromUrl,
        semester,
        year,
        forceNoPeriod: createMode,
        viewMode: "registration",
      }),
      primaryRole === "ADMIN_DOJO"
        ? Promise.resolve(
            [] as Awaited<ReturnType<typeof loadUktDojoFilterGroups>>,
          )
        : loadUktDojoFilterGroups(user),
    ]);
    // #region agent log
    const __pageDbgFetchMs = Date.now() - __pageDbgT0;
    // #endregion
    orgProfile = profile;
    registrationPolicy = policy;
    periods = data.periods;
    dojos = data.dojos;
    selectedPeriodId = createMode ? null : data.selectedPeriodId;
    dojoGroups = dojoGroupsResult;

    if (!createMode && periodFromUrl) {
      const fromUrl = periods.find((p) => p.id === periodFromUrl);
      if (fromUrl && !isUktPeriodActiveView(fromUrl)) {
        // #region agent log
        __pageDbgLog(
          "A",
          "admin/ukt/page.tsx:redirect-arsip",
          "UKT redirect arsip after full fetch",
          {
            fetchMs: __pageDbgFetchMs,
            periodFromUrl,
            semester,
            year,
          },
        );
        // #endregion
        redirect(
          buildUktAdminUrl(semester, year, periodFromUrl, {
            basePath: "/admin/ukt/arsip",
          }),
        );
      }
    }

    if (!createMode) {
      const canonicalPeriod = data.selectedPeriodId;
      const urlNeedsSync =
        urlSemester !== semester ||
        urlYear !== String(year) ||
        (periodFromUrl ?? "") !== (canonicalPeriod ?? "");
      // #region agent log
      __pageDbgLog(
        "A",
        "admin/ukt/page.tsx:after-fetch",
        urlNeedsSync
          ? "UKT will redirect canonical after full fetch"
          : "UKT URL already canonical — no redirect",
        {
          fetchMs: __pageDbgFetchMs,
          urlNeedsSync,
          periodFromUrl: periodFromUrl ?? null,
          canonicalPeriod: canonicalPeriod ?? null,
          urlSemester: urlSemester ?? null,
          urlYear: urlYear ?? null,
          semester,
          year,
          rowCount: data.allRows?.length ?? 0,
          runIdTag: "post-fix",
        },
      );
      // #endregion
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
      ? user.managedDojoId && managedDojoIds.includes(user.managedDojoId)
        ? user.managedDojoId
        : managedDojoIds[0] || user.managedDojoId || ""
      : "";
  const loginDojoName = loginDojoId
    ? dojos.find((d) => d.id === loginDojoId)?.name || ""
    : "";

  return (
    <UktDashboard
      hideStickyTermBar
      headerNote={`${ROLE_LABELS[primaryRole] || primaryRole} — Periode aktif & pendaftaran anggota`}
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
  );
}

export default function AdminUktPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense
      fallback={
        <>
          <AdminPageHeader title="Pendaftaran UKT" />
          <AdminPageLoader rows={4} message="Memuat UKT..." />
        </>
      }
    >
      <UktPageShell searchParams={searchParams} />
    </Suspense>
  );
}

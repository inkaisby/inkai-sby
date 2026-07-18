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
  type UktSemester,
} from "@/lib/ukt";
import { fetchUktDashboardData } from "@/lib/inkai-api/admin-data";
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

  const primaryRole = getPrimaryAdminRole(user.roles);
  let dbError: string | null = null;

  let periods: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    registrationCloseAt?: string | null;
  }[] = [];
  let dojos: { id: string; name: string }[] = [];
  let selectedPeriodId: string | null = params.period || null;
  let allRows: Awaited<ReturnType<typeof fetchUktDashboardData>>["allRows"] = [];
  let beltFees = beltFeesFromTemplates([]);
  let komisiRanting = 0;

  try {
    const data = await fetchUktDashboardData(token, user, {
      periodFromUrl: params.period || null,
      semester,
      year,
    });
    periods = data.periods;
    dojos = data.dojos;
    selectedPeriodId = data.selectedPeriodId;

    // URL kanonik mengikuti periode yang benar-benar ter-resolve (bukan re-query terpisah).
    const canonicalPeriod = data.selectedPeriodId;
    const urlNeedsSync =
      params.semester !== semester ||
      params.year !== String(year) ||
      (params.period ?? "") !== (canonicalPeriod ?? "");
    if (urlNeedsSync) {
      redirect(buildUktAdminUrl(semester, year, canonicalPeriod));
    }
    allRows = data.allRows;
    beltFees = data.beltFees;
    komisiRanting = data.komisiRanting;
    if (!data.ok) dbError = "Gagal memuat data UKT dari API. Silakan coba lagi.";
  } catch (error) {
    // redirect() melempar NEXT_REDIRECT — jangan tampilkan sebagai gagal API.
    if (isNextRedirectError(error)) throw error;
    console.error("[AdminUkt] API error:", error);
    dbError = "Gagal memuat data UKT dari API. Silakan coba lagi.";
  }

  const autoDojoId =
    primaryRole === "ADMIN_DOJO" && user.managedDojoId ? user.managedDojoId : "";

  const canCreatePeriod = canCreateEventsByWilayah(user.roles);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Ujian Kenaikan Tingkat (UKT)</h2>
        <p className="text-muted-foreground">
          {ROLE_LABELS[primaryRole] || primaryRole} — Kelola pendaftaran UKT anggota ranting
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

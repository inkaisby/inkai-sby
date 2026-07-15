import { Suspense } from "react";
import {
  getPrimaryAdminRole,
  ROLE_LABELS,
} from "@/lib/rbac";
import { UktDashboard } from "@/components/admin/ukt/UktDashboard";
import {
  beltFeesFromTemplates,
  type UktSemester,
} from "@/lib/ukt";
import { fetchUktDashboardData } from "@/lib/inkai-api/admin-data";
import { requireAdminSession } from "@/lib/admin-session";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type SearchParams = Promise<{
  period?: string;
  semester?: string;
  year?: string;
}>;

async function UktPageContent({ searchParams }: { searchParams: SearchParams }) {
  const { user, token } = await requireAdminSession();

  const params = await searchParams;
  const semester = (params.semester === "II" ? "II" : "I") as UktSemester;
  const year = Math.min(
    2100,
    Math.max(2020, parseInt(params.year || String(new Date().getFullYear()), 10) || new Date().getFullYear()),
  );

  const primaryRole = getPrimaryAdminRole(user.roles);
  let dbError: string | null = null;

  let periods: { id: string; title: string; startDate: string; endDate: string }[] = [];
  let dojos: { id: string; name: string }[] = [];
  let selectedPeriodId: string | null = params.period || null;
  let allRows: Awaited<ReturnType<typeof fetchUktDashboardData>>["allRows"] = [];
  let invoiceAcks: Record<string, { acknowledged: boolean; at: string; by: string }> = {};
  let beltFees = beltFeesFromTemplates([]);
  let komisiRanting = 0;

  try {
    const data = await fetchUktDashboardData(token, user, params.period || null);
    periods = data.periods;
    dojos = data.dojos;
    selectedPeriodId = data.selectedPeriodId;
    allRows = data.allRows;
    invoiceAcks = data.invoiceAcks;
    beltFees = data.beltFees;
    komisiRanting = data.komisiRanting;
    if (!data.ok) dbError = "Gagal memuat data UKT dari API. Silakan coba lagi.";
  } catch (error) {
    console.error("[AdminUkt] API error:", error);
    dbError = "Gagal memuat data UKT dari API. Silakan coba lagi.";
  }

  const autoDojoId =
    primaryRole === "ADMIN_DOJO" && user.managedDojoId ? user.managedDojoId : "";

  const canCreatePeriod = ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(
    primaryRole,
  );

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
        invoiceAcks={invoiceAcks}
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

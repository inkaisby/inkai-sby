import { Suspense } from "react";
import { requireAdminSession } from "@/lib/admin-session";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  AdminAbsensiClient,
  type AbsensiView,
} from "@/components/admin/AdminAbsensiClient";
import { loadAbsensiClientPayload } from "@/lib/admin-absensi-data";
import { UKT_SEMESTER_SESSION_TOTAL } from "@/lib/ukt";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  date?: string;
  q?: string;
  view?: string;
  semester?: string;
  year?: string;
}>;

export default function AdminAbsensiPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageLoader rows={6} />}>
      <AdminAbsensiContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminAbsensiContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user } = await requireAdminSession();
  const token = await getInkaiAccessToken();
  if (!token) throw new Error("Token tidak tersedia");

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const rawView = params.view?.trim() || "progress";
  const initialView: AbsensiView =
    rawView === "rekap"
      ? "progress"
      : rawView === "harian" || rawView === "belum" || rawView === "progress"
        ? rawView
        : "progress";

  const payload = await loadAbsensiClientPayload(token, user, {
    date: params.date,
    semester: params.semester,
    year: Number(params.year) || undefined,
  });

  return (
    <>
      <AdminPageHeader
        title="Laporan Absensi"
        description={
          <>
            Progress kehadiran anggota, absensi harian, dan yang belum hadir
            (syarat UKT {UKT_SEMESTER_SESSION_TOTAL} sesi). Tab berganti instan
            tanpa reload.
          </>
        }
      />
      <AdminAbsensiClient
        initialView={initialView}
        dateStr={payload.dateStr}
        semester={payload.semester}
        year={payload.year}
        q={q}
        presentCount={payload.presentCount}
        dayLogs={payload.dayLogs}
        belumHadir={payload.belumHadir}
        progressRows={payload.progressRows}
      />
    </>
  );
}

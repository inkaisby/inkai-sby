import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { fetchUktDashboardData } from "@/lib/inkai-api/admin-data";
import { currentSemester, type UktSemester } from "@/lib/ukt";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Refresh data tabel UKT (rows + deposit) tanpa reload halaman penuh.
 * GET ?semester=I|II&year=YYYY&period=<eventId>&viewMode=registration|archive&create=1
 */
export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const semesterRaw = searchParams.get("semester");
  const semester = (
    semesterRaw === "II" ? "II" : semesterRaw === "I" ? "I" : currentSemester()
  ) as UktSemester;
  const yearParsed = Number.parseInt(searchParams.get("year") || "", 10);
  const year =
    Number.isFinite(yearParsed) && yearParsed >= 2020 && yearParsed <= 2100
      ? yearParsed
      : new Date().getFullYear();
  const period = searchParams.get("period")?.trim() || null;
  const viewMode =
    searchParams.get("viewMode") === "archive" ? "archive" : "registration";
  const forceNoPeriod =
    searchParams.get("create") === "1" || searchParams.get("create") === "true";

  try {
    const data = await fetchUktDashboardData(authResult.token, authResult.user, {
      periodFromUrl: period,
      semester,
      year,
      forceNoPeriod,
      viewMode,
    });

    return NextResponse.json({
      success: true,
      selectedPeriodId: data.selectedPeriodId,
      allRows: data.allRows,
      depositMap: data.depositMap,
      periodMeta: data.periodMeta ?? null,
    });
  } catch (error) {
    console.error("[UKT table refresh]", error);
    return NextResponse.json(
      { error: "Gagal memuat ulang data tabel UKT" },
      { status: 500 },
    );
  }
}

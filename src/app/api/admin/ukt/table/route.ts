import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { fetchUktTableRefreshSnapshot } from "@/lib/inkai-api/admin-data";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * Refresh cepat tabel UKT: snapshot registrasi/tagihan periode saja
 * (tanpa refetch pool anggota / events / fee / absensi semester).
 * GET ?period=<eventId>
 */
export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const period = new URL(request.url).searchParams.get("period")?.trim() || "";
  if (!period) {
    return NextResponse.json(
      { error: "period wajib untuk refresh tabel" },
      { status: 400 },
    );
  }

  try {
    const data = await fetchUktTableRefreshSnapshot(authResult.token, period);
    return NextResponse.json({
      success: true,
      periodId: data.periodId,
      participants: data.participants,
      depositMap: data.depositMap,
    });
  } catch (error) {
    console.error("[UKT table refresh]", error);
    return NextResponse.json(
      { error: "Gagal memuat ulang data tabel UKT" },
      { status: 500 },
    );
  }
}

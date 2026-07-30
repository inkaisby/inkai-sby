import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { loadAbsensiClientPayload } from "@/lib/admin-absensi-data";

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const token = await getInkaiAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  }

  const sp = new URL(request.url).searchParams;
  try {
    const payload = await loadAbsensiClientPayload(
      token,
      authResult.user,
      {
        date: sp.get("date") ?? undefined,
        semester: sp.get("semester") ?? undefined,
        year: Number(sp.get("year") || 0) || undefined,
      },
    );
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[absensi-api]", error);
    return NextResponse.json(
      { error: "Gagal memuat data absensi" },
      { status: 502 },
    );
  }
}

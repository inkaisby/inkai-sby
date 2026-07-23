import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listOpenEventsForAdmin } from "@/lib/open-events";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  try {
    const events = await listOpenEventsForAdmin(12);
    return NextResponse.json(
      {
        success: true,
        count: events.length,
        events,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
        },
      },
    );
  } catch (error) {
    console.error("[open-events]", error);
    return NextResponse.json(
      { success: false, count: 0, events: [], error: "Gagal memuat kegiatan" },
      { status: 500 },
    );
  }
}

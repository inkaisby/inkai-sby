import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { fetchMyMemberProfile } from "@/lib/inkai-api/member-data";
import { loadGeofencedDojosForCabang } from "@/lib/attendance-geofence";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { jakartaDayKey } from "@/lib/ukt";

export async function GET() {
  const session = await auth();
  const token = await getInkaiAccessToken();
  if (!session?.user.memberId || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [member, dojos, eventsRes] = await Promise.all([
    fetchMyMemberProfile(token, session.user.memberId),
    loadGeofencedDojosForCabang(),
    inkaiFetch("/v1/events", {}, token).catch(() => null),
  ]);

  const homeDojoId =
    (member as { dojoId?: string } | null)?.dojoId ||
    ((member?.dojo as { id?: string } | undefined)?.id ?? null);
  const homeDojoName =
    (member?.dojo as { name?: string } | undefined)?.name || null;

  const today = jakartaDayKey();
  const eventsToday: Array<{ id: string; title: string; hostDojoId?: string }> =
    [];
  if (eventsRes?.res.ok) {
    const items =
      (eventsRes.data.data as Array<Record<string, unknown>>) ?? [];
    for (const e of items) {
      const start = String(e.startDate || e.startAt || "");
      if (!start) continue;
      const day = jakartaDayKey(new Date(start));
      if (day !== today) continue;
      const id = String(e.id || "");
      const title = String(e.title || "Kegiatan");
      if (!id) continue;
      const hostDojoId =
        typeof e.dojoId === "string"
          ? e.dojoId
          : ((e.dojo as { id?: string } | undefined)?.id ?? undefined);
      eventsToday.push({ id, title, hostDojoId });
    }
  }

  return NextResponse.json({
    homeDojo: homeDojoId
      ? { id: homeDojoId, name: homeDojoName || "Dojo saya" }
      : null,
    dojos: dojos.map((d) => ({ id: d.id, name: d.name })),
    eventsToday,
  });
}

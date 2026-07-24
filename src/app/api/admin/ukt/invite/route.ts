import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { loadUktPeriodMeta } from "@/lib/ukt-period-meta-store";
import {
  buildUktInviteUrl,
  getUktInvitePublic,
  syncUktInviteSnapshot,
} from "@/lib/ukt-invite";
import { z } from "zod";

const inviteSchema = z.object({
  eventId: z.string().trim().min(1).max(128),
});

/**
 * Pastikan snapshot undangan publik ada untuk periode ini (periode lama / sebelum fitur).
 * POST { eventId }
 */
export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "eventId wajib" }, { status: 400 });
  }
  const eventId = parsed.data.eventId;

  const { res, data } = await inkaiFetch(`/v1/events/${eventId}`, {}, authResult.token);
  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Periode UKT tidak ditemukan") },
      { status: res.status },
    );
  }

  const event = (data.data as Record<string, unknown> | undefined) ?? {};
  const title = String(event.title ?? "");
  if (!title.toUpperCase().includes("UKT")) {
    return NextResponse.json({ error: "Event bukan periode UKT" }, { status: 400 });
  }

  const meta = await loadUktPeriodMeta(authResult.token, eventId);
  await syncUktInviteSnapshot({
    periodId: eventId,
    title,
    startDate: event.startDate ? String(event.startDate) : null,
    endDate: event.endDate ? String(event.endDate) : null,
    registrationCloseAt: event.registrationCloseAt
      ? String(event.registrationCloseAt)
      : null,
    location: event.location ? String(event.location) : null,
    meta,
  });

  const invite = await getUktInvitePublic(eventId);
  return NextResponse.json({
    ok: true,
    url: buildUktInviteUrl(eventId),
    invite,
  });
}

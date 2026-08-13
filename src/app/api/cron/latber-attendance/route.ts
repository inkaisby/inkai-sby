import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSettingsByPrefix } from "@/lib/inkai-api/admin-data";
import { isLatberEventTitle, parseLatberPeriodMetaValue } from "@/lib/latber";
import { creditLatberAttendanceForPaidRegistration } from "@/lib/latber-attendance";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron harian: kredit 1 hari kehadiran untuk peserta Latber Lunas
 * pada/setelah tanggal jadwal (eventAt).
 * Auth: Authorization Bearer CRON_SECRET atau header x-cron-secret.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET belum di-set" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const headerSecret = request.headers.get("x-cron-secret") ?? "";
  const ok = auth === `Bearer ${secret}` || headerSecret === secret;
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceToken =
    process.env.INKAI_SERVICE_TOKEN || process.env.CRON_INKAI_TOKEN;
  if (!serviceToken) {
    return NextResponse.json(
      { error: "Token layanan (INKAI_SERVICE_TOKEN) belum di-set" },
      { status: 503 },
    );
  }

  const [events, metaRows] = await Promise.all([
    prisma.event.findMany({
      where: { isDeleted: false },
      select: { id: true, title: true },
      take: 200,
    }),
    fetchSettingsByPrefix(serviceToken, "latber-period-meta:", {
      timeoutMs: 8_000,
      retries: 0,
    }),
  ]);

  const metaById = new Map(
    metaRows.map((row) => [
      row.key.slice("latber-period-meta:".length),
      parseLatberPeriodMetaValue(row.value),
    ]),
  );

  const latberEvents = events.filter((e) => isLatberEventTitle(e.title ?? ""));
  let credited = 0;
  let skipped = 0;
  let examined = 0;

  for (const event of latberEvents) {
    const meta = metaById.get(event.id);
    const eventAt = meta?.eventAt;
    if (!eventAt) continue;

    const regs = await prisma.eventRegistration.findMany({
      where: { eventId: event.id },
      select: {
        id: true,
        memberId: true,
        member: { select: { dojoId: true } },
      },
      take: 500,
    });
    if (regs.length === 0) continue;

    const paid = await prisma.billing.findMany({
      where: {
        isDeleted: false,
        status: { in: ["PAID", "SUCCESS"] },
        registrationId: { in: regs.map((r) => r.id) },
      },
      select: { memberId: true, registrationId: true },
    });
    const paidMemberIds = new Set(paid.map((b) => b.memberId));

    for (const reg of regs) {
      if (!paidMemberIds.has(reg.memberId)) continue;
      examined += 1;
      const result = await creditLatberAttendanceForPaidRegistration({
        memberId: reg.memberId,
        eventId: event.id,
        eventAt,
        dojoId: reg.member.dojoId,
      });
      if (result.created) credited += 1;
      else skipped += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    periods: latberEvents.length,
    examined,
    credited,
    skipped,
    at: new Date().toISOString(),
  });
}

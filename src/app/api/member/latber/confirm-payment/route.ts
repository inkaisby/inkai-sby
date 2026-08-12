import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { prisma } from "@/lib/prisma";
import {
  loadLatberSelfRegistrationMeta,
  upsertLatberSelfRegistrationMeta,
} from "@/lib/latber-self-registration";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import { z } from "zod";

export const maxDuration = 30;

const bodySchema = z.object({
  eventId: z.string().uuid(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.memberId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = await getInkaiAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "eventId wajib" }, { status: 400 });
  }

  const { eventId } = parsed.data;
  const memberId = session.user.memberId;

  const registration = await prisma.eventRegistration.findFirst({
    where: { eventId, memberId },
    select: { id: true, status: true },
  });
  if (!registration) {
    return NextResponse.json(
      { error: "Belum ada pengajuan Latber untuk periode ini" },
      { status: 400 },
    );
  }
  if (registration.status !== "PENDING") {
    return NextResponse.json(
      { error: "Konfirmasi bayar hanya untuk pengajuan yang menunggu ranting" },
      { status: 400 },
    );
  }

  const meta = await loadLatberSelfRegistrationMeta(eventId, memberId);
  if (!meta) {
    return NextResponse.json(
      { error: "Pengajuan mandiri tidak ditemukan" },
      { status: 400 },
    );
  }

  if (meta.memberPaymentConfirmedAt) {
    return NextResponse.json({
      success: true,
      alreadyConfirmed: true,
      displayStatus: "menunggu_konfirmasi_ranting",
    });
  }

  const confirmedAt = new Date().toISOString();
  await upsertLatberSelfRegistrationMeta(eventId, memberId, {
    ...meta,
    memberPaymentConfirmedAt: confirmedAt,
  });

  writeAuditLog({
    userId: session.user.id,
    email: session.user.email,
    action: "LATBER_SELF_CONFIRM_PAYMENT",
    details: `Member confirmed Latber payment to ranting for ${eventId}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token,
  });

  return NextResponse.json({
    success: true,
    alreadyConfirmed: false,
    displayStatus: "menunggu_konfirmasi_ranting",
  });
}

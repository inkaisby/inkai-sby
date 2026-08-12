import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { prisma } from "@/lib/prisma";
import {
  loadLatberSelfRegistrationMeta,
  upsertLatberSelfRegistrationMeta,
} from "@/lib/latber-self-registration";
import { notifyDojoAndBranchAdmins } from "@/lib/admin-notify-scope";
import { notifyLatberStatusChange } from "@/lib/latber-notify";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
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

  const limit = await rateLimitAsync(`member-latber-confirm:${session.user.id}`, {
    max: 10,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfterSec ?? 60);
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
      { error: "Belum ada pengajuan Latihan Bersama untuk periode ini" },
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
      registrationId: registration.id,
      displayStatus: "menunggu_konfirmasi_ranting",
    });
  }

  const member = await prisma.member.findFirst({
    where: { id: memberId, isDeleted: false },
    select: { fullName: true, dojoId: true },
  });
  const period = await prisma.event.findFirst({
    where: { id: eventId },
    select: { title: true },
  });
  const periodTitle = period?.title ?? "Latihan Bersama";
  const memberName = member?.fullName ?? session.user.name ?? "Anggota";

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

  void notifyLatberStatusChange({
    token,
    memberId,
    memberName,
    periodTitle,
    displayStatus: "menunggu_konfirmasi_ranting",
    extra: "Konfirmasi bayar tercatat. Menunggu ranting menerima pengajuan.",
  }).catch((err) => console.error("[Latber confirm-payment] notify member", err));

  if (member?.dojoId) {
    void notifyDojoAndBranchAdmins({
      dojoId: member.dojoId,
      token,
      title: "Latihan Bersama — Konfirmasi bayar anggota",
      content: `${memberName} mengonfirmasi sudah bayar Latihan Bersama (${periodTitle}). Menunggu Terima/Tolak ranting.`,
      type: "INFO",
    }).catch((err) => console.error("[Latber confirm-payment] notify ranting", err));
  }

  return NextResponse.json({
    success: true,
    alreadyConfirmed: false,
    registrationId: registration.id,
    displayStatus: "menunggu_konfirmasi_ranting",
  });
}

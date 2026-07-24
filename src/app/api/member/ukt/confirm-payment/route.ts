import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { prisma } from "@/lib/prisma";
import {
  loadUktSelfRegistrationMeta,
  upsertUktSelfRegistrationMeta,
} from "@/lib/ukt-self-registration";
import { notifyDojoAndBranchAdmins } from "@/lib/admin-notify-scope";
import { notifyUktStatusChange } from "@/lib/ukt-notify";
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
      { error: "Belum ada pengajuan UKT untuk periode ini" },
      { status: 400 },
    );
  }
  if (registration.status !== "PENDING") {
    return NextResponse.json(
      { error: "Konfirmasi bayar hanya untuk pengajuan yang menunggu ranting" },
      { status: 400 },
    );
  }

  const meta = await loadUktSelfRegistrationMeta(eventId, memberId);
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
  await upsertUktSelfRegistrationMeta(eventId, memberId, {
    ...meta,
    memberPaymentConfirmedAt: confirmedAt,
  });

  const member = await prisma.member.findFirst({
    where: { id: memberId },
    select: { fullName: true, dojoId: true },
  });
  const period = await prisma.event.findFirst({
    where: { id: eventId },
    select: { title: true },
  });
  const memberName = member?.fullName ?? "Anggota";
  const periodTitle = period?.title ?? "UKT";

  writeAuditLog({
    userId: session.user.id,
    email: session.user.email,
    action: "UKT_SELF_CONFIRM_PAYMENT",
    details: `Member confirmed UKT payment to ranting for ${eventId}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token,
  });

  void notifyUktStatusChange({
    token,
    memberId,
    memberName,
    periodTitle,
    displayStatus: "menunggu_konfirmasi_ranting",
    extra: "Menunggu ketua ranting menerima pendaftaran dan pembayaran.",
  }).catch((err) => console.error("[UKT confirm-payment] notify member", err));

  if (member?.dojoId) {
    void notifyDojoAndBranchAdmins({
      dojoId: member.dojoId,
      token,
      title: "UKT — Anggota konfirmasi sudah bayar",
      content: `${memberName} mengonfirmasi sudah bayar UKT (${periodTitle}). Silakan Terima atau Tolak di menu UKT.`,
      type: "INFO",
    }).catch((err) => console.error("[UKT confirm-payment] notify ranting", err));
  }

  return NextResponse.json({
    success: true,
    alreadyConfirmed: false,
    displayStatus: "menunggu_konfirmasi_ranting",
  });
}

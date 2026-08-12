import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { prisma } from "@/lib/prisma";
import {
  forceRegisterLatberInDb,
  validateLatberRegistrationEligibility,
} from "@/lib/latber-register";
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

  const eligibility = await validateLatberRegistrationEligibility(
    token,
    eventId,
    memberId,
  );
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 403 });
  }

  const member = await prisma.member.findFirst({
    where: { id: memberId, isDeleted: false },
    select: { id: true, fullName: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  const period = await prisma.event.findFirst({
    where: { id: eventId },
    select: { title: true },
  });
  const periodTitle = period?.title ?? "Latber";

  const existing = await prisma.eventRegistration.findFirst({
    where: { eventId, memberId, status: { notIn: ["CANCELLED", "REJECTED"] } },
    select: { id: true, status: true },
  });

  if (existing && existing.status !== "PENDING") {
    return NextResponse.json({
      success: true,
      alreadyRegistered: true,
      registrationId: existing.id,
      displayStatus: "belum_bayar",
    });
  }

  const dbReg = await forceRegisterLatberInDb({
    eventId,
    memberId,
    registeredByUserId: session.user.id,
    periodTitle,
    amount: 0,
    status: "PENDING",
  });
  if (!dbReg.ok) {
    return NextResponse.json({ error: dbReg.error }, { status: 400 });
  }

  const existingMeta = await loadLatberSelfRegistrationMeta(eventId, memberId);
  await upsertLatberSelfRegistrationMeta(eventId, memberId, {
    source: "member",
    registeredAt: existingMeta?.registeredAt ?? new Date().toISOString(),
    memberPaymentConfirmedAt: existingMeta?.memberPaymentConfirmedAt ?? null,
  });

  writeAuditLog({
    userId: session.user.id,
    email: session.user.email,
    action: "LATBER_SELF_REGISTER",
    details: `Self-registered ${member.fullName} for ${eventId}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token,
  });

  return NextResponse.json({
    success: true,
    alreadyRegistered: Boolean(existing),
    registrationId: dbReg.registrationId,
    displayStatus: "menunggu_terima_ranting",
  });
}

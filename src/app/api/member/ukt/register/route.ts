import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import {
  DEFAULT_MEMBER_RANK,
  encodeUktRegisteredRank,
  formatRankLabel,
} from "@/lib/belt";
import { prisma } from "@/lib/prisma";
import {
  forceRegisterUktPendingInDb,
  validateUktRegistrationEligibility,
} from "@/lib/ukt-register";
import {
  upsertUktSelfRegistrationMeta,
  loadUktSelfRegistrationMeta,
} from "@/lib/ukt-self-registration";
import { notifyUktStatusChange } from "@/lib/ukt-notify";
import { notifyDojoAndBranchAdmins } from "@/lib/admin-notify-scope";
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

  const eligibility = await validateUktRegistrationEligibility(
    token,
    eventId,
    memberId,
    { primaryRole: "MEMBER" },
  );
  if (!eligibility.ok) {
    return NextResponse.json(
      {
        error: eligibility.error,
        blockers: eligibility.blockers,
        gate: true,
      },
      { status: 403 },
    );
  }

  const member = await prisma.member.findFirst({
    where: { id: memberId, isDeleted: false },
    select: {
      id: true,
      fullName: true,
      currentRank: true,
      dojoId: true,
    },
  });
  if (!member) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  const kyuLama =
    formatRankLabel(member.currentRank) ||
    member.currentRank ||
    DEFAULT_MEMBER_RANK;
  const registeredRank = encodeUktRegisteredRank(kyuLama, "");

  const dbReg = await forceRegisterUktPendingInDb({
    eventId,
    memberId,
    registeredByUserId: session.user.id,
    kyuLamaSnapshot: registeredRank,
  });
  if (!dbReg.ok) {
    return NextResponse.json({ error: dbReg.error }, { status: 400 });
  }

  const existingMeta = await loadUktSelfRegistrationMeta(eventId, memberId);
  if (!existingMeta || dbReg.status === "PENDING") {
    await upsertUktSelfRegistrationMeta(eventId, memberId, {
      source: "member",
      registeredAt: existingMeta?.registeredAt ?? new Date().toISOString(),
      memberPaymentConfirmedAt: existingMeta?.memberPaymentConfirmedAt ?? null,
    });
  }

  // Jika sudah APPROVED (didaftarkan ranting) — idempotent
  if (dbReg.alreadyRegistered && dbReg.status !== "PENDING") {
    return NextResponse.json({
      success: true,
      alreadyRegistered: true,
      registrationId: dbReg.registrationId,
      displayStatus:
        dbReg.status === "APPROVED" ? "belum_bayar" : "menunggu_terima_ranting",
    });
  }

  const memberName = dbReg.memberName || member.fullName;
  const period = await prisma.event.findFirst({
    where: { id: eventId },
    select: { title: true },
  });
  const periodTitle = period?.title ?? "UKT";

  writeAuditLog({
    userId: session.user.id,
    email: session.user.email,
    action: "UKT_SELF_REGISTER",
    details: `Self-registered ${memberName} for ${eventId}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token,
  });

  void notifyUktStatusChange({
    token,
    memberId,
    memberName,
    periodTitle,
    displayStatus: "menunggu_terima_ranting",
    extra: "Pengajuan terkirim. Bayar ke ketua ranting, lalu konfirmasi di kartu Status UKT.",
  }).catch((err) => console.error("[UKT self-register] notify member", err));

  if (member.dojoId) {
    void notifyDojoAndBranchAdmins({
      dojoId: member.dojoId,
      token,
      title: "UKT — Pendaftaran mandiri anggota",
      content: `${memberName} mendaftar UKT mandiri (${periodTitle}). Status: Menunggu Terima Ranting.`,
      type: "INFO",
    }).catch((err) => console.error("[UKT self-register] notify ranting", err));
  }

  return NextResponse.json({
    success: true,
    alreadyRegistered: dbReg.alreadyRegistered,
    registrationId: dbReg.registrationId,
    displayStatus: "menunggu_terima_ranting",
  });
}

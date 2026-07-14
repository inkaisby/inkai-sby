import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { buildEventFilter, buildMemberFilter } from "@/lib/rbac";
import { uktRegisterSchema } from "@/lib/security/schemas";
import { pickUniqueEventFeeAmount, resolveRankFee } from "@/lib/ukt-fee";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const parsed = uktRegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const { eventId, memberId } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { id: eventId, ...buildEventFilter(authResult.user), isDeleted: false },
      });

      if (!event) {
        throw new Error("Periode UKT tidak ditemukan");
      }

      const member = await tx.member.findFirst({
        where: { id: memberId, ...buildMemberFilter(authResult.user) },
      });

      if (!member) {
        throw new Error("Anggota tidak ditemukan");
      }

      const existing = await tx.eventRegistration.findFirst({
        where: { eventId, memberId },
      });

      if (existing) {
        throw new Error("Anggota sudah terdaftar di periode ini");
      }

      const templates = await tx.rankFeeTemplate.findMany();
      const baseFee = await resolveRankFee(member.currentRank, templates);

      const registration = await tx.eventRegistration.create({
        data: {
          eventId,
          memberId,
          registeredByUserId: authResult.user.id,
          registeredRank: member.currentRank,
          status: "PENDING",
        },
      });

      const { baseRounded, uniqueTail, total } = await pickUniqueEventFeeAmount(
        tx,
        eventId,
        baseFee,
      );

      const billing = await tx.billing.create({
        data: {
          memberId,
          registrationId: registration.id,
          type: "EVENT_FEE",
          amount: total,
          baseFeeAmount: baseRounded,
          uniqueTail,
          description: `Biaya UKT — ${event.title}`,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "PENDING",
        },
      });

      return { registration, billing, memberName: member.fullName, eventTitle: event.title };
    });

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "UKT_REGISTER",
      details: `Registered ${result.memberName} for ${result.eventTitle}`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      success: true,
      registrationId: result.registration.id,
      billingId: result.billing.id,
    });
  } catch (error) {
    console.error("[UKT Register]", error);
    const message = error instanceof Error ? error.message : "Gagal mendaftarkan anggota";
    const status = message.includes("sudah terdaftar") ? 409 : message.includes("tidak ditemukan") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

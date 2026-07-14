import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { buildEventFilter, buildMemberFilter } from "@/lib/rbac";
import { uktRegisterSchema } from "@/lib/security/schemas";
import { pickUniqueEventFeeAmount, resolveRankFee } from "@/lib/ukt-fee";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const body = await request.json();
  const parsed = uktRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { eventId, memberId } = parsed.data;

  const [event, member] = await Promise.all([
    prisma.event.findFirst({
      where: { id: eventId, ...buildEventFilter(authResult.user), isDeleted: false },
      include: { categories: true },
    }),
    prisma.member.findFirst({
      where: { id: memberId, ...buildMemberFilter(authResult.user) },
      include: { dojo: true },
    }),
  ]);

  if (!event) {
    return NextResponse.json({ error: "Periode UKT tidak ditemukan" }, { status: 404 });
  }
  if (!member) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  const existing = await prisma.eventRegistration.findFirst({
    where: { eventId, memberId },
  });
  if (existing) {
    return NextResponse.json({ error: "Anggota sudah terdaftar di periode ini" }, { status: 409 });
  }

  const templates = await prisma.rankFeeTemplate.findMany();
  const baseFee = await resolveRankFee(member.currentRank, templates);

  const result = await prisma.$transaction(async (tx) => {
    const registration = await tx.eventRegistration.create({
      data: {
        eventId,
        memberId,
        registeredByUserId: authResult.user.id,
        registeredRank: member.currentRank,
        status: "PENDING",
      },
    });

    const { baseRounded, uniqueTail, total } = await pickUniqueEventFeeAmount(tx, eventId, baseFee);

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

    return { registration, billing };
  });

  await writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_REGISTER",
    details: `Registered ${member.fullName} for ${event.title}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    success: true,
    registrationId: result.registration.id,
    billingId: result.billing.id,
  });
}

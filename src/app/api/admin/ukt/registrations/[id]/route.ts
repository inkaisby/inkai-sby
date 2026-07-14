import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { buildMemberFilter, getPrimaryAdminRole } from "@/lib/rbac";
import { canEditKyuBaru } from "@/lib/belt";
import { uktRegistrationUpdateSchema } from "@/lib/security/schemas";
import { pickUniqueEventFeeAmount, resolveRankFee } from "@/lib/ukt-fee";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = uktRegistrationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const registration = await prisma.eventRegistration.findFirst({
    where: {
      id,
      member: buildMemberFilter(authResult.user),
      event: { isDeleted: false },
    },
    include: {
      member: true,
      event: { include: { categories: true } },
      category: true,
    },
  });

  if (!registration) {
    return NextResponse.json({ error: "Pendaftaran tidak ditemukan" }, { status: 404 });
  }

  const data = parsed.data;
  const role = getPrimaryAdminRole(authResult.user.roles);
  const isCabang = canEditKyuBaru(authResult.user.roles);

  if (data.newRank && !isCabang) {
    return NextResponse.json({ error: "Kyu Baru hanya dapat diubah oleh admin cabang" }, { status: 403 });
  }

  if (data.action === "approve" || data.action === "reject" || data.status) {
    const canApprove = ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(role);
    if (!canApprove && data.action !== "reject") {
      return NextResponse.json({ error: "Hanya admin cabang yang dapat menyetujui pendaftaran" }, { status: 403 });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const updates: Record<string, unknown> = {};

    if (data.action === "approve" || data.status === "APPROVED") {
      updates.status = "APPROVED";
    } else if (data.action === "reject" || data.status === "REJECTED") {
      updates.status = "REJECTED";
    } else if (data.action === "mark_paid" || data.status === "PAID") {
      updates.status = "PAID";
    } else if (data.status) {
      updates.status = data.status;
    }

    if (data.newRank) {
      let category = registration.event.categories.find(
        (c) => c.name.toLowerCase() === data.newRank!.toLowerCase(),
      );
      if (!category) {
        const templates = await tx.rankFeeTemplate.findMany();
        const fee = await resolveRankFee(data.newRank, templates);
        category = await tx.eventCategory.create({
          data: { eventId: registration.eventId, name: data.newRank, fee },
        });
      }
      updates.categoryId = category.id;

      if (updates.status === "APPROVED" || updates.status === "PAID" || registration.status === "APPROVED") {
        await tx.member.update({
          where: { id: registration.memberId },
          data: { currentRank: data.newRank },
        });
        await tx.memberRank.create({
          data: {
            memberId: registration.memberId,
            rank: data.newRank,
            date: new Date(),
            location: registration.event.location || "Surabaya",
            isVerified: true,
          },
        });
      }

      const billing = await tx.billing.findFirst({
        where: { registrationId: id, isDeleted: false },
      });
      if (billing && billing.status === "PENDING") {
        const { baseRounded, uniqueTail, total } = await pickUniqueEventFeeAmount(
          tx,
          registration.eventId,
          category.fee,
          billing.id,
        );
        await tx.billing.update({
          where: { id: billing.id },
          data: { amount: total, baseFeeAmount: baseRounded, uniqueTail },
        });
      }
    }

    if (data.categoryId) {
      updates.categoryId = data.categoryId;
    }

    const updated = await tx.eventRegistration.update({
      where: { id },
      data: updates,
      include: { category: true, member: { include: { dojo: true } } },
    });

    if (data.action === "mark_paid") {
      const billing = await tx.billing.findFirst({ where: { registrationId: id, isDeleted: false } });
      if (billing) {
        await tx.billing.update({ where: { id: billing.id }, data: { status: "PAID" } });
      }
    }

    return updated;
  });

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_REGISTRATION_UPDATE",
    details: `Updated registration ${id}: ${JSON.stringify(data)}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, registration: result });
}

export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await context.params;

  const registration = await prisma.eventRegistration.findFirst({
    where: {
      id,
      member: buildMemberFilter(authResult.user),
    },
    include: { member: true },
  });

  if (!registration) {
    return NextResponse.json({ error: "Pendaftaran tidak ditemukan" }, { status: 404 });
  }

  const billing = await prisma.billing.findFirst({
    where: { registrationId: id, isDeleted: false },
  });

  if (billing?.status === "PAID") {
    return NextResponse.json({ error: "Tidak dapat menghapus pendaftaran yang sudah lunas" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (billing) {
      await tx.billing.update({ where: { id: billing.id }, data: { isDeleted: true } });
    }
    await tx.eventRegistration.delete({ where: { id } });
  });

  return NextResponse.json({ success: true });
}

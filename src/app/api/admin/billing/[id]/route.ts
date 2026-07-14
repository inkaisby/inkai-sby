import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { buildBillingFilter } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { getClientIp } from "@/lib/security/request";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNotes: z.string().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const billing = await prisma.billing.findFirst({
    where: { id, ...buildBillingFilter(authResult.user) },
    include: { member: { include: { user: true } }, payment: true },
  });

  if (!billing) {
    return NextResponse.json({ error: "Tagihan tidak ditemukan" }, { status: 404 });
  }

  if (billing.status !== "WAITING_VERIFICATION") {
    return NextResponse.json(
      { error: "Tagihan tidak dalam status verifikasi" },
      { status: 400 }
    );
  }

  const ip = getClientIp(request);
  const newStatus = parsed.data.action === "approve" ? "PAID" : "REJECTED";

  await prisma.$transaction(async (tx) => {
    await tx.billing.update({
      where: { id },
      data: { status: newStatus },
    });
    if (parsed.data.action === "approve" && billing.payment) {
      await tx.payment.update({
        where: { billingId: id },
        data: { paidAt: new Date() },
      });
    }
    if (billing.member.userId) {
      await tx.notification.create({
        data: {
          title:
            parsed.data.action === "approve"
              ? "Iuran Disetujui"
              : "Iuran Ditolak",
          content:
            parsed.data.action === "approve"
              ? `Pembayaran iuran ${billing.type} Anda telah diverifikasi dan disetujui.`
              : `Pembayaran iuran ${billing.type} ditolak. Hubungi admin untuk informasi lebih lanjut.`,
          type: parsed.data.action === "approve" ? "SUCCESS" : "WARNING",
          userId: billing.member.userId,
        },
      });
    }
  });

  await writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: parsed.data.action === "approve" ? "BILLING_APPROVE" : "BILLING_REJECT",
    details: `${newStatus} billing ${id} for ${billing.member.fullName}`,
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  await notifyUser({
    userId: authResult.user.id,
    title:
      parsed.data.action === "approve"
        ? "Iuran Diverifikasi"
        : "Iuran Ditolak",
    content: `Verifikasi iuran ${billing.member.fullName} (${newStatus}) berhasil disimpan.`,
    type: parsed.data.action === "approve" ? "SUCCESS" : "WARNING",
  });

  return NextResponse.json({
    success: true,
    status: newStatus,
    message:
      parsed.data.action === "approve"
        ? "Iuran berhasil diverifikasi"
        : "Iuran berhasil ditolak",
  });
}

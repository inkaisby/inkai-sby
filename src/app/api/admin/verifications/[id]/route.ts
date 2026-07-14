import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { buildVerificationFilter } from "@/lib/rbac";
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

  const claim = await prisma.verification.findFirst({
    where: { id, ...buildVerificationFilter(authResult.user) },
    include: { member: { include: { user: true } } },
  });

  if (!claim) {
    return NextResponse.json({ error: "Verifikasi tidak ditemukan" }, { status: 404 });
  }

  if (claim.status !== "PENDING") {
    return NextResponse.json(
      { error: "Verifikasi sudah diproses" },
      { status: 400 }
    );
  }

  const ip = getClientIp(request);
  const newStatus = parsed.data.action === "approve" ? "APPROVED" : "REJECTED";

  await prisma.$transaction(async (tx) => {
    await tx.verification.update({
      where: { id },
      data: {
        status: newStatus,
        ...(parsed.data.adminNotes ? { adminNotes: parsed.data.adminNotes } : {}),
      },
    });
    if (claim.member.userId) {
      await tx.notification.create({
        data: {
          title:
            parsed.data.action === "approve"
              ? "Verifikasi Disetujui"
              : "Verifikasi Ditolak",
          content:
            parsed.data.action === "approve"
              ? `Pengajuan ${claim.type} Anda telah disetujui admin.`
              : `Pengajuan ${claim.type} ditolak.${parsed.data.adminNotes ? ` Catatan: ${parsed.data.adminNotes}` : ""}`,
          type: parsed.data.action === "approve" ? "SUCCESS" : "WARNING",
          userId: claim.member.userId,
        },
      });
    }
  });

  await writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action:
      parsed.data.action === "approve"
        ? "VERIFICATION_APPROVE"
        : "VERIFICATION_REJECT",
    details: `${newStatus} verification ${id} (${claim.type}) for ${claim.member.fullName}`,
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  await notifyUser({
    userId: authResult.user.id,
    title:
      parsed.data.action === "approve"
        ? "Verifikasi Disetujui"
        : "Verifikasi Ditolak",
    content: `Pengajuan ${claim.type} dari ${claim.member.fullName} berhasil diproses (${newStatus}).`,
    type: parsed.data.action === "approve" ? "SUCCESS" : "WARNING",
  });

  return NextResponse.json({
    success: true,
    status: newStatus,
    message:
      parsed.data.action === "approve"
        ? "Verifikasi berhasil disetujui"
        : "Verifikasi berhasil ditolak",
  });
}

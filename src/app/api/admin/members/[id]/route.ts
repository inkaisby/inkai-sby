import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { buildMemberFilter } from "@/lib/rbac";
import { memberActionSchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = memberActionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const member = await prisma.member.findFirst({
    where: { id, ...buildMemberFilter(authResult.user) },
    include: { user: true },
  });

  if (!member) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  const ip = getClientIp(request);

  if (parsed.data.action === "approve") {
    await prisma.$transaction(async (tx) => {
      await tx.member.update({
        where: { id },
        data: {
          status: "Active",
          ...(parsed.data.nia ? { nia: parsed.data.nia } : {}),
        },
      });
      if (member.userId) {
        await tx.user.update({
          where: { id: member.userId },
          data: { isActive: true },
        });
        await tx.notification.create({
          data: {
            title: "Pendaftaran Disetujui",
            content:
              "Selamat! Pendaftaran Anda sebagai anggota INKAI Surabaya telah disetujui. Silakan login ke dashboard.",
            type: "SUCCESS",
            userId: member.userId,
          },
        });
      }
    });

    await writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "MEMBER_APPROVE",
      details: `Approved member ${member.fullName} (${id})`,
      ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ success: true, status: "Active" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.member.update({
      where: { id },
      data: { status: "REJECTED" },
    });
    if (member.userId) {
      await tx.user.update({
        where: { id: member.userId },
        data: { isActive: false },
      });
      await tx.notification.create({
        data: {
          title: "Pendaftaran Ditolak",
          content:
            "Pendaftaran Anda belum dapat disetujui. Hubungi admin dojo/cabang untuk informasi lebih lanjut.",
          type: "WARNING",
          userId: member.userId,
        },
      });
    }
  });

  await writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "MEMBER_REJECT",
    details: `Rejected member ${member.fullName} (${id})`,
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, status: "REJECTED" });
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { buildMemberFilter } from "@/lib/rbac";
import { canManageIuranByWilayah } from "@/lib/wilayah-rbac";
import { adminIuranReportSetorSchema } from "@/lib/security/schemas";
import { reportIuranSetorPeriod } from "@/lib/iuran-setor-period";
import { getClientIp } from "@/lib/security/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }
  if (!canManageIuranByWilayah(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Anda tidak berhak mencatat setor iuran" },
      { status: 403 },
    );
  }

  const { id: memberId } = await context.params;
  const member = await prisma.member.findFirst({
    where: { AND: [{ id: memberId }, buildMemberFilter(authResult.user)] },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.json(
      { error: "Anggota tidak ditemukan atau di luar wilayah Anda" },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = adminIuranReportSetorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  const result = await reportIuranSetorPeriod({
    memberId,
    period: parsed.data.period,
    paidAtYmd: parsed.data.paidAt,
    token: authResult.token,
    paymentMethod: parsed.data.paymentMethod,
    billingAction: "ranting_report_setor",
    actor: {
      userId: authResult.user.id,
      email: authResult.user.email,
    },
    notesExtra: parsed.data.adminNotes,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    allowCreateWhenExempt: true,
    successMessage: `Setor ${parsed.data.period} dicatat. Menunggu setujui/verifikasi.`,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    billingId: result.billingId,
    period: result.period,
    amount: result.amount,
  });
}

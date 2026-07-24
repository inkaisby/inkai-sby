import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { buildMemberFilter } from "@/lib/rbac";
import { canManageIuranByWilayah } from "@/lib/wilayah-rbac";
import { getClientIp } from "@/lib/security/request";
import { writeLocalAuditLog } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

const IURAN_TRAIL_ACTIONS = new Set([
  "BILLING_VERIFY",
  "BILLING_UPDATE",
  "BILLING_SUBMIT_VERIFICATION",
  "BILLING_GENERATE_MONTHLY",
  "BILLING_MEMBER_REPORT",
]);

export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  if (!canManageIuranByWilayah(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Anda tidak berhak menghapus jejak iuran" },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const memberId = url.searchParams.get("memberId")?.trim();
  if (!memberId) {
    return NextResponse.json({ error: "memberId wajib" }, { status: 400 });
  }

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

  const entry = await prisma.auditLog.findFirst({
    where: { id },
    select: { id: true, action: true, details: true },
  });
  if (!entry || !IURAN_TRAIL_ACTIONS.has(entry.action)) {
    return NextResponse.json({ error: "Jejak tidak ditemukan" }, { status: 404 });
  }

  const details = entry.details || "";
  if (!details.includes(`memberId=${memberId}`)) {
    return NextResponse.json({ error: "Jejak tidak ditemukan" }, { status: 404 });
  }

  await prisma.auditLog.delete({ where: { id } });

  // Jejak meta lokal (tidak ditampilkan di filter rekening iuran)
  writeLocalAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "BILLING_AUDIT_DELETE",
    details: `memberId=${memberId} deletedAuditId=${id} action=${entry.action}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    success: true,
    message: "Jejak aksi dihapus",
  });
}

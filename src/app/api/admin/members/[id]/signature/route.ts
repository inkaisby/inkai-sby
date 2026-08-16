import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { buildMemberFilter } from "@/lib/rbac";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  signatureUrl: z.string().url().nullable(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const rlKey = `member-signature:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 30, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
  }

  const member = await prisma.member.findFirst({
    where: { AND: [{ id }, buildMemberFilter(authResult.user)] },
    select: { id: true, fullName: true },
  });
  if (!member) {
    return NextResponse.json(
      { error: "Anggota tidak ditemukan atau di luar wilayah Anda" },
      { status: 404 },
    );
  }

  const updated = await prisma.member.update({
    where: { id: member.id },
    data: {
      signatureUrl: parsed.data.signatureUrl,
      signatureUpdatedAt: parsed.data.signatureUrl ? new Date() : null,
    },
    select: {
      id: true,
      signatureUrl: true,
      signatureUpdatedAt: true,
    },
  });

  void writeAuditLog({
    userId: authResult.user.id,
    action: "MEMBER_SIGNATURE_UPDATE",
    details: `memberId=${member.id} ${parsed.data.signatureUrl ? "set" : "clear"}`,
    ip: getClientIp(request),
  });

  return NextResponse.json(updated);
}

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await context.params;
  const member = await prisma.member.findFirst({
    where: { AND: [{ id }, buildMemberFilter(authResult.user)] },
    select: {
      id: true,
      fullName: true,
      signatureUrl: true,
      signatureUpdatedAt: true,
    },
  });
  if (!member) {
    return NextResponse.json(
      { error: "Anggota tidak ditemukan atau di luar wilayah Anda" },
      { status: 404 },
    );
  }
  return NextResponse.json(member);
}

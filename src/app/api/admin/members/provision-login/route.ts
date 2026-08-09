import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { buildMemberFilter } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/security/request";
import { writeAuditLog } from "@/lib/audit";
import { provisionMemberNiaLogin } from "@/lib/member-nia-login";
import { canToggleMemberActive } from "@/lib/wilayah-rbac";

const bodySchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1).max(100),
});

/**
 * Retry provision akun login NIA untuk anggota ber-NIA tanpa User.
 * Jalur utama auto-provision ada di create/set_nia/backfill.
 */
export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  if (!canToggleMemberActive(authResult.user.roles)) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "memberIds wajib (maks 100)" }, { status: 400 });
  }

  const scope = buildMemberFilter(authResult.user);
  const scoped = await prisma.member.findMany({
    where: {
      AND: [{ id: { in: parsed.data.memberIds } }, scope],
    },
    select: { id: true, nia: true, userId: true, fullName: true },
  });
  const scopedIds = new Set(scoped.map((m) => m.id));

  let okCount = 0;
  let failCount = 0;
  const results: Array<{
    memberId: string;
    status: string;
    reason?: string;
    email?: string;
  }> = [];

  for (const id of parsed.data.memberIds) {
    if (!scopedIds.has(id)) {
      failCount += 1;
      results.push({ memberId: id, status: "failed", reason: "out_of_scope" });
      continue;
    }
    const result = await provisionMemberNiaLogin(id, {
      actorUserId: authResult.user.id,
      actorEmail: authResult.user.email,
    });
    if (result.status === "created") {
      okCount += 1;
      results.push({
        memberId: id,
        status: "created",
        email: result.email,
      });
    } else if (result.status === "skipped") {
      if (result.reason === "already_has_user") {
        okCount += 1;
        results.push({
          memberId: id,
          status: "skipped",
          reason: result.reason,
          email: result.email ?? undefined,
        });
      } else {
        failCount += 1;
        results.push({
          memberId: id,
          status: "skipped",
          reason: result.reason,
        });
      }
    } else {
      failCount += 1;
      results.push({
        memberId: id,
        status: "failed",
        reason: result.reason,
      });
    }
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "MEMBER_NIA_LOGIN_PROVISION_BULK",
    details: `ok=${okCount} fail=${failCount} ids=${parsed.data.memberIds.length}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: failCount === 0,
    okCount,
    failCount,
    results,
    message:
      failCount === 0
        ? `${okCount} akun login siap (dibuat / sudah ada)`
        : `${okCount} berhasil, ${failCount} gagal/dilewati`,
  });
}

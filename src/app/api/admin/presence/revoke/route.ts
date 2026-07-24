import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeLocalAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  buildPresenceScopeWhere,
  canViewAccountPresence,
} from "@/lib/presence";
import { getClientIp } from "@/lib/security/request";
import {
  rateLimitAsync,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import { revokeUserSessions } from "@/lib/security/session-control";
import { isCurrentlyImpersonating } from "@/lib/security/impersonation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  if (!canViewAccountPresence(authResult.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (await isCurrentlyImpersonating()) {
    return NextResponse.json(
      { error: "Tidak dapat mencabut sesi saat mode ambil alih" },
      { status: 403 },
    );
  }

  const rlKey = `presence:revoke:${authResult.user.id}`;
  const limit = await rateLimitAsync(rlKey, { max: 20, windowMs: 60_000 });
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfterSec ?? 30, rlKey);
  }

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    reason?: string;
  };
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "userId wajib" }, { status: 400 });
  }
  if (reason.length < 3) {
    return NextResponse.json(
      { error: "Alasan wajib diisi (min. 3 karakter)" },
      { status: 400 },
    );
  }
  if (userId === authResult.user.id) {
    return NextResponse.json(
      { error: "Tidak dapat mencabut sesi sendiri" },
      { status: 400 },
    );
  }

  const scope = buildPresenceScopeWhere(authResult.user, {
    includeInactive: true,
  });
  if (!scope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await prisma.user.findFirst({
    where: { AND: [{ id: userId }, scope] },
    select: { id: true, email: true, fullName: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: "User tidak ditemukan atau di luar cakupan" },
      { status: 404 },
    );
  }

  await revokeUserSessions(target.id);

  writeLocalAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "SECURITY_SESSION_REVOKE",
    details: `targetUserId=${target.id} targetEmail=${target.email} reason=${reason.slice(0, 200)}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    success: true,
    message: `Sesi ${target.fullName || target.email} dicabut`,
  });
}

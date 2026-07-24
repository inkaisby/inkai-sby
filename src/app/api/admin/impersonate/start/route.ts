import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/security/request";
import {
  rateLimitAsync,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import {
  isCurrentlyImpersonating,
  startImpersonation,
} from "@/lib/security/impersonation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  if (await isCurrentlyImpersonating()) {
    return NextResponse.json(
      { error: "Sudah dalam mode ambil alih" },
      { status: 409 },
    );
  }

  const limit = await rateLimitAsync(
    `impersonate:start:${authResult.user.id}`,
    { max: 10, windowMs: 15 * 60_000 },
  );
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfterSec ?? 60);
  }

  const body = (await request.json().catch(() => ({}))) as {
    targetUserId?: string;
    reason?: string;
    password?: string;
    confirmPhrase?: string;
  };

  const result = await startImpersonation({
    actor: authResult.user,
    targetUserId:
      typeof body.targetUserId === "string" ? body.targetUserId.trim() : "",
    reason: typeof body.reason === "string" ? body.reason : "",
    password: typeof body.password === "string" ? body.password : "",
    confirmPhrase:
      typeof body.confirmPhrase === "string" ? body.confirmPhrase : "",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    message: `Mengambil alih ${result.target.name || result.target.email}`,
    sessionId: result.sessionId,
    target: {
      id: result.target.id,
      email: result.target.email,
      name: result.target.name,
      roles: result.target.roles,
    },
  });
}

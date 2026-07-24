import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getClientIp } from "@/lib/security/request";
import {
  rateLimitAsync,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import {
  readImpersonationClaims,
  stopImpersonation,
} from "@/lib/security/impersonation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  const claims = await readImpersonationClaims();

  // Actor = impersonatorId (JWT sub), bukan session.user (target)
  const actorId = session?.impersonatorId || claims?.actorId;
  if (!session || !actorId || !claims) {
    return NextResponse.json(
      { error: "Tidak sedang dalam mode ambil alih" },
      { status: 400 },
    );
  }

  if (claims.actorId !== actorId) {
    return NextResponse.json({ error: "Sesi ambil alih tidak valid" }, { status: 403 });
  }

  const limit = await rateLimitAsync(`impersonate:stop:${actorId}`, {
    max: 20,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfterSec ?? 30);
  }

  const actor = await prisma.user.findFirst({
    where: { id: actorId, isDeleted: false },
    select: { email: true },
  });

  const result = await stopImpersonation({
    actorId,
    actorEmail: actor?.email ?? session.impersonatorId,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.stopped) {
    return NextResponse.json(
      { error: "Tidak sedang dalam mode ambil alih" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Mode ambil alih dihentikan",
  });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  clearPresence,
  touchPresence,
} from "@/lib/presence";
import { snapshotFromRequest } from "@/lib/session-audit";
import {
  rateLimitAsync,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type HeartbeatBody = {
  timezone?: string;
  language?: string;
  screen?: string;
  platform?: string;
};

/** Heartbeat kehadiran + jejak perangkat (path halaman tidak disimpan). */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimitAsync(`presence:hb:${userId}`, {
    max: 30,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfterSec ?? 30);
  }

  let body: HeartbeatBody = {};
  try {
    body = (await request.json()) as HeartbeatBody;
  } catch {
    body = {};
  }

  const snap = snapshotFromRequest(request, {
    timezone: body.timezone,
    language: body.language,
    screen: body.screen,
    platform: body.platform,
  });

  await touchPresence(userId, { snap });
  return NextResponse.json({ ok: true });
}

/** Hapus sinyal online (dipanggil sebelum logout / ganti akun). */
export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await clearPresence(userId);
  return NextResponse.json({ ok: true });
}

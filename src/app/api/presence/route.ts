import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  clearPresence,
  touchPresence,
} from "@/lib/presence";
import {
  rateLimitAsync,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/** Heartbeat kehadiran — auth wajib; path tidak disimpan (privasi). */
export async function POST() {
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

  await touchPresence(userId);
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

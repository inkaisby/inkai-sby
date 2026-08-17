import { NextResponse } from "next/server";
import { getUktPublicRoster } from "@/lib/ukt-public";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";

export const dynamic = "force-dynamic";

/** Cache singkat di memori proses — kurangi bentrok poll banyak tab. */
let cache:
  | { at: number; body: Awaited<ReturnType<typeof getUktPublicRoster>> }
  | null = null;
const CACHE_MS = 10_000;

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limited = await rateLimitAsync(`ukt-public-regs:${ip}`, {
    max: 60,
    windowMs: 60_000,
  });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60);
  }

  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return NextResponse.json(cache.body, {
      headers: {
        "Cache-Control": "public, max-age=5, s-maxage=10, stale-while-revalidate=30",
      },
    });
  }

  const body = await getUktPublicRoster();
  cache = { at: now, body };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=5, s-maxage=10, stale-while-revalidate=30",
    },
  });
}

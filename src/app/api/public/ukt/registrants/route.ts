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
  if (cache && now - cache.at < CACHE_MS && !cache.body.loadError) {
    return NextResponse.json(cache.body, {
      headers: {
        "Cache-Control": "public, max-age=5, s-maxage=10, stale-while-revalidate=30",
      },
    });
  }

  try {
    const body = await getUktPublicRoster();
    // Jangan cache payload error — hindari sticky empty/loadError palsu.
    if (!body.loadError) {
      cache = { at: now, body };
    }
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": body.loadError
          ? "no-store"
          : "public, max-age=5, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("[ukt-public] GET /registrants failed", error);
    return NextResponse.json(
      {
        period: {
          periodId: null,
          title: null,
          semester: null,
          year: null,
          examAt: null,
          examLocation: null,
          archived: false,
          locked: false,
        },
        registrants: [],
        loadError: true,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

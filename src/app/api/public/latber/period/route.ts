import { NextResponse } from "next/server";
import { getLatberPublicPeriod } from "@/lib/latber-public";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limited = await rateLimitAsync(`latber-public-period:${ip}`, {
    max: 60,
    windowMs: 60_000,
  });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60);
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period");
  const payload = await getLatberPublicPeriod(period);
  return NextResponse.json(payload);
}

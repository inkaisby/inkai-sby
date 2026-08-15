import { NextResponse } from "next/server";
import {
  loadLatberPublicRegistrants,
  resolveActiveLatberPeriodId,
} from "@/lib/latber-public";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limited = await rateLimitAsync(`latber-public-regs:${ip}`, {
    max: 60,
    windowMs: 60_000,
  });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60);
  }

  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period");
  const { period } = await resolveActiveLatberPeriodId(periodParam);
  if (!period) {
    return NextResponse.json({ registrants: [] });
  }

  const registrants = await loadLatberPublicRegistrants(period.id);
  return NextResponse.json({ periodId: period.id, registrants });
}

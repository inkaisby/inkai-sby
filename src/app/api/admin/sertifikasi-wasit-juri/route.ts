import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  fetchWasitJuriData,
  forbidWasitJuriAction,
} from "@/lib/wasit-juri-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const denied = forbidWasitJuriAction(
    authResult.user,
    authResult.adminDojoGrants,
    "read",
  );
  if (denied) return denied;

  const rlKey = `wasit-juri:get:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 60, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const data = await fetchWasitJuriData(authResult.user);
  return NextResponse.json(data);
}

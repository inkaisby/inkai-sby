import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";

const BLOCKED_HEADERS = ["x-middleware-subrequest"];

export function proxy(request: NextRequest) {
  for (const header of BLOCKED_HEADERS) {
    if (request.headers.get(header)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const { pathname } = request.nextUrl;

  if (
    request.method === "POST" &&
    (pathname.startsWith("/api/auth") || pathname === "/api/auth/register")
  ) {
    const ip = getClientIp(request);
    const limit = rateLimit(`auth-post:${ip}`, {
      max: 20,
      windowMs: 15 * 60 * 1000,
    });

    if (!limit.success) {
      return rateLimitResponse(limit.retryAfterSec ?? 60);
    }
  }

  if (request.method === "POST" && pathname === "/api/auth/register") {
    const ip = getClientIp(request);
    const limit = rateLimit(`register:${ip}`, {
      max: 5,
      windowMs: 60 * 60 * 1000,
    });

    if (!limit.success) {
      return rateLimitResponse(limit.retryAfterSec ?? 300);
    }
  }

  const response = NextResponse.next();
  response.headers.set("X-Request-Id", crypto.randomUUID());
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*", "/dashboard/:path*"],
};

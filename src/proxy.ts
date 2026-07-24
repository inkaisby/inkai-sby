import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  assertSameOrigin,
  getClientIp,
  isMutatingMethod,
} from "@/lib/security/request";

const BLOCKED_HEADERS = ["x-middleware-subrequest"];

export async function proxy(request: NextRequest) {
  for (const header of BLOCKED_HEADERS) {
    if (request.headers.get(header)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  if (
    isMutatingMethod(request.method) &&
    pathname.startsWith("/api/admin")
  ) {
    if (!assertSameOrigin(request)) {
      // Fire-and-forget; jangan await di critical path proxy
      void import("@/lib/security/security-events").then(({ writeSecurityEvent, bumpSecurityStrike }) => {
        writeSecurityEvent({
          action: "SECURITY_CSRF_REJECT",
          ip,
          details: `path=${pathname}`,
        });
        void bumpSecurityStrike(`csrf:${ip}`, { max: 15, windowMs: 10 * 60_000 });
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (
    request.method === "POST" &&
    (pathname.startsWith("/api/auth") || pathname === "/api/auth/register")
  ) {
    const limit = await rateLimitAsync(`auth-post:${ip}`, {
      max: 20,
      windowMs: 15 * 60 * 1000,
    });

    if (!limit.success) {
      return rateLimitResponse(limit.retryAfterSec ?? 60);
    }
  }

  if (request.method === "POST" && pathname === "/api/auth/register") {
    const limit = await rateLimitAsync(`register:${ip}`, {
      max: 5,
      windowMs: 60 * 60 * 1000,
    });

    if (!limit.success) {
      return rateLimitResponse(limit.retryAfterSec ?? 300);
    }
  }

  if (request.method === "POST" && pathname === "/api/auth/validate") {
    const limit = await rateLimitAsync(`auth-validate:${ip}`, {
      max: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.success) {
      return rateLimitResponse(limit.retryAfterSec ?? 60);
    }
  }

  if (pathname.startsWith("/api/auth/register/check")) {
    const limit = await rateLimitAsync(`register-check:${ip}`, {
      max: 30,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.success) {
      return rateLimitResponse(limit.retryAfterSec ?? 60);
    }
  }

  if (pathname.startsWith("/v/")) {
    const limit = await rateLimitAsync(`verify-card:${ip}`, {
      max: 40,
      windowMs: 60_000,
    });
    if (!limit.success) {
      return rateLimitResponse(limit.retryAfterSec ?? 60);
    }
  }

  const response = NextResponse.next();
  response.headers.set("X-Request-Id", crypto.randomUUID());
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*", "/dashboard/:path*", "/v/:path*"],
};

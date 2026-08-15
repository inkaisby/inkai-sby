import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  assertSameOrigin,
  assertSameOriginLoose,
  getClientIp,
  isMutatingMethod,
} from "@/lib/security/request";
import { INKAI_TOKEN_COOKIE } from "@/lib/inkai-api/cookies";

const BLOCKED_HEADERS = ["x-middleware-subrequest"];

function hasSessionCookie(request: NextRequest): boolean {
  if (request.cookies.get(INKAI_TOKEN_COOKIE)?.value) return true;
  if (request.cookies.get("authjs.session-token")?.value) return true;
  if (request.cookies.get("__Secure-authjs.session-token")?.value) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  for (const header of BLOCKED_HEADERS) {
    if (request.headers.get(header)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  // Publik walk-in: /admin/latber tanpa sesi → /latber (arsip tetap admin)
  if (
    request.method === "GET" &&
    (pathname === "/admin/latber" || pathname === "/admin/latber/")
  ) {
    if (!hasSessionCookie(request)) {
      const url = request.nextUrl.clone();
      url.pathname = "/latber";
      return NextResponse.redirect(url);
    }
  }

  if (
    isMutatingMethod(request.method) &&
    pathname.startsWith("/api/admin")
  ) {
    if (!assertSameOrigin(request)) {
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
    isMutatingMethod(request.method) &&
    pathname.startsWith("/api/public/latber")
  ) {
    if (!assertSameOriginLoose(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const limit = await rateLimitAsync(`latber-public-mutate:${ip}`, {
      max: 30,
      windowMs: 60_000,
    });
    if (!limit.success) {
      return rateLimitResponse(limit.retryAfterSec ?? 60);
    }
  }

  if (pathname.startsWith("/api/public/latber")) {
    const limit = await rateLimitAsync(`latber-public-get:${ip}`, {
      max: 90,
      windowMs: 60_000,
    });
    if (!limit.success) {
      return rateLimitResponse(limit.retryAfterSec ?? 60);
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

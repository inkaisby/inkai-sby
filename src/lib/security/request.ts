export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Same-origin check for mutating requests.
 * Requires Origin or Referer to match Host (missing both → reject).
 */
export function assertSameOrigin(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  // Non-browser clients (curl, server-to-server) often omit Origin/Referer.
  // Allow only when both are absent AND a custom header is present for APIs
  // that opt in via assertSameOriginLoose — default is strict reject.
  return false;
}

/** Lenient check for auth flows that may omit Origin on some browsers. */
export function assertSameOriginLoose(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin) {
    const referer = request.headers.get("referer");
    if (!referer) return true;
    if (!host) return false;
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function assertJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type") || "";
  return contentType.includes("application/json");
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isMutatingMethod(method: string): boolean {
  return MUTATING.has(method.toUpperCase());
}

/**
 * Pure helpers for Inkai JWT soft-check + portal status mapping.
 * Keep free of server-only imports so unit tests can import directly.
 */

export const INKAI_JWT_NEAR_EXPIRY_SEC = 5 * 60;

/** Decode JWT `exp` (seconds) without verifying signature — soft expiry only. */
export function decodeJwtExpSeconds(token: string | null | undefined): number | null {
  if (!token?.trim()) return null;
  const parts = token.trim().split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = payload.length % 4 === 0 ? "" : "=".repeat(4 - (payload.length % 4));
    const json =
      typeof atob === "function"
        ? atob(payload + pad)
        : Buffer.from(payload + pad, "base64").toString("utf8");
    const parsed = JSON.parse(json) as { exp?: unknown };
    return typeof parsed.exp === "number" && Number.isFinite(parsed.exp)
      ? parsed.exp
      : null;
  } catch {
    return null;
  }
}

/** Soft-valid: has exp in the future (or missing exp → treat as usable until Inkai rejects). */
export function isInkaiTokenSoftValid(
  token: string | null | undefined,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  if (!token?.trim()) return false;
  const exp = decodeJwtExpSeconds(token);
  if (exp == null) return true;
  return exp > nowSec;
}

/** Prefer service token when user JWT missing, expired, or within near-expiry window. */
export function shouldPreferServiceToken(
  userToken: string | null | undefined,
  nowSec = Math.floor(Date.now() / 1000),
  nearExpirySec = INKAI_JWT_NEAR_EXPIRY_SEC,
): boolean {
  if (!userToken?.trim()) return true;
  const exp = decodeJwtExpSeconds(userToken);
  if (exp == null) return false;
  return exp <= nowSec + nearExpirySec;
}

/**
 * After requireAdmin succeeded, never forward Inkai auth 401 to the browser.
 * Auth failures → 502; other statuses preserved (except clamp nonsense).
 */
export function portalStatusFromInkai(inkaiStatus: number): number {
  if (inkaiStatus === 401) return 502;
  if (inkaiStatus === 403) return 403;
  if (inkaiStatus >= 400 && inkaiStatus < 600) return inkaiStatus;
  if (inkaiStatus === 0 || !Number.isFinite(inkaiStatus)) return 502;
  return inkaiStatus >= 200 && inkaiStatus < 300 ? inkaiStatus : 502;
}

/** Login page: auto-enter portal only when session + soft-valid Inkai token. */
export function shouldAutoEnterPortal(opts: {
  hasSession: boolean;
  inkaiToken: string | null | undefined;
  nowSec?: number;
}): boolean {
  if (!opts.hasSession) return false;
  return isInkaiTokenSoftValid(opts.inkaiToken, opts.nowSec);
}

export function inkaiServiceTokenFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const t =
    env.INKAI_SERVICE_TOKEN?.trim() || env.CRON_INKAI_TOKEN?.trim() || "";
  return t || null;
}

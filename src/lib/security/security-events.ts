import { writeLocalAuditLog } from "@/lib/audit";
import { rateLimitAsync } from "@/lib/security/rate-limit";

/** Fire-and-forget local audit for security-relevant signals. */
export function writeSecurityEvent(params: {
  action: string;
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
  details?: string;
}): void {
  const action = params.action.startsWith("SECURITY_")
    ? params.action
    : `SECURITY_${params.action}`;
  writeLocalAuditLog({
    userId: params.userId,
    email: params.email,
    action,
    details: params.details,
    ip: params.ip,
  });
}

/**
 * Bump a strike counter; when the window is exceeded, log SECURITY_ABUSE_BURST.
 * Returns true while still within the allowance.
 */
export async function bumpSecurityStrike(
  key: string,
  opts: { max?: number; windowMs?: number } = {},
): Promise<boolean> {
  const max = opts.max ?? 20;
  const windowMs = opts.windowMs ?? 60_000;
  const result = await rateLimitAsync(`security-strike:${key}`, {
    max,
    windowMs,
  });
  if (!result.success) {
    writeSecurityEvent({
      action: "SECURITY_ABUSE_BURST",
      details: `key=${key}`,
    });
  }
  return result.success;
}

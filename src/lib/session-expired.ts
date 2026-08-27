export const SESSION_EXPIRED_MESSAGE =
  "Sesi berakhir — silakan login ulang";

/**
 * Hard-logout only when portal requireAdmin said so — not every Inkai 401.
 */
export function isUnauthorizedPayload(
  status: number,
  error?: string | null,
): boolean {
  if (error === SESSION_EXPIRED_MESSAGE) return true;
  if (error === "Unauthorized" && status === 401) return true;
  return false;
}

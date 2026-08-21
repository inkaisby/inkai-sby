export type AuthBounceReason = "missing_session" | "missing_inkai_token";

/** Why a portal layout sent the user back to /login — for server logs only. */
export function authBounceReason(input: {
  hasSession: boolean;
  hasInkaiToken: boolean;
}): AuthBounceReason | null {
  if (!input.hasSession) return "missing_session";
  if (!input.hasInkaiToken) return "missing_inkai_token";
  return null;
}

export function logAuthBounce(
  where: string,
  reason: AuthBounceReason,
): void {
  console.info(`[auth.bounce] ${where} ${reason}`);
}

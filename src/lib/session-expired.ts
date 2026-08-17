export const SESSION_EXPIRED_MESSAGE =
  "Sesi berakhir — silakan login ulang";

export function isUnauthorizedPayload(
  status: number,
  error?: string | null,
): boolean {
  return status === 401 || error === "Unauthorized";
}

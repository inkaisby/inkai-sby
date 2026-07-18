const BLOCKED_MEMBER_STATUSES = new Set([
  "PENDING",
  "INACTIVE",
  "REJECTED",
  "SUSPENDED",
]);

export function isMemberLoginBlocked(status: string | null | undefined): boolean {
  if (!status) return false;
  return BLOCKED_MEMBER_STATUSES.has(status.toUpperCase());
}

export function isMemberInactiveLike(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toUpperCase();
  return s === "INACTIVE" || s === "SUSPENDED";
}

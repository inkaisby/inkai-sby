export function normalizeMemberPhotoUrl(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function resolveMemberPhotoUrl(
  memberPhotoUrl: string | null | undefined,
  userPhotoUrl?: string | null,
  fallbackPhotoUrl?: string | null,
): string | null {
  return (
    normalizeMemberPhotoUrl(memberPhotoUrl) ??
    normalizeMemberPhotoUrl(userPhotoUrl) ??
    normalizeMemberPhotoUrl(fallbackPhotoUrl)
  );
}

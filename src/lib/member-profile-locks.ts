import { BELT_RANK_OPTIONS, formatRankLabel, isBlackBeltRank } from "@/lib/belt";

export type ProfileLockFlags = {
  emailSelfEditedAt: Date | null;
  niaSelfEditedAt: Date | null;
  rankSelfEditedAt: Date | null;
  mshSelfEditedAt: Date | null;
};

export type LockedField = "email" | "nia" | "currentRank" | "mshNumber";

export function isFieldLocked(
  flags: ProfileLockFlags,
  field: LockedField,
): boolean {
  switch (field) {
    case "email":
      return Boolean(flags.emailSelfEditedAt);
    case "nia":
      return Boolean(flags.niaSelfEditedAt);
    case "currentRank":
      return Boolean(flags.rankSelfEditedAt);
    case "mshNumber":
      return Boolean(flags.mshSelfEditedAt);
  }
}

export function normalizeNia(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim().toUpperCase();
  return t || null;
}

export function normalizeMsh(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).replace(/\s+/g, "").trim().toUpperCase();
  return t || null;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  return t || null;
}

export function normalizeSelfRank(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const label = formatRankLabel(String(raw).trim());
  if (!label) return null;
  const ok = BELT_RANK_OPTIONS.some(
    (opt) => opt.toLowerCase() === label.toLowerCase(),
  );
  return ok ? label : null;
}

export function mshAllowedForRank(rank: string | null | undefined): boolean {
  return isBlackBeltRank(rank);
}

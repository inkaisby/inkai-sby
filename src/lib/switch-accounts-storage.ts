/** Riwayat akun yang pernah dipakai lewat Ganti Akun (per perangkat). */
const STORAGE_KEY = "inkai.switchAccounts.v1";
const MAX_RECENT = 8;

export type RecentSwitchAccount = {
  email: string;
  lastUsedAt: string;
};

function readRaw(): RecentSwitchAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is RecentSwitchAccount =>
          !!row &&
          typeof row === "object" &&
          typeof (row as RecentSwitchAccount).email === "string" &&
          (row as RecentSwitchAccount).email.includes("@"),
      )
      .map((row) => ({
        email: row.email.trim().toLowerCase(),
        lastUsedAt:
          typeof row.lastUsedAt === "string"
            ? row.lastUsedAt
            : new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

export function listRecentSwitchAccounts(opts?: {
  excludeEmail?: string;
}): RecentSwitchAccount[] {
  const exclude = opts?.excludeEmail?.trim().toLowerCase() || "";
  return readRaw()
    .filter((r) => r.email && r.email !== exclude)
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, MAX_RECENT);
}

export function rememberSwitchAccount(email: string) {
  if (typeof window === "undefined") return;
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return;
  const others = readRaw().filter((r) => r.email !== normalized);
  const next: RecentSwitchAccount[] = [
    { email: normalized, lastUsedAt: new Date().toISOString() },
    ...others,
  ].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

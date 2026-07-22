/** Konstanta presence — aman diimpor client & server (tanpa Prisma / alias). */

/** Online bila aktivitas dalam 5 menit. */
export const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
/** Heartbeat saat tab terlihat. */
export const HEARTBEAT_INTERVAL_VISIBLE_MS = 45_000;
/** Heartbeat saat tab tersembunyi (browser throttle). */
export const HEARTBEAT_INTERVAL_HIDDEN_MS = 120_000;
/** TTL key Redis presence. */
export const REDIS_PRESENCE_TTL_SEC = 120;
/** Batasi write lastSeenAt ke DB (hindari spam pool). */
export const DB_LAST_SEEN_THROTTLE_MS = 60_000;
/** Cakupan daftar “login 24 jam”. */
export const LOGIN_24H_MS = 24 * 60 * 60 * 1000;

/**
 * Pusat + cabang saja (bukan ranting / pengprov).
 * Prioritas peran selaras `getPrimaryAdminRole` di rbac.ts.
 */
export function canViewAccountPresence(roles: string[]) {
  const order = [
    "ADMINISTRATOR",
    "ADMIN_PUSAT",
    "ADMIN_PROVINCE",
    "ADMIN_BRANCH",
    "ADMIN_DOJO",
    "ADMIN",
  ];
  const primary = order.find((r) => roles.includes(r)) ?? "MEMBER";
  return (
    primary === "ADMINISTRATOR" ||
    primary === "ADMIN_PUSAT" ||
    primary === "ADMIN" ||
    primary === "ADMIN_BRANCH"
  );
}

export type PresenceListRow = {
  id: string;
  email: string;
  fullName: string | null;
  roles: string[];
  roleLabel: string;
  scopeLabel: string;
  online: boolean;
  lastSeenAt: string | null;
  lastLoginAt: string | null;
  isSelf: boolean;
  /** Jejak audit sesi aktif / terakhir. */
  session: {
    id: string | null;
    ip: string | null;
    deviceType: string | null;
    browser: string | null;
    os: string | null;
    deviceLabel: string | null;
    locationLabel: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
    timezone: string | null;
    language: string | null;
    screen: string | null;
    platform: string | null;
    userAgent: string | null;
    startedAt: string | null;
    lastSeenAt: string | null;
  } | null;
};

export function formatRelativeId(
  iso: string | null,
  now = Date.now(),
): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Math.max(0, now - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "baru saja";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} jam lalu`;
  const day = Math.floor(hour / 24);
  return `${day} hari lalu`;
}

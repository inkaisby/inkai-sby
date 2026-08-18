import { prisma } from "@/lib/prisma";
import { DB_LAST_SEEN_THROTTLE_MS } from "@/lib/presence-constants";
import { errorMessageOf } from "@/lib/prisma-errors";

/** Lock / statement timeout on best-effort heartbeat — skip quietly. */
export function isPresenceDbWriteSkippable(error: unknown): boolean {
  const lower = errorMessageOf(error).toLowerCase();
  return (
    lower.includes("55p03") ||
    lower.includes("57014") ||
    lower.includes("lock timeout") ||
    lower.includes("canceling statement due to statement timeout") ||
    lower.includes("could not obtain lock")
  );
}

/** Cutoff: skip DB write when lastSeenAt is newer than this. */
export function lastSeenWriteCutoff(
  stamp: Date,
  throttleMs = DB_LAST_SEEN_THROTTLE_MS,
): Date {
  return new Date(stamp.getTime() - throttleMs);
}

/** Pure: would a conditional lastSeenAt write change anything? */
export function shouldAllowDbLastSeenWrite(
  lastSeenAt: Date | null | undefined,
  stamp: Date,
  throttleMs = DB_LAST_SEEN_THROTTLE_MS,
): boolean {
  if (!lastSeenAt) return true;
  return lastSeenAt.getTime() < lastSeenWriteCutoff(stamp, throttleMs).getTime();
}

type MemoryTouchEntry = { at: number };

const memoryDbTouchStore = new Map<string, MemoryTouchEntry>();
const MEMORY_TOUCH_CLEANUP_MS = 60_000;
let lastMemoryTouchCleanup = Date.now();

function cleanupMemoryDbTouch(now: number) {
  if (now - lastMemoryTouchCleanup < MEMORY_TOUCH_CLEANUP_MS) return;
  lastMemoryTouchCleanup = now;
  for (const [key, entry] of memoryDbTouchStore) {
    if (now - entry.at > DB_LAST_SEEN_THROTTLE_MS * 2) {
      memoryDbTouchStore.delete(key);
    }
  }
}

/** In-process throttle when Redis unavailable (per serverless isolate). */
export function consumeMemoryDbTouch(
  userId: string,
  now = Date.now(),
  throttleMs = DB_LAST_SEEN_THROTTLE_MS,
): boolean {
  cleanupMemoryDbTouch(now);
  const entry = memoryDbTouchStore.get(userId);
  if (entry && now - entry.at < throttleMs) return false;
  memoryDbTouchStore.set(userId, { at: now });
  return true;
}

/** Test hook — reset in-process throttle map. */
export function resetMemoryDbTouchStoreForTests() {
  memoryDbTouchStore.clear();
  lastMemoryTouchCleanup = Date.now();
}

/**
 * Write User.lastSeenAt without RETURNING * (no passwordHash leak).
 * Conditional + lock_timeout so heartbeat does not convoy on hot rows.
 */
export async function writeUserLastSeenAt(
  userId: string,
  stamp: Date,
  opts?: { force?: boolean },
): Promise<void> {
  try {
    if (opts?.force) {
      await prisma.user.updateMany({
        where: { id: userId },
        data: { lastSeenAt: stamp },
      });
      return;
    }

    const cutoff = lastSeenWriteCutoff(stamp);
    await prisma.$transaction([
      prisma.$executeRawUnsafe(`SET LOCAL lock_timeout = '250ms'`),
      prisma.$executeRaw`
        UPDATE "User"
        SET "lastSeenAt" = ${stamp}
        WHERE id = ${userId}
          AND ("lastSeenAt" IS NULL OR "lastSeenAt" < ${cutoff})
      `,
    ]);
  } catch (error) {
    if (isPresenceDbWriteSkippable(error)) return;
    console.error("[presence] lastSeenAt", error);
  }
}

/** Login bootstrap: lastLoginAt + lastSeenAt without RETURNING *. */
export async function writeUserLoginTimestamps(
  userId: string,
  stamp: Date,
  setLastLogin: boolean,
): Promise<void> {
  try {
    await prisma.user.updateMany({
      where: { id: userId },
      data: {
        lastSeenAt: stamp,
        ...(setLastLogin ? { lastLoginAt: stamp } : {}),
      },
    });
  } catch (error) {
    if (isPresenceDbWriteSkippable(error)) return;
    console.error("[presence] login timestamps", error);
  }
}

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const memoryStore = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanupExpired(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) memoryStore.delete(key);
  }
}

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  retryAfterSec?: number;
  backend?: "upstash" | "memory";
};

function memoryRateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  cleanupExpired(now);

  const entry = memoryStore.get(key);
  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: max - 1, backend: "memory" };
  }

  if (entry.count >= max) {
    return {
      success: false,
      remaining: 0,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
      backend: "memory",
    };
  }

  entry.count += 1;
  return { success: true, remaining: max - entry.count, backend: "memory" };
}

/** Sync fallback — prefer `rateLimitAsync` on serverless. */
export function rateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): RateLimitResult {
  return memoryRateLimit(key, opts);
}

function hasUpstashEnv() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(max: number, windowMs: number): Ratelimit | null {
  if (!hasUpstashEnv()) return null;
  const bucket = `${max}:${windowMs}`;
  let limiter = upstashLimiters.get(bucket);
  if (!limiter) {
    const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
      prefix: "inkai-sby:rl",
      analytics: false,
    });
    upstashLimiters.set(bucket, limiter);
  }
  return limiter;
}

/**
 * Shared rate limit when Upstash env is set; otherwise process-local Map.
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN on Vercel.
 */
export async function rateLimitAsync(
  key: string,
  opts: { max: number; windowMs: number },
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(opts.max, opts.windowMs);
  if (!limiter) {
    return memoryRateLimit(key, opts);
  }

  try {
    const result = await limiter.limit(key);
    const retryAfterSec = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000),
    );
    return {
      success: result.success,
      remaining: result.remaining,
      retryAfterSec: result.success ? undefined : retryAfterSec,
      backend: "upstash",
    };
  } catch (error) {
    console.error("[rateLimitAsync] upstash failed, falling back to memory", error);
    return memoryRateLimit(key, opts);
  }
}

/**
 * 429 response. When `key` is given, fires a SECURITY_RATE_LIMIT event and
 * bumps the abuse-strike counter without blocking the response (dynamic
 * import avoids a circular dependency with security-events.ts).
 */
export function rateLimitResponse(retryAfterSec: number, key?: string) {
  if (key) {
    void import("@/lib/security/security-events").then(
      ({ writeSecurityEvent, bumpSecurityStrike }) => {
        writeSecurityEvent({ action: "SECURITY_RATE_LIMIT", details: `key=${key}` });
        void bumpSecurityStrike(key);
      },
    );
  }
  return new Response(
    JSON.stringify({
      error: "Terlalu banyak percobaan. Coba lagi nanti.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    },
  );
}

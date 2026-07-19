import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Keep serverless Prisma from exhausting shared Supabase pool (session mode ~15). */
function withServerlessPoolLimit(url: string | undefined) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isSupabasePooler = host.includes("pooler.supabase.com");

    // Session pooler (:5432) cepat habis di Vercel — pakai Transaction (:6543).
    if (isSupabasePooler && (!parsed.port || parsed.port === "5432")) {
      parsed.port = "6543";
    }

    // Transaction pooler needs pgbouncer=true for Prisma prepared statements.
    if (
      (parsed.port === "6543" || isSupabasePooler) &&
      !parsed.searchParams.has("pgbouncer")
    ) {
      parsed.searchParams.set("pgbouncer", "true");
    }
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "1");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "10");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: withServerlessPoolLimit(process.env.DATABASE_URL),
      },
    },
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Reuse client across hot reloads (dev) and warm serverless invocations (prod)
globalForPrisma.prisma = prisma;

export {
  errorMessageOf,
  isPrismaBusyError,
  settingsUsernameLoadWarning,
} from "@/lib/prisma-errors";

/** Run a Prisma query; on pool/timeout errors return fallback instead of crashing SSR. */
export async function withPrismaFallback<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<{ data: T; failed: boolean; error?: unknown }> {
  try {
    return { data: await fn(), failed: false };
  } catch (error) {
    console.error(`[prisma:${label}]`, error);
    return { data: fallback, failed: true, error };
  }
}

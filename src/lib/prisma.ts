import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/** Keep serverless Prisma from exhausting shared Supabase pool (session mode ~15). */
function withServerlessPoolLimit(url: string | undefined) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "1");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "20");
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
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Reuse client across hot reloads (dev) and warm serverless invocations (prod)
globalForPrisma.prisma = prisma;

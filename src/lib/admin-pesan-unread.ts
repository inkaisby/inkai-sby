import { unstable_cache } from "next/cache";
import { prisma, withPrismaFallback } from "@/lib/prisma";

async function countUnreadPesan(userId: string): Promise<number> {
  const result = await withPrismaFallback(
    "admin-pesan-unread-nav",
    () =>
      prisma.message.count({
        where: {
          isRead: false,
          senderId: { not: userId },
          conversation: {
            participants: { some: { id: userId } },
          },
        },
      }),
    0,
  );
  return result.data;
}

/** Cached 45s to cut Prisma hits on every admin navigation. */
export function getCachedAdminUnreadPesan(userId: string): Promise<number> {
  const cached = unstable_cache(
    () => countUnreadPesan(userId),
    ["admin-pesan-unread", userId],
    { revalidate: 45 },
  );
  return cached();
}

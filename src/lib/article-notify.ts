import { prisma } from "@/lib/prisma";

/** Notifikasi lokal (tanpa Inkai token) untuk antrean artikel. */
export async function notifyArticlePendingAdmins(opts: {
  dojoId: string;
  title: string;
  content: string;
  excludeUserId?: string;
}) {
  try {
    const [dojoAdmins, branchAdmins] = await Promise.all([
      prisma.user.findMany({
        where: {
          isDeleted: false,
          isActive: true,
          managedDojoId: opts.dojoId,
          roles: { some: { name: "ADMIN_DOJO" } },
        },
        select: { id: true },
        take: 30,
      }),
      prisma.user.findMany({
        where: {
          isDeleted: false,
          isActive: true,
          roles: {
            some: {
              name: {
                in: ["ADMIN_BRANCH", "ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN"],
              },
            },
          },
        },
        select: { id: true },
        take: 40,
      }),
    ]);

    const ids = [
      ...new Set(
        [...dojoAdmins, ...branchAdmins]
          .map((u) => u.id)
          .filter((id) => id !== opts.excludeUserId),
      ),
    ];
    if (ids.length === 0) return 0;

    await prisma.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        title: opts.title,
        content: opts.content,
        type: "INFO",
        audience: "ADMIN",
      })),
    });
    return ids.length;
  } catch (error) {
    console.error("[notifyArticlePendingAdmins]", error);
    return 0;
  }
}

export async function notifyArticleAuthor(opts: {
  userId: string;
  title: string;
  content: string;
  type?: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        userId: opts.userId,
        title: opts.title,
        content: opts.content,
        type: opts.type ?? "INFO",
        audience: "MEMBER",
      },
    });
    return true;
  } catch (error) {
    console.error("[notifyArticleAuthor]", error);
    return false;
  }
}

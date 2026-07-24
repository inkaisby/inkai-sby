import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";

/** Beritahu admin ranting (dojo) + cabang tentang perubahan No. MSH anggota. */
export async function notifyAdminsAboutMemberMsh(opts: {
  dojoId: string;
  /** Jika ada: kirim via Inkai. Jika tidak: tulis Notification lokal saja. */
  token?: string | null;
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
          roles: {
            some: { name: { in: ["ADMIN_DOJO", "ADMIN_BRANCH"] } },
          },
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

    if (opts.token) {
      await Promise.allSettled(
        ids.map((userId) =>
          notifyUser({
            userId,
            title: opts.title,
            content: opts.content,
            type: "INFO",
            token: opts.token!,
            audience: "ADMIN",
            email: false,
          }),
        ),
      );
    } else if (ids.length > 0) {
      await prisma.notification.createMany({
        data: ids.map((userId) => ({
          userId,
          title: opts.title,
          content: opts.content,
          type: "INFO",
          audience: "ADMIN",
        })),
      });
    }
    return ids.length;
  } catch (error) {
    console.error("[notifyAdminsAboutMemberMsh]", error);
    return 0;
  }
}

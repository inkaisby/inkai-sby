import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";
import { SITE_BRANCH_NAME } from "@/lib/site";

/** Notifikasi semua ketua ranting (ADMIN_DOJO) aktif di cabang Surabaya. */
export async function notifyUktDojoAdmins(opts: {
  token: string;
  title: string;
  content: string;
  actorEmail?: string;
  type?: string;
}) {
  try {
    const recipients = await prisma.user.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        roles: { some: { name: "ADMIN_DOJO" } },
        OR: [
          {
            managedDojo: {
              isDeleted: false,
              branch: {
                name: { equals: SITE_BRANCH_NAME, mode: "insensitive" },
              },
            },
          },
          { managedDojoId: { not: null } },
        ],
      },
      select: { id: true, email: true },
      take: 120,
    });

    const actor = opts.actorEmail?.toLowerCase();
    await Promise.allSettled(
      recipients
        .filter((u) => !actor || u.email?.toLowerCase() !== actor)
        .map((u) =>
          notifyUser({
            userId: u.id,
            title: opts.title,
            content: opts.content,
            type: opts.type ?? "INFO",
            token: opts.token,
          }),
        ),
    );
    return recipients.length;
  } catch (error) {
    console.error("[notifyUktDojoAdmins]", error);
    return 0;
  }
}

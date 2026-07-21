import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";
import { SITE_BRANCH_NAME } from "@/lib/site";

/** Notifikasi admin cabang/pusat saat susunan pengurus berubah. */
export async function notifyPengurusUpdate(opts: {
  token: string;
  actorEmail: string;
  periodeLabel: string;
  summary: string;
}) {
  try {
    const recipients = await prisma.user.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        roles: {
          some: {
            name: {
              in: ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_BRANCH", "ADMIN"],
            },
          },
        },
        OR: [
          { managedBranch: { name: { equals: SITE_BRANCH_NAME, mode: "insensitive" } } },
          { roles: { some: { name: { in: ["ADMINISTRATOR", "ADMIN_PUSAT"] } } } },
        ],
      },
      select: { id: true, email: true },
      take: 40,
    });

    await Promise.allSettled(
      recipients
        .filter((u) => u.email?.toLowerCase() !== opts.actorEmail.toLowerCase())
        .map((u) =>
          notifyUser({
            userId: u.id,
            title: "Susunan pengurus diperbarui",
            content: `${opts.actorEmail} mengubah periode ${opts.periodeLabel}: ${opts.summary}`,
            type: "INFO",
            token: opts.token,
            audience: "ADMIN",
          }),
        ),
    );
  } catch (error) {
    console.error("[notifyPengurusUpdate]", error);
  }
}

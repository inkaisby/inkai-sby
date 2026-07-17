import { prisma } from "@/lib/prisma";

/** Cari user admin cabang/ranting untuk jadi lawan bicara pesan anggota. */
export async function findSekretariatUserId(preferDojoId?: string | null) {
  if (preferDojoId) {
    const dojoAdmin = await prisma.user.findFirst({
      where: {
        isDeleted: false,
        isActive: true,
        managedDojoId: preferDojoId,
        roles: { some: { name: { in: ["ADMIN_DOJO", "ADMIN_BRANCH"] } } },
      },
      select: { id: true },
    });
    if (dojoAdmin) return dojoAdmin.id;
  }

  const branchAdmin = await prisma.user.findFirst({
    where: {
      isDeleted: false,
      isActive: true,
      roles: {
        some: {
          name: { in: ["ADMIN_BRANCH", "ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN"] },
        },
      },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  return branchAdmin?.id ?? null;
}

export async function getOrCreateMemberConversation(
  memberUserId: string,
  sekretariatUserId: string,
) {
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { id: memberUserId } } },
        { participants: { some: { id: sekretariatUserId } } },
      ],
    },
    include: {
      participants: { select: { id: true, fullName: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 100,
        include: { sender: { select: { id: true, fullName: true } } },
      },
    },
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      participants: {
        connect: [{ id: memberUserId }, { id: sekretariatUserId }],
      },
    },
    include: {
      participants: { select: { id: true, fullName: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 100,
        include: { sender: { select: { id: true, fullName: true } } },
      },
    },
  });
}

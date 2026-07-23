import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  findSekretariatUserId,
  getOrCreateMemberConversation,
} from "@/lib/messaging";

export type MemberPesanInbox = {
  conversation: {
    id: string;
    messages: Array<{
      id: string;
      content: string;
      createdAt: string;
      senderId: string;
      sender?: { id: string; fullName: string | null };
    }>;
  } | null;
  meId: string;
  message?: string;
  unreadCount?: number;
};

export async function loadMemberPesanInbox(): Promise<MemberPesanInbox | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const member = session.user.memberId
    ? await prisma.member.findUnique({
        where: { id: session.user.memberId },
        select: { dojoId: true, userId: true },
      })
    : null;

  const userId = member?.userId || session.user.id;
  const sekretariatId = await findSekretariatUserId(member?.dojoId);
  if (!sekretariatId) {
    return {
      conversation: null,
      meId: userId,
      message: "Belum ada pengurus yang dapat dihubungi.",
    };
  }

  if (sekretariatId === userId) {
    return {
      conversation: null,
      meId: userId,
      message: "Akun admin — gunakan panel admin untuk membalas pesan.",
    };
  }

  const conversation = await getOrCreateMemberConversation(userId, sekretariatId);

  const unreadCount = await prisma.message.count({
    where: {
      conversationId: conversation.id,
      isRead: false,
      senderId: { not: userId },
    },
  });

  await prisma.message.updateMany({
    where: {
      conversationId: conversation.id,
      senderId: { not: userId },
      isRead: false,
    },
    data: { isRead: true },
  });

  return {
    conversation: {
      id: conversation.id,
      messages: (conversation.messages || []).map((m) => ({
        id: m.id,
        content: m.content,
        createdAt:
          m.createdAt instanceof Date
            ? m.createdAt.toISOString()
            : String(m.createdAt),
        senderId: m.senderId,
        sender: m.sender
          ? { id: m.sender.id, fullName: m.sender.fullName }
          : undefined,
      })),
    },
    meId: userId,
    unreadCount,
  };
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  findSekretariatUserId,
  getOrCreateMemberConversation,
} from "@/lib/messaging";
import { z } from "zod";

const sendSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member = session.user.memberId
    ? await prisma.member.findUnique({
        where: { id: session.user.memberId },
        select: { dojoId: true, userId: true },
      })
    : null;

  const userId = member?.userId || session.user.id;
  const sekretariatId = await findSekretariatUserId(member?.dojoId);
  if (!sekretariatId) {
    return NextResponse.json({
      conversation: null,
      message: "Belum ada pengurus yang dapat dihubungi.",
    });
  }

  if (sekretariatId === userId) {
    return NextResponse.json({
      conversation: null,
      message: "Akun admin — gunakan panel admin untuk membalas pesan.",
    });
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

  return NextResponse.json({ conversation, meId: userId, unreadCount });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = sendSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Pesan tidak valid" }, { status: 400 });
  }

  const member = session.user.memberId
    ? await prisma.member.findUnique({
        where: { id: session.user.memberId },
        select: { dojoId: true, userId: true },
      })
    : null;
  const userId = member?.userId || session.user.id;

  let conversationId = parsed.data.conversationId;
  if (!conversationId) {
    const sekretariatId = await findSekretariatUserId(member?.dojoId);
    if (!sekretariatId) {
      return NextResponse.json(
        { error: "Belum ada pengurus yang dapat dihubungi" },
        { status: 400 },
      );
    }
    const conv = await getOrCreateMemberConversation(userId, sekretariatId);
    conversationId = conv.id;
  }

  const allowed = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { id: userId } },
    },
  });
  if (!allowed) {
    return NextResponse.json({ error: "Percakapan tidak ditemukan" }, { status: 404 });
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      content: parsed.data.content,
    },
    include: { sender: { select: { id: true, fullName: true } } },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  return NextResponse.json({ message, conversationId });
}

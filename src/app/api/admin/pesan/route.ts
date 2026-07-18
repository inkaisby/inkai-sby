import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { z } from "zod";

const sendSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
});

type ConvRow = {
  id: string;
  lastMessageAt: Date | null;
  participants: unknown[];
  messages: unknown[];
};

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const meId = authResult.user.id;

  const result = await withPrismaFallback(
    "admin-conversations",
    () =>
      prisma.conversation.findMany({
        where: {
          participants: { some: { id: meId } },
        },
        include: {
          participants: {
            select: {
              id: true,
              fullName: true,
              email: true,
              member: { select: { fullName: true, nia: true } },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: { select: { id: true, fullName: true } } },
          },
        },
        orderBy: { lastMessageAt: "desc" },
        take: 50,
      }),
    [],
  );

  const all = await withPrismaFallback(
    "admin-conversations-all",
    () =>
      prisma.conversation.findMany({
        include: {
          participants: {
            select: {
              id: true,
              fullName: true,
              email: true,
              member: { select: { fullName: true, nia: true } },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: { select: { id: true, fullName: true } } },
          },
        },
        orderBy: { lastMessageAt: "desc" },
        take: 50,
      }),
    [],
  );

  const mine = result.data as ConvRow[];
  const list = (mine.length > 0 ? mine : (all.data as ConvRow[])) ?? [];
  const ids = list.map((c) => c.id);

  const unreadGroups =
    ids.length === 0
      ? []
      : await prisma.message.groupBy({
          by: ["conversationId"],
          where: {
            conversationId: { in: ids },
            isRead: false,
            senderId: { not: meId },
          },
          _count: { _all: true },
        });

  const unreadMap = new Map(
    unreadGroups.map((g) => [g.conversationId, g._count._all]),
  );

  const data = list.map((c) => ({
    ...c,
    unreadCount: unreadMap.get(c.id) ?? 0,
  }));

  const totalUnread = data.reduce((sum, c) => sum + c.unreadCount, 0);

  return NextResponse.json({ data, meId, totalUnread });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const parsed = sendSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Pesan tidak valid" }, { status: 400 });
  }

  const conv = await prisma.conversation.findUnique({
    where: { id: parsed.data.conversationId },
    include: { participants: { select: { id: true } } },
  });
  if (!conv) {
    return NextResponse.json({ error: "Percakapan tidak ditemukan" }, { status: 404 });
  }

  if (!conv.participants.some((p) => p.id === authResult.user.id)) {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { participants: { connect: { id: authResult.user.id } } },
    });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: parsed.data.conversationId,
      senderId: authResult.user.id,
      content: parsed.data.content,
      isRead: true,
    },
    include: { sender: { select: { id: true, fullName: true } } },
  });

  await prisma.conversation.update({
    where: { id: parsed.data.conversationId },
    data: { lastMessageAt: new Date() },
  });

  return NextResponse.json({ message });
}

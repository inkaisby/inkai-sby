import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { z } from "zod";

const sendSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
});

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const result = await withPrismaFallback(
    "admin-conversations",
    () =>
      prisma.conversation.findMany({
        where: {
          participants: { some: { id: authResult.user.id } },
        },
        include: {
          participants: {
            select: { id: true, fullName: true, email: true, member: { select: { fullName: true, nia: true } } },
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

  // Juga tampilkan percakapan yang melibatkan admin cabang lain jika user pusat
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

  const mine = result.data as unknown[];
  const list = mine.length > 0 ? mine : all.data;

  return NextResponse.json({ data: list, meId: authResult.user.id });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const parsed = sendSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Pesan tidak valid" }, { status: 400 });
  }

  // Pastikan admin masuk sebagai participant
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
    },
    include: { sender: { select: { id: true, fullName: true } } },
  });

  await prisma.conversation.update({
    where: { id: parsed.data.conversationId },
    data: { lastMessageAt: new Date() },
  });

  return NextResponse.json({ message });
}

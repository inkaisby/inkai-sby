import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma, withPrismaFallback } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await context.params;
  const meId = authResult.user.id;

  const result = await withPrismaFallback(
    "admin-conversation-detail",
    () =>
      prisma.conversation.findFirst({
        where: {
          id,
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
            orderBy: { createdAt: "asc" },
            take: 200,
            include: { sender: { select: { id: true, fullName: true } } },
          },
        },
      }),
    null,
  );

  if (!result.data) {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }

  await prisma.message.updateMany({
    where: {
      conversationId: id,
      senderId: { not: meId },
      isRead: false,
    },
    data: { isRead: true },
  });

  return NextResponse.json({ conversation: result.data, meId });
}

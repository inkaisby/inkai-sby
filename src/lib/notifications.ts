import { prisma } from "@/lib/prisma";

export async function notifyUser({
  userId,
  title,
  content,
  type = "SUCCESS",
}: {
  userId: string;
  title: string;
  content: string;
  type?: string;
}) {
  return prisma.notification.create({
    data: { userId, title, content, type },
  });
}

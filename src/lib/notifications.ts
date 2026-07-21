import { inkaiFetch } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/email";

export type NotificationAudience = "MEMBER" | "ADMIN" | "BROADCAST";

export async function notifyUser({
  userId,
  title,
  content,
  type = "SUCCESS",
  token,
  audience = "MEMBER",
  /** Juga kirim email jika RESEND_API_KEY tersedia (default true). */
  email = true,
}: {
  userId: string;
  title: string;
  content: string;
  type?: string;
  token: string;
  audience?: NotificationAudience;
  email?: boolean;
}) {
  const { res, data } = await inkaiFetch(
    "/v1/notifications",
    {
      method: "POST",
      body: JSON.stringify({ userId, title, content, type, audience }),
    },
    token,
  );
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" ? data.message : "Gagal mengirim notifikasi",
    );
  }

  if (email) {
    void sendEmailForUser(userId, title, content).catch((err) => {
      console.error("[notifyUser:email]", err);
    });
  }

  return data.data;
}

async function sendEmailForUser(userId: string, title: string, content: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false, isActive: true },
    select: { email: true },
  });
  if (!user?.email) return;
  await sendNotificationEmail({
    to: user.email,
    title,
    content,
  });
}

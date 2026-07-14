import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { forgotPasswordSchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`forgot:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.success) return rateLimitResponse(limit.retryAfterSec ?? 300);

  const body = await request.json();
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { email: parsed.data.email, isDeleted: false },
  });

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await sendPasswordResetEmail(user.email, token);
    await writeAuditLog({
      userId: user.id,
      email: user.email,
      action: "PASSWORD_RESET_REQUEST",
      ip,
    });
    await notifyUser({
      userId: user.id,
      title: "Permintaan Reset Password",
      content:
        "Instruksi reset password telah dikirim ke email Anda. Periksa inbox atau folder spam.",
      type: "INFO",
    });
  }

  return NextResponse.json({
    success: true,
    message:
      "Jika email terdaftar, instruksi reset password telah dikirim. Periksa inbox atau hubungi admin cabang.",
  });
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { validatePassword } from "@/lib/security/password";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { resetPasswordSchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`reset:${ip}`, { max: 10, windowMs: 60 * 60 * 1000 });
  if (!limit.success) return rateLimitResponse(limit.retryAfterSec ?? 300);

  const body = await request.json();
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const passwordCheck = validatePassword(parsed.data.password);
  if (!passwordCheck.valid) {
    return NextResponse.json({ error: passwordCheck.error }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: parsed.data.token,
      resetTokenExpiry: { gt: new Date() },
      isDeleted: false,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Token tidak valid atau sudah kadaluarsa" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  await writeAuditLog({
    userId: user.id,
    email: user.email,
    action: "PASSWORD_RESET_COMPLETE",
    ip,
  });

  await notifyUser({
    userId: user.id,
    title: "Password Diperbarui",
    content: "Password akun Anda berhasil diubah. Silakan login dengan password baru.",
    type: "SUCCESS",
  });

  return NextResponse.json({
    success: true,
    message: "Password berhasil diperbarui",
  });
}

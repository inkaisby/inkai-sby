import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { akunPasswordSchema } from "@/lib/security/schemas";
import { validateMemberSelfPassword } from "@/lib/security/password";
import { getClientIp } from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { forbidIfImpersonating } from "@/lib/security/impersonation-guard";
import { endOtherUserSessions } from "@/lib/security/session-control";

export async function PATCH(request: Request) {
  const session = await auth();
  const token = await getInkaiAccessToken();
  if (!session?.user?.id || !session.user.memberId || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await forbidIfImpersonating();
  if (blocked) return blocked;

  const ip = getClientIp(request);
  const limit = await rateLimitAsync(`member-password:${session.user.id}`, {
    max: 8,
    windowMs: 15 * 60_000,
  });
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfterSec ?? 60);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }

  const parsed = akunPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  const member = await prisma.member.findFirst({
    where: { id: session.user.memberId, isDeleted: false },
    select: { nia: true, userId: true },
  });
  if (!member?.userId) {
    return NextResponse.json(
      { error: "Akun anggota tidak ditemukan" },
      { status: 404 },
    );
  }

  const pwCheck = validateMemberSelfPassword(
    parsed.data.newPassword,
    member.nia,
  );
  if (!pwCheck.valid) {
    return NextResponse.json({ error: pwCheck.error }, { status: 400 });
  }

  const { res, data } = await inkaiFetch(
    "/v1/auth/change-password",
    {
      method: "PUT",
      body: JSON.stringify({
        oldPassword: parsed.data.oldPassword,
        newPassword: parsed.data.newPassword,
      }),
    },
    token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal mengubah password") },
      { status: res.status },
    );
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: member.userId },
      data: { passwordHash },
    });
  } catch (err) {
    console.error("[member/password] local hash sync failed:", err);
  }

  await endOtherUserSessions(member.userId);

  writeAuditLog({
    userId: session.user.id,
    email: session.user.email,
    action: "MEMBER_PASSWORD_CHANGE",
    details: "Anggota mengubah password sendiri",
    ip,
    userAgent: request.headers.get("user-agent"),
    token,
  });

  return NextResponse.json({
    success: true,
    message: "Password berhasil diubah",
  });
}

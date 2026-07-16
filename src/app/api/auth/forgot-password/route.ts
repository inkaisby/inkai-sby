import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { SITE_BRANCH_NAME } from "@/lib/site";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`forgot:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 });
    if (!limit.success) return rateLimitResponse(limit.retryAfterSec ?? 300);

    const { email } = (await request.json()) as { email?: string };
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email wajib diisi" }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        email: normalized,
        isDeleted: false,
        isActive: true,
      },
      include: {
        member: {
          include: {
            dojo: {
              include: { branch: true },
            },
          },
        },
      },
    });

    // Generic success to avoid email enumeration
    const genericOk = NextResponse.json({
      success: true,
      message:
        "Jika email terdaftar di Cabang Surabaya, pengajuan telah dikirim ke ranting untuk diverifikasi.",
    });

    if (!user?.member) {
      return genericOk;
    }

    const branchName = (user.member.dojo?.branch?.name || "").toUpperCase();
    if (!branchName.includes(SITE_BRANCH_NAME)) {
      return genericOk;
    }

    const existing = await prisma.verification.findFirst({
      where: {
        memberId: user.member.id,
        type: "PASSWORD_RESET",
        status: "PENDING",
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        message:
          "Pengajuan reset password Anda masih menunggu verifikasi ranting.",
      });
    }

    await prisma.verification.create({
      data: {
        memberId: user.member.id,
        type: "PASSWORD_RESET",
        data: JSON.stringify({
          email: user.email,
          fullName: user.fullName || user.member.fullName,
          requestedAt: new Date().toISOString(),
          channel: "web-sby",
        }),
        proofUrl: "—",
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Pengajuan berhasil dikirim ke ranting. Pengurus akan memverifikasi dan mengubah password akun Anda.",
    });
  } catch (error) {
    console.error("[forgot-password]", error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}

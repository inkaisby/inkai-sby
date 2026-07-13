import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { surabayaDojoWhere } from "@/lib/security/branch-scope";
import { validatePassword } from "@/lib/security/password";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  assertJsonRequest,
  assertSameOrigin,
  getClientIp,
} from "@/lib/security/request";
import { registerSchema } from "@/lib/security/schemas";

export async function POST(request: Request) {
  try {
    if (!assertJsonRequest(request)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 415 });
    }

    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = getClientIp(request);
    const limit = rateLimit(`register:${ip}`, {
      max: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!limit.success) {
      return rateLimitResponse(limit.retryAfterSec ?? 300);
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message || "Data tidak valid";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { name, email, password, dojoId, nik, phoneNumber, gender, birthDate } =
      parsed.data;

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.error },
        { status: 400 }
      );
    }

    if (nik) {
      const existingNik = await prisma.member.findFirst({
        where: { nik, isDeleted: false },
      });
      if (existingNik) {
        return NextResponse.json({ error: "NIK sudah terdaftar" }, { status: 400 });
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 400 }
      );
    }

    const dojo = await prisma.dojo.findFirst({
      where: { id: dojoId, ...surabayaDojoWhere },
    });
    if (!dojo) {
      return NextResponse.json(
        { error: "Dojo tidak valid untuk Cabang Surabaya" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const parsedBirthDate =
      birthDate && birthDate.length > 0 ? new Date(birthDate) : null;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          fullName: name,
          phoneNumber: phoneNumber || null,
          roles: {
            connectOrCreate: {
              where: { name: "MEMBER" },
              create: { name: "MEMBER" },
            },
          },
        },
      });

      const member = await tx.member.create({
        data: {
          userId: user.id,
          fullName: name,
          dojoId,
          status: "PENDING",
          nik: nik || null,
          gender: gender || null,
          birthDate: parsedBirthDate,
        },
      });

      return { user, member };
    });

    await writeAuditLog({
      email,
      action: "REGISTER",
      details: `Member ${name} dojo ${dojoId}`,
      ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      success: true,
      memberId: result.member.id,
      message: "Registrasi berhasil, menunggu verifikasi admin",
    });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat pendaftaran" },
      { status: 500 }
    );
  }
}

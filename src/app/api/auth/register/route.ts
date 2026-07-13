import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, dojoId } = body;

    if (!name || !email || !password || !dojoId) {
      return NextResponse.json(
        { error: "Semua field wajib diisi" },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 400 }
      );
    }

    const dojo = await prisma.dojo.findFirst({
      where: { id: dojoId, isDeleted: false },
    });
    if (!dojo) {
      return NextResponse.json({ error: "Dojo tidak ditemukan" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: name,
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
        },
      });

      return { user, member };
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

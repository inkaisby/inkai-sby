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

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 400 }
      );
    }

    const dojo = await prisma.dojo.findUnique({ where: { id: dojoId } });
    if (!dojo) {
      return NextResponse.json({ error: "Dojo tidak ditemukan" }, { status: 400 });
    }

    const count = await prisma.anggota.count();
    const nomorInduk = `INKAI-${String(count + 1).padStart(5, "0")}`;

    const passwordHash = await bcrypt.hash(password, 12);

    const anggota = await prisma.anggota.create({
      data: {
        nomorInduk,
        nama: name,
        dojoId,
      },
    });

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "ANGGOTA",
        anggotaId: anggota.id,
        scopeDojoId: dojoId,
      },
    });

    return NextResponse.json({ success: true, nomorInduk });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan saat pendaftaran" },
      { status: 500 }
    );
  }
}

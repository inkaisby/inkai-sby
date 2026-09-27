import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      eventId,
      memberId,
      fullName,
      gender,
      birthDate,
      dojoName,
      currentRank,
      phone,
      weight,
      categoryId,
      agreedTerms,
      email,
      password,
      photoUrl,
      birthCertificateUrl,
      bpjsCardUrl,
    } = body;

    // Handle registration for existing INKAI member (via search suggestion)
    if (memberId && eventId) {
      const eventObj = await prisma.event.findUnique({
        where: { id: eventId },
        include: { tournamentCategories: { orderBy: { createdAt: "asc" } } },
      });
      if (!eventObj || eventObj.isDeleted) {
        return NextResponse.json({ error: "Event kejuaraan tidak ditemukan." }, { status: 404 });
      }

      const memberObj = await prisma.member.findUnique({
        where: { id: memberId },
        select: { id: true, dojoId: true, fullName: true },
      });
      if (!memberObj) {
        return NextResponse.json({ error: "Data anggota tidak ditemukan." }, { status: 404 });
      }

      const existingReg = await prisma.tournamentRegistration.findFirst({
        where: { eventId, memberId },
      });
      if (existingReg) {
        return NextResponse.json({ error: "Anggota sudah terdaftar pada event kejuaraan ini." }, { status: 400 });
      }

      const targetCatId = categoryId || eventObj.tournamentCategories[0]?.id;
      if (!targetCatId) {
        return NextResponse.json({ error: "Kategori kelas pertandingan belum tersedia." }, { status: 400 });
      }

      const registration = await prisma.tournamentRegistration.create({
        data: {
          eventId,
          dojoId: memberObj.dojoId,
          memberId: memberObj.id,
          categoryId: targetCatId,
          status: "REGISTERED",
        },
        include: {
          member: true,
          dojo: true,
          category: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Berhasil mendaftarkan ${memberObj.fullName}!`,
        registration,
      });
    }

    if (!eventId || !fullName || !gender || !birthDate || !categoryId) {
      return NextResponse.json(
        { error: "Mohon lengkapi semua data wajib (Event, Nama, Gender, Tgl Lahir, Kategori)." },
        { status: 400 }
      );
    }

    if (!agreedTerms) {
      return NextResponse.json(
        { error: "Anda harus menyetujui Ketentuan Pertandingan untuk dapat mendaftar." },
        { status: 400 }
      );
    }

    // 1. Verify Event & Category exist
    const eventObj = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!eventObj || eventObj.isDeleted) {
      return NextResponse.json({ error: "Event kejuaraan tidak ditemukan." }, { status: 404 });
    }

    const categoryObj = await prisma.tournamentCategory.findUnique({
      where: { id: categoryId },
    });
    if (!categoryObj) {
      return NextResponse.json({ error: "Kategori pertandingan tidak ditemukan." }, { status: 404 });
    }

    // 2. User Account Creation (Email & Password check if provided)
    let createdUserId: string | undefined = undefined;
    if (email && password) {
      const cleanEmail = email.toLowerCase().trim();
      const existingUser = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });
      if (existingUser) {
        return NextResponse.json(
          { error: "Email sudah terdaftar. Silakan login atau gunakan email lain." },
          { status: 400 }
        );
      }

      if (password.length < 6) {
        return NextResponse.json(
          { error: "Password minimal 6 karakter." },
          { status: 400 }
        );
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = await prisma.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          fullName: fullName.trim(),
          phoneNumber: phone || null,
          isActive: true,
        },
      });
      createdUserId = newUser.id;
    }

    // 3. Find or create Dojo
    const targetDojoName = dojoName?.trim() || "Dojo External / Tamu";
    let dojo = await prisma.dojo.findFirst({
      where: {
        name: { equals: targetDojoName, mode: "insensitive" },
        isDeleted: false,
      },
    });

    if (!dojo) {
      const branch = await prisma.branch.findFirst();
      if (!branch) {
        return NextResponse.json({ error: "Data cabang (Branch) belum tersedia." }, { status: 500 });
      }
      dojo = await prisma.dojo.create({
        data: {
          name: targetDojoName,
          address: "Eksternal / Tamu Kejuaraan",
          branchId: branch.id,
        },
      });
    }

    // 4. Create Guest Member Record with Login Account & Uploaded Document URLs
    const guestNia = `TAMU-${Math.floor(100000 + Math.random() * 900000)}`;
    const guestMember = await prisma.member.create({
      data: {
        fullName: fullName.trim(),
        gender: gender,
        birthDate: new Date(birthDate),
        dojoId: dojo.id,
        currentRank: currentRank || "Putih (Kyu 10)",
        nia: guestNia,
        status: "Active",
        userId: createdUserId,
        photoUrl: photoUrl || null,
        birthCertificateUrl: birthCertificateUrl || null,
        bpjsCardUrl: bpjsCardUrl || null,
      },
    });

    // 5. Create Tournament Registration
    const registration = await prisma.tournamentRegistration.create({
      data: {
        eventId,
        dojoId: dojo.id,
        memberId: guestMember.id,
        categoryId,
        status: "REGISTERED",
        officialPhone: phone || null,
        actualWeight: weight ? parseFloat(weight.toString()) : null,
      },
      include: {
        member: true,
        dojo: true,
        category: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: createdUserId
        ? "Pendaftaran berhasil! Akun telah dibuat, Anda dapat login menggunakan email & password tersebut."
        : "Pendaftaran sebagai tamu berhasil tercatat!",
      registration,
    });
  } catch (error: any) {
    console.error("POST /api/public/pertandingan/guest-register error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal melakukan pendaftaran tamu." },
      { status: 500 }
    );
  }
}

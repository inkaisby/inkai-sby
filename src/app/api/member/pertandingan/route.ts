import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get active member
    const member = await prisma.member.findFirst({
      where: {
        OR: [
          { userId: session.user.id },
          { id: session.user.id },
        ],
      },
      include: { dojo: true },
    });

    if (!member) {
      return NextResponse.json({ error: "Data anggota tidak ditemukan" }, { status: 404 });
    }

    // Get active events with categories
    const events = await prisma.event.findMany({
      where: {
        isDeleted: false,
        endDate: { gte: new Date() },
      },
      include: {
        tournamentCategories: true,
      },
      orderBy: { startDate: "asc" },
    });

    // Get member's existing registrations
    const myRegistrations = await prisma.tournamentRegistration.findMany({
      where: { memberId: member.id },
      include: {
        event: { select: { id: true, title: true, startDate: true, location: true } },
        category: { select: { id: true, name: true, fee: true, isFeeVisible: true, categoryType: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      member,
      events,
      myRegistrations,
    });
  } catch (error: any) {
    console.error("GET /api/member/pertandingan error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch member tournament data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const member = await prisma.member.findFirst({
      where: {
        OR: [
          { userId: session.user.id },
          { id: session.user.id },
        ],
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Data anggota tidak ditemukan" }, { status: 404 });
    }

    const body = await request.json();
    const { eventId, categoryId, officialName, officialPhone, notes } = body;

    if (!eventId || !categoryId) {
      return NextResponse.json({ error: "eventId dan categoryId wajib diisi" }, { status: 400 });
    }

    // Check if event registration is still open
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event || event.isDeleted) {
      return NextResponse.json({ error: "Event kejuaraan tidak ditemukan" }, { status: 404 });
    }

    if (event.registrationCloseAt && new Date() > new Date(event.registrationCloseAt)) {
      return NextResponse.json({ error: "Pendaftaran untuk kejuaraan ini sudah ditutup" }, { status: 400 });
    }

    const registration = await prisma.tournamentRegistration.create({
      data: {
        eventId,
        dojoId: member.dojoId,
        memberId: member.id,
        categoryId,
        registeredByUserId: session.user.id,
        officialName: officialName || null,
        officialPhone: officialPhone || null,
        notes: notes || null,
        status: "REGISTERED",
      },
    });

    return NextResponse.json({ success: true, registration });
  } catch (error: any) {
    console.error("POST /api/member/pertandingan error:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Anda sudah terdaftar pada kelas pertandingan ini" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Failed to register" }, { status: 500 });
  }
}

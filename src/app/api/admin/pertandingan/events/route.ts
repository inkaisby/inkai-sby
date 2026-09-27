import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");

    const events = await prisma.event.findMany({
      where: {
        isDeleted: false,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        _count: {
          select: {
            tournamentCategories: true,
            tournamentRegistrations: true,
          },
        },
        tournamentCategories: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error("GET /api/admin/pertandingan/events error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, startDate, endDate, eventTime, registrationCloseAt, location, branchId } = body;

    if (!title || !startDate || !endDate) {
      return NextResponse.json({ error: "Judul, tanggal mulai, dan tanggal selesai wajib diisi" }, { status: 400 });
    }

    const newEvent = await prisma.event.create({
      data: {
        title,
        description: description || "Kejuaraan Karate INKAI",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        eventTime: eventTime || "08.00 – 12.00 WIB",
        registrationCloseAt: registrationCloseAt ? new Date(registrationCloseAt) : null,
        location: location || "Gedung Olahraga Kodam V/Brawijaya Jl. Kesatriyan No.38 A, Gn. Sari, Kec. Dukuhpakis, Surabaya",
        branchId: branchId || session.user.managedBranchId || null,
        createdById: session.user.id,
      },
    });

    // Seed default categories based on birth date ranges and ages
    const currentYear = new Date().getFullYear();
    const defaultCategories = [
      {
        name: "Kata Perorangan Putra Usia Dini (7-9 Thn)",
        categoryType: "KATA_INDIVIDUAL",
        gender: "MALE",
        minAge: 7,
        maxAge: 9,
        minBirthDate: new Date(`${currentYear - 9}-01-01`),
        maxBirthDate: new Date(`${currentYear - 7}-12-31`),
        fee: 150000,
      },
      {
        name: "Kata Perorangan Putri Usia Dini (7-9 Thn)",
        categoryType: "KATA_INDIVIDUAL",
        gender: "FEMALE",
        minAge: 7,
        maxAge: 9,
        minBirthDate: new Date(`${currentYear - 9}-01-01`),
        maxBirthDate: new Date(`${currentYear - 7}-12-31`),
        fee: 150000,
      },
      {
        name: "Kata Perorangan Putra Pra Pemula (10-11 Thn)",
        categoryType: "KATA_INDIVIDUAL",
        gender: "MALE",
        minAge: 10,
        maxAge: 11,
        minBirthDate: new Date(`${currentYear - 11}-01-01`),
        maxBirthDate: new Date(`${currentYear - 10}-12-31`),
        fee: 150000,
      },
      {
        name: "Kata Perorangan Putri Pra Pemula (10-11 Thn)",
        categoryType: "KATA_INDIVIDUAL",
        gender: "FEMALE",
        minAge: 10,
        maxAge: 11,
        minBirthDate: new Date(`${currentYear - 11}-01-01`),
        maxBirthDate: new Date(`${currentYear - 10}-12-31`),
        fee: 150000,
      },
      {
        name: "Kumite Perorangan Putra Usia Dini -30kg",
        categoryType: "KUMITE_INDIVIDUAL",
        gender: "MALE",
        minAge: 7,
        maxAge: 9,
        minBirthDate: new Date(`${currentYear - 9}-01-01`),
        maxBirthDate: new Date(`${currentYear - 7}-12-31`),
        maxWeight: 30,
        fee: 150000,
      },
      {
        name: "Kumite Perorangan Putri Usia Dini -25kg",
        categoryType: "KUMITE_INDIVIDUAL",
        gender: "FEMALE",
        minAge: 7,
        maxAge: 9,
        minBirthDate: new Date(`${currentYear - 9}-01-01`),
        maxBirthDate: new Date(`${currentYear - 7}-12-31`),
        maxWeight: 25,
        fee: 150000,
      },
      {
        name: "Kumite Perorangan Putra Pra Pemula -35kg",
        categoryType: "KUMITE_INDIVIDUAL",
        gender: "MALE",
        minAge: 10,
        maxAge: 11,
        minBirthDate: new Date(`${currentYear - 11}-01-01`),
        maxBirthDate: new Date(`${currentYear - 10}-12-31`),
        maxWeight: 35,
        fee: 150000,
      },
      {
        name: "Kumite Perorangan Putri Pra Pemula -30kg",
        categoryType: "KUMITE_INDIVIDUAL",
        gender: "FEMALE",
        minAge: 10,
        maxAge: 11,
        minBirthDate: new Date(`${currentYear - 11}-01-01`),
        maxBirthDate: new Date(`${currentYear - 10}-12-31`),
        maxWeight: 30,
        fee: 150000,
      },
      { name: "Kata Beregu Putra", categoryType: "KATA_TEAM", gender: "MALE", fee: 250000 },
      { name: "Kata Beregu Putri", categoryType: "KATA_TEAM", gender: "FEMALE", fee: 250000 },
    ];

    await prisma.tournamentCategory.createMany({
      data: defaultCategories.map((cat) => ({
        ...cat,
        eventId: newEvent.id,
      })),
    });

    return NextResponse.json({ success: true, event: newEvent });
  } catch (error: any) {
    console.error("POST /api/admin/pertandingan/events error:", error);
    return NextResponse.json({ error: error.message || "Failed to create event" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, title, description, startDate, endDate, eventTime, registrationCloseAt, location, rulesContent } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const updateData: any = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (eventTime !== undefined) updateData.eventTime = eventTime;
    if (registrationCloseAt !== undefined) {
      updateData.registrationCloseAt = registrationCloseAt ? new Date(registrationCloseAt) : null;
    }
    if (location !== undefined) updateData.location = location;
    if (rulesContent !== undefined) updateData.rulesContent = rulesContent;

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, event: updatedEvent });
  } catch (error: any) {
    console.error("PATCH /api/admin/pertandingan/events error:", error);
    return NextResponse.json({ error: error.message || "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await prisma.event.update({
      where: { id },
      data: { isDeleted: true },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/admin/pertandingan/events error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete event" }, { status: 500 });
  }
}

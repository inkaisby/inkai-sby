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
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
    }

    const categories = await prisma.tournamentCategory.findMany({
      where: { eventId },
      include: {
        _count: { select: { registrations: true } },
      },
      orderBy: [
        { categoryType: "asc" },
        { gender: "asc" },
        { minAge: "asc" },
        { name: "asc" },
      ],
    });

    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error("GET /api/admin/pertandingan/categories error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { eventId, name, categoryType, gender, minAge, maxAge, minBirthDate, maxBirthDate, minWeight, maxWeight, fee } = body;

    if (!eventId || !name || !categoryType || !gender) {
      return NextResponse.json({ error: "eventId, nama kelas, jenis kategori, dan gender wajib diisi" }, { status: 400 });
    }

    const category = await prisma.tournamentCategory.create({
      data: {
        eventId,
        name,
        categoryType,
        gender,
        minAge: minAge ? parseInt(minAge) : null,
        maxAge: maxAge ? parseInt(maxAge) : null,
        minBirthDate: minBirthDate ? new Date(minBirthDate) : null,
        maxBirthDate: maxBirthDate ? new Date(maxBirthDate) : null,
        minWeight: minWeight ? parseFloat(minWeight) : null,
        maxWeight: maxWeight ? parseFloat(maxWeight) : null,
        fee: fee ? parseFloat(fee) : 0,
      },
    });

    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    console.error("POST /api/admin/pertandingan/categories error:", error);
    return NextResponse.json({ error: error.message || "Failed to create category" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, categoryType, gender, minAge, maxAge, minBirthDate, maxBirthDate, minWeight, maxWeight, fee } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (categoryType) updateData.categoryType = categoryType;
    if (gender) updateData.gender = gender;
    if (minAge !== undefined) updateData.minAge = minAge ? parseInt(minAge) : null;
    if (maxAge !== undefined) updateData.maxAge = maxAge ? parseInt(maxAge) : null;
    if (minBirthDate !== undefined) updateData.minBirthDate = minBirthDate ? new Date(minBirthDate) : null;
    if (maxBirthDate !== undefined) updateData.maxBirthDate = maxBirthDate ? new Date(maxBirthDate) : null;
    if (minWeight !== undefined) updateData.minWeight = minWeight ? parseFloat(minWeight) : null;
    if (maxWeight !== undefined) updateData.maxWeight = maxWeight ? parseFloat(maxWeight) : null;
    if (fee !== undefined) updateData.fee = fee ? parseFloat(fee) : 0;

    const category = await prisma.tournamentCategory.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    console.error("PATCH /api/admin/pertandingan/categories error:", error);
    return NextResponse.json({ error: error.message || "Failed to update category" }, { status: 500 });
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

    await prisma.tournamentCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/admin/pertandingan/categories error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete category" }, { status: 500 });
  }
}

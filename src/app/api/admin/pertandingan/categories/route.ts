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
    const { eventId, name, categoryType, gender, minAge, maxAge, minBirthDate, maxBirthDate, minWeight, maxWeight, fee, isFeeVisible } = body;

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
        fee: fee !== undefined && fee !== "" ? parseFloat(fee) : 0,
        isFeeVisible: isFeeVisible !== undefined ? Boolean(isFeeVisible) : true,
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
    const { id, ids, name, categoryType, gender, minAge, maxAge, minBirthDate, maxBirthDate, minWeight, maxWeight, fee, isFeeVisible } = body;

    // Batch update case
    if (Array.isArray(ids) && ids.length > 0) {
      const updateData: any = {};
      if (fee !== undefined && fee !== "") updateData.fee = parseFloat(fee);
      if (isFeeVisible !== undefined) updateData.isFeeVisible = Boolean(isFeeVisible);

      const result = await prisma.tournamentCategory.updateMany({
        where: { id: { in: ids } },
        data: updateData,
      });

      return NextResponse.json({ success: true, count: result.count });
    }

    if (!id) {
      return NextResponse.json({ error: "id or ids required" }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (categoryType !== undefined) updateData.categoryType = categoryType;
    if (gender !== undefined) updateData.gender = gender;
    if (minAge !== undefined) updateData.minAge = minAge ? parseInt(minAge) : null;
    if (maxAge !== undefined) updateData.maxAge = maxAge ? parseInt(maxAge) : null;
    if (minBirthDate !== undefined) updateData.minBirthDate = minBirthDate ? new Date(minBirthDate) : null;
    if (maxBirthDate !== undefined) updateData.maxBirthDate = maxBirthDate ? new Date(maxBirthDate) : null;
    if (minWeight !== undefined) updateData.minWeight = minWeight ? parseFloat(minWeight) : null;
    if (maxWeight !== undefined) updateData.maxWeight = maxWeight ? parseFloat(maxWeight) : null;
    if (fee !== undefined && fee !== "") updateData.fee = parseFloat(fee);
    if (isFeeVisible !== undefined) updateData.isFeeVisible = Boolean(isFeeVisible);

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

    let idsToDelete: string[] = [];
    const { searchParams } = new URL(request.url);
    const singleId = searchParams.get("id");
    if (singleId) idsToDelete.push(singleId);

    try {
      const body = await request.json();
      if (Array.isArray(body.ids)) {
        idsToDelete.push(...body.ids);
      }
    } catch (e) {
      // Body empty or not JSON, continue with query param
    }

    idsToDelete = Array.from(new Set(idsToDelete));

    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: "id or ids required" }, { status: 400 });
    }

    const result = await prisma.tournamentCategory.deleteMany({
      where: { id: { in: idsToDelete } },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error: any) {
    console.error("DELETE /api/admin/pertandingan/categories error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete category" }, { status: 500 });
  }
}


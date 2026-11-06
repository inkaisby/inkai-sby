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

function parseWeightValue(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  const str = String(val).trim().replace(/\s+/g, "").replace(",", ".");
  if (str.startsWith("+")) {
    const n = parseFloat(str.substring(1));
    return isNaN(n) ? null : n + 0.1;
  }
  if (str.startsWith("-")) {
    const n = parseFloat(str.substring(1));
    return isNaN(n) ? null : n;
  }
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Multi-items batch creation (misal Putra & Putri sekaligus)
    if (Array.isArray(body.items) && body.items.length > 0) {
      const createdList = [];
      for (const item of body.items) {
        if (!item.eventId || !item.name || !item.categoryType || !item.gender) continue;
        const created = await prisma.tournamentCategory.create({
          data: {
            eventId: item.eventId,
            name: item.name,
            categoryType: item.categoryType,
            gender: item.gender,
            minAge: item.minAge ? parseInt(item.minAge) : null,
            maxAge: item.maxAge ? parseInt(item.maxAge) : null,
            minBirthDate: item.minBirthDate ? new Date(item.minBirthDate) : null,
            maxBirthDate: item.maxBirthDate ? new Date(item.maxBirthDate) : null,
            minWeight: parseWeightValue(item.minWeight),
            maxWeight: parseWeightValue(item.maxWeight),
            fee: item.fee !== undefined && item.fee !== "" ? parseFloat(item.fee) : 0,
            isFeeVisible: item.isFeeVisible !== undefined ? Boolean(item.isFeeVisible) : true,
          },
        });
        createdList.push(created);
      }
      return NextResponse.json({ success: true, count: createdList.length, categories: createdList });
    }

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
        minWeight: parseWeightValue(minWeight),
        maxWeight: parseWeightValue(maxWeight),
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
    if (minWeight !== undefined) updateData.minWeight = parseWeightValue(minWeight);
    if (maxWeight !== undefined) updateData.maxWeight = parseWeightValue(maxWeight);
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

    const [regResult, catResult] = await prisma.$transaction([
      prisma.tournamentRegistration.deleteMany({
        where: { categoryId: { in: idsToDelete } },
      }),
      prisma.tournamentCategory.deleteMany({
        where: { id: { in: idsToDelete } },
      }),
    ]);

    return NextResponse.json({ success: true, count: catResult.count, registrationsDeleted: regResult.count });
  } catch (error: any) {
    console.error("DELETE /api/admin/pertandingan/categories error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete category" }, { status: 500 });
  }
}


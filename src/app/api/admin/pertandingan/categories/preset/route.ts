import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { TOURNAMENT_CATEGORY_PRESETS } from "@/lib/tournament-category-presets";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { eventId, divisionGroup = "ALL", feeOverride } = body;

    if (!eventId) {
      return NextResponse.json({ error: "eventId wajib diisi" }, { status: 400 });
    }

    // Filter target presets
    const targetPresets = TOURNAMENT_CATEGORY_PRESETS.filter((item) => {
      if (divisionGroup && divisionGroup !== "ALL") {
        return item.divisionGroup === divisionGroup;
      }
      return true;
    });

    if (targetPresets.length === 0) {
      return NextResponse.json({ error: "Tidak ada templat kategori yang cocok" }, { status: 400 });
    }

    // Fetch existing categories for this event to prevent duplicates
    const existingCategories = await prisma.tournamentCategory.findMany({
      where: { eventId },
      select: { name: true },
    });
    const existingNames = new Set(existingCategories.map((c) => c.name.toLowerCase().trim()));

    const newCategoriesToInsert = targetPresets
      .filter((preset) => !existingNames.has(preset.name.toLowerCase().trim()))
      .map((preset) => {
        const fee = feeOverride !== undefined && feeOverride !== "" && feeOverride !== null
          ? parseFloat(feeOverride)
          : (preset.defaultFee || 150000);

        return {
          eventId,
          name: preset.name,
          categoryType: preset.categoryType,
          gender: preset.gender,
          minAge: preset.minAge || null,
          maxAge: preset.maxAge || null,
          minBirthDate: preset.minBirthDate ? new Date(preset.minBirthDate) : null,
          maxBirthDate: preset.maxBirthDate ? new Date(preset.maxBirthDate) : null,
          minWeight: preset.minWeight || null,
          maxWeight: preset.maxWeight || null,
          fee: fee,
          isFeeVisible: true,
        };
      });

    if (newCategoriesToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        insertedCount: 0,
        message: "Semua kategori pada divisi ini sudah ada di kejuaraan.",
      });
    }

    await prisma.tournamentCategory.createMany({
      data: newCategoriesToInsert,
    });

    return NextResponse.json({
      success: true,
      insertedCount: newCategoriesToInsert.length,
      message: `Berhasil menambahkan ${newCategoriesToInsert.length} kategori kelas pertandingan baru.`,
    });
  } catch (error: any) {
    console.error("POST /api/admin/pertandingan/categories/preset error:", error);
    return NextResponse.json({ error: error.message || "Gagal membuat preset kategori" }, { status: 500 });
  }
}

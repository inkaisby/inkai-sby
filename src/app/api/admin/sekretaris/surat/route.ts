import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { buildSekretarisFilter, resolveSekretarisScope, buildSuratNumberFormat } from "@/lib/sekretaris-rbac";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requireAdminSession();
    const filter = buildSekretarisFilter(session.user);
    const { searchParams } = new URL(req.url);

    const type = searchParams.get("type"); // MASUK | KELUAR
    const kategori = searchParams.get("kategori");
    const status = searchParams.get("status");
    const q = searchParams.get("q");

    const where: any = {
      ...filter,
      ...(type ? { type } : {}),
      ...(kategori ? { kategori } : {}),
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { nomorSurat: { contains: q, mode: "insensitive" } },
              { perihal: { contains: q, mode: "insensitive" } },
              { pengirim: { contains: q, mode: "insensitive" } },
              { tujuan: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const items = await prisma.suratEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error("[GET /api/admin/sekretaris/surat]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil surat" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requireAdminSession();
    const defaultScope = resolveSekretarisScope(session.user);
    const body = await req.json();

    const {
      type = "KELUAR",
      nomorSurat,
      tanggalSurat,
      pengirim,
      tujuan,
      perihal,
      kategori = "UNDANGAN",
      status = "DRAFT",
      fileUrl,
      disposisi,
      templateKey,
      templateData,
      paperSize = "A4",
      signatureMode = "SYSTEM",
      signedKetuaUrl,
      signedSekretarisUrl,
      stampUrl,
      eventId,
      deliveredToMembers = false,
      scopeType = defaultScope.scopeType,
      scopeId = defaultScope.scopeId,
    } = body;

    if (!perihal) {
      return NextResponse.json({ success: false, error: "Perihal surat wajib diisi" }, { status: 400 });
    }

    let finalNomor = nomorSurat;

    // Auto-generate nomor surat if requested
    if (!finalNomor || finalNomor === "AUTO") {
      const count = await prisma.suratEntry.count({
        where: { scopeType, scopeId },
      });
      let dojoName = undefined;
      if (scopeType === "DOJO" && scopeId !== "main") {
        const dojo = await prisma.dojo.findUnique({ where: { id: scopeId } });
        if (dojo) dojoName = dojo.name;
      }
      finalNomor = buildSuratNumberFormat(
        count + 1,
        kategori,
        scopeType as any,
        dojoName,
        tanggalSurat ? new Date(tanggalSurat) : new Date()
      );
    }

    const item = await prisma.suratEntry.create({
      data: {
        type,
        nomorSurat: finalNomor,
        tanggalSurat: tanggalSurat ? new Date(tanggalSurat) : new Date(),
        pengirim: pengirim || null,
        tujuan: tujuan || null,
        perihal,
        kategori,
        status,
        fileUrl: fileUrl || null,
        disposisi: disposisi || null,
        templateKey: templateKey || null,
        templateData: templateData || null,
        paperSize,
        signatureMode,
        signedKetuaUrl: signedKetuaUrl || null,
        signedSekretarisUrl: signedSekretarisUrl || null,
        stampUrl: stampUrl || null,
        scopeType,
        scopeId,
        eventId: eventId || null,
        deliveredToMembers,
        createdById: session.user.id,
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    console.error("[POST /api/admin/sekretaris/surat]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal membuat surat" },
      { status: 500 }
    );
  }
}

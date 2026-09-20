import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { buildSekretarisFilter, resolveSekretarisScope } from "@/lib/sekretaris-rbac";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requireAdminSession();
    const filter = buildSekretarisFilter(session.user);
    const { searchParams } = new URL(req.url);

    const kategori = searchParams.get("kategori");
    const q = searchParams.get("q");

    const where: any = {
      ...filter,
      ...(kategori ? { kategori } : {}),
      ...(q
        ? {
            OR: [
              { judul: { contains: q, mode: "insensitive" } },
              { nomorDokumen: { contains: q, mode: "insensitive" } },
              { keterangan: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const items = await prisma.arsipDokumen.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error("[GET /api/admin/sekretaris/dokumen]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requireAdminSession();
    const defaultScope = resolveSekretarisScope(session.user);
    const body = await req.json();

    const {
      judul,
      nomorDokumen,
      kategori = "DOKUMEN_RESMI",
      fileUrl,
      keterangan,
      tanggalBerlaku,
      tanggalKadaluarsa,
      scopeType = defaultScope.scopeType,
      scopeId = defaultScope.scopeId,
    } = body;

    if (!judul || !fileUrl) {
      return NextResponse.json(
        { success: false, error: "Judul dan File Dokumen wajib diisi" },
        { status: 400 }
      );
    }

    const item = await prisma.arsipDokumen.create({
      data: {
        judul,
        nomorDokumen: nomorDokumen || null,
        kategori,
        fileUrl,
        keterangan: keterangan || null,
        tanggalBerlaku: tanggalBerlaku ? new Date(tanggalBerlaku) : null,
        tanggalKadaluarsa: tanggalKadaluarsa ? new Date(tanggalKadaluarsa) : null,
        scopeType,
        scopeId,
        createdById: session.user.id,
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    console.error("[POST /api/admin/sekretaris/dokumen]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

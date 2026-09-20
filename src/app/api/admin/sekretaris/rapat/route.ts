import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { buildSekretarisFilter, resolveSekretarisScope } from "@/lib/sekretaris-rbac";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requireAdminSession();
    const filter = buildSekretarisFilter(session.user);
    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q");

    const where: any = {
      ...filter,
      ...(q
        ? {
            OR: [
              { judulRapat: { contains: q, mode: "insensitive" } },
              { pimpinanRapat: { contains: q, mode: "insensitive" } },
              { agenda: { contains: q, mode: "insensitive" } },
              { keputusan: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const items = await prisma.notulenRapat.findMany({
      where,
      orderBy: { tanggalRapat: "desc" },
      take: 200,
    });

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error("[GET /api/admin/sekretaris/rapat]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session } = await requireAdminSession();
    const defaultScope = resolveSekretarisScope(session.user);
    const body = await req.json();

    const {
      judulRapat,
      tanggalRapat,
      lokasi,
      pimpinanRapat,
      pesertaHadir,
      agenda,
      pembahasan,
      keputusan,
      actionItems,
      scopeType = defaultScope.scopeType,
      scopeId = defaultScope.scopeId,
    } = body;

    if (!judulRapat || !agenda || !pembahasan) {
      return NextResponse.json(
        { success: false, error: "Judul Rapat, Agenda, dan Pembahasan wajib diisi" },
        { status: 400 }
      );
    }

    const item = await prisma.notulenRapat.create({
      data: {
        judulRapat,
        tanggalRapat: tanggalRapat ? new Date(tanggalRapat) : new Date(),
        lokasi: lokasi || null,
        pimpinanRapat: pimpinanRapat || null,
        pesertaHadir: pesertaHadir || [],
        agenda,
        pembahasan,
        keputusan: keputusan || "",
        actionItems: actionItems || [],
        scopeType,
        scopeId,
        createdById: session.user.id,
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    console.error("[POST /api/admin/sekretaris/rapat]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

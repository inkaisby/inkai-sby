import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdminSession();
    const item = await prisma.notulenRapat.findUnique({
      where: { id: params.id },
    });
    if (!item) {
      return NextResponse.json({ success: false, error: "Notulen rapat tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdminSession();
    const body = await req.json();

    const updateData: any = {};
    const fields = [
      "judulRapat",
      "tanggalRapat",
      "lokasi",
      "pimpinanRapat",
      "pesertaHadir",
      "agenda",
      "pembahasan",
      "keputusan",
      "actionItems",
    ];

    fields.forEach((f) => {
      if (body[f] !== undefined) {
        if (f === "tanggalRapat" && body[f]) {
          updateData[f] = new Date(body[f]);
        } else {
          updateData[f] = body[f];
        }
      }
    });

    const item = await prisma.notulenRapat.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdminSession();
    await prisma.notulenRapat.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

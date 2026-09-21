import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(
  req: NextRequest,
  context: Ctx
) {
  try {
    await requireAdminSession();
    const { id } = await context.params;
    const item = await prisma.notulenRapat.findUnique({
      where: { id },
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
  context: Ctx
) {
  try {
    await requireAdminSession();
    const { id } = await context.params;
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
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: Ctx
) {
  try {
    await requireAdminSession();
    const { id } = await context.params;
    await prisma.notulenRapat.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

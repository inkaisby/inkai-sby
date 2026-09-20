import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdminSession();
    const item = await prisma.arsipDokumen.findUnique({
      where: { id: params.id },
    });
    if (!item) {
      return NextResponse.json({ success: false, error: "Dokumen tidak ditemukan" }, { status: 404 });
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
      "judul",
      "nomorDokumen",
      "kategori",
      "fileUrl",
      "keterangan",
      "tanggalBerlaku",
      "tanggalKadaluarsa",
    ];

    fields.forEach((f) => {
      if (body[f] !== undefined) {
        if ((f === "tanggalBerlaku" || f === "tanggalKadaluarsa") && body[f]) {
          updateData[f] = new Date(body[f]);
        } else {
          updateData[f] = body[f];
        }
      }
    });

    const item = await prisma.arsipDokumen.update({
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
    await prisma.arsipDokumen.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

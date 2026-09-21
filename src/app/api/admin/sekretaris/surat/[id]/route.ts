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
    const item = await prisma.suratEntry.findUnique({
      where: { id },
    });
    if (!item) {
      return NextResponse.json({ success: false, error: "Surat tidak ditemukan" }, { status: 404 });
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
    const { session } = await requireAdminSession();
    const { id } = await context.params;
    const body = await req.json();

    const existing = await prisma.suratEntry.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Surat tidak ditemukan" }, { status: 404 });
    }

    const updateData: any = {};
    const fields = [
      "nomorSurat",
      "tanggalSurat",
      "pengirim",
      "tujuan",
      "perihal",
      "kategori",
      "status",
      "fileUrl",
      "disposisi",
      "templateKey",
      "templateData",
      "paperSize",
      "signatureMode",
      "signedKetuaUrl",
      "signedSekretarisUrl",
      "stampUrl",
      "eventId",
      "deliveredToMembers",
    ];

    fields.forEach((f) => {
      if (body[f] !== undefined) {
        if (f === "tanggalSurat" && body[f]) {
          updateData[f] = new Date(body[f]);
        } else {
          updateData[f] = body[f];
        }
      }
    });

    if (body.status === "APPROVED" && existing.status !== "APPROVED") {
      updateData.approvedById = session.user.id;
      updateData.approvedAt = new Date();
    }

    const item = await prisma.suratEntry.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    console.error("[PATCH /api/admin/sekretaris/surat/[id]]", error);
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
    await prisma.suratEntry.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

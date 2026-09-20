import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { session } = await requireAdminSession();
    const surat = await prisma.suratEntry.findUnique({
      where: { id: params.id },
    });

    if (!surat) {
      return NextResponse.json({ success: false, error: "Surat tidak ditemukan" }, { status: 404 });
    }

    // Mark as delivered to members
    const updatedSurat = await prisma.suratEntry.update({
      where: { id: params.id },
      data: { deliveredToMembers: true },
    });

    // Determine target members based on scope
    let memberWhere: any = { isDeleted: false, status: "Active" };
    if (surat.scopeType === "DOJO" && surat.scopeId !== "main") {
      memberWhere.dojoId = surat.scopeId;
    } else if (surat.eventId) {
      // Members registered for this event
      const regs = await prisma.eventRegistration.findMany({
        where: { eventId: surat.eventId },
        select: { memberId: true },
      });
      const memberIds = regs.map((r) => r.memberId);
      memberWhere.id = { in: memberIds };
    }

    const members = await prisma.member.findMany({
      where: memberWhere,
      select: { id: true, userId: true },
      take: 1000,
    });

    // Create notifications for members with accounts
    const userIds = members.map((m) => m.userId).filter(Boolean) as string[];

    if (userIds.length > 0) {
      const notifs = userIds.map((uId) => ({
        title: `📩 Surat Resmi: ${surat.perihal}`,
        content: `Surat Resmi No. ${surat.nomorSurat} telah diterbitkan dan tersampaikan ke akun Anda. Buka menu Dokumen untuk mengunduh.`,
        type: "INFO",
        audience: "MEMBER",
        userId: uId,
      }));

      await prisma.notification.createMany({
        data: notifs,
      });
    }

    return NextResponse.json({
      success: true,
      deliveredCount: members.length,
      notifiedUserCount: userIds.length,
      item: updatedSurat,
    });
  } catch (error: any) {
    console.error("[POST /api/admin/sekretaris/surat/[id]/deliver]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

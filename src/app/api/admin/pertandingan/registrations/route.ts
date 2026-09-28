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
    const dojoId = searchParams.get("dojoId");
    const categoryId = searchParams.get("categoryId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    if (!eventId) {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
    }

    const where: any = { eventId };

    if (dojoId) where.dojoId = dojoId;
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { member: { fullName: { contains: search, mode: "insensitive" } } },
        { member: { nia: { contains: search, mode: "insensitive" } } },
        { dojo: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const registrations = await prisma.tournamentRegistration.findMany({
      where,
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            nia: true,
            currentRank: true,
            gender: true,
            birthDate: true,
            photoUrl: true,
            birthCertificateUrl: true,
            bpjsCardUrl: true,
          },
        },
        dojo: {
          select: { id: true, name: true },
        },
        category: {
          select: {
            id: true,
            name: true,
            categoryType: true,
            gender: true,
            minAge: true,
            maxAge: true,
            fee: true,
          },
        },

      },
      orderBy: [
        { dojo: { name: "asc" } },
        { category: { name: "asc" } },
        { member: { fullName: "asc" } },
      ],
    });

    // Summary stats
    const totalCount = registrations.length;
    const paidCount = registrations.filter(r => r.status === "PAID" || r.status === "VERIFIED").length;
    const totalFee = registrations.reduce((sum, r) => sum + (r.category?.fee || 0), 0);
    const uniqueDojos = new Set(registrations.map(r => r.dojoId)).size;
    const uniqueAthletes = new Set(registrations.map(r => r.memberId)).size;

    return NextResponse.json({
      registrations,
      summary: {
        totalCount,
        paidCount,
        totalFee,
        uniqueDojos,
        uniqueAthletes,
      },
    });
  } catch (error: any) {
    console.error("GET /api/admin/pertandingan/registrations error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch registrations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { eventId, dojoId, entries, officialName, officialPhone, notes } = body;

    if (!eventId || !entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "eventId dan minimal 1 peserta/kategori wajib diisi" }, { status: 400 });
    }

    const created = [];
    const skipped = [];

    for (const entry of entries) {
      const { memberId, categoryId } = entry;
      if (!memberId || !categoryId) continue;

      // Check member's dojo if not provided
      const member = await prisma.member.findUnique({
        where: { id: memberId },
        select: { id: true, dojoId: true },
      });

      if (!member) continue;

      const targetDojoId = dojoId || member.dojoId;

      try {
        const reg = await prisma.tournamentRegistration.create({
          data: {
            eventId,
            dojoId: targetDojoId,
            memberId,
            categoryId,
            registeredByUserId: session.user.id,
            officialName: officialName || null,
            officialPhone: officialPhone || null,
            notes: notes || null,
            status: "REGISTERED",
          },
        });
        created.push(reg);
      } catch (err: any) {
        // Unique constraint violation (already registered for this category in this event)
        skipped.push({ memberId, categoryId, reason: "Sudah terdaftar di kategori ini" });
      }
    }

    return NextResponse.json({
      success: true,
      createdCount: created.length,
      skippedCount: skipped.length,
      skipped,
    });
  } catch (error: any) {
    console.error("POST /api/admin/pertandingan/registrations error:", error);
    return NextResponse.json({ error: error.message || "Failed to create registrations" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, actualWeight, notes, categoryId, paymentMethod, proofUrl, certificateUrl, medal, birthCertificateUrl, bpjsCardUrl, photoUrl } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (status !== undefined) dataToUpdate.status = status;
    if (actualWeight !== undefined) {
      dataToUpdate.actualWeight = (actualWeight !== null && actualWeight !== "" && actualWeight !== undefined && !isNaN(Number(actualWeight)))
        ? parseFloat(actualWeight.toString())
        : null;
    }
    if (notes !== undefined) dataToUpdate.notes = notes;
    if (categoryId !== undefined) dataToUpdate.categoryId = categoryId;
    if (paymentMethod !== undefined) dataToUpdate.paymentMethod = paymentMethod;
    if (proofUrl !== undefined) dataToUpdate.proofUrl = proofUrl;
    if (certificateUrl !== undefined) dataToUpdate.certificateUrl = certificateUrl;
    if (medal !== undefined) dataToUpdate.medal = medal;

    const updated = await prisma.tournamentRegistration.update({
      where: { id },
      data: dataToUpdate,
      include: {
        category: true,
        dojo: true,
        member: true,
      },
    });

    if (updated.memberId && (birthCertificateUrl !== undefined || bpjsCardUrl !== undefined || photoUrl !== undefined)) {
      const memberData: any = {};
      if (birthCertificateUrl !== undefined) memberData.birthCertificateUrl = birthCertificateUrl;
      if (bpjsCardUrl !== undefined) memberData.bpjsCardUrl = bpjsCardUrl;
      if (photoUrl !== undefined) memberData.photoUrl = photoUrl;

      await prisma.member.update({
        where: { id: updated.memberId },
        data: memberData,
      });
    }

    return NextResponse.json({ success: true, registration: updated });
  } catch (error: any) {
    console.error("PATCH /api/admin/pertandingan/registrations error:", error);
    return NextResponse.json({ error: error.message || "Failed to update registration" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await prisma.tournamentRegistration.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/admin/pertandingan/registrations error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete registration" }, { status: 500 });
  }
}

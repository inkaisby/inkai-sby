import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const dojoId = searchParams.get("dojoId");
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("search");

    // Fetch active tournament events
    const allEvents = await prisma.event.findMany({
      where: {
        isDeleted: false,
      },
      include: {
        _count: {
          select: {
            tournamentCategories: true,
            tournamentRegistrations: true,
          },
        },
        tournamentCategories: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { startDate: "desc" },
    });

    const events = allEvents.filter((e) => {
      const upper = (e.title || "").toUpperCase().trim();
      if (upper.startsWith("UKT") || upper.includes("UKT ") || upper.includes("UJIAN KENAIKAN TINGKAT")) return false;
      if (upper.startsWith("LATBER") || upper.includes("LATBER") || upper.includes("LATIHAN BERSAMA")) return false;
      return true;
    });

    const activeEventId = eventId || (events.length > 0 ? events[0].id : null);

    if (!activeEventId) {
      return NextResponse.json({ events: [], registrations: [], summary: {} });
    }

    const where: any = { eventId: activeEventId };

    if (dojoId) where.dojoId = dojoId;
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.OR = [
        { member: { fullName: { contains: search, mode: "insensitive" } } },
        { member: { nia: { contains: search, mode: "insensitive" } } },
        { dojo: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const registrations = await prisma.tournamentRegistration.findMany({
      where,
      select: {
        id: true,
        status: true,
        createdAt: true,
        actualWeight: true,
        paymentMethod: true,
        proofUrl: true,
        certificateUrl: true,
        medal: true,
        categoryId: true,
        dojoId: true,
        memberId: true,
        member: {
          select: {
            id: true,
            fullName: true,
            nia: true,
            mshNumber: true,
            currentRank: true,
            gender: true,
            birthDate: true,
            birthPlace: true,
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
            isFeeVisible: true,
          },
        },
      },
      orderBy: [
        { dojo: { name: "asc" } },
        { category: { name: "asc" } },
        { member: { fullName: "asc" } },
      ],
    });

    const totalRegistrations = registrations.length;
    const uniqueDojos = new Set(registrations.map(r => r.dojo.name)).size;
    const uniqueAthletes = new Set(registrations.map(r => r.member.fullName)).size;

    const dojos = await prisma.dojo.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      events,
      activeEventId,
      registrations,
      dojos,
      summary: {
        totalRegistrations,
        uniqueDojos,
        uniqueAthletes,
      },
    });
  } catch (error: any) {
    console.error("GET /api/public/pertandingan error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch public tournament data" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, categoryId, paymentMethod, proofUrl, certificateUrl, medal, actualWeight, status, birthCertificateUrl, bpjsCardUrl, photoUrl } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const reg = await prisma.tournamentRegistration.findUnique({
      where: { id },
      include: { member: true },
    });

    if (!reg) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (categoryId !== undefined) dataToUpdate.categoryId = categoryId;
    if (paymentMethod !== undefined) dataToUpdate.paymentMethod = paymentMethod;
    if (proofUrl !== undefined) dataToUpdate.proofUrl = proofUrl;
    if (certificateUrl !== undefined) dataToUpdate.certificateUrl = certificateUrl;
    if (medal !== undefined) dataToUpdate.medal = medal;
    if (actualWeight !== undefined) {
      dataToUpdate.actualWeight = (actualWeight !== null && actualWeight !== "" && actualWeight !== undefined && !isNaN(Number(actualWeight)))
        ? parseFloat(actualWeight.toString())
        : null;
    }
    if (status !== undefined) dataToUpdate.status = status;

    const updated = await prisma.tournamentRegistration.update({
      where: { id },
      data: dataToUpdate,
      include: {
        category: true,
        dojo: true,
        member: true,
      },
    });

    if (reg.memberId && (birthCertificateUrl !== undefined || bpjsCardUrl !== undefined || photoUrl !== undefined)) {
      const memberData: any = {};
      if (birthCertificateUrl !== undefined) memberData.birthCertificateUrl = birthCertificateUrl;
      if (bpjsCardUrl !== undefined) memberData.bpjsCardUrl = bpjsCardUrl;
      if (photoUrl !== undefined) memberData.photoUrl = photoUrl;

      await prisma.member.update({
        where: { id: reg.memberId },
        data: memberData,
      });
    }

    return NextResponse.json({ success: true, registration: updated });
  } catch (error: any) {
    console.error("PATCH /api/public/pertandingan error:", error);
    return NextResponse.json({ error: error.message || "Failed to update registration" }, { status: 500 });
  }
}


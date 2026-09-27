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
    const events = await prisma.event.findMany({
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
        member: {
          select: {
            fullName: true,
            nia: true,
            currentRank: true,
            photoUrl: true,
            birthCertificateUrl: true,
            bpjsCardUrl: true,
          },
        },
        dojo: {
          select: { name: true },
        },
        category: {
          select: {
            name: true,
            categoryType: true,
            gender: true,
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

    const totalRegistrations = registrations.length;
    const uniqueDojos = new Set(registrations.map(r => r.dojo.name)).size;
    const uniqueAthletes = new Set(registrations.map(r => r.member.fullName)).size;

    return NextResponse.json({
      events,
      activeEventId,
      registrations,
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

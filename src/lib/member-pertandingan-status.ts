import { prisma } from "@/lib/prisma";

export type MemberPertandinganPayload = {
  event?: {
    id: string;
    title: string;
    description?: string | null;
    startDate: string | Date;
    endDate: string | Date;
    eventTime?: string | null;
    location?: string | null;
    registrationCloseAt?: string | Date | null;
  } | null;
  registered?: boolean;
  registration?: {
    id: string;
    status: string;
    actualWeight?: number | null;
    category?: {
      name: string;
    } | null;
    dojo?: {
      name: string;
    } | null;
  } | null;
};

export async function getMemberPertandinganStatus(
  memberId: string,
): Promise<MemberPertandinganPayload> {
  if (!memberId) return { event: null };

  const now = new Date();

  // Find tournament events from Prisma
  const tournamentEvents = await prisma.event
    .findMany({
      where: {
        isDeleted: false,
        NOT: [
          { title: { startsWith: "UKT" } },
          { title: { contains: "UKT " } },
          { title: { contains: "UJIAN KENAIKAN TINGKAT" } },
          { title: { startsWith: "LATBER" } },
          { title: { contains: "LATBER" } },
          { title: { contains: "LATIHAN BERSAMA" } },
        ],
      },
      orderBy: { startDate: "desc" },
      take: 10,
    })
    .catch(() => []);

  if (!tournamentEvents || tournamentEvents.length === 0) {
    return { event: null };
  }

  // Check if member is registered in any of these tournament events
  const eventIds = tournamentEvents.map((e) => e.id);
  const myReg = await prisma.tournamentRegistration
    .findFirst({
      where: {
        memberId,
        eventId: { in: eventIds },
      },
      include: {
        category: { select: { name: true } },
        dojo: { select: { name: true } },
        event: true,
      },
      orderBy: { createdAt: "desc" },
    })
    .catch(() => null);

  if (myReg && myReg.event) {
    return {
      event: {
        id: myReg.event.id,
        title: myReg.event.title,
        description: myReg.event.description,
        startDate: myReg.event.startDate,
        endDate: myReg.event.endDate,
        eventTime: myReg.event.eventTime,
        location: myReg.event.location,
        registrationCloseAt: myReg.event.registrationCloseAt,
      },
      registered: true,
      registration: {
        id: myReg.id,
        status: myReg.status,
        actualWeight: myReg.actualWeight,
        category: myReg.category,
        dojo: myReg.dojo,
      },
    };
  }

  // If member is not registered, find the first active open tournament event where registration is not expired
  const activeEvent = tournamentEvents.find((e) => {
    const regClose = e.registrationCloseAt ? new Date(e.registrationCloseAt) : null;
    const end = e.endDate ? new Date(e.endDate) : null;
    if (regClose && regClose < now) return false;
    if (end && end < new Date(now.valueOf() - 24 * 60 * 60 * 1000)) return false;
    return true;
  });

  if (!activeEvent) {
    return { event: null };
  }

  return {
    event: {
      id: activeEvent.id,
      title: activeEvent.title,
      description: activeEvent.description,
      startDate: activeEvent.startDate,
      endDate: activeEvent.endDate,
      eventTime: activeEvent.eventTime,
      location: activeEvent.location,
      registrationCloseAt: activeEvent.registrationCloseAt,
    },
    registered: false,
  };
}

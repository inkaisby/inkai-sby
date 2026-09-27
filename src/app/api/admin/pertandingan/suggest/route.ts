import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatRankLabel } from "@/lib/belt";

export const dynamic = "force-dynamic";

const suggestSchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  eventId: z.string().trim().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = suggestSchema.safeParse({
      q: searchParams.get("q") ?? undefined,
      eventId: searchParams.get("eventId") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ suggestions: [] });
    }

    const rawQ = parsed.data.q.trim();
    if (rawQ.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const { eventId } = parsed.data;

    const members = await prisma.member.findMany({
      where: {
        isDeleted: false,
        OR: [
          { fullName: { contains: rawQ, mode: "insensitive" } },
          { nia: { contains: rawQ, mode: "insensitive" } },
          { dojo: { name: { contains: rawQ, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        nia: true,
        currentRank: true,
        gender: true,
        birthDate: true,
        dojo: { select: { id: true, name: true } },
        user: { select: { phoneNumber: true } },
      },
      take: 12,
      orderBy: { fullName: "asc" },
    });

    let registeredMemberIds = new Set<string>();
    if (eventId && members.length > 0) {
      const regs = await prisma.tournamentRegistration.findMany({
        where: {
          eventId,
          memberId: { in: members.map((m) => m.id) },
        },
        select: { memberId: true },
      });
      registeredMemberIds = new Set(regs.map((r) => r.memberId));
    }

    return NextResponse.json({
      suggestions: members.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        nia: m.nia,
        dojoId: m.dojo?.id || null,
        dojoName: m.dojo?.name || "Dojo Mandiri",
        currentRank: formatRankLabel(m.currentRank) || m.currentRank || "Putih",
        gender: m.gender || "MALE",
        birthDate: m.birthDate ? m.birthDate.toISOString().split("T")[0] : "",
        isRegistered: registeredMemberIds.has(m.id),
      })),
    });
  } catch (error: any) {
    console.error("GET /api/admin/pertandingan/suggest error:", error);
    return NextResponse.json({ suggestions: [] });
  }
}

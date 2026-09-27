import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formatRankLabel } from "@/lib/belt";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";

export const dynamic = "force-dynamic";

const suggestQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  eventId: z.string().trim().optional(),
});

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const limited = await rateLimitAsync(`pertandingan-public-suggest:${ip}`, {
      max: 60,
      windowMs: 60_000,
    });
    if (!limited.success) {
      return rateLimitResponse(limited.retryAfterSec ?? 60);
    }

    const { searchParams } = new URL(request.url);
    const parsed = suggestQuerySchema.safeParse({
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

    // Fetch matching members
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
        photoUrl: true,
        birthCertificateUrl: true,
        bpjsCardUrl: true,
        dojo: { select: { id: true, name: true } },
        user: { select: { phoneNumber: true } },
      },
      take: 10,
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
        dojoName: m.dojo?.name || "Dojo Mandiri / Tamu",
        currentRank: formatRankLabel(m.currentRank) || m.currentRank || "Putih (Kyu 10)",
        gender: m.gender || "MALE",
        birthDate: m.birthDate ? m.birthDate.toISOString().split("T")[0] : "",
        phone: m.user?.phoneNumber || "",
        photoUrl: m.photoUrl || "",
        birthCertificateUrl: m.birthCertificateUrl || "",
        bpjsCardUrl: m.bpjsCardUrl || "",
        isRegistered: registeredMemberIds.has(m.id),
      })),
    });
  } catch (error: any) {
    console.error("GET /api/public/pertandingan/suggest error:", error);
    return NextResponse.json({ suggestions: [] });
  }
}

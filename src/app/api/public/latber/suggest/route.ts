import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formatRankLabel } from "@/lib/belt";
import { parseMemberCardScanPayload } from "@/lib/latber-card-scan";
import {
  resolveActiveLatberPeriodId,
} from "@/lib/latber-public";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";

export const dynamic = "force-dynamic";

const suggestQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  period: z.string().trim().uuid().optional(),
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limited = await rateLimitAsync(`latber-public-suggest:${ip}`, {
    max: 40,
    windowMs: 60_000,
  });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60);
  }

  const { searchParams } = new URL(request.url);
  const parsed = suggestQuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    period: searchParams.get("period") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ suggestions: [] });
  }

  const rawQ = parseMemberCardScanPayload(parsed.data.q);
  const isUuid = UUID_RE.test(rawQ);
  const isCardPath = rawQ.length >= 1 && (isUuid || rawQ.includes("."));
  if (rawQ.length < 2 && !isUuid) {
    return NextResponse.json({ suggestions: [] });
  }

  const { period } = await resolveActiveLatberPeriodId(parsed.data.period);

  const members = await prisma.member.findMany({
    where: {
      isDeleted: false,
      OR: isUuid
        ? [{ id: rawQ }, { nia: { equals: rawQ, mode: "insensitive" } }]
        : [
            { fullName: { contains: rawQ, mode: "insensitive" } },
            { nia: { contains: rawQ, mode: "insensitive" } },
            ...(isCardPath
              ? [{ nia: { equals: rawQ, mode: "insensitive" as const } }]
              : []),
          ],
    },
    select: {
      id: true,
      fullName: true,
      nia: true,
      currentRank: true,
      status: true,
      dojo: { select: { name: true } },
    },
    take: 8,
    orderBy: { fullName: "asc" },
  });

  let registeredIds = new Set<string>();
  if (period && members.length > 0) {
    const regs = await prisma.eventRegistration.findMany({
      where: {
        eventId: period.id,
        memberId: { in: members.map((m) => m.id) },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      select: { memberId: true },
    });
    registeredIds = new Set(regs.map((r) => r.memberId));
  }

  return NextResponse.json({
    suggestions: members.map((m) => {
      const status = String(m.status ?? "").toLowerCase();
      const inactive =
        status === "inactive" ||
        status === "suspended" ||
        status === "rejected";
      return {
        id: m.id,
        fullName: m.fullName,
        nia: m.nia,
        dojoName: m.dojo?.name ?? "—",
        currentRank: formatRankLabel(m.currentRank) || m.currentRank,
        status: m.status,
        registered: registeredIds.has(m.id),
        canRegister: !inactive,
      };
    }),
  });
}

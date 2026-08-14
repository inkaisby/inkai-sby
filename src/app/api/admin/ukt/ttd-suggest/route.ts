import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { canEditKyuBaru, formatRankLabel, isBlackBeltRank } from "@/lib/belt";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { formatUktOfficerTitle } from "@/lib/ukt-ttd";

const suggestQuerySchema = z.object({
  q: z.string().trim().max(64).optional().default(""),
});

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canEditKyuBaru(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat mencari pejabat/penguji" },
      { status: 403 },
    );
  }

  const rlKey = `ukt:ttd-suggest:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 60, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const { searchParams } = new URL(request.url);
  const parsed = suggestQuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
  });
  if (!parsed.success || parsed.data.q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }
  const q = parsed.data.q;

  const members = await prisma.member.findMany({
    where: {
      isDeleted: false,
      userId: { not: null },
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { nia: { contains: q, mode: "insensitive" } },
        { mshNumber: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      nia: true,
      mshNumber: true,
      currentRank: true,
      dojo: { select: { name: true } },
    },
    take: 40,
    orderBy: { fullName: "asc" },
  });

  const suggestions = members
    .filter((m) => isBlackBeltRank(m.currentRank))
    .slice(0, 12)
    .map((m) => ({
      id: m.id,
      fullName: m.fullName,
      nia: m.nia,
      mshNumber: m.mshNumber,
      currentRank: formatRankLabel(m.currentRank),
      dojoName: m.dojo?.name ?? "",
      officerTitle: formatUktOfficerTitle(m.currentRank, m.mshNumber),
    }));

  return NextResponse.json({ suggestions });
}

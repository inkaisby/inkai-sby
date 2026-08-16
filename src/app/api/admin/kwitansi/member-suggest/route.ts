import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { formatRankLabel } from "@/lib/belt";
import { prisma } from "@/lib/prisma";
import { buildMemberFilter } from "@/lib/rbac";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { formatUktOfficerTitle } from "@/lib/ukt-ttd";

const suggestQuerySchema = z.object({
  q: z.string().trim().max(64).optional().default(""),
});

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const rlKey = `kwitansi:member-suggest:${authResult.user.id}`;
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
      AND: [
        buildMemberFilter(authResult.user),
        {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { nia: { contains: q, mode: "insensitive" } },
            { mshNumber: { contains: q, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: {
      id: true,
      fullName: true,
      nia: true,
      mshNumber: true,
      currentRank: true,
      signatureUrl: true,
      dojo: { select: { name: true } },
    },
    take: 20,
    orderBy: { fullName: "asc" },
  });

  const suggestions = members.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    nia: m.nia,
    mshNumber: m.mshNumber,
    currentRank: formatRankLabel(m.currentRank),
    dojoName: m.dojo?.name ?? "",
    officerTitle: formatUktOfficerTitle(m.currentRank, m.mshNumber),
    signatureUrl: m.signatureUrl,
  }));

  return NextResponse.json({ suggestions });
}

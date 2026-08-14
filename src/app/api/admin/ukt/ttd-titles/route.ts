import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { canEditKyuBaru } from "@/lib/belt";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { formatUktOfficerTitle } from "@/lib/ukt-ttd";

const bodySchema = z.object({
  memberIds: z.array(z.string().trim().min(1).max(64)).max(40),
});

/** Batch refresh pangkat/MSH dari keanggotaan untuk pejabat/penguji TTD. */
export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canEditKyuBaru(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat menyegarkan pangkat TTD" },
      { status: 403 },
    );
  }

  const rlKey = `ukt:ttd-titles:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 40, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const ids = [...new Set(parsed.data.memberIds)];
  if (ids.length === 0) {
    return NextResponse.json({ titles: {} });
  }

  const members = await prisma.member.findMany({
    where: { id: { in: ids }, isDeleted: false },
    select: { id: true, currentRank: true, mshNumber: true },
  });

  const titles: Record<string, string> = {};
  for (const m of members) {
    const title = formatUktOfficerTitle(m.currentRank, m.mshNumber);
    if (title) titles[m.id] = title;
  }

  return NextResponse.json({ titles });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { buildMemberFilter } from "@/lib/rbac";

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const dojoId = searchParams.get("dojo")?.trim() || "";

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const members = await prisma.member.findMany({
    where: {
      ...buildMemberFilter(authResult.user),
      ...(dojoId ? { dojoId } : {}),
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { nia: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      nia: true,
      currentRank: true,
      dojo: { select: { name: true } },
    },
    orderBy: { fullName: "asc" },
    take: 8,
  });

  return NextResponse.json({
    suggestions: members.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      nia: m.nia,
      dojoName: m.dojo.name,
      currentRank: m.currentRank,
    })),
  });
}

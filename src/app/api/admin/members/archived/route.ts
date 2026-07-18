import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { buildMemberFilter } from "@/lib/rbac";
import { getMemberLifecycles } from "@/lib/member-lifecycle";
import { canSoftDeleteMembers } from "@/lib/wilayah-rbac";

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canSoftDeleteMembers(authResult.user.roles)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const dojoId = searchParams.get("dojoId")?.trim() || "";

  const members = await prisma.member.findMany({
    where: {
      AND: [
        buildMemberFilter(authResult.user, { includeDeleted: true }),
        dojoId ? { dojoId } : {},
        q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { nia: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    select: {
      id: true,
      fullName: true,
      nia: true,
      currentRank: true,
      status: true,
      updatedAt: true,
      dojo: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const lifecycles = await getMemberLifecycles(members.map((m) => m.id));

  return NextResponse.json({
    data: members.map((m) => ({
      ...m,
      updatedAt: m.updatedAt.toISOString(),
      lifecycle: lifecycles.get(m.id) ?? null,
    })),
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";
import { buildMemberFilter, getPrimaryAdminRole } from "@/lib/rbac";
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";

const suggestQuerySchema = z.object({
  q: z.string().trim().max(64).optional().default(""),
  dojo: z.string().trim().max(64).optional().default(""),
});

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsedQuery = suggestQuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    dojo: searchParams.get("dojo") ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ suggestions: [] });
  }
  const { q } = parsedQuery.data;
  const dojoId = parsedQuery.data.dojo;

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const primaryRole = getPrimaryAdminRole(authResult.user.roles);

  if (primaryRole === "ADMIN_DOJO") {
    // Fail-closed: tanpa ranting terkelola atau di luar allowlist → tidak ada saran.
    const allowlist = getManagedDojoIdsFromUser(authResult.user);
    if (allowlist.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }
    if (dojoId && !allowlist.includes(dojoId)) {
      return NextResponse.json({ suggestions: [] });
    }
    const scopedDojoIds = dojoId ? [dojoId] : allowlist;

    const members = await prisma.member.findMany({
      where: {
        AND: [
          buildMemberFilter(authResult.user),
          { dojoId: { in: scopedDojoIds } },
          {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { nia: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        fullName: true,
        nia: true,
        currentRank: true,
        dojo: { select: { name: true } },
      },
      take: 8,
      orderBy: { fullName: "asc" },
    });

    return NextResponse.json({
      suggestions: members.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        nia: m.nia,
        dojoName: m.dojo?.name,
        currentRank: m.currentRank,
      })),
    });
  }

  const qs = new URLSearchParams();
  qs.set("search", q);
  qs.set("limit", "8");
  if (dojoId) qs.set("dojoId", dojoId);

  const { res, data } = await inkaiFetch(`/v1/members?${qs}`, {}, authResult.token);
  if (!res.ok) {
    return NextResponse.json({ suggestions: [] });
  }

  const members = (data.data as Array<Record<string, unknown>>) ?? [];
  return NextResponse.json({
    suggestions: members.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      nia: m.nia,
      dojoName: (m.dojo as { name?: string } | undefined)?.name,
      currentRank: m.currentRank,
    })),
  });
}

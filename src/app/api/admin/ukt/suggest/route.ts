import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";
import { buildMemberFilter, getPrimaryAdminRole } from "@/lib/rbac";
import { resolveAdminDojoClusterAllowlist } from "@/lib/account-peers";
import {
  attachSuggestRegistrationFlags,
  inkaiMemberDojoName,
  mergeSuggestDojoNames,
  type UktSuggestItem,
} from "@/lib/ukt-suggest";

const suggestQuerySchema = z.object({
  q: z.string().trim().max(64).optional().default(""),
  dojo: z.string().trim().max(64).optional().default(""),
  uktEventId: z.string().trim().max(64).optional().default(""),
  latberEventId: z.string().trim().max(64).optional().default(""),
});

const ACTIVE_REG_STATUS = { notIn: ["CANCELLED", "REJECTED"] };

async function hydrateDojoAndFlags(
  suggestions: UktSuggestItem[],
  uktEventId: string,
  latberEventId: string,
): Promise<UktSuggestItem[]> {
  if (suggestions.length === 0) return suggestions;
  const ids = suggestions.map((s) => s.id);
  const prismaRows = await prisma.member.findMany({
    where: { id: { in: ids } },
    select: { id: true, dojo: { select: { name: true } } },
  });
  const dojoById = new Map(
    prismaRows
      .filter((m) => m.dojo?.name)
      .map((m) => [m.id, m.dojo!.name] as const),
  );
  let next = mergeSuggestDojoNames(suggestions, dojoById);

  const eventIds = [uktEventId, latberEventId].filter(Boolean);
  if (eventIds.length === 0) return next;

  const regs = await prisma.eventRegistration.findMany({
    where: {
      memberId: { in: ids },
      eventId: { in: eventIds },
      status: ACTIVE_REG_STATUS,
    },
    select: { memberId: true, eventId: true },
  });
  return attachSuggestRegistrationFlags(
    next,
    regs,
    uktEventId || undefined,
    latberEventId || undefined,
  );
}

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
    uktEventId: searchParams.get("uktEventId") ?? undefined,
    latberEventId: searchParams.get("latberEventId") ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ suggestions: [] });
  }
  const { q, uktEventId, latberEventId } = parsedQuery.data;
  const dojoId = parsedQuery.data.dojo;

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const primaryRole = getPrimaryAdminRole(authResult.user.roles);

  if (primaryRole === "ADMIN_DOJO") {
    const allowlist = await resolveAdminDojoClusterAllowlist(authResult.user);
    if (allowlist.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }
    if (dojoId && !allowlist.includes(dojoId)) {
      return NextResponse.json({ suggestions: [] });
    }
    const scopedDojoIds = dojoId ? [dojoId] : allowlist;
    const scopedUser = { ...authResult.user, managedDojoIds: allowlist };

    const members = await prisma.member.findMany({
      where: {
        AND: [
          buildMemberFilter(scopedUser),
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

    const suggestions = members.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      nia: m.nia,
      dojoName: m.dojo?.name,
      currentRank: m.currentRank,
    }));

    return NextResponse.json({
      suggestions: await hydrateDojoAndFlags(
        suggestions,
        uktEventId,
        latberEventId,
      ),
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
  const suggestions: UktSuggestItem[] = members.map((m) => ({
    id: String(m.id ?? ""),
    fullName: String(m.fullName ?? ""),
    nia: typeof m.nia === "string" ? m.nia : null,
    dojoName: inkaiMemberDojoName(m),
    currentRank: typeof m.currentRank === "string" ? m.currentRank : undefined,
  })).filter((m) => m.id);

  return NextResponse.json({
    suggestions: await hydrateDojoAndFlags(
      suggestions,
      uktEventId,
      latberEventId,
    ),
  });
}

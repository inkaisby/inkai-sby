import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { canAccessKas } from "@/lib/kas-store";
import { resolveUktTermFromDateRange } from "@/lib/kas-ukt-deposit";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { resolveAdminDojoClusterAllowlist } from "@/lib/account-peers";
import {
  buildUktAdminUrl,
  buildUktDepositMap,
  findUktPeriodForTerm,
  isUktAdminEventTitle,
  parseUktPeriodMetaValue,
  type UktDepositRecord,
  type UktPeriodOption,
} from "@/lib/ukt";

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canAccessKas(authResult.user, authResult.adminDojoGrants)) {
    return NextResponse.json({ error: "Tidak berhak membuka Kas" }, { status: 403 });
  }

  const url = new URL(request.url);
  const from = (url.searchParams.get("from") || "").trim();
  const to = (url.searchParams.get("to") || "").trim();
  const { term, ambiguous } = resolveUktTermFromDateRange(from, to || from);

  const empty = {
    period: null as null,
    periodUrl: null as string | null,
    ambiguous,
    depositMap: {} as Record<string, UktDepositRecord>,
    loadError: false,
  };

  if (!term) {
    return NextResponse.json(empty);
  }

  try {
    const events = await prisma.event.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        registrationCloseAt: true,
        createdAt: true,
      },
    });
    const uktEvents = events.filter((e) => isUktAdminEventTitle(e.title));
    const metaRows = await prisma.appSetting.findMany({
      where: { key: { startsWith: "ukt-period-meta:" } },
      select: { key: true, value: true },
    });
    const metaById = new Map(
      metaRows.map((row) => [
        row.key.slice("ukt-period-meta:".length),
        parseUktPeriodMetaValue(row.value),
      ]),
    );

    const periods: UktPeriodOption[] = uktEvents.map((e) => {
      const meta = metaById.get(e.id);
      return {
        id: e.id,
        title: e.title,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        registrationCloseAt: e.registrationCloseAt?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
        archived: meta?.archived === true,
        locked: meta?.locked === true,
      };
    });

    const active = findUktPeriodForTerm(periods, term.semester, term.year);
    const period =
      active && !active.archived
        ? active
        : findUktPeriodForTerm(periods, term.semester, term.year);
    if (!period) {
      return NextResponse.json({
        ...empty,
        ambiguous,
      });
    }

    const prefix = `ukt-deposit:${period.id}:`;
    const depositRows = await prisma.appSetting.findMany({
      where: { key: { startsWith: prefix } },
      select: { key: true, value: true },
    });
    const map = buildUktDepositMap(depositRows, period.id);

    const primaryRole = getPrimaryAdminRole(authResult.user.roles);
    if (primaryRole === "ADMIN_DOJO") {
      const allow = await resolveAdminDojoClusterAllowlist(authResult.user);
      for (const key of [...map.keys()]) {
        if (!allow.includes(key)) map.delete(key);
      }
    }

    const depositMap: Record<string, UktDepositRecord> = Object.fromEntries(map);

    return NextResponse.json({
      period: {
        id: period.id,
        title: period.title,
        semester: term.semester,
        year: term.year,
      },
      periodUrl: buildUktAdminUrl(term.semester, term.year, period.id),
      ambiguous,
      depositMap,
      loadError: false,
    });
  } catch {
    return NextResponse.json({
      ...empty,
      ambiguous,
      loadError: true,
    });
  }
}

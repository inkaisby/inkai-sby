import { inkaiFetch } from "@/lib/inkai-api/server";
import { fetchUktEventsCached } from "@/lib/inkai-api/admin-data";
import {
  findActiveLatberPeriod,
  isLatberEventTitle,
  latberPeriodMetaKey,
  parseLatberPeriodMetaValue,
  periodOptionFromLatberEvent,
  type LatberPeriodOption,
} from "@/lib/latber";
import {
  currentSemester,
  findUktPeriodForTerm,
  isUktAdminEventTitle,
  parseUktPeriodMetaValue,
  uktPeriodMetaKey,
} from "@/lib/ukt";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma";

function uktPeriodFromEvent(event: Record<string, unknown>) {
  return {
    id: String(event.id ?? ""),
    title: String(event.title ?? ""),
    startDate: String(event.startDate ?? ""),
    endDate: String(event.endDate ?? ""),
    registrationCloseAt: event.registrationCloseAt
      ? String(event.registrationCloseAt)
      : null,
    createdAt: event.createdAt ? String(event.createdAt) : undefined,
    archived: false as boolean | undefined,
    locked: false as boolean | undefined,
  };
}

export type ActiveRegistrationPeriod = { id: string; title: string } | null;

const FETCH_OPTS = { timeoutMs: 8_000, retries: 0 } as const;

async function fetchSettingsByPrefix(token: string, prefix: string) {
  const { res, data } = await inkaiFetch(
    `/v1/settings?prefix=${encodeURIComponent(prefix)}`,
    {},
    token,
    FETCH_OPTS,
  );
  if (!res.ok) return [] as Array<{ key: string; value: unknown }>;
  return ((data.data as Array<{ key: string; value: unknown }>) ?? []).filter((r) =>
    r.key?.startsWith(prefix),
  );
}

async function fetchUktPeriodOptionsFromPrisma() {
  const { data } = await withPrismaFallback(
    "active-ukt-periods-prisma",
    () =>
      prisma.event.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          registrationCloseAt: true,
          createdAt: true,
        },
        orderBy: { startDate: "desc" },
        take: 80,
      }),
    [] as Array<{
      id: string;
      title: string;
      startDate: Date;
      endDate: Date;
      registrationCloseAt: Date | null;
      createdAt: Date;
    }>,
  );

  return (data ?? [])
    .filter((e) => isUktAdminEventTitle(e.title))
    .map((e) =>
      uktPeriodFromEvent({
        id: e.id,
        title: e.title,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        registrationCloseAt: e.registrationCloseAt?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
      }),
    );
}

async function fetchLatberPeriodOptionsFromPrisma() {
  const { data } = await withPrismaFallback(
    "active-latber-periods-prisma",
    () =>
      prisma.event.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          registrationCloseAt: true,
        },
        orderBy: { startDate: "desc" },
        take: 80,
      }),
    [] as Array<{
      id: string;
      title: string;
      startDate: Date;
      endDate: Date;
      registrationCloseAt: Date | null;
    }>,
  );

  return (data ?? [])
    .filter((e) => isLatberEventTitle(e.title))
    .map((e) =>
      periodOptionFromLatberEvent({
        id: e.id,
        title: e.title,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        registrationCloseAt: e.registrationCloseAt?.toISOString() ?? null,
      }),
    );
}

async function loadUktPeriodMetaFromPrisma(periodIds: string[]) {
  const ids = [...new Set(periodIds.filter(Boolean))];
  if (ids.length === 0) return new Map<string, ReturnType<typeof parseUktPeriodMetaValue>>();
  const keys = ids.map((id) => uktPeriodMetaKey(id));
  const { data } = await withPrismaFallback(
    "active-ukt-period-meta-prisma",
    () =>
      prisma.appSetting.findMany({
        where: { key: { in: keys } },
        select: { key: true, value: true },
      }),
    [] as Array<{ key: string; value: unknown }>,
  );
  const map = new Map<string, ReturnType<typeof parseUktPeriodMetaValue>>();
  for (const row of data ?? []) {
    const id = row.key.slice("ukt-period-meta:".length);
    if (id) map.set(id, parseUktPeriodMetaValue(row.value));
  }
  return map;
}

async function loadLatberPeriodMetaFromPrisma(periodIds: string[]) {
  const ids = [...new Set(periodIds.filter(Boolean))];
  if (ids.length === 0) return new Map<string, ReturnType<typeof parseLatberPeriodMetaValue>>();
  const keys = ids.map((id) => latberPeriodMetaKey(id));
  const { data } = await withPrismaFallback(
    "active-latber-period-meta-prisma",
    () =>
      prisma.appSetting.findMany({
        where: { key: { in: keys } },
        select: { key: true, value: true },
      }),
    [] as Array<{ key: string; value: unknown }>,
  );
  const map = new Map<string, ReturnType<typeof parseLatberPeriodMetaValue>>();
  for (const row of data ?? []) {
    const id = row.key.slice("latber-period-meta:".length);
    if (id) map.set(id, parseLatberPeriodMetaValue(row.value));
  }
  return map;
}

function applyUktMeta(
  periods: ReturnType<typeof uktPeriodFromEvent>[],
  metaById: Map<string, ReturnType<typeof parseUktPeriodMetaValue>>,
) {
  return periods.map((p) => {
    const meta = metaById.get(p.id);
    return {
      ...p,
      archived: meta?.archived === true,
      locked: meta?.locked === true,
    };
  });
}

function applyLatberMeta(
  periods: LatberPeriodOption[],
  metaById: Map<string, ReturnType<typeof parseLatberPeriodMetaValue>>,
) {
  return periods.map((p) => {
    const meta = metaById.get(p.id);
    return {
      ...p,
      archived: meta?.archived === true,
      locked: meta?.locked === true,
    };
  });
}

/** Periode Latber aktif (non-arsip, pendaftaran masih relevan) — ringan untuk quick-reg. */
export async function resolveActiveLatberRegistrationPeriod(
  token: string,
): Promise<ActiveRegistrationPeriod> {
  const [eventsRes, metaRows] = await Promise.all([
    inkaiFetch("/v1/events?limit=200", {}, token, FETCH_OPTS),
    fetchSettingsByPrefix(token, "latber-period-meta:"),
  ]);

  const metaById = new Map(
    metaRows.map((row) => [
      row.key.slice("latber-period-meta:".length),
      parseLatberPeriodMetaValue(row.value),
    ]),
  );

  let periods: LatberPeriodOption[] = eventsRes.res.ok
    ? (
        (eventsRes.data.data as Array<Record<string, unknown>>) ?? []
      )
        .filter((e) => isLatberEventTitle(String(e.title ?? "")))
        .map((e) => {
          const opt = periodOptionFromLatberEvent(e);
          const meta = metaById.get(opt.id);
          return {
            ...opt,
            archived: meta?.archived === true,
            locked: meta?.locked === true,
          };
        })
    : [];

  if (!eventsRes.res.ok || periods.length === 0) {
    const prismaPeriods = await fetchLatberPeriodOptionsFromPrisma();
    if (prismaPeriods.length > 0) {
      const prismaMeta = await loadLatberPeriodMetaFromPrisma(
        prismaPeriods.map((p) => p.id),
      );
      for (const [id, meta] of prismaMeta) {
        if (!metaById.has(id)) metaById.set(id, meta);
      }
      periods = applyLatberMeta(prismaPeriods, metaById);
    }
  } else {
    const missingMetaIds = periods
      .map((p) => p.id)
      .filter((id) => id && !metaById.has(id));
    if (missingMetaIds.length > 0) {
      const prismaMeta = await loadLatberPeriodMetaFromPrisma(missingMetaIds);
      for (const [id, meta] of prismaMeta) {
        metaById.set(id, meta);
      }
      periods = applyLatberMeta(periods, metaById);
    }
  }

  const active = findActiveLatberPeriod(periods);
  if (!active || active.archived || active.locked) return null;
  return { id: active.id, title: active.title };
}

/** Periode UKT aktif — ringan untuk quick-reg. */
export async function resolveActiveUktRegistrationPeriod(
  token: string,
): Promise<ActiveRegistrationPeriod> {
  const [eventsData, metaRows] = await Promise.all([
    fetchUktEventsCached(token, FETCH_OPTS),
    fetchSettingsByPrefix(token, "ukt-period-meta:"),
  ]);

  const metaById = new Map(
    metaRows.map((row) => [
      row.key.slice("ukt-period-meta:".length),
      parseUktPeriodMetaValue(row.value),
    ]),
  );

  let periods = eventsData.ok
    ? eventsData.events.map((e) => {
        const opt = uktPeriodFromEvent(e);
        const meta = metaById.get(opt.id);
        return {
          ...opt,
          archived: meta?.archived === true,
          locked: meta?.locked === true,
        };
      })
    : [];

  if (!eventsData.ok || periods.length === 0) {
    const prismaPeriods = await fetchUktPeriodOptionsFromPrisma();
    if (prismaPeriods.length > 0) {
      const prismaMeta = await loadUktPeriodMetaFromPrisma(
        prismaPeriods.map((p) => p.id),
      );
      for (const [id, meta] of prismaMeta) {
        if (!metaById.has(id)) metaById.set(id, meta);
      }
      periods = applyUktMeta(prismaPeriods, metaById);
    }
  } else {
    const missingMetaIds = periods
      .map((p) => p.id)
      .filter((id) => id && !metaById.has(id));
    if (missingMetaIds.length > 0) {
      const prismaMeta = await loadUktPeriodMetaFromPrisma(missingMetaIds);
      for (const [id, meta] of prismaMeta) {
        metaById.set(id, meta);
      }
      periods = applyUktMeta(periods, metaById);
    }
  }

  if (periods.length === 0) return null;

  const year = new Date().getFullYear();
  const semester = currentSemester();
  const active = findUktPeriodForTerm(periods, semester, year);
  if (!active || active.archived || active.locked) return null;
  return { id: active.id, title: active.title };
}

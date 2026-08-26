import { inkaiFetch } from "@/lib/inkai-api/server";
import { fetchUktEventsCached } from "@/lib/inkai-api/admin-data";
import {
  findActiveLatberPeriod,
  isLatberEventTitle,
  parseLatberPeriodMetaValue,
  periodOptionFromLatberEvent,
  type LatberPeriodOption,
} from "@/lib/latber";
import {
  currentSemester,
  findUktPeriodForTerm,
  parseUktPeriodMetaValue,
} from "@/lib/ukt";

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

/** Periode Latber aktif (non-arsip, pendaftaran masih relevan) — ringan untuk quick-reg. */
export async function resolveActiveLatberRegistrationPeriod(
  token: string,
): Promise<ActiveRegistrationPeriod> {
  const [eventsRes, metaRows] = await Promise.all([
    inkaiFetch("/v1/events?limit=200", {}, token, FETCH_OPTS),
    fetchSettingsByPrefix(token, "latber-period-meta:"),
  ]);
  if (!eventsRes.res.ok) return null;

  const metaById = new Map(
    metaRows.map((row) => [
      row.key.slice("latber-period-meta:".length),
      parseLatberPeriodMetaValue(row.value),
    ]),
  );

  const periods: LatberPeriodOption[] = (
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
    });

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

  const periods = eventsData.events.map((e) => {
    const opt = uktPeriodFromEvent(e);
    const meta = metaById.get(opt.id);
    return {
      ...opt,
      archived: meta?.archived === true,
      locked: meta?.locked === true,
    };
  });

  if (!eventsData.ok) return null;

  const year = new Date().getFullYear();
  const semester = currentSemester();
  const active = findUktPeriodForTerm(periods, semester, year);
  if (!active || active.archived || active.locked) return null;
  return { id: active.id, title: active.title };
}

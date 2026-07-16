import type { Prisma } from "@prisma/client";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import {
  diffPengurusPeriods,
  summarizeChanges,
  type PengurusChangeEntry,
} from "@/lib/pengurus-diff";
import type { PengurusPeriod } from "@/lib/struktur-pengurus";

export const PENGURUS_HISTORY_KEY = "organisasi-pengurus-history";
const MAX_HISTORY = 80;

export async function fetchPengurusHistory(): Promise<PengurusChangeEntry[]> {
  const { data } = await withPrismaFallback(
    "pengurus-history",
    async () => {
      const row = await prisma.appSetting.findUnique({
        where: { key: PENGURUS_HISTORY_KEY },
      });
      if (!row || !Array.isArray(row.value)) return [] as PengurusChangeEntry[];
      return row.value as PengurusChangeEntry[];
    },
    [] as PengurusChangeEntry[],
  );
  return data;
}

export async function appendPengurusHistory(entry: PengurusChangeEntry) {
  const current = await fetchPengurusHistory();
  const next = [entry, ...current].slice(0, MAX_HISTORY);
  await prisma.appSetting.upsert({
    where: { key: PENGURUS_HISTORY_KEY },
    create: {
      key: PENGURUS_HISTORY_KEY,
      value: next as unknown as Prisma.InputJsonValue,
    },
    update: { value: next as unknown as Prisma.InputJsonValue },
  });
  return next;
}

export async function recordPengurusChange(opts: {
  action: string;
  byEmail: string;
  before: PengurusPeriod | null;
  after: PengurusPeriod;
}) {
  const changes = diffPengurusPeriods(opts.before, opts.after);
  const entry: PengurusChangeEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    byEmail: opts.byEmail,
    action: opts.action,
    periodId: opts.after.id,
    periodeLabel: opts.after.periode,
    summary: summarizeChanges(changes),
    changes: changes.slice(0, 40),
  };
  await appendPengurusHistory(entry);
  return entry;
}

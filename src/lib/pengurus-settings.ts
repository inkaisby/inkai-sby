import { unstable_cache } from "next/cache";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import {
  DEFAULT_PENGURUS_STORE,
  PENGURUS_CACHE_TAG,
  PENGURUS_SETTING_KEY,
  createDefaultPeriod,
  duplicatePeriod,
  getActivePeriod,
  normalizePengurusStore,
  pengurusPeriodSchema,
  type PengurusPeriod,
  type PengurusStore,
} from "@/lib/struktur-pengurus";

async function readStore(): Promise<PengurusStore> {
  const { data } = await withPrismaFallback(
    "pengurus-store",
    async () => {
      const row = await prisma.appSetting.findUnique({
        where: { key: PENGURUS_SETTING_KEY },
      });
      if (!row) return structuredClone(DEFAULT_PENGURUS_STORE);
      return normalizePengurusStore(row.value);
    },
    structuredClone(DEFAULT_PENGURUS_STORE),
  );
  return data;
}

export async function writeStore(store: PengurusStore): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: PENGURUS_SETTING_KEY },
    create: { key: PENGURUS_SETTING_KEY, value: store },
    update: { value: store },
  });
}

export async function fetchPengurusStore(
  seedIfMissing = false,
): Promise<PengurusStore> {
  const { data, failed } = await withPrismaFallback(
    "pengurus-store-fetch",
    async () => {
      const row = await prisma.appSetting.findUnique({
        where: { key: PENGURUS_SETTING_KEY },
      });

      if (!row) {
        const store = structuredClone(DEFAULT_PENGURUS_STORE);
        if (seedIfMissing) {
          await prisma.appSetting.create({
            data: { key: PENGURUS_SETTING_KEY, value: store },
          });
        }
        return store;
      }

      return normalizePengurusStore(row.value);
    },
    structuredClone(DEFAULT_PENGURUS_STORE),
  );

  if (failed) return data;
  return data;
}

export async function fetchPengurusStruktur(
  seedIfMissing = false,
): Promise<PengurusPeriod> {
  const store = await fetchPengurusStore(seedIfMissing);
  return getActivePeriod(store);
}

export const getPengurusStruktur = unstable_cache(
  async () => fetchPengurusStruktur(false),
  ["pengurus-struktur-active"],
  { revalidate: 60, tags: [PENGURUS_CACHE_TAG] },
);

export const getPengurusStoreCached = unstable_cache(
  async () => fetchPengurusStore(false),
  ["pengurus-struktur-store"],
  { revalidate: 60, tags: [PENGURUS_CACHE_TAG] },
);

export async function savePeriod(periodInput: PengurusPeriod): Promise<PengurusStore> {
  const parsed = pengurusPeriodSchema.safeParse({
    ...periodInput,
    updatedAt: new Date().toISOString(),
  });
  if (!parsed.success) throw parsed.error;

  const store = await readStore();
  const idx = store.periods.findIndex((p) => p.id === parsed.data.id);

  if (idx >= 0) {
    store.periods[idx] = {
      ...parsed.data,
      createdAt: store.periods[idx].createdAt,
    };
  } else {
    store.periods.push(parsed.data);
  }

  // Ensure only one active
  if (parsed.data.isActive) {
    store.periods = store.periods.map((p) =>
      p.id === parsed.data.id
        ? { ...p, isActive: true, archivedAt: null, isDeleted: false }
        : p.isActive
          ? { ...p, isActive: false, archivedAt: p.archivedAt ?? new Date().toISOString() }
          : p,
    );
  }

  await writeStore(store);
  return store;
}

export async function activatePeriod(periodId: string): Promise<PengurusStore> {
  const store = await readStore();
  const target = store.periods.find((p) => p.id === periodId && !p.isDeleted);
  if (!target) throw new Error("Periode tidak ditemukan");

  const now = new Date().toISOString();
  store.periods = store.periods.map((p) => {
    if (p.id === periodId) {
      return { ...p, isActive: true, archivedAt: null, updatedAt: now };
    }
    if (p.isActive) {
      return { ...p, isActive: false, archivedAt: now, updatedAt: now };
    }
    return p;
  });

  await writeStore(store);
  return store;
}

export async function archivePeriod(periodId: string): Promise<PengurusStore> {
  const store = await readStore();
  const target = store.periods.find((p) => p.id === periodId && !p.isDeleted);
  if (!target) throw new Error("Periode tidak ditemukan");
  if (target.isActive) {
    throw new Error("Aktifkan periode lain terlebih dahulu sebelum mengarsipkan");
  }

  const now = new Date().toISOString();
  store.periods = store.periods.map((p) =>
    p.id === periodId
      ? { ...p, isActive: false, archivedAt: now, updatedAt: now }
      : p,
  );

  await writeStore(store);
  return store;
}

export async function restorePeriod(periodId: string): Promise<PengurusStore> {
  const store = await readStore();
  const target = store.periods.find((p) => p.id === periodId);
  if (!target) throw new Error("Periode tidak ditemukan");

  const now = new Date().toISOString();
  store.periods = store.periods.map((p) =>
    p.id === periodId
      ? { ...p, isDeleted: false, archivedAt: null, updatedAt: now }
      : p,
  );

  await writeStore(store);
  return store;
}

export async function softDeletePeriod(periodId: string): Promise<PengurusStore> {
  const store = await readStore();
  const target = store.periods.find((p) => p.id === periodId);
  if (!target) throw new Error("Periode tidak ditemukan");
  if (target.isActive) {
    throw new Error("Tidak dapat menghapus periode aktif");
  }

  const visible = store.periods.filter((p) => !p.isDeleted && p.id !== periodId);
  if (visible.length === 0) {
    throw new Error("Minimal satu periode harus tersisa");
  }

  const now = new Date().toISOString();
  store.periods = store.periods.map((p) =>
    p.id === periodId
      ? { ...p, isDeleted: true, isActive: false, archivedAt: now, updatedAt: now }
      : p,
  );

  await writeStore(store);
  return store;
}

export async function createPeriodFrom(
  sourceId: string | null,
  periodeLabel: string,
): Promise<{ store: PengurusStore; createdId: string }> {
  const store = await readStore();
  const source =
    (sourceId && store.periods.find((p) => p.id === sourceId)) ||
    getActivePeriod(store) ||
    createDefaultPeriod();

  const next = duplicatePeriod(source, periodeLabel);
  store.periods.push(next);
  await writeStore(store);
  return { store, createdId: next.id };
}

/** @deprecated */
export async function savePengurusStruktur(data: PengurusPeriod) {
  await savePeriod({ ...data, isActive: true });
}

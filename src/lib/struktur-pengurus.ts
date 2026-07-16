import { z } from "zod";

export const PENGURUS_SETTING_KEY = "organisasi-pengurus-surabaya";
export const PENGURUS_CACHE_TAG = "pengurus-struktur";

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .refine((v) => !v || /^https?:\/\//i.test(v), "URL harus diawali http:// atau https://");

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const personEntrySchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(200),
  photoUrl: optionalUrl,
  phone: optionalText(30),
  email: z
    .string()
    .trim()
    .max(254)
    .optional()
    .refine((v) => !v || z.email().safeParse(v).success, "Email tidak valid"),
});

export const pengurusSeksiSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Judul seksi wajib").max(120),
  members: z.array(personEntrySchema).min(1, "Minimal 1 anggota seksi"),
});

export const pengurusBidangSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Judul bidang wajib").max(120),
  head: personEntrySchema.optional(),
  members: z.array(personEntrySchema).optional(),
  seksi: z.array(pengurusSeksiSchema).optional(),
});

export const pengurusDocumentSchema = z.object({
  title: optionalText(200),
  number: optionalText(120),
  date: optionalText(40),
  url: optionalUrl,
});

export const pengurusPeriodSchema = z.object({
  id: z.string().min(1),
  periode: z.string().trim().min(4, "Periode wajib").max(40),
  isActive: z.boolean(),
  isDeleted: z.boolean().default(false),
  pelindung: z.string().trim().min(1, "Pelindung wajib").max(200),
  penasihat: z.array(personEntrySchema).min(1, "Minimal 1 penasihat"),
  inti: z.object({
    ketua: personEntrySchema,
    koordinatorMsh: personEntrySchema,
    wakilKetua: personEntrySchema,
    sekretaris: personEntrySchema,
    bendahara: personEntrySchema,
  }),
  bidang: z.array(pengurusBidangSchema).min(1, "Minimal 1 bidang"),
  document: pengurusDocumentSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable().optional(),
});

export const pengurusStoreSchema = z.object({
  periods: z.array(pengurusPeriodSchema).min(1),
});

export type PersonEntry = z.infer<typeof personEntrySchema>;
export type PengurusSeksi = z.infer<typeof pengurusSeksiSchema>;
export type PengurusBidang = z.infer<typeof pengurusBidangSchema>;
export type PengurusDocument = z.infer<typeof pengurusDocumentSchema>;
export type PengurusPeriod = z.infer<typeof pengurusPeriodSchema>;
export type PengurusStore = z.infer<typeof pengurusStoreSchema>;

/** @deprecated use PengurusPeriod — kept for public component alias */
export type PengurusStruktur = PengurusPeriod;

function newId() {
  return crypto.randomUUID();
}

function person(name: string): PersonEntry {
  return { name };
}

export function createDefaultPeriod(
  overrides: Partial<PengurusPeriod> = {},
): PengurusPeriod {
  const now = new Date().toISOString();
  return {
    id: newId(),
    periode: "2026 – 2030",
    isActive: true,
    isDeleted: false,
    pelindung: "Pengprov INKAI Jawa Timur",
    penasihat: [
      person("Yulianto Moesri, S.E."),
      person("H. Dedy Prasetyo, S.H., M.H."),
      person("Asman Afif Ramadhan, S.H., M.H."),
    ],
    inti: {
      ketua: person("Jonathan Christian Bernard Kandou, S.Pd."),
      koordinatorMsh: person("Duchan Fanani, S.E."),
      wakilKetua: person("Tonny Siswanto, S.T."),
      sekretaris: person("Miftachul Au'lidhina"),
      bendahara: person("Habibur Rahman"),
    },
    bidang: [
      {
        id: newId(),
        title: "Bid. Organisasi",
        members: [person("Indiantoko, S.E."), person("Probo Kris Kencono, S.H.")],
      },
      {
        id: newId(),
        title: "Bid. Pembinaan & Prestasi",
        head: person("Maslikhah Surani, S.A.P."),
        seksi: [
          {
            id: newId(),
            title: "Sie Kepelatihan",
            members: [
              person("Mujiono"),
              person("Mohammad Zidan Al Akbar, S.H."),
            ],
          },
          {
            id: newId(),
            title: "Sie Pertandingan",
            members: [person("Antares Alva Edison, S.M.")],
          },
          {
            id: newId(),
            title: "Sie Perwasitan",
            members: [person("Wiwik Mindaryani")],
          },
        ],
      },
      {
        id: newId(),
        title: "Bid. Ujian",
        members: [person("Setia Basuki"), person("Yuandika Hindiari, S.Or.")],
      },
      {
        id: newId(),
        title: "Bid. Perlengkapan",
        members: [person("Dwi Sakti"), person("Hayu Sirathak")],
      },
      {
        id: newId(),
        title: "Sie Humas & Dokumentasi",
        members: [
          person("Rizaldy Febryan Syahputra"),
          person("Daffa Putra Pratama"),
        ],
      },
    ],
    document: {
      title: "Lampiran Surat Susunan Pengurus",
      number: "001/INKAI.Sby/II/2026",
      date: "11 Februari 2026",
      url: undefined,
    },
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    ...overrides,
  };
}

export const DEFAULT_PENGURUS_STORE: PengurusStore = {
  periods: [createDefaultPeriod({ id: "default-2026-2030" })],
};

function toPerson(value: unknown): PersonEntry {
  if (typeof value === "string") return { name: value.trim() };
  if (value && typeof value === "object" && "name" in value) {
    const p = value as Record<string, unknown>;
    return {
      name: String(p.name ?? "").trim(),
      photoUrl: typeof p.photoUrl === "string" ? p.photoUrl : undefined,
      phone: typeof p.phone === "string" ? p.phone : undefined,
      email: typeof p.email === "string" ? p.email : undefined,
    };
  }
  return { name: "" };
}

/** Migrate legacy single-object + string arrays into multi-period store. */
export function normalizePengurusStore(value: unknown): PengurusStore {
  if (!value || typeof value !== "object") return structuredClone(DEFAULT_PENGURUS_STORE);

  const raw = value as Record<string, unknown>;

  if (Array.isArray(raw.periods)) {
    const parsed = pengurusStoreSchema.safeParse(raw);
    if (parsed.success) return parsed.data;

    // Best-effort rebuild
    const periods = (raw.periods as unknown[])
      .map((p) => normalizeLegacyPeriod(p))
      .filter(Boolean) as PengurusPeriod[];
    if (periods.length === 0) return structuredClone(DEFAULT_PENGURUS_STORE);
    return { periods };
  }

  // Legacy flat structure
  const period = normalizeLegacyPeriod(raw);
  if (!period) return structuredClone(DEFAULT_PENGURUS_STORE);
  return { periods: [{ ...period, isActive: true, isDeleted: false }] };
}

function normalizeLegacyPeriod(value: unknown): PengurusPeriod | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const now = new Date().toISOString();

  const intiRaw = (raw.inti as Record<string, unknown>) ?? {};
  const bidangRaw = Array.isArray(raw.bidang) ? raw.bidang : [];

  const period: PengurusPeriod = {
    id: typeof raw.id === "string" ? raw.id : newId(),
    periode: String(raw.periode ?? "2026 – 2030"),
    isActive: Boolean(raw.isActive ?? true),
    isDeleted: Boolean(raw.isDeleted ?? false),
    pelindung: String(raw.pelindung ?? "Pengprov INKAI Jawa Timur"),
    penasihat: Array.isArray(raw.penasihat)
      ? (raw.penasihat as unknown[]).map(toPerson).filter((p) => p.name)
      : [person("—")],
    inti: {
      ketua: toPerson(intiRaw.ketua ?? "—"),
      koordinatorMsh: toPerson(intiRaw.koordinatorMsh ?? "—"),
      wakilKetua: toPerson(intiRaw.wakilKetua ?? "—"),
      sekretaris: toPerson(intiRaw.sekretaris ?? "—"),
      bendahara: toPerson(intiRaw.bendahara ?? "—"),
    },
    bidang: bidangRaw.map((b) => {
      const item = b as Record<string, unknown>;
      return {
        id: typeof item.id === "string" ? item.id : newId(),
        title: String(item.title ?? "Bidang"),
        head: item.head ? toPerson(item.head) : undefined,
        members: Array.isArray(item.members)
          ? (item.members as unknown[]).map(toPerson).filter((p) => p.name)
          : undefined,
        seksi: Array.isArray(item.seksi)
          ? (item.seksi as unknown[]).map((s) => {
              const seksi = s as Record<string, unknown>;
              return {
                id: typeof seksi.id === "string" ? seksi.id : newId(),
                title: String(seksi.title ?? "Seksi"),
                members: Array.isArray(seksi.members)
                  ? (seksi.members as unknown[])
                      .map(toPerson)
                      .filter((p) => p.name)
                  : [person("—")],
              };
            })
          : undefined,
      };
    }),
    document:
      raw.document && typeof raw.document === "object"
        ? (raw.document as PengurusDocument)
        : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
    archivedAt:
      typeof raw.archivedAt === "string" || raw.archivedAt === null
        ? (raw.archivedAt as string | null)
        : null,
  };

  const parsed = pengurusPeriodSchema.safeParse(period);
  return parsed.success ? parsed.data : period;
}

export function getActivePeriod(store: PengurusStore): PengurusPeriod {
  const active = store.periods.find((p) => p.isActive && !p.isDeleted);
  if (active) return active;
  const first = store.periods.find((p) => !p.isDeleted);
  return first ?? store.periods[0] ?? createDefaultPeriod();
}

export function listVisiblePeriods(store: PengurusStore): PengurusPeriod[] {
  return store.periods
    .filter((p) => !p.isDeleted)
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

export function formatPengurusFieldErrors(
  error: z.ZodError,
): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "root",
    message: issue.message,
  }));
}

export function emptyPerson(): PersonEntry {
  return { name: "" };
}

export function emptyBidang(): PengurusBidang {
  return {
    id: newId(),
    title: "Bidang Baru",
    members: [emptyPerson()],
  };
}

export function emptySeksi(): PengurusSeksi {
  return {
    id: newId(),
    title: "Seksi Baru",
    members: [emptyPerson()],
  };
}

export function duplicatePeriod(
  source: PengurusPeriod,
  periodeLabel: string,
): PengurusPeriod {
  const now = new Date().toISOString();
  const clone = structuredClone(source);
  clone.id = newId();
  clone.periode = periodeLabel;
  clone.isActive = false;
  clone.isDeleted = false;
  clone.archivedAt = null;
  clone.createdAt = now;
  clone.updatedAt = now;
  clone.bidang = clone.bidang.map((b) => ({
    ...b,
    id: newId(),
    seksi: b.seksi?.map((s) => ({ ...s, id: newId() })),
  }));
  return clone;
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

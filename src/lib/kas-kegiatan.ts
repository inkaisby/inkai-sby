const KEGIATAN_MAX = 120;

export const KAS_UKT_KEGIATAN_OLD =
  "UKT Biaya pendaftaran UKT Semester II-2026 - Pendaftaran";
export const KAS_UKT_KEGIATAN_NEW = "Bayar UKT II-2026 - FORTRESS";

export const KAS_LATBER_PERSIAPAN_UKT_KEGIATAN =
  "Bayar Latber Persiapan UKT-ranting";

export const KAS_LATBER_PERSIAPAN_UKT_KEGIATAN_OLD = [
  "Latber Latihan Bersama — persiapan UKT",
  "Latber Latihan Bersama - persiapan UKT",
] as const;

function clipKegiatan(value: string): string {
  return value.trim().slice(0, KEGIATAN_MAX);
}

/** Ambil I-YYYY / II-YYYY dari judul periode atau deskripsi tagihan. */
export function parseUktKasTerm(periodTitle: string): string | null {
  const match = periodTitle.match(/\b(II?)-(\d{4})\b/);
  return match ? `${match[1]}-${match[2]}` : null;
}

export function formatUktKasKegiatan(
  periodTitle: string,
  dojoName?: string | null,
): string {
  const parsed = parseUktKasTerm(periodTitle);
  const term = parsed ?? (periodTitle.trim() || "UKT");
  const dojo = dojoName?.trim();
  return clipKegiatan(dojo ? `Bayar UKT ${term} - ${dojo}` : `Bayar UKT ${term}`);
}

export function isLatberPersiapanUktTitle(periodTitle: string): boolean {
  return /persiapan\s*ukt/i.test(periodTitle);
}

export function formatLatberKasKegiatan(periodTitle: string): string {
  const title = periodTitle.trim() || "Latber";
  if (isLatberPersiapanUktTitle(title)) {
    return KAS_LATBER_PERSIAPAN_UKT_KEGIATAN;
  }
  return clipKegiatan(`Latber ${title}`);
}

export const KAS_KEGIATAN_RELABELS: ReadonlyArray<{
  from: string;
  to: string;
}> = [
  { from: KAS_UKT_KEGIATAN_OLD, to: KAS_UKT_KEGIATAN_NEW },
  ...KAS_LATBER_PERSIAPAN_UKT_KEGIATAN_OLD.map((from) => ({
    from,
    to: KAS_LATBER_PERSIAPAN_UKT_KEGIATAN,
  })),
];

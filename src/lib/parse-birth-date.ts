/** Nama bulan Indonesia → indeks 1–12. */
const ID_MONTHS: Record<string, number> = {
  januari: 1,
  jan: 1,
  februari: 2,
  feb: 2,
  pebruari: 2,
  maret: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mei: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  agustus: 8,
  ags: 8,
  agu: 8,
  agust: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  desember: 12,
  des: 12,
  december: 12,
  dec: 12,
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function toIsoDate(y: number, m: number, d: number): string | null {
  if (!isValidYmd(y, m, d)) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Parse tanggal fleksibel → `YYYY-MM-DD`.
 * Contoh: `28 Februari 2011`, `28/02/2011`, `2011-02-28`, `28-2-11`.
 */
export function parseFlexibleBirthDate(raw: string): string | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;

  // Sudah ISO
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // 28 Februari 2011 / 28 Feb 2011 / 28 Februari, 2011
  const named = text.match(
    /^(\d{1,2})[\s./-]+([A-Za-z.]+)[\s./,]+(\d{2,4})$/,
  );
  if (named) {
    const day = Number(named[1]);
    const monthKey = named[2].replace(/\./g, "").toLowerCase();
    const month = ID_MONTHS[monthKey];
    let year = Number(named[3]);
    if (!month) return null;
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    return toIsoDate(year, month, day);
  }

  // Februari 28, 2011 (EN-ish)
  const namedEn = text.match(
    /^([A-Za-z.]+)[\s./-]+(\d{1,2})(?:st|nd|rd|th)?[\s./,]+(\d{2,4})$/i,
  );
  if (namedEn) {
    const monthKey = namedEn[1].replace(/\./g, "").toLowerCase();
    const month = ID_MONTHS[monthKey];
    const day = Number(namedEn[2]);
    let year = Number(namedEn[3]);
    if (!month) return null;
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    return toIsoDate(year, month, day);
  }

  // 28/02/2011 | 28-02-2011 | 28.02.2011 | 28/2/11
  const dmy = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    return toIsoDate(year, month, day);
  }

  // 2011/02/28
  const ymd = text.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (ymd) {
    return toIsoDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }

  return null;
}

/**
 * Parse "Surabaya, 28 Maret 2015" / "SURABAYA 28/03/2015" → tempat + tanggal ISO.
 */
export function parseBirthPlaceAndDate(raw: string): {
  birthPlace: string;
  birthDate: string | null;
} {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return { birthPlace: "", birthDate: null };

  // Seluruh string adalah tanggal saja
  const onlyDate = parseFlexibleBirthDate(text);
  if (onlyDate) return { birthPlace: "", birthDate: onlyDate };

  // Pisah di koma terakhir yang diikuti pola tanggal
  const commaParts = text.split(",").map((p) => p.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const maybeDate = commaParts[commaParts.length - 1]!;
    const parsed = parseFlexibleBirthDate(maybeDate);
    if (parsed) {
      return {
        birthPlace: commaParts.slice(0, -1).join(", ").toUpperCase(),
        birthDate: parsed,
      };
    }
  }

  // Coba potong dari akhir: cari substring tanggal
  const dateTail = text.match(
    /^(.*?)[,\s]+(\d{1,2}[\s./-]+[A-Za-z.]+[\s./,]+\d{2,4}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2})$/,
  );
  if (dateTail) {
    const parsed = parseFlexibleBirthDate(dateTail[2]!);
    if (parsed) {
      return {
        birthPlace: dateTail[1]!.trim().toUpperCase(),
        birthDate: parsed,
      };
    }
  }

  return { birthPlace: text.toUpperCase(), birthDate: null };
}

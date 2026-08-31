import {
  formatRankLabel,
  normalizeGenderStorage,
} from "@/lib/belt";
import {
  parseBirthPlaceAndDate,
  parseFlexibleBirthDate,
} from "@/lib/parse-birth-date";

export type BulkPasteDojoOption = { id: string; name: string };

export type BulkPasteRow = {
  nia: string;
  fullName: string;
  gender: string;
  birthPlaceDate: string;
  address: string;
  currentRank: string;
  dojoId: string;
};

function upper(value: string) {
  return value.toUpperCase();
}

export function looksLikeGender(raw: string): boolean {
  return Boolean(normalizeGenderStorage(raw));
}

export function looksLikeBirthPlaceDate(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (looksLikeGender(t)) return false;
  if (/,/.test(t)) return true;
  if (parseFlexibleBirthDate(t)) return true;
  if (parseBirthPlaceAndDate(t).birthDate) return true;
  return /(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i.test(
    t,
  );
}

/** NIA kosong atau pola cabang INKAI (mis. 24.32849). */
export function looksLikeNia(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  if (/^\d{2}\.\d{4,6}$/.test(t)) return true;
  if (/^\d{2}\.\d+$/.test(t) && !/\s/.test(t)) return true;
  return false;
}

export function resolveBulkPasteDojoId(
  raw: string,
  dojos: BulkPasteDojoOption[],
  fallback: string,
): string {
  const t = raw.trim();
  if (!t) return fallback;
  if (dojos.some((d) => d.id === t)) return t;
  const byName = dojos.find(
    (d) => d.name.trim().toLowerCase() === t.toLowerCase(),
  );
  return byName?.id || fallback;
}

function formatBirthCombined(place: string, dateRaw: string): string {
  const placePart = place.trim();
  const datePart = dateRaw.trim();
  if (placePart && datePart) return `${upper(placePart)}, ${datePart}`;
  return upper(placePart) || datePart;
}

function mapSixColumnRow(
  cells: string[],
  dojos: BulkPasteDojoOption[],
  defaultDojoId: string,
): BulkPasteRow | null {
  const [c0 = "", c1 = "", c2 = "", c3 = "", c4 = "", c5 = ""] = cells;
  if (!c0.trim()) return null;
  const genderRaw = c2;
  const gender =
    normalizeGenderStorage(genderRaw) ||
    genderRaw.trim().toUpperCase() ||
    "";
  const rankRaw = c4;
  return {
    nia: "",
    fullName: upper(c0),
    gender,
    birthPlaceDate: c1.trim(),
    address: upper(c3),
    currentRank: formatRankLabel(rankRaw) || rankRaw.trim() || "",
    dojoId: resolveBulkPasteDojoId(c5, dojos, defaultDojoId),
  };
}

function shouldTreatSevenAsSixWithoutNia(cells: string[]): boolean {
  const [c0 = "", c1 = "", c2 = ""] = cells;
  if (cells.length !== 7) return false;
  if (looksLikeNia(c0)) return false;
  return (
    looksLikeBirthPlaceDate(c1) ||
    looksLikeGender(c2) ||
    (!/\d{2}\./.test(c0) && /[A-Za-z]/.test(c0) && c0.trim().length >= 3)
  );
}

/**
 * Parse baris paste Input Massal.
 * Format 6 kolom (tanpa NIA): Nama, Tempat&Tgl, JK, Alamat, Kyu, Ranting
 * Format 7 kolom: NIA, Nama, Tempat&Tgl, JK, Alamat, Kyu, Ranting
 * (+ format lama JK sebelum Tempat&Tgl, 9/10 kolom legacy)
 */
export function parseBulkMemberPasteLines(
  text: string,
  dojos: BulkPasteDojoOption[],
  defaultDojoId: string,
): BulkPasteRow[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const sep = lines[0]!.includes("\t")
    ? "\t"
    : lines[0]!.includes(";")
      ? ";"
      : ",";

  const rows: BulkPasteRow[] = [];
  for (const line of lines) {
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const head0 = cells[0]?.toLowerCase() || "";
    const head1 = cells[1]?.toLowerCase() || "";
    if (head0 === "nia" || head1.includes("nama")) continue;

    if (!cells.some((c) => c.trim())) continue;

    if (cells.length === 6) {
      const row = mapSixColumnRow(cells, dojos, defaultDojoId);
      if (row) rows.push(row);
      continue;
    }

    if (shouldTreatSevenAsSixWithoutNia(cells)) {
      const row = mapSixColumnRow(cells, dojos, defaultDojoId);
      if (row) rows.push(row);
      continue;
    }

    let nia = "";
    let fullName = "";
    let genderRaw = "";
    let birthPlaceDate = "";
    let address = "";
    let rankRaw = "";
    let rantingRaw = "";

    if (cells.length >= 10) {
      const [
        c0 = "",
        c1 = "",
        c2 = "",
        place = "",
        dateRaw = "",
        c5 = "",
        ,
        ,
        c8 = "",
        c9 = "",
      ] = cells;
      nia = c0;
      fullName = c1;
      genderRaw = c2;
      birthPlaceDate = formatBirthCombined(place, dateRaw);
      address = c5;
      rankRaw = c8;
      rantingRaw = c9;
    } else if (cells.length >= 9) {
      const [
        c0 = "",
        c1 = "",
        c2 = "",
        c3 = "",
        c4 = "",
        ,
        ,
        c7 = "",
        c8 = "",
      ] = cells;
      nia = c0;
      fullName = c1;
      genderRaw = c2;
      birthPlaceDate = c3;
      address = c4;
      rankRaw = c7;
      rantingRaw = c8;
    } else {
      const [
        c0 = "",
        c1 = "",
        c2 = "",
        c3 = "",
        c4 = "",
        c5 = "",
        c6 = "",
      ] = cells;
      nia = c0;
      fullName = c1;
      if (
        looksLikeBirthPlaceDate(c2) ||
        (looksLikeGender(c3) && !looksLikeGender(c2))
      ) {
        birthPlaceDate = c2;
        genderRaw = c3;
        address = c4;
        rankRaw = c5;
        rantingRaw = c6;
      } else {
        genderRaw = c2;
        birthPlaceDate = c3;
        address = c4;
        rankRaw = c5;
        rantingRaw = c6;
      }
    }

    if (!fullName.trim() && !nia.trim()) continue;

    const gender =
      normalizeGenderStorage(genderRaw) ||
      genderRaw.trim().toUpperCase() ||
      "";
    const currentRank =
      formatRankLabel(rankRaw) || rankRaw.trim() || "";

    rows.push({
      nia: upper(nia),
      fullName: upper(fullName),
      gender,
      birthPlaceDate: birthPlaceDate.trim(),
      address: upper(address),
      currentRank,
      dojoId: resolveBulkPasteDojoId(rantingRaw, dojos, defaultDojoId),
    });
  }
  return rows;
}

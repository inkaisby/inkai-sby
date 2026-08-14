export type Venue = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  mapsUrl: string;
};

export const DISPORA_JATIM: Venue = {
  name: "Prasarana Dojo Karate Dispora Jatim",
  address:
    "Gedung Prasarana Olahraga Dispora Jatim, Jl. Kertajaya Indah 77, Surabaya",
  lat: -7.2801655,
  lng: 112.7803995,
  mapsUrl:
    "https://www.google.com/maps/dir//PRASARANA+DOJO+KARATE+DISPORA+JATIM,+Jl.+Raya+Kertajaya+Indah+No.77,+Manyar+Sabrangan,+Kec.+Mulyorejo,+Surabaya,+Jawa+Timur+60116/@-7.2801655,112.7803995,17z",
};

function normalizeLocation(loc: string): string {
  return loc.trim().toLowerCase();
}

export function isDisporaJatim(location: string | null | undefined): boolean {
  const q = normalizeLocation(location ?? "");
  if (!q) return false;
  const hasDispora = q.includes("dispora");
  const hasVenueHint =
    q.includes("kertajaya") ||
    q.includes("karate") ||
    q.includes("prasarana") ||
    q.includes("dojo");
  return hasDispora && hasVenueHint;
}

export function venueMapsUrl(venue: Venue): string {
  return venue.mapsUrl;
}

export function venueEmbedUrl(venue: Venue): string {
  return `https://maps.google.com/maps?q=${venue.lat},${venue.lng}&z=16&output=embed`;
}

export function resolveInviteMapsUrl(
  location: string | null | undefined,
): string | null {
  const q = location?.trim();
  if (!q) return null;
  if (isDisporaJatim(q)) return venueMapsUrl(DISPORA_JATIM);
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}`;
}

export function resolveInviteEmbedUrl(
  location: string | null | undefined,
): string | null {
  const q = location?.trim();
  if (!q) return null;
  if (isDisporaJatim(q)) return venueEmbedUrl(DISPORA_JATIM);
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
}

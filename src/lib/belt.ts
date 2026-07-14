export type BeltRingVisual = {
  bg: string;
  shadow?: string;
};

export const BELT_RANK_OPTIONS = [
  "Putih (Kyu 10)",
  "Putih (Kyu 9)",
  "Kuning (Kyu 8)",
  "Kuning (Kyu 7)",
  "Hijau (Kyu 6)",
  "Biru (Kyu 5)",
  "Biru (Kyu 4)",
  "Coklat (Kyu 3)",
  "Coklat (Kyu 2)",
  "Coklat (Kyu 1)",
  ...Array.from({ length: 10 }, (_, i) => `Hitam (DAN ${i + 1})`),
] as const;

export function beltRingVisual(rankRaw: string | null | undefined): BeltRingVisual {
  const r = (rankRaw || "").trim().toLowerCase();
  if (r.includes("hitam")) {
    return { bg: "#171717", shadow: "0 0 0 2px rgba(234, 179, 8, 0.42)" };
  }
  if (r.includes("coklat")) return { bg: "#9a3412" };
  if (r.includes("biru")) return { bg: "#2563eb" };
  if (r.includes("hijau")) return { bg: "#16a34a" };
  if (r.includes("kuning")) return { bg: "#ca8a04" };
  if (r.includes("putih")) {
    return { bg: "#e2e8f0", shadow: "inset 0 0 0 1px rgba(148, 163, 184, 0.45)" };
  }
  return { bg: "#64748b" };
}

export function shortRankLabel(rankRaw: string | null | undefined): string {
  const r = (rankRaw || "").trim();
  const kyu = r.match(/kyu\s*(\d+)/i);
  if (kyu) return `Kyu ${kyu[1]}`;
  const dan = r.match(/dan\s*(\d+)/i);
  if (dan) return `Dan ${dan[1]}`;
  if (r.toLowerCase().includes("putih")) return "Putih";
  if (r.toLowerCase().includes("kuning")) return "Kuning";
  if (r.toLowerCase().includes("hijau")) return "Hijau";
  if (r.toLowerCase().includes("biru")) return "Biru";
  if (r.toLowerCase().includes("coklat")) return "Coklat";
  if (r.toLowerCase().includes("hitam")) return "Hitam";
  return r;
}

export type BeltGroup = "PUTIH" | "KUNING" | "HIJAU" | "BIRU" | "COKELAT" | "LAINNYA";

export function getBeltGroup(rankRaw: string | null | undefined): BeltGroup {
  const r = (rankRaw || "").trim().toLowerCase();
  if (r.includes("putih")) return "PUTIH";
  if (r.includes("kuning") || r.includes("oranye")) return "KUNING";
  if (r.includes("hijau")) return "HIJAU";
  if (r.includes("biru")) return "BIRU";
  if (r.includes("coklat")) return "COKELAT";
  return "LAINNYA";
}

export function canEditKyuBaru(roles: string[]): boolean {
  const elevated = new Set([
    "ADMINISTRATOR",
    "ADMIN_PUSAT",
    "ADMIN_PROVINCE",
    "ADMIN_BRANCH",
    "ADMIN",
  ]);
  return roles.some((r) => elevated.has(r));
}

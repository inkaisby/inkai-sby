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

/** Canonical display: "Putih (Kyu 10)", "Hitam (DAN 3)", … */
export function formatRankLabel(rankRaw: string | null | undefined): string {
  const r = (rankRaw || "").trim();
  if (!r) return "";

  const exact = BELT_RANK_OPTIONS.find(
    (opt) => opt.toLowerCase() === r.toLowerCase(),
  );
  if (exact) return exact;

  const kyu = r.match(/kyu\s*(\d+)/i);
  if (kyu) {
    const byKyu = BELT_RANK_OPTIONS.find((opt) =>
      new RegExp(`kyu\\s*${kyu[1]}\\b`, "i").test(opt),
    );
    if (byKyu) return byKyu;
  }

  // Angka saja (mis. paste Excel "4" / "10") → Kyu N
  if (/^\d{1,2}$/.test(r)) {
    const n = Number(r);
    if (n >= 1 && n <= 10) {
      const byKyu = BELT_RANK_OPTIONS.find((opt) =>
        new RegExp(`kyu\\s*${n}\\b`, "i").test(opt),
      );
      if (byKyu) return byKyu;
    }
  }

  const dan = r.match(/dan\s*(\d+)/i);
  if (dan) {
    const n = Number(dan[1]);
    if (n >= 1 && n <= 10) return `Hitam (DAN ${n})`;
  }

  const lower = r.toLowerCase();
  if (lower === "putih" || lower.includes("putih")) return DEFAULT_MEMBER_RANK;
  if (lower.includes("kuning")) {
    return BELT_RANK_OPTIONS.find((o) => o.startsWith("Kuning")) ?? r;
  }
  if (lower.includes("hijau")) {
    return BELT_RANK_OPTIONS.find((o) => o.startsWith("Hijau")) ?? r;
  }
  if (lower.includes("biru")) {
    return BELT_RANK_OPTIONS.find((o) => o.startsWith("Biru")) ?? r;
  }
  if (lower.includes("coklat")) {
    return BELT_RANK_OPTIONS.find((o) => o.startsWith("Coklat")) ?? r;
  }
  if (lower.includes("hitam")) return "Hitam (DAN 1)";

  return r;
}

/** Nama tampilan seragam (huruf besar). */
export function formatMemberName(name: string | null | undefined): string {
  const n = (name || "").trim();
  return n ? n.toUpperCase() : "";
}

/** JK seragam: L / P. */
export function formatGenderLabel(gender: string | null | undefined): string {
  const g = (gender || "").trim().toLowerCase();
  if (!g) return "";
  if (g === "l" || g === "male" || g === "laki-laki" || g === "laki" || g === "m") {
    return "L";
  }
  if (g === "p" || g === "female" || g === "perempuan" || g === "f" || g === "wanita") {
    return "P";
  }
  return gender!.trim().toUpperCase();
}

/** Nilai gender untuk disimpan ke DB (L/P saja). */
export function normalizeGenderStorage(
  gender: string | null | undefined,
): "L" | "P" | null {
  const label = formatGenderLabel(gender);
  if (label === "L" || label === "P") return label;
  return null;
}

/** Apakah string sabuk perlu dinormalisasi ke format kanonik. */
export function needsRankNormalization(rankRaw: string | null | undefined): boolean {
  const raw = (rankRaw || "").trim();
  if (!raw) return false;
  const formatted = formatRankLabel(raw);
  return Boolean(formatted && formatted !== raw);
}

function beltRankIndex(rankRaw: string | null | undefined): number {
  const formatted = formatRankLabel(rankRaw);
  if (!formatted) return -1;
  return BELT_RANK_OPTIONS.findIndex(
    (opt) => opt.toLowerCase() === formatted.toLowerCase(),
  );
}

type MemberRankSource = {
  currentRank?: string | null;
  ranks?: Array<{ rank?: string | null; date?: string | Date | null }> | null;
  eventRegistrations?: Array<{
    status?: string | null;
    registeredRank?: string | null;
    event?: { title?: string | null } | null;
  }> | null;
};

/** Sabuk tampilan kartu anggota — ambil yang paling tinggi dari currentRank, riwayat, dan UKT selesai. */
export function resolveMemberDisplayRank(source: MemberRankSource): string {
  const candidates: string[] = [];

  const current = formatRankLabel(source.currentRank);
  if (current) candidates.push(current);

  for (const entry of source.ranks ?? []) {
    const rank = formatRankLabel(entry.rank);
    if (rank) candidates.push(rank);
  }

  for (const reg of source.eventRegistrations ?? []) {
    const title = String(reg.event?.title ?? "").toUpperCase();
    if (!title.includes("UKT") && !title.includes("UJIAN")) continue;

    const status = String(reg.status ?? "").toUpperCase();
    if (!["PAID", "SUCCESS", "APPROVED"].includes(status)) continue;

    const { kyuBaru } = decodeUktRegisteredRank(reg.registeredRank);
    if (kyuBaru) candidates.push(kyuBaru);
  }

  let best = "";
  let bestIdx = -1;
  for (const rank of candidates) {
    const idx = beltRankIndex(rank);
    if (idx > bestIdx) {
      bestIdx = idx;
      best = rank;
    }
  }

  return best;
}

/** Pemisah snapshot Kyu Lama ‖ Kyu Baru di EventRegistration.registeredRank */
export const UKT_RANK_SEP = " || ";

export function encodeUktRegisteredRank(kyuLama: string, kyuBaru: string): string {
  const lama = formatRankLabel(kyuLama) || kyuLama.trim();
  const baru = formatRankLabel(kyuBaru) || kyuBaru.trim();
  return `${lama}${UKT_RANK_SEP}${baru}`;
}

export function ranksEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = (formatRankLabel(a) || (a || "").trim()).toLowerCase();
  const right = (formatRankLabel(b) || (b || "").trim()).toLowerCase();
  return Boolean(left && right && left === right);
}

/** Rank kosong / placeholder di UI UKT. */
export function isBlankUktRank(rank: string | null | undefined): boolean {
  const t = (rank || "").trim();
  return !t || t === "—" || t === "-" || t === "–";
}

/**
 * Decode snapshot UKT.
 * - Format baru: "Putih (Kyu 10) || Hitam (DAN 1)"
 * - Legacy: seluruh string = Kyu Baru saja (kyuLama null)
 */
export function decodeUktRegisteredRank(
  registeredRank: string | null | undefined,
): { kyuLama: string | null; kyuBaru: string | null } {
  const raw = (registeredRank || "").trim();
  if (!raw) return { kyuLama: null, kyuBaru: null };

  const separators = [UKT_RANK_SEP, "\n→\n", " → ", "→"];
  for (const sep of separators) {
    if (!raw.includes(sep)) continue;
    const idx = raw.indexOf(sep);
    const lamaRaw = raw.slice(0, idx).trim();
    const baruRaw = raw.slice(idx + sep.length).trim();
    // Snapshot lama-only (saat daftar, belum ada kyu baru)
    if (lamaRaw && !baruRaw) {
      const lama = formatRankLabel(lamaRaw) || lamaRaw;
      return {
        kyuLama: isBlankUktRank(lama) ? null : lama,
        kyuBaru: null,
      };
    }
    if (lamaRaw && baruRaw) {
      const lama = formatRankLabel(lamaRaw) || lamaRaw;
      return {
        kyuLama: isBlankUktRank(lama) ? null : lama,
        kyuBaru: formatRankLabel(baruRaw) || baruRaw,
      };
    }
    // " || Kyu Baru" tanpa lama → treat as legacy kyu baru
    if (!lamaRaw && baruRaw) {
      return {
        kyuLama: null,
        kyuBaru: formatRankLabel(baruRaw) || baruRaw,
      };
    }
  }

  // Legacy: registeredRank hanya menyimpan Kyu Baru
  return {
    kyuLama: null,
    kyuBaru: formatRankLabel(raw) || raw,
  };
}

/** Resolve kolom Kyu Lama / Baru untuk tabel UKT — Kyu Lama tidak ikut currentRank setelah naik. */
export function resolveUktRankColumns(
  registeredRank: string | null | undefined,
  memberCurrentRank: string | null | undefined,
  categoryName?: string | null,
): { kyuLama: string; kyuBaru: string | null } {
  const decoded = decodeUktRegisteredRank(registeredRank);
  const current =
    formatRankLabel(memberCurrentRank) || (memberCurrentRank || "").trim();

  // Snapshot lengkap / lama-only
  if (decoded.kyuLama && !isBlankUktRank(decoded.kyuLama)) {
    return {
      kyuLama: decoded.kyuLama,
      kyuBaru: decoded.kyuBaru || categoryName || null,
    };
  }

  const kyuBaru = decoded.kyuBaru || categoryName || null;

  // Legacy / snapshot lama hilang: pakai sabuk anggota hanya jika belum sama dengan kyu baru
  if (kyuBaru) {
    if (!isBlankUktRank(current) && !ranksEqual(current, kyuBaru)) {
      return { kyuLama: current, kyuBaru };
    }
    const inferred = inferPreviousBeltRank(kyuBaru);
    return {
      kyuLama: inferred || "—",
      kyuBaru,
    };
  }

  return {
    kyuLama: current || DEFAULT_MEMBER_RANK,
    kyuBaru: null,
  };
}

/** Tampilkan Kyu Lama di UI/export; infer dari Kyu Baru bila kosong. */
export function displayUktKyuLama(
  kyuLama: string | null | undefined,
  kyuBaru: string | null | undefined,
): string {
  if (!isBlankUktRank(kyuLama)) {
    return formatRankLabel(kyuLama) || String(kyuLama).trim();
  }
  return inferPreviousBeltRank(kyuBaru) || "";
}

/**
 * Sabuk sebelum naik (satu tingkat di bawah target UKT).
 * Mis. target "Biru (Kyu 5)" → "Hijau (Kyu 6)".
 */
export function inferPreviousBeltRank(
  kyuBaru: string | null | undefined,
): string | null {
  const label = formatRankLabel(kyuBaru) || (kyuBaru || "").trim();
  if (!label || isBlankUktRank(label)) return null;
  const idx = BELT_RANK_OPTIONS.findIndex(
    (opt) => opt.toLowerCase() === label.toLowerCase(),
  );
  if (idx > 0) return BELT_RANK_OPTIONS[idx - 1];
  return null;
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
  // Matriks WILAYAH: hanya Cabang (+ nasional). Pengprov & Ranting tidak edit Kyu.
  const elevated = new Set([
    "ADMINISTRATOR",
    "ADMIN_PUSAT",
    "ADMIN_BRANCH",
    "ADMIN",
  ]);
  return roles.some((r) => elevated.has(r));
}

/** Cabang ke atas yang mengisi / assign NIA (Pengprov tidak assign). */
export function canAssignNia(roles: string[]): boolean {
  return canEditKyuBaru(roles);
}

export const DEFAULT_MEMBER_RANK = "Putih (Kyu 10)";

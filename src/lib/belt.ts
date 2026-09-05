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
  const kyu = r.match(/\bkyu\s*(\d+)\b/i);
  if (kyu) return `Kyu ${kyu[1]}`;
  const dan = r.match(/\bdan\s*(\d+)\b/i);
  if (dan) return `Dan ${dan[1]}`;
  if (r.toLowerCase().includes("putih")) return "Putih";
  if (r.toLowerCase().includes("kuning")) return "Kuning";
  if (r.toLowerCase().includes("hijau")) return "Hijau";
  if (r.toLowerCase().includes("biru")) return "Biru";
  if (r.toLowerCase().includes("coklat")) return "Coklat";
  if (r.toLowerCase().includes("hitam")) return "Hitam";
  return r;
}

/** Sabuk Hitam / DAN — wajib tampil No. MSH di kartu bila ada. */
export function isBlackBeltRank(rankRaw: string | null | undefined): boolean {
  const r = (rankRaw || "").trim().toLowerCase();
  if (!r) return false;
  return r.includes("hitam") || /\bdan\s*\d+/i.test(r);
}

/** Canonical display: "Putih (Kyu 10)", "Hitam (DAN 3)", … */
export function formatRankLabel(rankRaw: string | null | undefined): string {
  const r = (rankRaw || "").trim();
  if (!r) return "";

  const exact = BELT_RANK_OPTIONS.find(
    (opt) => opt.toLowerCase() === r.toLowerCase(),
  );
  if (exact) return exact;

  const kyu = r.match(/\bkyu\s*(\d+)\b/i);
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

  const dan = r.match(/\bdan\s*(\d+)\b/i);
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

/** Sabuk tampilan kartu anggota — mengikuti `currentRank` keanggotaan; fallback ke riwayat/UKT jika kosong. */
export function resolveMemberDisplayRank(source: MemberRankSource): string {
  const current = formatRankLabel(source.currentRank);
  if (current) return current;

  const candidates: string[] = [];

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
 * - Lama-only: "Putih (Kyu 10) ||" atau string tanpa pemisah = Kyu Lama (kyuBaru null)
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

  // Tanpa pemisah: snapshot Kyu Lama saat daftar (bukan Kyu Baru)
  const lama = formatRankLabel(raw) || raw;
  return {
    kyuLama: isBlankUktRank(lama) ? null : lama,
    kyuBaru: null,
  };
}

/** Resolve kolom Kyu Lama / Baru untuk tabel UKT.
 * Default: Kyu Lama = sabuk keanggotaan (`currentRank`); Kyu Baru hanya jika ujian LULUS.
 * Dual snapshot (lama ≠ baru) mengunci Kyu Lama setelah LULUS. `categoryName` diabaikan.
 */
export function resolveUktRankColumns(
  registeredRank: string | null | undefined,
  memberCurrentRank: string | null | undefined,
  categoryName?: string | null,
  opts?: { lockSnapshot?: boolean; examResult?: string | null },
): { kyuLama: string; kyuBaru: string | null } {
  void categoryName;
  const decoded = decodeUktRegisteredRank(registeredRank);
  const current =
    formatRankLabel(memberCurrentRank) || (memberCurrentRank || "").trim();
  const passed = opts?.examResult === "LULUS";
  let kyuBaru: string | null = decoded.kyuBaru || null;

  // Snapshot sisi kanan (mis. || Putih) bukan hasil ujian — buang kecuali LULUS
  if (!passed) {
    kyuBaru = null;
  }

  // Legacy LULUS tanpa dual snapshot: sabuk keanggotaan sudah naik → tampilkan sebagai Kyu Baru
  if (
    !kyuBaru &&
    passed &&
    decoded.kyuLama &&
    !isBlankUktRank(decoded.kyuLama) &&
    !isBlankUktRank(current) &&
    !ranksEqual(decoded.kyuLama, current)
  ) {
    kyuBaru = current;
  }

  const dualSnapshot = Boolean(
    decoded.kyuLama &&
      !isBlankUktRank(decoded.kyuLama) &&
      kyuBaru &&
      !isBlankUktRank(kyuBaru) &&
      !ranksEqual(decoded.kyuLama, kyuBaru),
  );

  if (
    dualSnapshot ||
    (opts?.lockSnapshot &&
      decoded.kyuLama &&
      !isBlankUktRank(decoded.kyuLama) &&
      !(kyuBaru && ranksEqual(decoded.kyuLama, kyuBaru)))
  ) {
    return {
      kyuLama: decoded.kyuLama!,
      kyuBaru,
    };
  }

  // Belum selesai / tidak lock: Kyu Lama mengikuti sabuk keanggotaan
  if (!isBlankUktRank(current)) {
    return { kyuLama: current, kyuBaru };
  }

  if (decoded.kyuLama && !isBlankUktRank(decoded.kyuLama)) {
    return { kyuLama: decoded.kyuLama, kyuBaru };
  }

  if (kyuBaru) {
    const inferred = inferPreviousBeltRank(kyuBaru);
    return {
      kyuLama: inferred || "—",
      kyuBaru,
    };
  }

  return {
    kyuLama: DEFAULT_MEMBER_RANK,
    kyuBaru: null,
  };
}

/** Tampilkan Kyu Lama di UI/export — tanpa menebak dari Kyu Baru. */
export function displayUktKyuLama(
  kyuLama: string | null | undefined,
  _kyuBaru?: string | null | undefined,
): string {
  if (!isBlankUktRank(kyuLama)) {
    return formatRankLabel(kyuLama) || String(kyuLama).trim();
  }
  return "";
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

/** Standard INKAI promotion recommendation: Kyu 10 / Kyu 9 -> Kyu 8 Kuning, Kyu 8 -> Kyu 7, etc. */
export function getUktTargetRank(currentRank: string | null | undefined): string | null {
  const formatted = formatRankLabel(currentRank);
  if (!formatted) return "Kuning (Kyu 8)";
  const r = formatted.toLowerCase();
  if (r.includes("kyu 10") || r.includes("kyu 9")) return "Kuning (Kyu 8)";
  if (r.includes("kyu 8")) return "Kuning (Kyu 7)";
  if (r.includes("kyu 7")) return "Hijau (Kyu 6)";
  if (r.includes("kyu 6")) return "Biru (Kyu 5)";
  if (r.includes("kyu 5")) return "Biru (Kyu 4)";
  if (r.includes("kyu 4")) return "Coklat (Kyu 3)";
  if (r.includes("kyu 3")) return "Coklat (Kyu 2)";
  if (r.includes("kyu 2")) return "Coklat (Kyu 1)";
  if (r.includes("kyu 1")) return "Hitam (DAN 1)";
  const idx = BELT_RANK_OPTIONS.findIndex((opt) => opt.toLowerCase() === formatted.toLowerCase());
  if (idx >= 0 && idx < BELT_RANK_OPTIONS.length - 1) return BELT_RANK_OPTIONS[idx + 1];
  return null;
}


export type BeltGroup = "PUTIH" | "KUNING" | "HIJAU" | "BIRU" | "COKELAT" | "LAINNYA";

export function getBeltGroup(rankRaw: string | null | undefined): BeltGroup {
  const r = (rankRaw || "").trim().toLowerCase();
  if (r.includes("putih")) return "PUTIH";
  if (r.includes("kuning") || r.includes("oranye")) return "KUNING";
  if (r.includes("hijau")) return "HIJAU";
  if (r.includes("biru")) return "BIRU";
  if (r.includes("cokelat") || r.includes("coklat")) return "COKELAT";
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

/** Cabang, Pengprov, dan nasional yang mengisi / assign NIA. */
export function canAssignNia(roles: string[]): boolean {
  const elevated = new Set([
    "ADMINISTRATOR",
    "ADMIN_PUSAT",
    "ADMIN_PROVINCE",
    "ADMIN_BRANCH",
    "ADMIN",
  ]);
  return roles.some((r) => elevated.has(r));
}

export const DEFAULT_MEMBER_RANK = "Putih (Kyu 10)";

export type RankSortParsed = {
  kind: 0 | 1 | 2;
  n: number;
  label: string;
};

/** Ekstrak urutan sabuk kanonik: Kyu (kind 0, n 10→1), Dan (kind 1, n 1→10), Lainnya (kind 2). */
export function rankSortKey(rankRaw: string | null | undefined): RankSortParsed {
  const formatted = formatRankLabel(rankRaw) || (rankRaw || "").trim();
  const short = shortRankLabel(formatted);
  const label = (short || "").trim().toLowerCase();

  const kyu = label.match(/\bkyu\s*(\d+)\b/i);
  if (kyu) return { kind: 0, n: Number(kyu[1]), label };

  const dan = label.match(/\bdan\s*(\d+)\b/i);
  if (dan) return { kind: 1, n: Number(dan[1]), label };

  return { kind: 2, n: 0, label };
}

/** Urutkan sabuk: Kyu 10→1, Dan 1→10, lalu label lainnya A–Z. */
export function compareUktRanks(
  aRank: string | null | undefined,
  bRank: string | null | undefined,
): number {
  const pa = rankSortKey(aRank);
  const pb = rankSortKey(bRank);
  if (pa.kind !== pb.kind) return pa.kind - pb.kind;
  if (pa.kind === 0) return pb.n - pa.n;
  if (pa.kind === 1) return pa.n - pb.n;
  return pa.label.localeCompare(pb.label, "id");
}


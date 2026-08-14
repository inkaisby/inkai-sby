import { isBlackBeltRank, shortRankLabel } from "@/lib/belt";
import {
  UKT_HASIL_UJIAN_OFFICERS,
  type UktPeriodMeta,
} from "@/lib/ukt";

export const UKT_TTD_TEMPLATE_KEY = "ukt.ttd-template";
export const UKT_TTD_DEFAULT_PENGUJI_SLOTS = 6;
export const UKT_TTD_MAX_PENGUJI = 20;

export type UktTtdTemplate = {
  pengdaKetua?: string;
  pengdaKetuaTitle?: string;
  mshKetua?: string;
  mshKetuaTitle?: string;
  ketuaCabangName?: string;
  bidangUjianName?: string;
  pengujiNames?: string[];
  pengdaKetuaSignUrl?: string;
  mshKetuaSignUrl?: string;
  ketuaCabangSignUrl?: string;
  bidangUjianSignUrl?: string;
  pengujiSignUrls?: string[];
  updatedAt?: string;
};

export type UktTtdResolvedOfficers = {
  pengdaKetua: string;
  pengdaKetuaTitle: string;
  mshKetua: string;
  mshKetuaTitle: string;
  ketuaCabangName: string;
  bidangUjianName: string;
  pengujiNames: string[];
  pengdaKetuaSignUrl: string;
  mshKetuaSignUrl: string;
  ketuaCabangSignUrl: string;
  bidangUjianSignUrl: string;
  pengujiSignUrls: string[];
};

function trimOrEmpty(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function pickFirst(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    const t = trimOrEmpty(v);
    if (t) return t;
  }
  return "";
}

function parseStringList(value: unknown, max = UKT_TTD_MAX_PENGUJI): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (!t) continue;
    out.push(t.slice(0, 120));
    if (out.length >= max) break;
  }
  return out;
}

function parseUrlList(value: unknown, max = UKT_TTD_MAX_PENGUJI): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (!t) {
      out.push("");
    } else {
      out.push(t.slice(0, 500));
    }
    if (out.length >= max) break;
  }
  return out;
}

/** Format pangkat pejabat dari sabuk DAN + No. MSH anggota. */
export function formatUktOfficerTitle(
  currentRank?: string | null,
  mshNumber?: string | null,
): string {
  const rank = shortRankLabel(currentRank);
  const danMatch = rank.match(/Dan\s*(\d+)/i);
  const dan = danMatch?.[1];
  const msh = (mshNumber ?? "").trim();
  if (dan && msh) return `DAN ${dan} INKAI MSH NO. ${msh}`;
  if (dan) return `DAN ${dan} INKAI`;
  if (msh) return `INKAI MSH NO. ${msh}`;
  if (isBlackBeltRank(currentRank)) return "DAN INKAI";
  return "";
}

export function parseUktTtdTemplateValue(value: unknown): UktTtdTemplate {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  return {
    pengdaKetua:
      typeof v.pengdaKetua === "string" ? v.pengdaKetua.trim() || undefined : undefined,
    pengdaKetuaTitle:
      typeof v.pengdaKetuaTitle === "string"
        ? v.pengdaKetuaTitle.trim() || undefined
        : undefined,
    mshKetua:
      typeof v.mshKetua === "string" ? v.mshKetua.trim() || undefined : undefined,
    mshKetuaTitle:
      typeof v.mshKetuaTitle === "string"
        ? v.mshKetuaTitle.trim() || undefined
        : undefined,
    ketuaCabangName:
      typeof v.ketuaCabangName === "string"
        ? v.ketuaCabangName.trim() || undefined
        : undefined,
    bidangUjianName:
      typeof v.bidangUjianName === "string"
        ? v.bidangUjianName.trim() || undefined
        : undefined,
    pengujiNames: parseStringList(v.pengujiNames),
    pengdaKetuaSignUrl:
      typeof v.pengdaKetuaSignUrl === "string"
        ? v.pengdaKetuaSignUrl.trim() || undefined
        : undefined,
    mshKetuaSignUrl:
      typeof v.mshKetuaSignUrl === "string"
        ? v.mshKetuaSignUrl.trim() || undefined
        : undefined,
    ketuaCabangSignUrl:
      typeof v.ketuaCabangSignUrl === "string"
        ? v.ketuaCabangSignUrl.trim() || undefined
        : undefined,
    bidangUjianSignUrl:
      typeof v.bidangUjianSignUrl === "string"
        ? v.bidangUjianSignUrl.trim() || undefined
        : undefined,
    pengujiSignUrls: parseUrlList(v.pengujiSignUrls),
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : undefined,
  };
}

export type UktTtdResolveContext = {
  meta?: UktPeriodMeta | null;
  template?: UktTtdTemplate | null;
  /** Province.headName Jawa Timur (Pengprov). */
  pengprovHeadName?: string | null;
  /** Kebijakan cabang. */
  orgKetuaCabangName?: string | null;
  /** Susunan pengurus cabang aktif. */
  strukturKetuaName?: string | null;
  orgBidangUjianName?: string | null;
};

/**
 * Urutan: period-meta → template → org (Pengprov/struktur/kebijakan) → konstanta.
 */
export function resolveUktTtdOfficers(
  ctx: UktTtdResolveContext = {},
): UktTtdResolvedOfficers {
  const meta = ctx.meta;
  const tpl = ctx.template;

  const pengujiNames = (() => {
    if (meta?.pengujiNames && meta.pengujiNames.length > 0) {
      return meta.pengujiNames.map((n) => n.trim()).filter(Boolean);
    }
    if (tpl?.pengujiNames && tpl.pengujiNames.length > 0) {
      return tpl.pengujiNames.map((n) => n.trim()).filter(Boolean);
    }
    return [];
  })();

  const pengujiSignUrls = (() => {
    const fromMeta = meta?.pengujiSignUrls;
    const fromTpl = tpl?.pengujiSignUrls;
    const source =
      fromMeta && fromMeta.length > 0
        ? fromMeta
        : fromTpl && fromTpl.length > 0
          ? fromTpl
          : [];
    return pengujiNames.map((_, i) => (source[i] ?? "").trim());
  })();

  return {
    pengdaKetua: pickFirst(
      meta?.pengdaKetua,
      tpl?.pengdaKetua,
      ctx.pengprovHeadName,
      UKT_HASIL_UJIAN_OFFICERS.pengdaKetua,
    ),
    pengdaKetuaTitle: pickFirst(
      meta?.pengdaKetuaTitle,
      tpl?.pengdaKetuaTitle,
      UKT_HASIL_UJIAN_OFFICERS.pengdaKetuaTitle,
    ),
    mshKetua: pickFirst(
      meta?.mshKetua,
      tpl?.mshKetua,
      UKT_HASIL_UJIAN_OFFICERS.mshKetua,
    ),
    mshKetuaTitle: pickFirst(
      meta?.mshKetuaTitle,
      tpl?.mshKetuaTitle,
      UKT_HASIL_UJIAN_OFFICERS.mshKetuaTitle,
    ),
    ketuaCabangName: pickFirst(
      meta?.ketuaCabangName,
      tpl?.ketuaCabangName,
      ctx.orgKetuaCabangName,
      ctx.strukturKetuaName,
    ),
    bidangUjianName: pickFirst(
      meta?.bidangUjianName,
      tpl?.bidangUjianName,
      ctx.orgBidangUjianName,
      "SETIA BASUKI",
    ),
    pengujiNames,
    pengdaKetuaSignUrl: pickFirst(
      meta?.pengdaKetuaSignUrl,
      tpl?.pengdaKetuaSignUrl,
    ),
    mshKetuaSignUrl: pickFirst(meta?.mshKetuaSignUrl, tpl?.mshKetuaSignUrl),
    ketuaCabangSignUrl: pickFirst(
      meta?.ketuaCabangSignUrl,
      tpl?.ketuaCabangSignUrl,
    ),
    bidangUjianSignUrl: pickFirst(
      meta?.bidangUjianSignUrl,
      tpl?.bidangUjianSignUrl,
    ),
    pengujiSignUrls,
  };
}

export function padPengujiSlots(
  names: string[],
  slots = UKT_TTD_DEFAULT_PENGUJI_SLOTS,
): string[] {
  const out = names.map((n) => n.trim());
  while (out.length < slots) out.push("");
  return out.slice(0, UKT_TTD_MAX_PENGUJI);
}

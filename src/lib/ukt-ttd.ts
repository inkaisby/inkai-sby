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
  pengdaKetuaMemberId?: string;
  mshKetua?: string;
  mshKetuaTitle?: string;
  mshKetuaMemberId?: string;
  ketuaCabangName?: string;
  ketuaCabangTitle?: string;
  ketuaCabangMemberId?: string;
  bidangUjianName?: string;
  bidangUjianTitle?: string;
  bidangUjianMemberId?: string;
  pengujiNames?: string[];
  pengujiTitles?: string[];
  pengujiMemberIds?: string[];
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
  pengdaKetuaMemberId: string;
  mshKetua: string;
  mshKetuaTitle: string;
  mshKetuaMemberId: string;
  ketuaCabangName: string;
  ketuaCabangTitle: string;
  ketuaCabangMemberId: string;
  bidangUjianName: string;
  bidangUjianTitle: string;
  bidangUjianMemberId: string;
  pengujiNames: string[];
  pengujiTitles: string[];
  pengujiMemberIds: string[];
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

/** Preserve empty slots (titles / member ids / sign urls aligned to names). */
function parseAlignedList(value: unknown, max = UKT_TTD_MAX_PENGUJI): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      out.push("");
    } else {
      out.push(item.trim().slice(0, 500));
    }
    if (out.length >= max) break;
  }
  return out;
}

function parseOptString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
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
    pengdaKetua: parseOptString(v.pengdaKetua),
    pengdaKetuaTitle: parseOptString(v.pengdaKetuaTitle),
    pengdaKetuaMemberId: parseOptString(v.pengdaKetuaMemberId),
    mshKetua: parseOptString(v.mshKetua),
    mshKetuaTitle: parseOptString(v.mshKetuaTitle),
    mshKetuaMemberId: parseOptString(v.mshKetuaMemberId),
    ketuaCabangName: parseOptString(v.ketuaCabangName),
    ketuaCabangTitle: parseOptString(v.ketuaCabangTitle),
    ketuaCabangMemberId: parseOptString(v.ketuaCabangMemberId),
    bidangUjianName: parseOptString(v.bidangUjianName),
    bidangUjianTitle: parseOptString(v.bidangUjianTitle),
    bidangUjianMemberId: parseOptString(v.bidangUjianMemberId),
    pengujiNames: parseStringList(v.pengujiNames),
    pengujiTitles: parseAlignedList(v.pengujiTitles),
    pengujiMemberIds: parseAlignedList(v.pengujiMemberIds),
    pengdaKetuaSignUrl: parseOptString(v.pengdaKetuaSignUrl),
    mshKetuaSignUrl: parseOptString(v.mshKetuaSignUrl),
    ketuaCabangSignUrl: parseOptString(v.ketuaCabangSignUrl),
    bidangUjianSignUrl: parseOptString(v.bidangUjianSignUrl),
    pengujiSignUrls: parseAlignedList(v.pengujiSignUrls),
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

  const align = (fromMeta?: string[], fromTpl?: string[]) => {
    const source =
      fromMeta && fromMeta.length > 0
        ? fromMeta
        : fromTpl && fromTpl.length > 0
          ? fromTpl
          : [];
    return pengujiNames.map((_, i) => (source[i] ?? "").trim());
  };

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
    pengdaKetuaMemberId: pickFirst(
      meta?.pengdaKetuaMemberId,
      tpl?.pengdaKetuaMemberId,
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
    mshKetuaMemberId: pickFirst(meta?.mshKetuaMemberId, tpl?.mshKetuaMemberId),
    ketuaCabangName: pickFirst(
      meta?.ketuaCabangName,
      tpl?.ketuaCabangName,
      ctx.orgKetuaCabangName,
      ctx.strukturKetuaName,
    ),
    ketuaCabangTitle: pickFirst(meta?.ketuaCabangTitle, tpl?.ketuaCabangTitle),
    ketuaCabangMemberId: pickFirst(
      meta?.ketuaCabangMemberId,
      tpl?.ketuaCabangMemberId,
    ),
    bidangUjianName: pickFirst(
      meta?.bidangUjianName,
      tpl?.bidangUjianName,
      ctx.orgBidangUjianName,
      "SETIA BASUKI",
    ),
    bidangUjianTitle: pickFirst(meta?.bidangUjianTitle, tpl?.bidangUjianTitle),
    bidangUjianMemberId: pickFirst(
      meta?.bidangUjianMemberId,
      tpl?.bidangUjianMemberId,
    ),
    pengujiNames,
    pengujiTitles: align(meta?.pengujiTitles, tpl?.pengujiTitles),
    pengujiMemberIds: align(meta?.pengujiMemberIds, tpl?.pengujiMemberIds),
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
    pengujiSignUrls: align(meta?.pengujiSignUrls, tpl?.pengujiSignUrls),
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

export type UktTtdMemberRankRow = {
  id: string;
  currentRank: string | null;
  mshNumber: string | null;
};

/**
 * Refresh titles from Member ranks when memberId is set.
 * Manual titles (no memberId) are left unchanged.
 */
export function applyLiveUktTtdTitles<T extends UktTtdResolvedOfficers>(
  draft: T,
  members: UktTtdMemberRankRow[],
): T {
  const byId = new Map(members.map((m) => [m.id, m]));
  const titleFor = (memberId: string, fallback: string) => {
    const id = memberId.trim();
    if (!id) return fallback;
    const m = byId.get(id);
    if (!m) return fallback;
    return formatUktOfficerTitle(m.currentRank, m.mshNumber) || fallback;
  };

  const pengujiTitles = draft.pengujiNames.map((_, i) =>
    titleFor(draft.pengujiMemberIds[i] ?? "", draft.pengujiTitles[i] ?? ""),
  );

  return {
    ...draft,
    pengdaKetuaTitle: titleFor(draft.pengdaKetuaMemberId, draft.pengdaKetuaTitle),
    mshKetuaTitle: titleFor(draft.mshKetuaMemberId, draft.mshKetuaTitle),
    ketuaCabangTitle: titleFor(
      draft.ketuaCabangMemberId,
      draft.ketuaCabangTitle,
    ),
    bidangUjianTitle: titleFor(
      draft.bidangUjianMemberId,
      draft.bidangUjianTitle,
    ),
    pengujiTitles,
  };
}

export function collectUktTtdMemberIds(draft: UktTtdResolvedOfficers): string[] {
  const ids = [
    draft.pengdaKetuaMemberId,
    draft.mshKetuaMemberId,
    draft.ketuaCabangMemberId,
    draft.bidangUjianMemberId,
    ...draft.pengujiMemberIds,
  ]
    .map((id) => id.trim())
    .filter(Boolean);
  return [...new Set(ids)];
}

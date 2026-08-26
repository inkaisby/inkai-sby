import { inkaiFetch } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";
import {
  parseUktPeriodMetaValue,
  uktPeriodMetaKey,
  type BeltFeeKey,
  type UktPeriodMeta,
} from "@/lib/ukt";

export async function loadUktPeriodMeta(
  token: string,
  eventId: string,
): Promise<UktPeriodMeta> {
  const { res, data } = await inkaiFetch(
    `/v1/settings/${encodeURIComponent(uktPeriodMetaKey(eventId))}`,
    {},
    token,
    { timeoutMs: 8_000, retries: 0 },
  );
  if (res.ok) {
    return parseUktPeriodMetaValue(
      (data.data as { value?: unknown } | undefined)?.value ?? null,
    );
  }

  // Fallback Prisma bila JWT Inkai gagal/expired — jangan anggap periode terbuka palsu.
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: uktPeriodMetaKey(eventId) },
      select: { value: true },
    });
    if (row?.value != null) {
      return parseUktPeriodMetaValue(row.value);
    }
  } catch (error) {
    console.warn("[loadUktPeriodMeta] prisma fallback", error);
  }

  return { archived: false, locked: false };
}

/**
 * Tolak mutasi (daftar, deposit, fee, waiver, hari-H) bila periode UKT sudah
 * diarsipkan/dikunci. Terima `meta` opsional agar caller yang sudah punya
 * hasil `loadUktPeriodMeta` tidak perlu fetch ulang.
 */
export async function assertUktPeriodMutable(
  token: string,
  eventId: string,
  meta?: UktPeriodMeta,
): Promise<
  | { ok: true; meta: UktPeriodMeta }
  | { ok: false; status: 403; error: string }
> {
  const resolved = meta ?? (await loadUktPeriodMeta(token, eventId));
  if (resolved.archived || resolved.locked) {
    return {
      ok: false,
      status: 403,
      error: "Periode UKT sudah diarsipkan/dikunci — tidak dapat diubah",
    };
  }
  return { ok: true, meta: resolved };
}

export async function saveUktPeriodMeta(
  token: string,
  eventId: string,
  next: UktPeriodMeta,
): Promise<{ ok: boolean; status: number; errorData?: unknown }> {
  const { putAppSettingPrismaFirst } = await import("@/lib/app-setting-write");
  const saved = await putAppSettingPrismaFirst({
    key: uktPeriodMetaKey(eventId),
    value: next,
    token,
    label: "ukt-period-meta",
  });
  if (!saved.ok) {
    return {
      ok: false,
      status: saved.status,
      errorData: { error: saved.error },
    };
  }
  return { ok: true, status: 200 };
}

function trimOptional(value: string | null | undefined): string | undefined {
  if (value === null) return undefined;
  if (value === undefined) return undefined;
  const t = value.trim();
  return t || undefined;
}

export type UktPeriodMetaPatch = {
  archived?: boolean;
  locked?: boolean;
  registrationOpenAt?: string | null;
  examAt?: string | null;
  examLocation?: string | null;
  bidangUjianName?: string | null;
  bendaharaCabangName?: string | null;
  beltFees?: Partial<Record<BeltFeeKey, number>> | null;
  komisiRanting?: number | null;
  pengprovBeltFees?: Partial<Record<BeltFeeKey, number>> | null;
  pengdaKetua?: string | null;
  pengdaKetuaTitle?: string | null;
  mshKetua?: string | null;
  mshKetuaTitle?: string | null;
  ketuaCabangName?: string | null;
  ketuaCabangTitle?: string | null;
  bidangUjianTitle?: string | null;
  pengdaKetuaMemberId?: string | null;
  mshKetuaMemberId?: string | null;
  ketuaCabangMemberId?: string | null;
  bidangUjianMemberId?: string | null;
  pengujiNames?: string[] | null;
  pengujiTitles?: string[] | null;
  pengujiMemberIds?: string[] | null;
  pengdaKetuaSignUrl?: string | null;
  mshKetuaSignUrl?: string | null;
  ketuaCabangSignUrl?: string | null;
  bidangUjianSignUrl?: string | null;
  pengujiSignUrls?: string[] | null;
  notifiedOpenAt?: string | null;
  notifiedCloseReminderAt?: string | null;
  notifiedExtendedAt?: string | null;
  by?: string;
};

export function mergeUktPeriodMeta(
  current: UktPeriodMeta,
  patch: UktPeriodMetaPatch,
): UktPeriodMeta {
  const now = new Date().toISOString();
  const next: UktPeriodMeta = {
    ...current,
    by: patch.by ?? current.by,
  };

  if (patch.archived !== undefined) {
    next.archived = patch.archived;
    next.archivedAt = patch.archived ? now : undefined;
    if (patch.archived && patch.locked !== false) {
      next.locked = true;
      next.lockedAt = now;
    }
  }
  if (patch.locked !== undefined) {
    next.locked = patch.locked;
    next.lockedAt = patch.locked ? now : undefined;
  }
  if (patch.registrationOpenAt !== undefined) {
    next.registrationOpenAt = patch.registrationOpenAt || undefined;
  }
  if (patch.examAt !== undefined) {
    next.examAt = patch.examAt || undefined;
  }
  if (patch.examLocation !== undefined) {
    next.examLocation = patch.examLocation?.trim() || undefined;
  }
  if (patch.bidangUjianName !== undefined) {
    next.bidangUjianName = trimOptional(patch.bidangUjianName);
  }
  if (patch.bendaharaCabangName !== undefined) {
    next.bendaharaCabangName = trimOptional(patch.bendaharaCabangName);
  }
  if (patch.beltFees !== undefined) {
    next.beltFees = patch.beltFees || undefined;
  }
  if (patch.komisiRanting !== undefined) {
    next.komisiRanting =
      patch.komisiRanting == null ? undefined : Math.round(patch.komisiRanting);
  }
  if (patch.pengprovBeltFees !== undefined) {
    next.pengprovBeltFees = patch.pengprovBeltFees || undefined;
  }
  if (patch.pengdaKetua !== undefined) {
    next.pengdaKetua = trimOptional(patch.pengdaKetua);
  }
  if (patch.pengdaKetuaTitle !== undefined) {
    next.pengdaKetuaTitle = trimOptional(patch.pengdaKetuaTitle);
  }
  if (patch.mshKetua !== undefined) {
    next.mshKetua = trimOptional(patch.mshKetua);
  }
  if (patch.mshKetuaTitle !== undefined) {
    next.mshKetuaTitle = trimOptional(patch.mshKetuaTitle);
  }
  if (patch.ketuaCabangName !== undefined) {
    next.ketuaCabangName = trimOptional(patch.ketuaCabangName);
  }
  if (patch.ketuaCabangTitle !== undefined) {
    next.ketuaCabangTitle = trimOptional(patch.ketuaCabangTitle);
  }
  if (patch.bidangUjianTitle !== undefined) {
    next.bidangUjianTitle = trimOptional(patch.bidangUjianTitle);
  }
  if (patch.pengdaKetuaMemberId !== undefined) {
    next.pengdaKetuaMemberId = trimOptional(patch.pengdaKetuaMemberId);
  }
  if (patch.mshKetuaMemberId !== undefined) {
    next.mshKetuaMemberId = trimOptional(patch.mshKetuaMemberId);
  }
  if (patch.ketuaCabangMemberId !== undefined) {
    next.ketuaCabangMemberId = trimOptional(patch.ketuaCabangMemberId);
  }
  if (patch.bidangUjianMemberId !== undefined) {
    next.bidangUjianMemberId = trimOptional(patch.bidangUjianMemberId);
  }
  if (patch.pengujiNames !== undefined) {
    next.pengujiNames = patch.pengujiNames
      ? patch.pengujiNames
          .map((n) => n.trim())
          .filter(Boolean)
          .slice(0, 20)
      : undefined;
  }
  if (patch.pengujiTitles !== undefined) {
    next.pengujiTitles = patch.pengujiTitles
      ? patch.pengujiTitles.map((n) => n.trim()).slice(0, 20)
      : undefined;
  }
  if (patch.pengujiMemberIds !== undefined) {
    next.pengujiMemberIds = patch.pengujiMemberIds
      ? patch.pengujiMemberIds.map((n) => n.trim()).slice(0, 20)
      : undefined;
  }
  if (patch.pengdaKetuaSignUrl !== undefined) {
    next.pengdaKetuaSignUrl = trimOptional(patch.pengdaKetuaSignUrl);
  }
  if (patch.mshKetuaSignUrl !== undefined) {
    next.mshKetuaSignUrl = trimOptional(patch.mshKetuaSignUrl);
  }
  if (patch.ketuaCabangSignUrl !== undefined) {
    next.ketuaCabangSignUrl = trimOptional(patch.ketuaCabangSignUrl);
  }
  if (patch.bidangUjianSignUrl !== undefined) {
    next.bidangUjianSignUrl = trimOptional(patch.bidangUjianSignUrl);
  }
  if (patch.pengujiSignUrls !== undefined) {
    next.pengujiSignUrls = patch.pengujiSignUrls
      ? patch.pengujiSignUrls.map((n) => n.trim()).slice(0, 20)
      : undefined;
  }
  if (patch.notifiedOpenAt !== undefined) {
    next.notifiedOpenAt = patch.notifiedOpenAt || undefined;
  }
  if (patch.notifiedCloseReminderAt !== undefined) {
    next.notifiedCloseReminderAt = patch.notifiedCloseReminderAt || undefined;
  }
  if (patch.notifiedExtendedAt !== undefined) {
    next.notifiedExtendedAt = patch.notifiedExtendedAt || undefined;
  }

  return next;
}

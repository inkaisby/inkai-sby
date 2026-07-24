import { inkaiFetch } from "@/lib/inkai-api/server";
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
  );
  if (!res.ok) return { archived: false, locked: false };
  return parseUktPeriodMetaValue(
    (data.data as { value?: unknown } | undefined)?.value ?? null,
  );
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
  const { res, data } = await inkaiFetch(
    `/v1/settings/${encodeURIComponent(uktPeriodMetaKey(eventId))}`,
    { method: "PUT", body: JSON.stringify({ value: next }) },
    token,
  );
  return { ok: res.ok, status: res.status, errorData: data };
}

export function mergeUktPeriodMeta(
  current: UktPeriodMeta,
  patch: {
    archived?: boolean;
    locked?: boolean;
    registrationOpenAt?: string | null;
    examAt?: string | null;
    examLocation?: string | null;
    bidangUjianName?: string | null;
    bendaharaCabangName?: string | null;
    beltFees?: Partial<Record<BeltFeeKey, number>> | null;
    komisiRanting?: number | null;
    notifiedOpenAt?: string | null;
    notifiedCloseReminderAt?: string | null;
    notifiedExtendedAt?: string | null;
    by?: string;
  },
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
    next.bidangUjianName = patch.bidangUjianName?.trim() || undefined;
  }
  if (patch.bendaharaCabangName !== undefined) {
    next.bendaharaCabangName = patch.bendaharaCabangName?.trim() || undefined;
  }
  if (patch.beltFees !== undefined) {
    next.beltFees = patch.beltFees || undefined;
  }
  if (patch.komisiRanting !== undefined) {
    next.komisiRanting =
      patch.komisiRanting == null ? undefined : Math.round(patch.komisiRanting);
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

import { inkaiFetch } from "@/lib/inkai-api/server";
import {
  latberPeriodMetaKey,
  parseLatberPeriodMetaValue,
  type LatberPeriodMeta,
} from "@/lib/latber";

export async function loadLatberPeriodMeta(
  token: string,
  eventId: string,
): Promise<LatberPeriodMeta> {
  const { res, data } = await inkaiFetch(
    `/v1/settings/${encodeURIComponent(latberPeriodMetaKey(eventId))}`,
    {},
    token,
  );
  if (!res.ok) return { archived: false, locked: false };
  return parseLatberPeriodMetaValue(
    (data.data as { value?: unknown } | undefined)?.value ?? null,
  );
}

export async function assertLatberPeriodMutable(
  token: string,
  eventId: string,
  meta?: LatberPeriodMeta,
): Promise<
  | { ok: true; meta: LatberPeriodMeta }
  | { ok: false; status: 403; error: string }
> {
  const resolved = meta ?? (await loadLatberPeriodMeta(token, eventId));
  if (resolved.archived || resolved.locked) {
    return {
      ok: false,
      status: 403,
      error: "Periode Latber sudah diarsipkan/dikunci — tidak dapat diubah",
    };
  }
  return { ok: true, meta: resolved };
}

export async function saveLatberPeriodMeta(
  token: string,
  eventId: string,
  next: LatberPeriodMeta,
): Promise<{ ok: boolean; status: number; errorData?: unknown }> {
  const { res, data } = await inkaiFetch(
    `/v1/settings/${encodeURIComponent(latberPeriodMetaKey(eventId))}`,
    { method: "PUT", body: JSON.stringify({ value: next }) },
    token,
  );
  return { ok: res.ok, status: res.status, errorData: data };
}

export function mergeLatberPeriodMeta(
  current: LatberPeriodMeta,
  patch: {
    archived?: boolean;
    locked?: boolean;
    registrationOpenAt?: string | null;
    eventAt?: string | null;
    eventLocation?: string | null;
    feeAmount?: number | null;
    komisiRanting?: number | null;
    by?: string;
  },
): LatberPeriodMeta {
  const now = new Date().toISOString();
  const next: LatberPeriodMeta = {
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
  if (patch.eventAt !== undefined) {
    next.eventAt = patch.eventAt || undefined;
  }
  if (patch.eventLocation !== undefined) {
    next.eventLocation = patch.eventLocation?.trim() || undefined;
  }
  if (patch.feeAmount !== undefined) {
    next.feeAmount =
      patch.feeAmount == null ? undefined : Math.round(patch.feeAmount);
  }
  if (patch.komisiRanting !== undefined) {
    next.komisiRanting =
      patch.komisiRanting == null ? undefined : Math.round(patch.komisiRanting);
  }

  return next;
}

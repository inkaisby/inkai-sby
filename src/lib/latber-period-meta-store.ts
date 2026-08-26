import { inkaiFetch } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";
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
    { timeoutMs: 8_000, retries: 0 },
  );
  if (res.ok) {
    return parseLatberPeriodMetaValue(
      (data.data as { value?: unknown } | undefined)?.value ?? null,
    );
  }

  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: latberPeriodMetaKey(eventId) },
      select: { value: true },
    });
    if (row?.value != null) {
      return parseLatberPeriodMetaValue(row.value);
    }
  } catch (error) {
    console.warn("[loadLatberPeriodMeta] prisma fallback", error);
  }

  return { archived: false, locked: false };
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
      error: "Periode Latihan Bersama sudah diarsipkan/dikunci — tidak dapat diubah",
    };
  }
  return { ok: true, meta: resolved };
}

export async function saveLatberPeriodMeta(
  token: string,
  eventId: string,
  next: LatberPeriodMeta,
): Promise<{ ok: boolean; status: number; errorData?: unknown }> {
  const { putAppSettingPrismaFirst } = await import("@/lib/app-setting-write");
  const saved = await putAppSettingPrismaFirst({
    key: latberPeriodMetaKey(eventId),
    value: next,
    token,
    label: "latber-period-meta",
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

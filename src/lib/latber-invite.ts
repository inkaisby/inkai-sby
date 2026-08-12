import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getEventDetail } from "@/lib/public-data";
import { inkaiFetch } from "@/lib/inkai-api/server";
import {
  getLatberRegistrationDeadline,
  isLatberRegistrationOpen,
  latberPeriodMetaKey,
  parseLatberPeriodMetaValue,
  type LatberPeriodMeta,
} from "@/lib/latber";
import { SITE_URL } from "@/lib/site";

export const LATBER_INVITE_KEY_PREFIX = "latber-invite:";

export function latberInviteKey(periodId: string): string {
  return `${LATBER_INVITE_KEY_PREFIX}${periodId}`;
}

export type LatberInvitePublic = {
  periodId: string;
  title: string;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  eventAt: string | null;
  eventLocation: string | null;
  feeAmount: number;
  archived: boolean;
  locked: boolean;
  registrationOpen: boolean;
  mapsUrl: string | null;
};

export function buildLatberInviteUrl(periodId: string): string {
  return `${SITE_URL}/undangan/latber/${periodId}`;
}

export function buildLatberInviteLoginUrl(periodId: string): string {
  const callbackUrl = `/admin/latber?period=${encodeURIComponent(periodId)}`;
  return `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export function buildLatberInviteMapsUrl(
  location: string | null | undefined,
): string | null {
  const q = location?.trim();
  if (!q) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}`;
}

export type LatberInviteSnapshotInput = {
  periodId: string;
  title: string;
  startDate?: string | null;
  endDate?: string | null;
  registrationCloseAt?: string | null;
  location?: string | null;
  meta: Pick<
    LatberPeriodMeta,
    | "registrationOpenAt"
    | "eventAt"
    | "eventLocation"
    | "archived"
    | "locked"
    | "feeAmount"
  >;
};

export function buildLatberInviteSnapshot(
  input: LatberInviteSnapshotInput,
): LatberInvitePublic {
  const eventLocation =
    input.meta.eventLocation?.trim() || input.location?.trim() || null;
  const startDate = input.startDate || "";
  const endDate = input.endDate || input.startDate || "";
  const registrationCloseAt =
    input.registrationCloseAt ||
    (startDate
      ? getLatberRegistrationDeadline({
          startDate,
          endDate,
          registrationCloseAt: input.registrationCloseAt,
        }).toISOString()
      : null);

  const schedule = {
    startDate,
    endDate,
    registrationCloseAt: input.registrationCloseAt,
    registrationOpenAt: input.meta.registrationOpenAt,
  };

  const registrationOpen =
    !input.meta.archived &&
    !input.meta.locked &&
    Boolean(startDate) &&
    isLatberRegistrationOpen(schedule);

  return {
    periodId: input.periodId,
    title: input.title,
    registrationOpenAt: input.meta.registrationOpenAt ?? null,
    registrationCloseAt,
    eventAt: input.meta.eventAt ?? null,
    eventLocation,
    feeAmount: input.meta.feeAmount ?? 45_000,
    archived: Boolean(input.meta.archived),
    locked: Boolean(input.meta.locked),
    registrationOpen,
    mapsUrl: buildLatberInviteMapsUrl(eventLocation),
  };
}

export async function syncLatberInviteSnapshot(
  input: LatberInviteSnapshotInput,
  token?: string | null,
): Promise<void> {
  const snapshot = buildLatberInviteSnapshot(input);
  const key = latberInviteKey(input.periodId);
  const body = JSON.stringify({ value: snapshot });

  if (token) {
    await inkaiFetch(
      `/v1/settings/${encodeURIComponent(key)}`,
      { method: "PUT", body },
      token,
    ).catch((err) => console.error("[syncLatberInviteSnapshot]", err));
    return;
  }

  await prisma.appSetting
    .upsert({
      where: { key },
      create: { key, value: snapshot as object },
      update: { value: snapshot as object },
    })
    .catch((err) => console.error("[syncLatberInviteSnapshot] prisma", err));
}

export const getLatberInvitePublic = cache(
  async (periodId: string): Promise<LatberInvitePublic | null> => {
    const key = latberInviteKey(periodId);
    try {
      const local = await prisma.appSetting.findUnique({
        where: { key },
        select: { value: true },
      });
      if (local?.value && typeof local.value === "object") {
        const v = local.value as LatberInvitePublic;
        if (v.periodId) return v;
      }
    } catch {
      /* fallback below */
    }

    const event = await getEventDetail(periodId);
    if (!event) return null;

    let meta: LatberPeriodMeta = { archived: false, locked: false };
    try {
      const { res, data } = await inkaiFetch(
        `/v1/settings/${encodeURIComponent(latberPeriodMetaKey(periodId))}`,
        {},
        null,
      );
      if (res.ok) {
        meta = parseLatberPeriodMetaValue(
          (data.data as { value?: unknown } | undefined)?.value ?? null,
        );
      }
    } catch {
      /* ignore */
    }

    return buildLatberInviteSnapshot({
      periodId,
      title: String(event.title ?? "Latber"),
      startDate: event.startDate,
      endDate: event.endDate,
      registrationCloseAt: event.endDate,
      location: event.location,
      meta,
    });
  },
);

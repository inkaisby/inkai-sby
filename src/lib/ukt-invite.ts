import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEventDetail } from "@/lib/public-data";
import {
  getUktRegistrationDeadline,
  isUktRegistrationOpen,
  parseUktEventTitle,
  type UktPeriodMeta,
  type UktSemester,
} from "@/lib/ukt";
import { SITE_URL } from "@/lib/site";

export const UKT_INVITE_KEY_PREFIX = "ukt-invite:";

export function uktInviteKey(periodId: string): string {
  return `${UKT_INVITE_KEY_PREFIX}${periodId}`;
}

export type UktInvitePublic = {
  periodId: string;
  title: string;
  semester: UktSemester | null;
  year: number | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  examAt: string | null;
  examLocation: string | null;
  archived: boolean;
  locked: boolean;
  /** Pendaftaran masih bisa dilakukan sekarang. */
  registrationOpen: boolean;
  mapsUrl: string | null;
};

export function buildUktInviteUrl(periodId: string): string {
  return `${SITE_URL}/undangan/ukt/${periodId}`;
}

export function buildUktInviteLoginUrl(invite: {
  periodId: string;
  semester: UktSemester | null;
  year: number | null;
}): string {
  const adminQs = new URLSearchParams({ period: invite.periodId });
  if (invite.semester) adminQs.set("semester", invite.semester);
  if (invite.year) adminQs.set("year", String(invite.year));
  const callbackUrl = `/admin/ukt?${adminQs.toString()}`;
  return `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export function buildUktInviteMapsUrl(examLocation: string | null | undefined): string | null {
  const q = examLocation?.trim();
  if (!q) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}`;
}

export type UktInviteSnapshotInput = {
  periodId: string;
  title: string;
  startDate?: string | null;
  endDate?: string | null;
  registrationCloseAt?: string | null;
  location?: string | null;
  meta: Pick<
    UktPeriodMeta,
    "registrationOpenAt" | "examAt" | "examLocation" | "archived" | "locked"
  >;
};

export function buildUktInviteSnapshot(input: UktInviteSnapshotInput): UktInvitePublic {
  const parsed = parseUktEventTitle(input.title);
  const examLocation =
    input.meta.examLocation?.trim() || input.location?.trim() || null;
  const startDate = input.startDate || "";
  const endDate = input.endDate || input.startDate || "";
  const registrationCloseAt =
    input.registrationCloseAt ||
    (startDate
      ? getUktRegistrationDeadline({
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
    isUktRegistrationOpen(schedule);

  return {
    periodId: input.periodId,
    title: input.title,
    semester: parsed?.semester ?? null,
    year: parsed?.year ?? null,
    registrationOpenAt: input.meta.registrationOpenAt ?? null,
    registrationCloseAt,
    examAt: input.meta.examAt ?? null,
    examLocation,
    archived: Boolean(input.meta.archived),
    locked: Boolean(input.meta.locked),
    registrationOpen,
    mapsUrl: buildUktInviteMapsUrl(examLocation),
  };
}

export async function syncUktInviteSnapshot(
  input: UktInviteSnapshotInput,
): Promise<void> {
  const value = buildUktInviteSnapshot(input);
  await prisma.appSetting.upsert({
    where: { key: uktInviteKey(input.periodId) },
    create: {
      key: uktInviteKey(input.periodId),
      value: value as unknown as Prisma.InputJsonValue,
    },
    update: { value: value as unknown as Prisma.InputJsonValue },
  });
}

function parseInviteValue(raw: unknown): UktInvitePublic | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const periodId = typeof v.periodId === "string" ? v.periodId : null;
  const title = typeof v.title === "string" ? v.title : null;
  if (!periodId || !title) return null;

  const examLocation =
    typeof v.examLocation === "string" ? v.examLocation : null;
  return {
    periodId,
    title,
    semester:
      v.semester === "I" || v.semester === "II"
        ? v.semester
        : parseUktEventTitle(title)?.semester ?? null,
    year: typeof v.year === "number" ? v.year : parseUktEventTitle(title)?.year ?? null,
    registrationOpenAt:
      typeof v.registrationOpenAt === "string" ? v.registrationOpenAt : null,
    registrationCloseAt:
      typeof v.registrationCloseAt === "string" ? v.registrationCloseAt : null,
    examAt: typeof v.examAt === "string" ? v.examAt : null,
    examLocation,
    archived: Boolean(v.archived),
    locked: Boolean(v.locked),
    registrationOpen: Boolean(v.registrationOpen),
    mapsUrl:
      typeof v.mapsUrl === "string"
        ? v.mapsUrl
        : buildUktInviteMapsUrl(examLocation),
  };
}

async function loadInviteFromDb(periodId: string): Promise<UktInvitePublic | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: uktInviteKey(periodId) },
  });
  return parseInviteValue(row?.value ?? null);
}

async function loadInviteFallback(periodId: string): Promise<UktInvitePublic | null> {
  const event = await getEventDetail(periodId);
  if (!event) return null;
  const titleUpper = event.title.toUpperCase();
  if (!titleUpper.includes("UKT")) return null;

  return buildUktInviteSnapshot({
    periodId: event.id,
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    registrationCloseAt: null,
    location: event.location,
    meta: {
      archived: false,
      locked: false,
      examLocation: event.location ?? undefined,
    },
  });
}

export const getUktInvitePublic = cache(async (periodId: string) => {
  const fromDb = await loadInviteFromDb(periodId);
  if (fromDb) {
    const closeIso =
      fromDb.registrationCloseAt || new Date(Date.now() + 86400000).toISOString();
    const schedule = {
      startDate: closeIso,
      endDate: closeIso,
      registrationCloseAt: fromDb.registrationCloseAt,
      registrationOpenAt: fromDb.registrationOpenAt ?? undefined,
    };
    const registrationOpen =
      !fromDb.archived &&
      !fromDb.locked &&
      isUktRegistrationOpen(schedule);
    return { ...fromDb, registrationOpen };
  }
  return loadInviteFallback(periodId);
});

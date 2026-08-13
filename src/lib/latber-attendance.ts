import { prisma } from "@/lib/prisma";
import { jakartaDayKey } from "@/lib/ukt";

export const LATBER_ATTENDANCE_METHOD = "LATBER";
export const LATBER_ATTENDANCE_LABEL = "Latihan Bersama";

export type LatberAttendanceCreditRow = {
  id: string;
  memberId: string;
  dojoId: string;
  eventId: string | null;
  checkInAt: Date;
  method: string;
  dojoName?: string | null;
  eventTitle?: string | null;
  fullName?: string | null;
  nia?: string | null;
};

export function isLatberAttendanceMethod(method: string | null | undefined): boolean {
  return String(method ?? "").toUpperCase() === LATBER_ATTENDANCE_METHOD;
}

export function isLatberEventDayReached(
  eventAt: string | Date,
  now: Date = new Date(),
): boolean {
  const eventDate = eventAt instanceof Date ? eventAt : new Date(eventAt);
  if (Number.isNaN(eventDate.getTime())) return false;
  return jakartaDayKey(now) >= jakartaDayKey(eventDate);
}

export function latberAttendanceCheckInAt(eventAt: string | Date): Date | null {
  const eventDate = eventAt instanceof Date ? eventAt : new Date(eventAt);
  if (Number.isNaN(eventDate.getTime())) return null;
  return eventDate;
}

export function mergeAttendanceWithLatberCredits(
  inkaiRows: Array<Record<string, unknown>>,
  credits: LatberAttendanceCreditRow[],
): Array<Record<string, unknown>> {
  const byDay = new Map<string, Record<string, unknown>>();

  for (const row of inkaiRows) {
    const raw = String(row.checkInAt ?? "");
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const day = jakartaDayKey(d);
    if (isLatberAttendanceMethod(String(row.method ?? ""))) continue;
    byDay.set(day, row);
  }

  for (const credit of credits) {
    const day = jakartaDayKey(credit.checkInAt);
    if (byDay.has(day)) continue;
    byDay.set(day, latberCreditToAttendanceRow(credit));
  }

  return [...byDay.values()].sort((a, b) => {
    const ta = new Date(String(a.checkInAt ?? "")).getTime();
    const tb = new Date(String(b.checkInAt ?? "")).getTime();
    return tb - ta;
  });
}

export function latberCreditToAttendanceRow(
  credit: LatberAttendanceCreditRow,
): Record<string, unknown> {
  return {
    id: credit.id,
    memberId: credit.memberId,
    dojoId: credit.dojoId,
    eventId: credit.eventId,
    checkInAt: credit.checkInAt.toISOString(),
    method: LATBER_ATTENDANCE_METHOD,
    member: {
      id: credit.memberId,
      fullName: credit.fullName ?? "—",
      nia: credit.nia ?? "",
    },
    dojo: { id: credit.dojoId, name: credit.dojoName ?? "—" },
    event: credit.eventId
      ? { id: credit.eventId, title: credit.eventTitle || LATBER_ATTENDANCE_LABEL }
      : { title: LATBER_ATTENDANCE_LABEL },
  };
}

function mapCredit(row: {
  id: string;
  memberId: string;
  dojoId: string;
  eventId: string | null;
  checkInAt: Date;
  method: string;
  dojo?: { name: string } | null;
  event?: { title: string } | null;
  member?: { fullName: string; nia: string | null } | null;
}): LatberAttendanceCreditRow {
  return {
    id: row.id,
    memberId: row.memberId,
    dojoId: row.dojoId,
    eventId: row.eventId,
    checkInAt: row.checkInAt,
    method: row.method,
    dojoName: row.dojo?.name ?? null,
    eventTitle: row.event?.title ?? null,
    fullName: row.member?.fullName ?? null,
    nia: row.member?.nia ?? null,
  };
}

export async function loadLatberAttendanceCreditsForMember(
  memberId: string,
): Promise<LatberAttendanceCreditRow[]> {
  if (!memberId) return [];
  const rows = await prisma.attendance.findMany({
    where: {
      memberId,
      isDeleted: false,
      method: LATBER_ATTENDANCE_METHOD,
    },
    select: {
      id: true,
      memberId: true,
      dojoId: true,
      eventId: true,
      checkInAt: true,
      method: true,
      dojo: { select: { name: true } },
      event: { select: { title: true } },
      member: { select: { fullName: true, nia: true } },
    },
    orderBy: { checkInAt: "desc" },
    take: 120,
  });
  return rows.map(mapCredit);
}

export async function loadLatberAttendanceCreditsInRange(opts: {
  from: Date;
  to: Date;
  memberIds?: string[];
}): Promise<LatberAttendanceCreditRow[]> {
  const rows = await prisma.attendance.findMany({
    where: {
      isDeleted: false,
      method: LATBER_ATTENDANCE_METHOD,
      checkInAt: { gte: opts.from, lte: opts.to },
      ...(opts.memberIds && opts.memberIds.length > 0
        ? { memberId: { in: opts.memberIds } }
        : {}),
    },
    select: {
      id: true,
      memberId: true,
      dojoId: true,
      eventId: true,
      checkInAt: true,
      method: true,
      dojo: { select: { name: true } },
      event: { select: { title: true } },
      member: { select: { fullName: true, nia: true } },
    },
    take: 2000,
  });
  return rows.map(mapCredit);
}

export async function hasLatberAttendanceOnJakartaDay(
  memberId: string,
  dayKey: string,
): Promise<boolean> {
  if (!memberId || !dayKey) return false;
  const rows = await prisma.attendance.findMany({
    where: {
      memberId,
      isDeleted: false,
      method: LATBER_ATTENDANCE_METHOD,
    },
    select: { checkInAt: true },
    take: 40,
  });
  return rows.some((row) => jakartaDayKey(row.checkInAt) === dayKey);
}

export async function ensureLatberAttendanceCredit(opts: {
  memberId: string;
  eventId: string;
  eventAt: string | Date;
  dojoId: string;
}): Promise<{ created: boolean; skipped: string | null; id?: string }> {
  const checkInAt = latberAttendanceCheckInAt(opts.eventAt);
  if (!checkInAt) {
    return { created: false, skipped: "eventAt_invalid" };
  }
  if (!opts.memberId || !opts.eventId || !opts.dojoId) {
    return { created: false, skipped: "missing_ids" };
  }
  if (!isLatberEventDayReached(checkInAt)) {
    return { created: false, skipped: "event_day_future" };
  }

  const existingForEvent = await prisma.attendance.findFirst({
    where: {
      memberId: opts.memberId,
      eventId: opts.eventId,
      method: LATBER_ATTENDANCE_METHOD,
      isDeleted: false,
    },
    select: { id: true },
  });
  if (existingForEvent) {
    return { created: false, skipped: "already_credited", id: existingForEvent.id };
  }

  const dayKey = jakartaDayKey(checkInAt);
  const sameDay = await prisma.attendance.findMany({
    where: {
      memberId: opts.memberId,
      isDeleted: false,
    },
    select: { id: true, checkInAt: true, method: true },
    take: 80,
  });
  const gpsSameDay = sameDay.find(
    (row) =>
      jakartaDayKey(row.checkInAt) === dayKey &&
      !isLatberAttendanceMethod(row.method),
  );
  if (gpsSameDay) {
    return { created: false, skipped: "gps_same_day", id: gpsSameDay.id };
  }

  try {
    const created = await prisma.attendance.create({
      data: {
        memberId: opts.memberId,
        dojoId: opts.dojoId,
        eventId: opts.eventId,
        checkInAt,
        method: LATBER_ATTENDANCE_METHOD,
        isDeleted: false,
      },
      select: { id: true },
    });
    return { created: true, skipped: null, id: created.id };
  } catch (error) {
    console.error("[latber-attendance] create failed", error);
    return { created: false, skipped: "create_failed" };
  }
}

export async function removeLatberAttendanceCredit(
  memberId: string,
  eventId: string,
): Promise<number> {
  if (!memberId || !eventId) return 0;
  const result = await prisma.attendance.updateMany({
    where: {
      memberId,
      eventId,
      method: LATBER_ATTENDANCE_METHOD,
      isDeleted: false,
    },
    data: { isDeleted: true },
  });
  return result.count;
}

export async function creditLatberAttendanceForPaidRegistration(opts: {
  memberId: string;
  eventId: string;
  eventAt?: string | Date | null;
  dojoId?: string | null;
}): Promise<{ created: boolean; skipped: string | null }> {
  if (!opts.eventAt) return { created: false, skipped: "no_event_at" };
  const dojoId = opts.dojoId?.trim() || "";
  if (!dojoId) {
    const member = await prisma.member.findFirst({
      where: { id: opts.memberId, isDeleted: false },
      select: { dojoId: true },
    });
    if (!member?.dojoId) return { created: false, skipped: "no_dojo" };
    return ensureLatberAttendanceCredit({
      memberId: opts.memberId,
      eventId: opts.eventId,
      eventAt: opts.eventAt,
      dojoId: member.dojoId,
    });
  }
  return ensureLatberAttendanceCredit({
    memberId: opts.memberId,
    eventId: opts.eventId,
    eventAt: opts.eventAt,
    dojoId,
  });
}

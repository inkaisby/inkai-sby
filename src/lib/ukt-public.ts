import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { formatRankLabel, resolveUktRankColumns } from "@/lib/belt";
import { isLatberEventTitle } from "@/lib/latber";
import {
  buildUktExamResultMap,
  currentSemester,
  findUktPeriodForTerm,
  isUktPeriodActiveView,
  parseUktPeriodMetaValue,
  resolveUktDisplayStatus,
  uktDisplayStatusLabel,
  uktPeriodMetaKey,
  type UktDisplayStatus,
  type UktExamResult,
  type UktMemberRow,
  type UktPeriodMeta,
  type UktPeriodOption,
} from "@/lib/ukt";
import { loadUktSelfRegistrationMetaMap } from "@/lib/ukt-self-registration";

export type UktPublicPeriod = {
  periodId: string | null;
  title: string | null;
  semester: string | null;
  year: number | null;
  examAt: string | null;
  examLocation: string | null;
  archived: boolean;
  locked: boolean;
};

export type UktPublicRegistrant = {
  /** Opaque row key for React — bukan memberId publik. */
  id: string;
  photoUrl: string | null;
  nia: string | null;
  fullName: string;
  kyuLama: string;
  kyuBaru: string | null;
  ranting: string;
  status: UktDisplayStatus;
  statusLabel: string;
  /** Untuk cincin sabuk avatar. */
  rankForRing: string | null;
};

export type UktPublicPayload = {
  period: UktPublicPeriod;
  registrants: UktPublicRegistrant[];
};

function isUktEventTitle(title: string): boolean {
  const upper = String(title ?? "").toUpperCase();
  if (isLatberEventTitle(title)) return false;
  return upper.includes("UKT");
}

async function loadMetaForEvent(eventId: string): Promise<UktPeriodMeta> {
  try {
    const local = await prisma.appSetting.findUnique({
      where: { key: uktPeriodMetaKey(eventId) },
      select: { value: true },
    });
    if (local?.value != null) {
      return parseUktPeriodMetaValue(local.value);
    }
  } catch {
    /* ignore */
  }
  return { archived: false, locked: false };
}

/** Periode UKT non-arsip untuk term berjalan (locked tetap boleh tampil). */
export async function resolvePublicUktPeriod(): Promise<{
  period: UktPeriodOption | null;
  meta: UktPeriodMeta;
}> {
  const events = await prisma.event.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      registrationCloseAt: true,
      createdAt: true,
    },
    orderBy: { startDate: "desc" },
    take: 80,
  });

  const periods: UktPeriodOption[] = [];
  const metaById = new Map<string, UktPeriodMeta>();

  for (const e of events) {
    if (!isUktEventTitle(e.title)) continue;
    const meta = await loadMetaForEvent(e.id);
    metaById.set(e.id, meta);
    periods.push({
      id: e.id,
      title: e.title,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
      registrationCloseAt: e.registrationCloseAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
      archived: meta.archived,
      locked: meta.locked,
    });
  }

  const year = new Date().getFullYear();
  const semester = currentSemester();
  let selected =
    findUktPeriodForTerm(periods, semester, year) ??
    periods.find((p) => isUktPeriodActiveView(p)) ??
    null;

  // Prefer non-arsip; jangan drop hanya karena locked.
  if (selected?.archived) {
    selected =
      periods.find((p) => !p.archived && isUktPeriodActiveView(p)) ??
      periods.find((p) => !p.archived) ??
      null;
  }

  const meta = selected
    ? metaById.get(selected.id) ?? { archived: false, locked: false }
    : { archived: false, locked: false };

  return { period: selected, meta };
}

async function loadExamResultMap(
  periodId: string,
): Promise<Map<string, UktExamResult>> {
  const prefix = `ukt-exam-result:${periodId}:`;
  try {
    const rows = await prisma.appSetting.findMany({
      where: { key: { startsWith: prefix } },
      select: { key: true, value: true },
      take: 2000,
    });
    return buildUktExamResultMap(rows, periodId);
  } catch {
    return new Map();
  }
}

export async function loadUktPublicRegistrants(
  eventId: string,
): Promise<UktPublicRegistrant[]> {
  const regs = await prisma.eventRegistration.findMany({
    where: {
      eventId,
      status: { notIn: ["CANCELLED", "REJECTED"] },
    },
    select: {
      id: true,
      status: true,
      registeredRank: true,
      memberId: true,
      member: {
        select: {
          id: true,
          fullName: true,
          nia: true,
          currentRank: true,
          dojo: { select: { name: true } },
          user: { select: { photoUrl: true } },
        },
      },
      category: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 800,
  });

  if (regs.length === 0) return [];

  const regIds = regs.map((r) => r.id);
  const [billings, selfMetaMap, examMap] = await Promise.all([
    prisma.billing.findMany({
      where: {
        registrationId: { in: regIds },
        isDeleted: false,
        status: { notIn: ["CANCELLED"] },
      },
      select: {
        id: true,
        registrationId: true,
        amount: true,
        baseFeeAmount: true,
        status: true,
      },
      take: 800,
    }),
    loadUktSelfRegistrationMetaMap(eventId),
    loadExamResultMap(eventId),
  ]);

  const billingByReg = new Map(
    billings
      .filter((b) => b.registrationId)
      .map((b) => [b.registrationId!, b]),
  );

  const out: UktPublicRegistrant[] = [];
  for (const r of regs) {
    const billing = billingByReg.get(r.id);
    const selfMeta = selfMetaMap.get(r.memberId);
    const registeredRank =
      typeof r.registeredRank === "string" ? r.registeredRank : null;
    const { kyuLama, kyuBaru } = resolveUktRankColumns(
      registeredRank,
      r.member.currentRank,
      r.category?.name,
    );
    const examResult = examMap.get(r.id) ?? null;

    const row: UktMemberRow = {
      memberId: r.memberId,
      registrationId: r.id,
      photoUrl: r.member.user?.photoUrl ?? null,
      nia: r.member.nia,
      fullName: r.member.fullName,
      birthPlace: null,
      birthDate: null,
      gender: null,
      address: null,
      kyuLama: kyuLama || formatRankLabel(r.member.currentRank) || "—",
      kyuBaru: kyuBaru || null,
      memberCurrentRank: r.member.currentRank,
      birthCertificateUrl: null,
      bpjsCardUrl: null,
      dojoName: r.member.dojo?.name || "—",
      dojoId: "",
      status: r.status,
      billingId: billing?.id ?? null,
      billingStatus: billing?.status ?? null,
      billingAmount: billing?.amount ?? null,
      outstandingDues: 0,
      pendingVerifications: 0,
      attendanceCount: 0,
      attendancePct: 0,
      examResult,
      examPresent: null,
      selfRegistration: Boolean(selfMeta),
      memberPaymentConfirmedAt: selfMeta?.memberPaymentConfirmedAt ?? null,
    };

    const status = resolveUktDisplayStatus(row, examResult);
    out.push({
      id: r.id,
      photoUrl: row.photoUrl,
      nia: row.nia,
      fullName: row.fullName,
      kyuLama: row.kyuLama,
      kyuBaru: row.kyuBaru,
      ranting: row.dojoName,
      status,
      statusLabel: uktDisplayStatusLabel(status),
      rankForRing: row.kyuLama || row.memberCurrentRank || null,
    });
  }

  out.sort(
    (a, b) =>
      a.ranting.localeCompare(b.ranting, "id") ||
      a.fullName.localeCompare(b.fullName, "id"),
  );
  return out;
}

export const getUktPublicRoster = cache(
  async (): Promise<UktPublicPayload> => {
    const { period, meta } = await resolvePublicUktPeriod();
    if (!period) {
      return {
        period: {
          periodId: null,
          title: null,
          semester: null,
          year: null,
          examAt: null,
          examLocation: null,
          archived: false,
          locked: false,
        },
        registrants: [],
      };
    }

    const registrants = await loadUktPublicRegistrants(period.id);
    const parsed = period.title.match(/semester\s*(I|II)\s*[-/]\s*(\d{4})/i);

    return {
      period: {
        periodId: period.id,
        title: period.title,
        semester: parsed?.[1]?.toUpperCase() ?? null,
        year: parsed?.[2] ? parseInt(parsed[2], 10) : null,
        examAt: meta.examAt ?? null,
        examLocation: meta.examLocation ?? null,
        archived: Boolean(meta.archived),
        locked: Boolean(meta.locked),
      },
      registrants,
    };
  },
);

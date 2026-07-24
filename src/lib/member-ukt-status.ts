import { inkaiFetch } from "@/lib/inkai-api/server";
import {
  decodeUktRegisteredRank,
  formatRankLabel,
  ranksEqual,
  resolveUktRankColumns,
} from "@/lib/belt";
import {
  buildUktEventTitle,
  buildUktExamResultMap,
  currentSemester,
  findUktPeriodForTerm,
  findUktPeriodsForTerm,
  parseUktPeriodMetaValue,
  resolveUktDisplayStatus,
  uktDisplayStatusLabel,
  type UktDisplayStatus,
  type UktMemberRow,
  type UktPeriodOption,
  type UktRegistrationBlocker,
} from "@/lib/ukt";
import { fetchSettingsByPrefix } from "@/lib/inkai-api/admin-data";
import { loadUktSelfRegistrationMeta } from "@/lib/ukt-self-registration";
import { prisma } from "@/lib/prisma";

export type MemberUktStatusPayload = {
  period?: {
    id?: string;
    title?: string;
    semester?: string;
    year?: number;
    startDate?: string;
    endDate?: string;
  } | null;
  registered?: boolean;
  statusLabel?: string;
  displayStatus?: UktDisplayStatus;
  kyuLama?: string | null;
  kyuBaru?: string | null;
  examAt?: string | null;
  examLocation?: string | null;
  registrationId?: string;
  examResult?: string | null;
  canSelfRegister?: boolean;
  blockers?: UktRegistrationBlocker[];
  memberPaymentConfirmedAt?: string | null;
};

function filterUktEvents(events: Array<Record<string, unknown>>) {
  return events.filter((e) => String(e.title).toUpperCase().includes("UKT"));
}

/**
 * Status UKT periode aktif untuk kartu anggota.
 * Dioptimasi: parallel I/O, Prisma-first untuk mandiri, gate eligibility
 * ditunda ke klik daftar (bukan di setiap load kartu).
 */
export async function getMemberUktStatus(
  token: string,
  memberId: string,
  memberName?: string | null,
): Promise<MemberUktStatusPayload> {
  const year = new Date().getFullYear();
  const activeSemester = currentSemester();

  // Parallel: daftar event + meta periode (hindari waterfall)
  const [eventsResult, metaRows] = await Promise.all([
    inkaiFetch("/v1/events?limit=200", {}, token, {
      timeoutMs: 8_000,
      retries: 0,
    }),
    fetchSettingsByPrefix(token, "ukt-period-meta:"),
  ]);

  if (!eventsResult.res.ok) {
    return { period: null, statusLabel: undefined };
  }

  const metaById = new Map(
    metaRows.map((row) => [
      row.key.slice("ukt-period-meta:".length),
      parseUktPeriodMetaValue(row.value),
    ]),
  );

  let periods: UktPeriodOption[] = filterUktEvents(
    (eventsResult.data.data as Array<Record<string, unknown>>) ?? [],
  ).map((p) => {
    const id = String(p.id);
    const meta = metaById.get(id);
    return {
      id,
      title: String(p.title),
      startDate: String(p.startDate),
      endDate: String(p.endDate),
      registrationCloseAt: p.registrationCloseAt
        ? String(p.registrationCloseAt)
        : null,
      createdAt: p.createdAt ? String(p.createdAt) : undefined,
      archived: meta?.archived === true,
      locked: meta?.locked === true,
    };
  });

  const termPeriods = findUktPeriodsForTerm(periods, activeSemester, year);
  const activeTermPeriods = termPeriods.filter((p) => !p.archived && !p.locked);
  const match =
    findUktPeriodForTerm(
      activeTermPeriods.length > 0 ? activeTermPeriods : [],
      activeSemester,
      year,
    ) ??
    activeTermPeriods[0] ??
    null;

  if (!match) {
    return {
      period: {
        title: buildUktEventTitle(activeSemester, year),
        semester: activeSemester,
        year,
      },
      registered: false,
      statusLabel:
        termPeriods.length > 0
          ? "Menunggu periode UKT baru"
          : "Periode belum dibuka",
      displayStatus: "belum_daftar",
      canSelfRegister: false,
      blockers: ["PERIODE_BELUM_BUKA"],
    };
  }

  const periodMeta = metaById.get(match.id) ?? parseUktPeriodMetaValue(null);
  const examPayload = {
    examAt: periodMeta.examAt ?? null,
    examLocation: periodMeta.examLocation ?? null,
  };

  // Parallel Prisma: registrasi lokal + meta mandiri (cepat, tanpa Inkai)
  const [selfMeta, localReg] = await Promise.all([
    loadUktSelfRegistrationMeta(match.id, memberId),
    prisma.eventRegistration.findFirst({
      where: {
        eventId: match.id,
        memberId,
        status: { notIn: ["CANCELLED"] },
      },
      select: {
        id: true,
        status: true,
        registeredRank: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Fast path: PENDING mandiri — cukup Prisma, tanpa event detail / eligibility / exam
  if (localReg && localReg.status === "PENDING") {
    const decoded = decodeUktRegisteredRank(
      typeof localReg.registeredRank === "string"
        ? localReg.registeredRank
        : null,
    );
    const row: UktMemberRow = {
      memberId,
      registrationId: localReg.id,
      photoUrl: null,
      nia: null,
      fullName: memberName ?? "",
      birthPlace: null,
      birthDate: null,
      gender: null,
      address: null,
      kyuLama: decoded.kyuLama || "",
      kyuBaru: decoded.kyuBaru,
      birthCertificateUrl: null,
      bpjsCardUrl: null,
      dojoName: "—",
      dojoId: "",
      status: "PENDING",
      billingId: null,
      billingStatus: null,
      billingAmount: null,
      outstandingDues: 0,
      pendingVerifications: 0,
      attendanceCount: 0,
      attendancePct: null,
      examResult: null,
      examPresent: null,
      selfRegistration: true,
      memberPaymentConfirmedAt: selfMeta?.memberPaymentConfirmedAt ?? null,
    };
    const displayStatus = resolveUktDisplayStatus(row);
    return {
      period: match,
      registered: true,
      registrationId: localReg.id,
      kyuLama: row.kyuLama || null,
      kyuBaru: row.kyuBaru ?? null,
      displayStatus,
      statusLabel: uktDisplayStatusLabel(displayStatus),
      examResult: null,
      memberPaymentConfirmedAt: row.memberPaymentConfirmedAt ?? null,
      canSelfRegister: false,
      blockers: [],
      ...examPayload,
    };
  }

  // Belum daftar: jangan panggil eligibility berat di load kartu — gate di POST daftar
  if (!localReg) {
    return {
      period: match,
      registered: false,
      statusLabel: periodMeta.archived
        ? "Periode diarsipkan"
        : "Belum terdaftar",
      displayStatus: "belum_daftar",
      canSelfRegister: !periodMeta.archived && !periodMeta.locked,
      blockers: [],
      ...examPayload,
    };
  }

  // Terdaftar APPROVED+: billing Prisma + exam result (parallel), tanpa dump semua registrasi Inkai
  const [localBilling, examSettings, memberLocal] = await Promise.all([
    prisma.billing.findFirst({
      where: {
        registrationId: localReg.id,
        isDeleted: false,
      },
      select: { id: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
    fetchSettingsByPrefix(token, `ukt-exam-result:${match.id}:`),
    prisma.member.findFirst({
      where: { id: memberId },
      select: { fullName: true, currentRank: true },
    }),
  ]);

  const examMap = buildUktExamResultMap(examSettings, match.id);
  const registeredRank =
    typeof localReg.registeredRank === "string"
      ? localReg.registeredRank
      : null;
  const decoded = decodeUktRegisteredRank(registeredRank);
  const memberRank = memberLocal?.currentRank
    ? String(memberLocal.currentRank)
    : null;
  const kyuBaruHint = decoded.kyuBaru || null;
  const billingStatus = localBilling?.status
    ? String(localBilling.status)
    : null;
  const paid =
    billingStatus === "PAID" ||
    billingStatus === "SUCCESS" ||
    localReg.status === "PAID" ||
    localReg.status === "SUCCESS";
  const lockSnapshot = Boolean(
    paid &&
      kyuBaruHint &&
      ranksEqual(memberRank, kyuBaruHint) &&
      decoded.kyuLama &&
      !ranksEqual(decoded.kyuLama, kyuBaruHint),
  );
  const { kyuLama, kyuBaru } = resolveUktRankColumns(
    registeredRank,
    memberRank,
    null,
    { lockSnapshot },
  );

  const row: UktMemberRow = {
    memberId,
    registrationId: localReg.id,
    photoUrl: null,
    nia: null,
    fullName: String(memberLocal?.fullName ?? memberName ?? ""),
    birthPlace: null,
    birthDate: null,
    gender: null,
    address: null,
    kyuLama,
    kyuBaru,
    memberCurrentRank: formatRankLabel(memberRank) || memberRank,
    birthCertificateUrl: null,
    bpjsCardUrl: null,
    dojoName: "—",
    dojoId: "",
    status: localReg.status,
    billingId: localBilling?.id ?? null,
    billingStatus,
    billingAmount: null,
    outstandingDues: 0,
    pendingVerifications: 0,
    attendanceCount: 0,
    attendancePct: null,
    examResult: examMap.get(localReg.id) ?? null,
    examPresent: null,
    selfRegistration: Boolean(selfMeta),
    memberPaymentConfirmedAt: selfMeta?.memberPaymentConfirmedAt ?? null,
  };

  const displayStatus = resolveUktDisplayStatus(row);

  return {
    period: match,
    registered: true,
    registrationId: row.registrationId || undefined,
    kyuLama: row.kyuLama ?? null,
    kyuBaru: row.kyuBaru ?? null,
    displayStatus,
    statusLabel: uktDisplayStatusLabel(displayStatus),
    examResult: (row.examResult as string | null) ?? null,
    memberPaymentConfirmedAt: row.memberPaymentConfirmedAt ?? null,
    canSelfRegister: false,
    blockers: [],
    ...examPayload,
  };
}

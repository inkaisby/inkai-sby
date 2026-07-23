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
} from "@/lib/ukt";
import { fetchSettingsByPrefix } from "@/lib/inkai-api/admin-data";
import { loadUktPeriodMeta } from "@/lib/ukt-period-meta-store";

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
};

function filterUktEvents(events: Array<Record<string, unknown>>) {
  return events.filter((e) => String(e.title).toUpperCase().includes("UKT"));
}

/** Status UKT periode aktif untuk kartu anggota (shared API + RSC). */
export async function getMemberUktStatus(
  token: string,
  memberId: string,
  memberName?: string | null,
): Promise<MemberUktStatusPayload> {
  const year = new Date().getFullYear();
  const activeSemester = currentSemester();

  const { res, data } = await inkaiFetch("/v1/events?limit=200", {}, token);
  if (!res.ok) {
    return { period: null, statusLabel: undefined };
  }

  let periods: UktPeriodOption[] = filterUktEvents(
    (data.data as Array<Record<string, unknown>>) ?? [],
  ).map((p) => ({
    id: String(p.id),
    title: String(p.title),
    startDate: String(p.startDate),
    endDate: String(p.endDate),
    registrationCloseAt: p.registrationCloseAt
      ? String(p.registrationCloseAt)
      : null,
    createdAt: p.createdAt ? String(p.createdAt) : undefined,
  }));

  const metaRows = await fetchSettingsByPrefix(token, "ukt-period-meta:");
  const metaById = new Map(
    metaRows.map((row) => [
      row.key.slice("ukt-period-meta:".length),
      parseUktPeriodMetaValue(row.value),
    ]),
  );
  periods = periods.map((p) => {
    const meta = metaById.get(p.id);
    return {
      ...p,
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
    };
  }

  const periodMeta =
    metaById.get(match.id) ?? (await loadUktPeriodMeta(token, match.id));
  const examPayload = {
    examAt: periodMeta.examAt ?? null,
    examLocation: periodMeta.examLocation ?? null,
  };

  const { res: detailRes, data: detailData } = await inkaiFetch(
    `/v1/events/${match.id}`,
    {},
    token,
  );
  if (!detailRes.ok) {
    return {
      period: match,
      registered: false,
      statusLabel: "—",
      ...examPayload,
    };
  }

  const event = detailData.data as Record<string, unknown>;
  const registrations =
    (event.registrations as Array<Record<string, unknown>>) ?? [];
  const reg = registrations.find(
    (r) =>
      String((r.member as { id?: string })?.id ?? r.memberId) === memberId,
  );

  if (!reg) {
    return {
      period: match,
      registered: false,
      statusLabel: periodMeta.archived
        ? "Periode diarsipkan"
        : "Belum terdaftar",
      displayStatus: "belum_daftar",
      ...examPayload,
    };
  }

  const examSettings = await fetchSettingsByPrefix(
    token,
    `ukt-exam-result:${match.id}:`,
  );
  const examMap = buildUktExamResultMap(examSettings, match.id);
  const member = reg.member as Record<string, unknown> | undefined;
  const billings = (member?.billings as Array<Record<string, unknown>>) ?? [];
  const billing =
    billings.find((b) => b.registrationId === reg.id) ?? billings[0];
  const category = reg.category as { name?: string } | null | undefined;
  const registeredRank =
    typeof reg.registeredRank === "string" ? reg.registeredRank : null;
  const decoded = decodeUktRegisteredRank(registeredRank);
  const memberRank = member?.currentRank ? String(member.currentRank) : null;
  const kyuBaruHint = decoded.kyuBaru || category?.name || null;
  const billingStatus = billing?.status ? String(billing.status) : null;
  const paid =
    billingStatus === "PAID" ||
    billingStatus === "SUCCESS" ||
    String(reg.status ?? "") === "PAID" ||
    String(reg.status ?? "") === "SUCCESS";
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
    category?.name,
    { lockSnapshot },
  );

  const row: UktMemberRow = {
    memberId,
    registrationId: String(reg.id),
    photoUrl: null,
    nia: null,
    fullName: String(member?.fullName ?? memberName ?? ""),
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
    status: String(reg.status ?? ""),
    billingId: billing?.id ? String(billing.id) : null,
    billingStatus: billing?.status ? String(billing.status) : null,
    billingAmount: billing?.amount != null ? Number(billing.amount) : null,
    outstandingDues: 0,
    pendingVerifications: 0,
    attendanceCount: 0,
    attendancePct: null,
    examResult: examMap.get(String(reg.id)) ?? null,
    examPresent: null,
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
    ...examPayload,
  };
}

import { inkaiFetch } from "@/lib/inkai-api/server";
import { formatRankLabel } from "@/lib/belt";
import {
  findActiveLatberPeriod,
  isLatberEventTitle,
  isLatberRegistrationOpen,
  latberDisplayStatusLabel,
  parseLatberPeriodMetaValue,
  periodOptionFromLatberEvent,
  resolveLatberDisplayStatus,
  type LatberDisplayStatus,
  type LatberMemberRow,
  type LatberPeriodOption,
} from "@/lib/latber";
import { fetchSettingsByPrefix } from "@/lib/inkai-api/admin-data";
import { loadLatberSelfRegistrationMeta } from "@/lib/latber-self-registration";
import { prisma } from "@/lib/prisma";

export type MemberLatberStatusPayload = {
  period?: LatberPeriodOption | null;
  registered?: boolean;
  statusLabel?: string;
  displayStatus?: LatberDisplayStatus;
  currentRank?: string | null;
  eventAt?: string | null;
  eventLocation?: string | null;
  registrationId?: string;
  feeAmount?: number;
  canSelfRegister?: boolean;
  memberPaymentConfirmedAt?: string | null;
};

/**
 * Status Latber periode aktif untuk kartu anggota.
 */
export async function getMemberLatberStatus(
  token: string,
  memberId: string,
  memberName?: string | null,
): Promise<MemberLatberStatusPayload> {
  const [eventsResult, metaRows] = await Promise.all([
    inkaiFetch("/v1/events?limit=200", {}, token, {
      timeoutMs: 8_000,
      retries: 0,
    }),
    fetchSettingsByPrefix(token, "latber-period-meta:"),
  ]);

  if (!eventsResult.res.ok) {
    return { period: null, statusLabel: undefined };
  }

  const metaById = new Map(
    metaRows.map((row) => [
      row.key.slice("latber-period-meta:".length),
      parseLatberPeriodMetaValue(row.value),
    ]),
  );

  const periods: LatberPeriodOption[] = (
    (eventsResult.data.data as Array<Record<string, unknown>>) ?? []
  )
    .filter((e) => isLatberEventTitle(String(e.title ?? "")))
    .map((e) => {
      const opt = periodOptionFromLatberEvent(e);
      const meta = metaById.get(opt.id);
      return {
        ...opt,
        archived: meta?.archived === true,
        locked: meta?.locked === true,
      };
    });

  const match = findActiveLatberPeriod(periods);

  if (!match) {
    return {
      period: null,
      registered: false,
      statusLabel: "Periode Latber belum dibuka",
      displayStatus: "belum_daftar",
      canSelfRegister: false,
    };
  }

  const periodMeta = metaById.get(match.id) ?? { archived: false, locked: false };
  const feeAmount = periodMeta.feeAmount ?? 45_000;

  const [selfMeta, localReg, memberLocal] = await Promise.all([
    loadLatberSelfRegistrationMeta(match.id, memberId),
    prisma.eventRegistration.findFirst({
      where: {
        eventId: match.id,
        memberId,
        status: { notIn: ["CANCELLED"] },
      },
      select: { id: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.member.findFirst({
      where: { id: memberId },
      select: { fullName: true, currentRank: true },
    }),
  ]);

  const examPayload = {
    eventAt: periodMeta.eventAt ?? null,
    eventLocation: periodMeta.eventLocation ?? null,
  };

  if (!localReg) {
    const schedule = {
      startDate: match.startDate ?? "",
      endDate: match.endDate ?? match.startDate ?? "",
      registrationCloseAt: match.registrationCloseAt,
      registrationOpenAt: periodMeta.registrationOpenAt,
    };
    const open =
      !periodMeta.archived &&
      !periodMeta.locked &&
      isLatberRegistrationOpen(schedule);
    return {
      period: match,
      registered: false,
      statusLabel: periodMeta.archived ? "Periode diarsipkan" : "Belum terdaftar",
      displayStatus: "belum_daftar",
      canSelfRegister: open,
      feeAmount,
      ...examPayload,
    };
  }

  const localBilling = await prisma.billing.findFirst({
    where: {
      registrationId: localReg.id,
      isDeleted: false,
    },
    select: { id: true, status: true, amount: true },
    orderBy: { createdAt: "desc" },
  });

  const row: LatberMemberRow = {
    memberId,
    registrationId: localReg.id,
    fullName: String(memberLocal?.fullName ?? memberName ?? ""),
    currentRank: memberLocal?.currentRank ?? null,
    dojoId: "",
    status: localReg.status,
    billingId: localBilling?.id ?? null,
    billingStatus: localBilling?.status ?? null,
    billingAmount: localBilling?.amount ?? feeAmount,
    selfRegistration: localReg.status === "PENDING" || Boolean(selfMeta),
    memberPaymentConfirmedAt: selfMeta?.memberPaymentConfirmedAt ?? null,
  };

  const displayStatus = resolveLatberDisplayStatus(row);

  return {
    period: match,
    registered: true,
    registrationId: localReg.id,
    currentRank:
      formatRankLabel(memberLocal?.currentRank) ||
      memberLocal?.currentRank ||
      null,
    displayStatus,
    statusLabel: latberDisplayStatusLabel(displayStatus),
    feeAmount: localBilling?.amount ?? feeAmount,
    memberPaymentConfirmedAt: row.memberPaymentConfirmedAt ?? null,
    canSelfRegister: false,
    ...examPayload,
  };
}

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { formatRankLabel } from "@/lib/belt";
import {
  DEFAULT_LATBER_FEE,
  LATBER_PAYMENT,
  findActiveLatberPeriod,
  isLatberEventTitle,
  isLatberRegistrationOpen,
  latberDisplayStatusLabel,
  latberPeriodMetaKey,
  parseLatberPeriodMetaValue,
  periodOptionFromLatberEvent,
  resolveLatberDisplayStatus,
  resolveLatberPeriodFees,
  type LatberMemberRow,
  type LatberPaymentInfo,
  type LatberPeriodMeta,
  type LatberPeriodOption,
} from "@/lib/latber";
import { getLatberInvitePublic } from "@/lib/latber-invite";
import { inkaiFetch } from "@/lib/inkai-api/server";
import {
  latberSelfRegistrationKey,
  parseLatberSelfRegistrationMeta,
} from "@/lib/latber-self-registration";
import { getBranchDojosList } from "@/lib/public-data";
import { getBranchOrgProfile } from "@/lib/org-settings";

export type LatberPublicPeriodPayload = {
  periodId: string | null;
  title: string | null;
  registrationOpen: boolean;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  eventAt: string | null;
  eventLocation: string | null;
  feeAmount: number;
  paymentEnabled: boolean;
  payment: LatberPaymentInfo;
  dojos: Array<{ id: string; name: string }>;
};

async function resolveLatberPublicPayment(): Promise<LatberPaymentInfo> {
  const fromConst = {
    bankName: LATBER_PAYMENT.bankName.trim(),
    bankAccountNumber: LATBER_PAYMENT.bankAccountNumber.trim(),
    bankAccountName: LATBER_PAYMENT.bankAccountName.trim(),
    paymentInstructions: LATBER_PAYMENT.paymentInstructions.trim(),
    qrisImageUrl: LATBER_PAYMENT.qrisImageUrl,
    qrisTrialNote: LATBER_PAYMENT.qrisTrialNote,
    qrisExpiresAtLabel: LATBER_PAYMENT.qrisExpiresAtLabel,
  };
  if (
    fromConst.bankName &&
    fromConst.bankAccountNumber &&
    fromConst.bankAccountName
  ) {
    return fromConst;
  }
  const profile = await getBranchOrgProfile();
  return {
    bankName: fromConst.bankName || profile.bankName.trim(),
    bankAccountNumber:
      fromConst.bankAccountNumber || profile.bankAccountNumber.trim(),
    bankAccountName:
      fromConst.bankAccountName || profile.bankAccountName.trim(),
    paymentInstructions:
      fromConst.paymentInstructions ||
      profile.paymentInstructions.trim() ||
      "",
    qrisImageUrl: fromConst.qrisImageUrl,
    qrisTrialNote: fromConst.qrisTrialNote,
    qrisExpiresAtLabel: fromConst.qrisExpiresAtLabel,
  };
}

export type LatberPublicRegistrant = {
  memberId: string;
  registrationId: string;
  nia: string | null;
  fullName: string;
  dojoName: string;
  currentRank: string | null;
  amount: number;
  statusLabel: string;
  displayStatus: string;
};

async function loadMetaForEvent(
  eventId: string,
): Promise<LatberPeriodMeta> {
  try {
    const local = await prisma.appSetting.findUnique({
      where: { key: latberPeriodMetaKey(eventId) },
      select: { value: true },
    });
    if (local?.value) {
      return parseLatberPeriodMetaValue(local.value);
    }
  } catch {
    /* fall through */
  }
  try {
    const { res, data } = await inkaiFetch(
      `/v1/settings/${encodeURIComponent(latberPeriodMetaKey(eventId))}`,
      {},
      null,
      { timeoutMs: 5_000, retries: 0 },
    );
    if (res.ok) {
      return parseLatberPeriodMetaValue(
        (data.data as { value?: unknown } | undefined)?.value ?? null,
      );
    }
  } catch {
    /* ignore */
  }
  return { archived: false, locked: false };
}

export async function resolveActiveLatberPeriodId(
  periodFromUrl?: string | null,
): Promise<{
  period: LatberPeriodOption | null;
  meta: LatberPeriodMeta;
}> {
  const events = await prisma.event.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      registrationCloseAt: true,
      location: true,
    },
    orderBy: { startDate: "desc" },
    take: 80,
  });

  const latberEvents = events.filter((e) => isLatberEventTitle(e.title));
  const periods: LatberPeriodOption[] = [];
  const metaById = new Map<string, LatberPeriodMeta>();

  for (const e of latberEvents) {
    const meta = await loadMetaForEvent(e.id);
    metaById.set(e.id, meta);
    periods.push({
      id: e.id,
      title: e.title,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
      registrationCloseAt: e.registrationCloseAt?.toISOString() ?? null,
      archived: meta.archived,
      locked: meta.locked,
    });
  }

  let selected: LatberPeriodOption | null = null;
  if (periodFromUrl) {
    selected = periods.find((p) => p.id === periodFromUrl) ?? null;
  }
  if (!selected) {
    selected = findActiveLatberPeriod(periods);
  }

  const meta = selected
    ? metaById.get(selected.id) ?? { archived: false, locked: false }
    : { archived: false, locked: false };

  return { period: selected, meta };
}

export const getLatberPublicPeriod = cache(
  async (periodFromUrl?: string | null): Promise<LatberPublicPeriodPayload> => {
    const [dojosRaw, payment] = await Promise.all([
      getBranchDojosList(),
      resolveLatberPublicPayment(),
    ]);
    const dojos = dojosRaw.map((d) => ({ id: d.id, name: d.name }));
    const paymentEnabled = Boolean(
      payment.bankAccountNumber.trim() || payment.qrisImageUrl,
    );

    const { period, meta } = await resolveActiveLatberPeriodId(periodFromUrl);
    if (!period) {
      return {
        periodId: null,
        title: null,
        registrationOpen: false,
        registrationOpenAt: null,
        registrationCloseAt: null,
        eventAt: null,
        eventLocation: null,
        feeAmount: DEFAULT_LATBER_FEE,
        paymentEnabled,
        payment,
        dojos,
      };
    }

    const invite = await getLatberInvitePublic(period.id);
    const fees = resolveLatberPeriodFees(meta);
    const schedule = {
      startDate: period.startDate ?? "",
      endDate: period.endDate ?? period.startDate ?? "",
      registrationCloseAt: period.registrationCloseAt,
      registrationOpenAt: meta.registrationOpenAt ?? null,
    };
    const registrationOpen =
      !meta.archived &&
      !meta.locked &&
      isLatberRegistrationOpen(schedule);

    return {
      periodId: period.id,
      title: period.title,
      registrationOpen,
      registrationOpenAt:
        invite?.registrationOpenAt ?? meta.registrationOpenAt ?? null,
      registrationCloseAt:
        invite?.registrationCloseAt ?? period.registrationCloseAt ?? null,
      eventAt: invite?.eventAt ?? meta.eventAt ?? null,
      eventLocation:
        invite?.eventLocation ?? meta.eventLocation ?? null,
      feeAmount: fees.feeAmount,
      paymentEnabled,
      payment,
      dojos,
    };
  },
);

export async function validateLatberPublicEligibility(
  eventId: string,
): Promise<{ ok: true; meta: LatberPeriodMeta; title: string } | { ok: false; error: string }> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, isDeleted: false },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      registrationCloseAt: true,
    },
  });
  if (!event || !isLatberEventTitle(event.title)) {
    return { ok: false, error: "Periode Latihan Bersama tidak ditemukan" };
  }

  const meta = await loadMetaForEvent(eventId);
  if (meta.archived || meta.locked) {
    return { ok: false, error: "Periode Latihan Bersama sudah ditutup" };
  }

  const schedule = {
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    registrationCloseAt: event.registrationCloseAt?.toISOString() ?? null,
    registrationOpenAt: meta.registrationOpenAt ?? null,
  };
  if (!isLatberRegistrationOpen(schedule)) {
    return {
      ok: false,
      error: "Pendaftaran Latihan Bersama belum dibuka atau sudah ditutup",
    };
  }

  return { ok: true, meta, title: event.title };
}

export async function loadLatberPublicRegistrants(
  eventId: string,
): Promise<LatberPublicRegistrant[]> {
  const fees = resolveLatberPeriodFees(await loadMetaForEvent(eventId));

  const regs = await prisma.eventRegistration.findMany({
    where: {
      eventId,
      status: { notIn: ["CANCELLED", "REJECTED"] },
    },
    select: {
      id: true,
      status: true,
      memberId: true,
      member: {
        select: {
          id: true,
          fullName: true,
          nia: true,
          currentRank: true,
          dojo: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (regs.length === 0) return [];

  const regIds = regs.map((r) => r.id);
  const memberIds = regs.map((r) => r.memberId);

  const [billings, selfMetaRows] = await Promise.all([
    prisma.billing.findMany({
      where: {
        registrationId: { in: regIds },
        isDeleted: false,
        status: { notIn: ["CANCELLED"] },
      },
      select: {
        registrationId: true,
        amount: true,
        baseFeeAmount: true,
        status: true,
        id: true,
      },
    }),
    prisma.appSetting.findMany({
      where: {
        key: {
          in: memberIds.map((id) => latberSelfRegistrationKey(eventId, id)),
        },
      },
      select: { key: true, value: true },
    }),
  ]);

  const billingByReg = new Map(
    billings
      .filter((b) => b.registrationId)
      .map((b) => [b.registrationId!, b]),
  );
  const selfByMember = new Map<string, ReturnType<typeof parseLatberSelfRegistrationMeta>>();
  for (const row of selfMetaRows) {
    const memberId = row.key.slice(latberSelfRegistrationKey(eventId, "").length);
    selfByMember.set(memberId, parseLatberSelfRegistrationMeta(row.value));
  }

  return regs.map((r) => {
    const billing = billingByReg.get(r.id);
    const selfMeta = selfByMember.get(r.memberId);
    const row: LatberMemberRow = {
      memberId: r.memberId,
      registrationId: r.id,
      nia: r.member.nia,
      fullName: r.member.fullName,
      currentRank: r.member.currentRank,
      dojoId: "",
      dojoName: r.member.dojo?.name ?? "—",
      status: r.status,
      billingId: billing?.id ?? null,
      billingAmount: billing?.amount ?? fees.feeAmount,
      billingStatus: billing?.status ?? null,
      selfRegistration: Boolean(selfMeta),
      memberPaymentConfirmedAt: selfMeta?.memberPaymentConfirmedAt ?? null,
    };
    const displayStatus = resolveLatberDisplayStatus(row);
    return {
      memberId: r.memberId,
      registrationId: r.id,
      nia: r.member.nia,
      fullName: r.member.fullName,
      dojoName: r.member.dojo?.name ?? "—",
      currentRank:
        formatRankLabel(r.member.currentRank) || r.member.currentRank || null,
      amount: billing?.amount ?? fees.feeAmount,
      statusLabel: latberDisplayStatusLabel(displayStatus),
      displayStatus,
    };
  });
}

export { parseMemberCardScanPayload } from "@/lib/latber-card-scan";
export { periodOptionFromLatberEvent };

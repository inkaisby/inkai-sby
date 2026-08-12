import { prisma } from "@/lib/prisma";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { getPrimaryAdminRole } from "@/lib/rbac";
import type { SessionUser } from "@/lib/rbac";
import { fetchAdminDojosScopedCached } from "@/lib/inkai-api/admin-data";
import {
  DEFAULT_LATBER_FEE,
  DEFAULT_LATBER_KOMISI_RANTING,
  findActiveLatberPeriod,
  isLatberEventTitle,
  parseLatberPeriodMetaValue,
  periodOptionFromLatberEvent,
  resolveLatberDisplayStatus,
  resolveLatberPeriodFees,
  type LatberMemberRow,
  type LatberPeriodMeta,
  type LatberPeriodOption,
} from "@/lib/latber";

const LATBER_INKAI = { timeoutMs: 12_000, retries: 0 } as const;

function filterLatberEvents(events: Array<Record<string, unknown>>) {
  return events.filter((e) => isLatberEventTitle(String(e.title ?? "")));
}

async function fetchLatberEvents(token: string) {
  const { res, data } = await inkaiFetch("/v1/events", {}, token, LATBER_INKAI);
  if (!res.ok) return [] as Array<Record<string, unknown>>;
  return filterLatberEvents((data.data as Array<Record<string, unknown>>) ?? []);
}

async function fetchSettingsByPrefix(token: string, prefix: string) {
  const { res, data } = await inkaiFetch(
    `/v1/settings?prefix=${encodeURIComponent(prefix)}`,
    {},
    token,
    LATBER_INKAI,
  );
  if (!res.ok) return [] as Array<{ key: string; value: unknown }>;
  return ((data.data as Array<{ key: string; value: unknown }>) ?? []).filter(
    (r) => r.key?.startsWith(prefix),
  );
}

export type LatberAdminViewMode = "registration" | "archive";

export async function fetchLatberDashboardData(
  token: string,
  user: SessionUser,
  opts: {
    periodFromUrl?: string | null;
    forceNoPeriod?: boolean;
    viewMode?: LatberAdminViewMode;
  },
) {
  const { periodFromUrl = null, forceNoPeriod = false, viewMode = "registration" } =
    opts;
  const primaryRole = getPrimaryAdminRole(user.roles);
  const dojoAllowlist =
    primaryRole === "ADMIN_DOJO"
      ? user.managedDojoIds?.length
        ? user.managedDojoIds
        : user.managedDojoId
          ? [user.managedDojoId]
          : []
      : [];

  const rantingAllowlistEmpty =
    primaryRole === "ADMIN_DOJO" && dojoAllowlist.length === 0;

  const [eventsRaw, dojosScoped, periodMetaRows] = await Promise.all([
    fetchLatberEvents(token),
    fetchAdminDojosScopedCached(user),
    fetchSettingsByPrefix(token, "latber-period-meta:"),
  ]);

  let dojos = dojosScoped;
  if (dojoAllowlist.length > 0) {
    dojos = dojosScoped.filter((d) => dojoAllowlist.includes(d.id));
  }

  const metaByPeriodId = new Map<string, LatberPeriodMeta>();
  for (const row of periodMetaRows) {
    const id = row.key.slice("latber-period-meta:".length);
    if (id) metaByPeriodId.set(id, parseLatberPeriodMetaValue(row.value));
  }

  let periods: LatberPeriodOption[] = eventsRaw.map((e) => {
    const opt = periodOptionFromLatberEvent(e);
    const meta = metaByPeriodId.get(opt.id);
    return {
      ...opt,
      archived: meta?.archived === true,
      locked: meta?.locked === true,
    };
  });

  let selectedPeriodId = forceNoPeriod ? null : periodFromUrl;
  if (!selectedPeriodId && !forceNoPeriod) {
    if (viewMode === "archive") {
      const archived = periods.filter((p) => p.archived || p.locked);
      selectedPeriodId = archived[0]?.id ?? null;
    } else {
      selectedPeriodId = findActiveLatberPeriod(periods)?.id ?? periods[0]?.id ?? null;
    }
  }

  const periodMeta: LatberPeriodMeta = selectedPeriodId
    ? (metaByPeriodId.get(selectedPeriodId) ?? { archived: false, locked: false })
    : { archived: false, locked: false };

  const fees = resolveLatberPeriodFees(periodMeta);

  let rows: LatberMemberRow[] = [];
  if (selectedPeriodId && !rantingAllowlistEmpty) {
    const registrations = await prisma.eventRegistration.findMany({
      where: {
        eventId: selectedPeriodId,
        status: { notIn: ["REJECTED"] },
        member: {
          isDeleted: false,
          ...(dojoAllowlist.length > 0 ? { dojoId: { in: dojoAllowlist } } : {}),
        },
      },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            nia: true,
            currentRank: true,
            dojoId: true,
            dojo: { select: { name: true } },
            user: { select: { photoUrl: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const billingByReg = new Map<
      string,
      { id: string; amount: number; status: string }
    >();
    if (registrations.length > 0) {
      const billings = await prisma.billing.findMany({
        where: {
          registrationId: { in: registrations.map((r) => r.id) },
          isDeleted: false,
        },
        select: { id: true, registrationId: true, amount: true, status: true },
      });
      for (const b of billings) {
        if (b.registrationId) billingByReg.set(b.registrationId, b);
      }
    }

    rows = registrations.map((reg) => {
      const m = reg.member;
      const bill = billingByReg.get(reg.id);
      const isPending = reg.status === "PENDING";
      return {
        memberId: m.id,
        registrationId: reg.id,
        nia: m.nia,
        fullName: m.fullName,
        currentRank: m.currentRank,
        dojoId: m.dojoId,
        dojoName: m.dojo?.name ?? null,
        photoUrl: m.user?.photoUrl ?? null,
        status: reg.status,
        billingId: bill?.id ?? null,
        billingAmount: bill?.amount ?? fees.feeAmount,
        billingStatus: bill?.status ?? (isPending ? null : "PENDING"),
        selfRegistration: isPending,
        memberPaymentConfirmedAt: null,
      };
    });
  }

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId) ?? null;

  return {
    periods,
    selectedPeriodId,
    selectedPeriod,
    periodMeta,
    feeAmount: fees.feeAmount,
    komisiRanting: fees.komisiRanting,
    rows,
    dojos,
    primaryRole,
    rantingAllowlistEmpty,
    dbError: false as boolean,
  };
}

export function countLatberKpis(rows: LatberMemberRow[]) {
  let belumBayar = 0;
  let menungguVerifikasi = 0;
  let lunas = 0;
  let menungguTerima = 0;
  for (const r of rows) {
    const s = resolveLatberDisplayStatus(r);
    if (s === "belum_bayar") belumBayar++;
    else if (s === "menunggu_verifikasi") menungguVerifikasi++;
    else if (s === "lunas") lunas++;
    else if (
      s === "menunggu_terima_ranting" ||
      s === "menunggu_konfirmasi_ranting"
    ) {
      menungguTerima++;
    }
  }
  return { belumBayar, menungguVerifikasi, lunas, menungguTerima, total: rows.length };
}

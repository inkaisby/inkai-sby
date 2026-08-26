import { prisma, withPrismaFallback } from "@/lib/prisma";
import { memberPhotoSelect } from "@/lib/prisma-columns";
import { resolveMemberPhotoUrl } from "@/lib/member-photo";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { getPrimaryAdminRole } from "@/lib/rbac";
import type { SessionUser } from "@/lib/rbac";
import { fetchAdminDojosScopedCached, fetchEventDetail } from "@/lib/inkai-api/admin-data";
import {
  findActiveLatberPeriod,
  isLatberEventTitle,
  isLatberRegistrationOpen,
  latberPeriodMetaKey,
  parseLatberPeriodMetaValue,
  periodOptionFromLatberEvent,
  resolveLatberDisplayStatus,
  resolveLatberPeriodFees,
  type LatberMemberRow,
  type LatberPeriodMeta,
  type LatberPeriodOption,
} from "@/lib/latber";
import {
  latberSelfRegistrationKey,
  parseLatberSelfRegistrationMeta,
} from "@/lib/latber-self-registration";
import {
  mergeLatberPeriodMeta,
  saveLatberPeriodMeta,
} from "@/lib/latber-period-meta-store";
import { syncInviteAfterLatberPeriodChange } from "@/lib/latber-invite-sync";

const LATBER_INKAI = { timeoutMs: 12_000, retries: 0 } as const;

function filterLatberEvents(events: Array<Record<string, unknown>>) {
  return events.filter((e) => isLatberEventTitle(String(e.title ?? "")));
}

async function fetchLatberEvents(token: string): Promise<{
  ok: boolean;
  events: Array<Record<string, unknown>>;
}> {
  try {
    const { res, data } = await inkaiFetch(
      "/v1/events?limit=200",
      {},
      token,
      LATBER_INKAI,
    );
    if (!res.ok) return { ok: false, events: [] };
    return {
      ok: true,
      events: filterLatberEvents((data.data as Array<Record<string, unknown>>) ?? []),
    };
  } catch (error) {
    console.error("[fetchLatberEvents]", error);
    return { ok: false, events: [] };
  }
}

/** True when admin should hydrate Latber periods from Prisma (publik path). */
export function shouldLoadLatberPeriodsFromPrisma(
  eventsOk: boolean,
  latberPeriodCount: number,
): boolean {
  return !eventsOk || latberPeriodCount === 0;
}

function upsertLatberPeriodOption(
  periods: LatberPeriodOption[],
  next: LatberPeriodOption,
): LatberPeriodOption[] {
  const idx = periods.findIndex((p) => p.id === next.id);
  if (idx < 0) return [...periods, next];
  return periods.map((p, i) => (i === idx ? { ...p, ...next } : p));
}

async function fetchLatberPeriodOptionsFromPrisma(): Promise<LatberPeriodOption[]> {
  const { data } = await withPrismaFallback(
    "latber-events-prisma",
    () =>
      prisma.event.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          registrationCloseAt: true,
        },
        orderBy: { startDate: "desc" },
        take: 80,
      }),
    [] as Array<{
      id: string;
      title: string;
      startDate: Date;
      endDate: Date;
      registrationCloseAt: Date | null;
    }>,
  );

  return (data ?? [])
    .filter((e) => isLatberEventTitle(e.title))
    .map((e) =>
      periodOptionFromLatberEvent({
        id: e.id,
        title: e.title,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        registrationCloseAt: e.registrationCloseAt?.toISOString() ?? null,
      }),
    );
}

async function ensureLatberPeriodsFromPrisma(
  periods: LatberPeriodOption[],
  opts: {
    eventsOk: boolean;
    periodFromUrl?: string | null;
  },
): Promise<{ periods: LatberPeriodOption[]; fromPrisma: boolean }> {
  const needList = shouldLoadLatberPeriodsFromPrisma(opts.eventsOk, periods.length);
  const needUrl =
    Boolean(opts.periodFromUrl) &&
    !periods.some((p) => p.id === opts.periodFromUrl);

  if (!needList && !needUrl) {
    return { periods, fromPrisma: false };
  }

  const prismaPeriods = await fetchLatberPeriodOptionsFromPrisma();
  let next = periods;
  let fromPrisma = false;

  if (needList) {
    for (const p of prismaPeriods) {
      next = upsertLatberPeriodOption(next, p);
      fromPrisma = true;
    }
  }

  if (needUrl && opts.periodFromUrl) {
    const fromList = prismaPeriods.find((p) => p.id === opts.periodFromUrl);
    if (fromList) {
      next = upsertLatberPeriodOption(next, fromList);
      fromPrisma = true;
    } else {
      const { data: ev } = await withPrismaFallback(
        "latber-event-by-id-prisma",
        () =>
          prisma.event.findFirst({
            where: { id: opts.periodFromUrl!, isDeleted: false },
            select: {
              id: true,
              title: true,
              startDate: true,
              endDate: true,
              registrationCloseAt: true,
            },
          }),
        null as {
          id: string;
          title: string;
          startDate: Date;
          endDate: Date;
          registrationCloseAt: Date | null;
        } | null,
      );
      if (ev && isLatberEventTitle(ev.title)) {
        next = upsertLatberPeriodOption(
          next,
          periodOptionFromLatberEvent({
            id: ev.id,
            title: ev.title,
            startDate: ev.startDate.toISOString(),
            endDate: ev.endDate.toISOString(),
            registrationCloseAt: ev.registrationCloseAt?.toISOString() ?? null,
          }),
        );
        fromPrisma = true;
      }
    }
  }

  return { periods: next, fromPrisma };
}

async function loadLatberPeriodMetaFromPrisma(
  periodIds: string[],
): Promise<Map<string, LatberPeriodMeta>> {
  const ids = [...new Set(periodIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const keys = ids.map((id) => latberPeriodMetaKey(id));
  const { data } = await withPrismaFallback(
    "latber-period-meta-prisma",
    () =>
      prisma.appSetting.findMany({
        where: { key: { in: keys } },
        select: { key: true, value: true },
      }),
    [] as Array<{ key: string; value: unknown }>,
  );
  const map = new Map<string, LatberPeriodMeta>();
  for (const row of data ?? []) {
    const id = row.key.slice("latber-period-meta:".length);
    if (id) map.set(id, parseLatberPeriodMetaValue(row.value));
  }
  return map;
}

async function fillMissingLatberPeriodMeta(
  periods: LatberPeriodOption[],
  metaByPeriodId: Map<string, LatberPeriodMeta>,
): Promise<Map<string, LatberPeriodMeta>> {
  const missingIds = periods
    .map((p) => p.id)
    .filter((id) => id && !metaByPeriodId.has(id));
  if (missingIds.length === 0) return metaByPeriodId;
  const fromPrisma = await loadLatberPeriodMetaFromPrisma(missingIds);
  for (const [id, meta] of fromPrisma) {
    metaByPeriodId.set(id, meta);
  }
  return metaByPeriodId;
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

function latberPeriodSchedule(
  p: LatberPeriodOption,
  meta: LatberPeriodMeta,
) {
  return {
    startDate: p.startDate ?? "",
    endDate: p.endDate ?? p.startDate ?? "",
    registrationCloseAt: p.registrationCloseAt,
    registrationOpenAt: meta.registrationOpenAt ?? null,
  };
}

function isLatberEventCompleted(p: LatberPeriodOption, meta: LatberPeriodMeta): boolean {
  const eventTimeIso = meta.eventAt || p.endDate || p.startDate;
  if (!eventTimeIso) return false;
  const eventDate = new Date(eventTimeIso);
  if (Number.isNaN(eventDate.getTime())) return false;
  // Auto-arsip hanya setelah 24 jam dari waktu pelaksanaan event
  const archiveCutoff = eventDate.getTime() + 24 * 60 * 60 * 1000;
  return Date.now() > archiveCutoff;
}

function isLatberPeriodInactive(p: LatberPeriodOption, meta: LatberPeriodMeta): boolean {
  if (meta.archived || meta.locked) return true;
  return isLatberEventCompleted(p, meta);
}

/** Idempotent: arsipkan periode yang pelaksanaan latihannya sudah berlalu (+24 jam). */
async function autoArchiveInactiveLatberPeriods(
  token: string,
  periods: LatberPeriodOption[],
  metaByPeriodId: Map<string, LatberPeriodMeta>,
) {
  for (const p of periods) {
    try {
      const meta = metaByPeriodId.get(p.id) ?? { archived: false, locked: false };
      if (meta.archived || meta.locked) continue;
      // Jangan arsipkan saat pendaftaran masih terbuka.
      if (isLatberRegistrationOpen(latberPeriodSchedule(p, meta))) continue;
      if (!isLatberEventCompleted(p, meta)) continue;

      const archived = mergeLatberPeriodMeta(meta, {
        archived: true,
        locked: true,
      });
      await saveLatberPeriodMeta(token, p.id, archived);
      metaByPeriodId.set(p.id, archived);
      await syncInviteAfterLatberPeriodChange({
        periodId: p.id,
        title: p.title,
        startDate: p.startDate,
        endDate: p.endDate,
        registrationCloseAt: p.registrationCloseAt,
        location: meta.eventLocation ?? null,
        meta: archived,
        token,
      });
    } catch (error) {
      console.error("[autoArchiveInactiveLatberPeriods]", p.id, error);
    }
  }
}

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

  const [eventsResult, dojosScoped, periodMetaRows, eventDetailFromUrl] =
    await Promise.all([
      fetchLatberEvents(token),
      fetchAdminDojosScopedCached(user),
      fetchSettingsByPrefix(token, "latber-period-meta:"),
      periodFromUrl
        ? fetchEventDetail(token, periodFromUrl, LATBER_INKAI).catch(() => null)
        : Promise.resolve(null),
    ]);

  const eventsOk = eventsResult.ok;
  let eventsRaw = eventsResult.events;

  if (
    periodFromUrl &&
    eventDetailFromUrl &&
    isLatberEventTitle(String(eventDetailFromUrl.title ?? ""))
  ) {
    const idx = eventsRaw.findIndex((e) => String(e.id) === periodFromUrl);
    if (idx < 0) eventsRaw = [...eventsRaw, eventDetailFromUrl];
    else eventsRaw = eventsRaw.map((e, i) => (i === idx ? eventDetailFromUrl : e));
  }

  let dojos = dojosScoped;
  if (dojoAllowlist.length > 0) {
    dojos = dojosScoped.filter((d) => dojoAllowlist.includes(d.id));
  }

  const metaByPeriodId = new Map<string, LatberPeriodMeta>();
  for (const row of periodMetaRows) {
    const id = row.key.slice("latber-period-meta:".length);
    if (id) metaByPeriodId.set(id, parseLatberPeriodMetaValue(row.value));
  }

  let periods: LatberPeriodOption[] = eventsRaw.map((e) =>
    periodOptionFromLatberEvent(e),
  );

  const prismaHydrated = await ensureLatberPeriodsFromPrisma(periods, {
    eventsOk,
    periodFromUrl,
  });
  periods = prismaHydrated.periods;
  const periodsFromPrisma = prismaHydrated.fromPrisma;

  await fillMissingLatberPeriodMeta(periods, metaByPeriodId);

  periods = periods.map((p) => {
    const meta = metaByPeriodId.get(p.id);
    return {
      ...p,
      archived: meta?.archived === true,
      locked: meta?.locked === true,
    };
  });

  await autoArchiveInactiveLatberPeriods(token, periods, metaByPeriodId);

  periods = periods.map((p) => {
    const meta = metaByPeriodId.get(p.id);
    return {
      ...p,
      archived: meta?.archived === true,
      locked: meta?.locked === true,
    };
  });

  if (viewMode === "registration") {
    periods = periods.filter((p) => {
      const meta = metaByPeriodId.get(p.id) ?? { archived: false, locked: false };
      return !isLatberPeriodInactive(p, meta);
    });
  } else {
    const inactiveOrClosed = periods.filter((p) => {
      const meta = metaByPeriodId.get(p.id) ?? { archived: false, locked: false };
      const closeIso = p.registrationCloseAt || p.endDate;
      const isClosed = Boolean(
        closeIso &&
          !Number.isNaN(new Date(closeIso).getTime()) &&
          Date.now() > new Date(closeIso).getTime(),
      );
      return isLatberPeriodInactive(p, meta) || isClosed || meta.archived || meta.locked;
    });
    // Fallback: Jika tidak ada periode terarsip/tutup spesifik, tampilkan seluruh periode Latber agar data tidak pernah kosong
    periods = inactiveOrClosed.length > 0 ? inactiveOrClosed : periods;
  }

  let selectedPeriodId = forceNoPeriod ? null : periodFromUrl;
  if (selectedPeriodId && !periods.some((p) => p.id === selectedPeriodId)) {
    // URL period mungkin aktif tapi terfilter; upsert dari Inkai detail atau Prisma.
    let recovered: LatberPeriodOption | null = null;
    if (
      periodFromUrl &&
      eventDetailFromUrl &&
      isLatberEventTitle(String(eventDetailFromUrl.title ?? ""))
    ) {
      recovered = periodOptionFromLatberEvent(eventDetailFromUrl, periodFromUrl);
    } else if (periodFromUrl) {
      const { data: ev } = await withPrismaFallback(
        "latber-event-url-recover",
        () =>
          prisma.event.findFirst({
            where: { id: periodFromUrl, isDeleted: false },
            select: {
              id: true,
              title: true,
              startDate: true,
              endDate: true,
              registrationCloseAt: true,
            },
          }),
        null as {
          id: string;
          title: string;
          startDate: Date;
          endDate: Date;
          registrationCloseAt: Date | null;
        } | null,
      );
      if (ev && isLatberEventTitle(ev.title)) {
        recovered = periodOptionFromLatberEvent({
          id: ev.id,
          title: ev.title,
          startDate: ev.startDate.toISOString(),
          endDate: ev.endDate.toISOString(),
          registrationCloseAt: ev.registrationCloseAt?.toISOString() ?? null,
        });
      }
    }

    if (recovered) {
      await fillMissingLatberPeriodMeta([recovered], metaByPeriodId);
      const meta = metaByPeriodId.get(recovered.id) ?? { archived: false, locked: false };
      const withMeta = {
        ...recovered,
        archived: meta.archived === true,
        locked: meta.locked === true,
      };
      if (viewMode === "registration" ? !isLatberPeriodInactive(withMeta, meta) : true) {
        periods = [...periods, withMeta];
      } else {
        selectedPeriodId = null;
      }
    } else {
      selectedPeriodId = null;
    }
  }
  if (!selectedPeriodId && !forceNoPeriod) {
    if (viewMode === "archive") {
      const archived = periods.filter((p) => p.archived || p.locked);
      selectedPeriodId = archived[0]?.id ?? periods[0]?.id ?? null;
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
    const photoSelect = await memberPhotoSelect();
    const regsResult = await withPrismaFallback(
      "latber-regs-prisma",
      () =>
        prisma.eventRegistration.findMany({
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
                status: true,
                gender: true,
                birthPlace: true,
                birthDate: true,
                address: true,
                nik: true,
                userId: true,
                ...photoSelect,
                dojo: { select: { name: true } },
                user: { select: { photoUrl: true, phoneNumber: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
      [] as Awaited<ReturnType<typeof prisma.eventRegistration.findMany>>,
    );
    const registrations = regsResult.data ?? [];

    const billingByReg = new Map<
      string,
      { id: string; amount: number; status: string; paymentMethod: string | null }
    >();
    if (registrations.length > 0) {
      const billingsResult = await withPrismaFallback(
        "latber-billings-prisma",
        () =>
          prisma.billing.findMany({
            where: {
              registrationId: { in: registrations.map((r) => r.id) },
              isDeleted: false,
            },
            select: {
              id: true,
              registrationId: true,
              amount: true,
              status: true,
              payment: { select: { paymentMethod: true } },
            },
          }),
        [] as Array<{
          id: string;
          registrationId: string | null;
          amount: number;
          status: string;
          payment: { paymentMethod: string | null } | null;
        }>,
      );
      for (const b of billingsResult.data ?? []) {
        if (b.registrationId) {
          billingByReg.set(b.registrationId, {
            id: b.id,
            amount: b.amount,
            status: b.status,
            paymentMethod: b.payment?.paymentMethod ?? null,
          });
        }
      }
    }

    const pendingRegs = registrations.filter((r) => r.status === "PENDING");
    const selfMetaByMember = new Map<string, { memberPaymentConfirmedAt: string | null }>();
    if (pendingRegs.length > 0 && selectedPeriodId) {
      const keys = pendingRegs.map((r) =>
        latberSelfRegistrationKey(selectedPeriodId, r.memberId),
      );
      const metaRowsResult = await withPrismaFallback(
        "latber-self-meta-prisma",
        () =>
          prisma.appSetting.findMany({
            where: { key: { in: keys } },
            select: { key: true, value: true },
          }),
        [] as Array<{ key: string; value: unknown }>,
      );
      for (const row of metaRowsResult.data ?? []) {
        const parsed = parseLatberSelfRegistrationMeta(row.value);
        if (!parsed) continue;
        const memberId = row.key.slice(
          latberSelfRegistrationKey(selectedPeriodId, "").length,
        );
        if (memberId) {
          selfMetaByMember.set(memberId, {
            memberPaymentConfirmedAt: parsed.memberPaymentConfirmedAt,
          });
        }
      }
    }

    const { loadLatberGuestFlags, isMembershipReady } = await import(
      "@/lib/latber-guest"
    );
    const guestFlags = await loadLatberGuestFlags(
      registrations.map((r) => r.memberId),
    );

    rows = registrations.map((reg) => {
      const m = reg.member;
      const bill = billingByReg.get(reg.id);
      const isPending = reg.status === "PENDING";
      const selfMeta = selfMetaByMember.get(m.id);
      const guest = guestFlags.get(m.id);
      const phoneFromUser = m.user?.phoneNumber ?? null;
      const phoneNumber = guest?.phoneNumber ?? phoneFromUser;
      const memberStatus = String(m.status ?? "");
      const gender = m.gender ?? null;
      const birthPlace = m.birthPlace ?? null;
      const birthDate = m.birthDate
        ? m.birthDate.toISOString().slice(0, 10)
        : null;
      const address = m.address ?? null;
      const nik = m.nik ?? null;
      const hasAccount = Boolean(m.userId || m.user);
      return {
        memberId: m.id,
        registrationId: reg.id,
        nia: m.nia,
        fullName: m.fullName,
        currentRank: m.currentRank,
        dojoId: m.dojoId,
        dojoName: m.dojo?.name ?? null,
        photoUrl: resolveMemberPhotoUrl(
          "photoUrl" in m ? (m.photoUrl as string | null) : null,
          m.user?.photoUrl,
        ),
        status: reg.status,
        billingId: bill?.id ?? null,
        billingAmount: bill?.amount ?? fees.feeAmount,
        billingStatus: bill?.status ?? (isPending ? null : "PENDING"),
        paymentMethod: bill?.paymentMethod ?? null,
        selfRegistration: isPending && Boolean(selfMeta),
        memberPaymentConfirmedAt: selfMeta?.memberPaymentConfirmedAt ?? null,
        registeredAt: reg.createdAt.toISOString(),
        isLatberGuest: Boolean(guest),
        memberStatus,
        gender,
        birthPlace,
        birthDate,
        address,
        nik,
        phoneNumber,
        hasAccount,
        membershipReady: isMembershipReady({
          fullName: m.fullName,
          dojoId: m.dojoId,
          gender,
          birthPlace,
          birthDate,
          address,
          phoneNumber,
        }),
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
    dbError: !eventsOk && !periodsFromPrisma,
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
    else if (s === "lunas" || s === "tunai") lunas++;
    else if (
      s === "menunggu_terima_ranting" ||
      s === "menunggu_konfirmasi_ranting"
    ) {
      menungguTerima++;
    }
  }
  return { belumBayar, menungguVerifikasi, lunas, menungguTerima, total: rows.length };
}

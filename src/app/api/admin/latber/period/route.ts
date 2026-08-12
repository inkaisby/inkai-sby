import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { canCreateEventsByWilayah } from "@/lib/wilayah-rbac";
import { latberPeriodPatchSchema, latberPeriodSchema } from "@/lib/security/schemas";
import {
  buildLatberEventTitle,
  DEFAULT_LATBER_FEE,
  DEFAULT_LATBER_KOMISI_RANTING,
  isLatberEventTitle,
  isLatberRegistrationOpen,
  LATBER_CATEGORY,
  periodOptionFromLatberEvent,
  type LatberPeriodOption,
} from "@/lib/latber";
import { SITE_BRANCH_NAME, SITE_PROVINCE_NAME } from "@/lib/site";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import {
  loadLatberPeriodMeta,
  mergeLatberPeriodMeta,
  saveLatberPeriodMeta,
} from "@/lib/latber-period-meta-store";
import { syncInviteAfterLatberPeriodChange } from "@/lib/latber-invite-sync";

async function resolveSurabayaBranchId(token: string) {
  const { res, data } = await inkaiFetch("/v1/org/provinces", {}, token);
  if (!res.ok) return null;
  const provinces = (data.data as Array<Record<string, unknown>>) ?? [];
  const province = provinces.find(
    (p) => String(p.name).toUpperCase() === SITE_PROVINCE_NAME.toUpperCase(),
  );
  const branches = (province?.branches as Array<Record<string, unknown>>) ?? [];
  const branch = branches.find(
    (b) => String(b.name).toUpperCase() === SITE_BRANCH_NAME.toUpperCase(),
  );
  return (branch?.id as string) ?? null;
}

async function fetchEventRecord(token: string, eventId: string) {
  const { res, data } = await inkaiFetch(`/v1/events/${eventId}`, {}, token);
  if (!res.ok) return null;
  return (data.data as Record<string, unknown>) ?? null;
}

function buildEventPatchBody(
  existing: Record<string, unknown>,
  updates: {
    title?: string;
    registrationCloseAt?: string;
  },
) {
  const nextTitle = updates.title?.trim() || String(existing.title ?? "");
  let nextStart = new Date(String(existing.startDate));
  let nextEnd = new Date(String(existing.endDate));
  let nextRegClose: string | null = existing.registrationCloseAt
    ? String(existing.registrationCloseAt)
    : null;

  if (updates.registrationCloseAt) {
    const close = new Date(updates.registrationCloseAt);
    if (Number.isNaN(close.getTime())) {
      throw new Error("Batas pendaftaran tidak valid");
    }
    nextRegClose = close.toISOString();
    if (close.getTime() > nextStart.getTime()) nextStart = close;
    if (close.getTime() > nextEnd.getTime()) nextEnd = close;
  }

  return {
    title: nextTitle,
    description: existing.description ?? "",
    startDate: nextStart.toISOString(),
    endDate: nextEnd.toISOString(),
    location: existing.location ?? "",
    registrationCloseAt: nextRegClose,
  };
}

function defaultLatberDates(closeAtInput?: string, openAtInput?: string) {
  const now = new Date();
  const registrationOpenAt = openAtInput ? new Date(openAtInput) : now;
  const registrationCloseAt = closeAtInput
    ? new Date(closeAtInput)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  let startDate = new Date(registrationOpenAt);
  let endDate = new Date(registrationCloseAt);
  if (registrationCloseAt.getTime() > startDate.getTime()) startDate = registrationCloseAt;
  if (registrationCloseAt.getTime() > endDate.getTime()) endDate = registrationCloseAt;
  return { startDate, endDate, registrationOpenAt, registrationCloseAt };
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = latberPeriodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const {
    title,
    registrationCloseAt: closeAtInput,
    registrationOpenAt: openAtInput,
    eventAt,
    eventLocation,
    feeAmount,
    komisiRanting,
  } = parsed.data;

  if (!canCreateEventsByWilayah(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat membuat periode Latber baru" },
      { status: 403 },
    );
  }

  const eventTitle = buildLatberEventTitle(title || "Periode");

  const { res: listRes, data: listData } = await inkaiFetch(
    "/v1/events?limit=200",
    {},
    authResult.token,
  );
  const allEvents = listRes.ok
    ? ((listData.data as Array<Record<string, unknown>>) ?? [])
    : [];
  const latberOptions: LatberPeriodOption[] = allEvents
    .filter((e) => isLatberEventTitle(String(e.title ?? "")))
    .map((e) => periodOptionFromLatberEvent(e));

  for (const opt of latberOptions) {
    if (!opt.id) continue;
    const meta = await loadLatberPeriodMeta(authResult.token, opt.id);
    opt.archived = meta.archived;
    opt.locked = meta.locked;
  }

  const openPeriods = latberOptions.filter(
    (p) =>
      !p.archived &&
      !p.locked &&
      isLatberRegistrationOpen({
        startDate: p.startDate ?? "",
        endDate: p.endDate ?? p.startDate ?? "",
        registrationCloseAt: p.registrationCloseAt,
      }),
  );
  const exactOpen = openPeriods.find(
    (p) => p.title.trim().toLowerCase() === eventTitle.toLowerCase(),
  );
  if (exactOpen) {
    return NextResponse.json({
      event: allEvents.find((e) => String(e.id) === exactOpen.id),
      created: false,
      message: "Periode Latber dengan judul serupa masih terbuka",
    });
  }

  let uniqueTitle = eventTitle;
  if (
    allEvents.some((e) => String(e.title).toLowerCase() === uniqueTitle.toLowerCase())
  ) {
    const stamp = new Date().toISOString().slice(0, 10);
    uniqueTitle = `${eventTitle} · ${stamp}`;
    let n = 2;
    while (
      allEvents.some((e) => String(e.title).toLowerCase() === uniqueTitle.toLowerCase())
    ) {
      uniqueTitle = `${eventTitle} · ${stamp} (${n})`;
      n += 1;
    }
  }

  const branchId = await resolveSurabayaBranchId(authResult.token);
  if (!branchId) {
    return NextResponse.json({ error: "Cabang tidak ditemukan" }, { status: 404 });
  }

  const dates = defaultLatberDates(closeAtInput, openAtInput);
  if (Number.isNaN(dates.registrationOpenAt.getTime())) {
    return NextResponse.json({ error: "Tanggal buka pendaftaran tidak valid" }, { status: 400 });
  }
  if (Number.isNaN(dates.registrationCloseAt.getTime())) {
    return NextResponse.json({ error: "Batas pendaftaran tidak valid" }, { status: 400 });
  }
  if (dates.registrationOpenAt.getTime() > dates.registrationCloseAt.getTime()) {
    return NextResponse.json(
      { error: "Tanggal buka pendaftaran harus sebelum atau sama dengan batas pendaftaran" },
      { status: 400 },
    );
  }

  const { res, data } = await inkaiFetch(
    "/v1/events",
    {
      method: "POST",
      body: JSON.stringify({
        title: uniqueTitle,
        description: `Latihan Bersama — ${uniqueTitle}`,
        startDate: dates.startDate.toISOString(),
        endDate: dates.endDate.toISOString(),
        registrationCloseAt: dates.registrationCloseAt.toISOString(),
        branchId,
        categories: [{ name: LATBER_CATEGORY, fee: 0 }],
      }),
    },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal membuat periode Latber") },
      { status: res.status },
    );
  }

  const event = data.data as { id?: string } | undefined;
  if (event?.id) {
    for (const old of openPeriods) {
      if (!old.id || old.id === event.id) continue;
      const oldMeta = await loadLatberPeriodMeta(authResult.token, old.id);
      const archived = mergeLatberPeriodMeta(oldMeta, {
        archived: true,
        locked: true,
        by: authResult.user.email,
      });
      await saveLatberPeriodMeta(authResult.token, old.id, archived);
      await syncInviteAfterLatberPeriodChange({
        periodId: old.id,
        title: old.title,
        startDate: old.startDate,
        endDate: old.endDate,
        registrationCloseAt: old.registrationCloseAt,
        location: eventLocation ?? null,
        meta: archived,
        token: authResult.token,
      });
    }

    const meta = mergeLatberPeriodMeta(
      { archived: false, locked: false },
      {
        registrationOpenAt: dates.registrationOpenAt.toISOString(),
        eventAt: eventAt ?? null,
        eventLocation: eventLocation ?? null,
        feeAmount: feeAmount ?? DEFAULT_LATBER_FEE,
        komisiRanting: komisiRanting ?? DEFAULT_LATBER_KOMISI_RANTING,
        by: authResult.user.email,
      },
    );
    await saveLatberPeriodMeta(authResult.token, event.id, meta);

    await syncInviteAfterLatberPeriodChange({
      periodId: event.id,
      title: uniqueTitle,
      startDate: dates.startDate.toISOString(),
      endDate: dates.endDate.toISOString(),
      registrationCloseAt: dates.registrationCloseAt.toISOString(),
      location: eventLocation ?? null,
      meta,
      token: authResult.token,
    });
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "LATBER_PERIOD_CREATE",
    details: `Created Latber period: ${uniqueTitle}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({ event, created: true });
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = latberPeriodPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const {
    eventId,
    title,
    registrationCloseAt,
    registrationOpenAt,
    eventAt,
    eventLocation,
    feeAmount,
    komisiRanting,
  } = parsed.data;

  const hasMetaPatch =
    registrationOpenAt !== undefined ||
    eventAt !== undefined ||
    eventLocation !== undefined ||
    feeAmount !== undefined ||
    komisiRanting !== undefined;

  if (!title && !registrationCloseAt && !hasMetaPatch) {
    return NextResponse.json({ error: "Tidak ada perubahan" }, { status: 400 });
  }

  if (!canCreateEventsByWilayah(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat mengubah periode Latber" },
      { status: 403 },
    );
  }

  const existing = await fetchEventRecord(authResult.token, eventId);
  if (!existing) {
    return NextResponse.json({ error: "Periode Latber tidak ditemukan" }, { status: 404 });
  }
  if (!isLatberEventTitle(String(existing.title ?? ""))) {
    return NextResponse.json({ error: "Event bukan periode Latber" }, { status: 400 });
  }

  const prevClose = existing.registrationCloseAt
    ? new Date(String(existing.registrationCloseAt))
    : new Date(String(existing.startDate));

  if (registrationCloseAt || registrationOpenAt) {
    const close = registrationCloseAt
      ? new Date(registrationCloseAt)
      : prevClose;
    const currentMeta = await loadLatberPeriodMeta(authResult.token, eventId);
    let open: Date | null = null;
    if (registrationOpenAt) open = new Date(registrationOpenAt);
    else if (registrationOpenAt === null) open = null;
    else if (currentMeta.registrationOpenAt) {
      open = new Date(currentMeta.registrationOpenAt);
    }
    if (open && !Number.isNaN(open.getTime()) && open.getTime() > close.getTime()) {
      return NextResponse.json(
        { error: "Tanggal buka pendaftaran harus sebelum atau sama dengan batas pendaftaran" },
        { status: 400 },
      );
    }
  }

  let eventResult: unknown = existing;
  if (title || registrationCloseAt) {
    let patchBody: ReturnType<typeof buildEventPatchBody>;
    try {
      patchBody = buildEventPatchBody(existing, {
        title: title ? buildLatberEventTitle(title) : undefined,
        registrationCloseAt,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Data tidak valid" },
        { status: 400 },
      );
    }

    const { res, data } = await inkaiFetch(
      `/v1/events/${eventId}`,
      { method: "PATCH", body: JSON.stringify(patchBody) },
      authResult.token,
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: inkaiErrorMessage(data, "Gagal mengubah periode Latber") },
        { status: res.status },
      );
    }
    eventResult = data.data;
  }

  if (hasMetaPatch || registrationCloseAt || title) {
    const current = await loadLatberPeriodMeta(authResult.token, eventId);
    const next = mergeLatberPeriodMeta(current, {
      registrationOpenAt,
      eventAt,
      eventLocation,
      feeAmount,
      komisiRanting,
      by: authResult.user.email,
    });
    await saveLatberPeriodMeta(authResult.token, eventId, next);

    const eventForInvite =
      (eventResult as Record<string, unknown> | null) ?? existing;
    await syncInviteAfterLatberPeriodChange({
      periodId: eventId,
      title: String(eventForInvite.title ?? existing.title ?? "Latber"),
      startDate: eventForInvite.startDate
        ? String(eventForInvite.startDate)
        : String(existing.startDate ?? ""),
      endDate: eventForInvite.endDate
        ? String(eventForInvite.endDate)
        : existing.endDate
          ? String(existing.endDate)
          : null,
      registrationCloseAt: eventForInvite.registrationCloseAt
        ? String(eventForInvite.registrationCloseAt)
        : registrationCloseAt ??
          (existing.registrationCloseAt
            ? String(existing.registrationCloseAt)
            : null),
      location:
        eventLocation ?? (existing.location ? String(existing.location) : null),
      meta: next,
      token: authResult.token,
    });
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "LATBER_PERIOD_UPDATE",
    details: `Updated Latber period ${eventId}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({ event: eventResult });
}

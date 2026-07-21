import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { canCreateEventsByWilayah } from "@/lib/wilayah-rbac";
import { uktPeriodPatchSchema, uktPeriodSchema } from "@/lib/security/schemas";
import {
  buildUktEventDates,
  buildUktEventTitle,
  formatUktPeriodLabel,
  formatUktRegistrationDeadline,
  type BeltFeeKey,
} from "@/lib/ukt";
import { SITE_BRANCH_NAME, SITE_PROVINCE_NAME } from "@/lib/site";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import {
  loadUktPeriodMeta,
  mergeUktPeriodMeta,
  saveUktPeriodMeta,
} from "@/lib/ukt-period-meta-store";
import { notifyUktDojoAdmins } from "@/lib/ukt-period-notify";

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

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = uktPeriodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const {
    semester,
    year,
    title,
    registrationCloseAt: closeAtInput,
    registrationOpenAt: openAtInput,
    examAt,
    examLocation,
    bidangUjianName,
    bendaharaCabangName,
    beltFees,
    komisiRanting,
    notifyRanting = true,
  } = parsed.data;
  const eventTitle = title || buildUktEventTitle(semester, year);

  const { res: listRes, data: listData } = await inkaiFetch("/v1/events", {}, authResult.token);
  if (listRes.ok) {
    const events = (listData.data as Array<Record<string, unknown>>) ?? [];
    const existing = events.find(
      (e) => String(e.title).toLowerCase() === eventTitle.toLowerCase(),
    );
    if (existing) {
      return NextResponse.json({ event: existing, created: false });
    }
  }

  const canCreate = canCreateEventsByWilayah(authResult.user.roles);
  if (!canCreate) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat membuat periode UKT baru" },
      { status: 403 },
    );
  }

  const branchId = await resolveSurabayaBranchId(authResult.token);
  if (!branchId) {
    return NextResponse.json({ error: "Cabang tidak ditemukan" }, { status: 404 });
  }

  const defaults = buildUktEventDates(semester, year);
  let startDate = defaults.startDate;
  let endDate = defaults.endDate;
  let registrationCloseAt = defaults.registrationCloseAt;
  let registrationOpenAt = defaults.registrationOpenAt;

  if (closeAtInput) {
    const close = new Date(closeAtInput);
    if (Number.isNaN(close.getTime())) {
      return NextResponse.json({ error: "Batas pendaftaran tidak valid" }, { status: 400 });
    }
    registrationCloseAt = close;
    if (close.getTime() > startDate.getTime()) startDate = close;
    if (close.getTime() > endDate.getTime()) endDate = close;
  }

  if (openAtInput) {
    const open = new Date(openAtInput);
    if (Number.isNaN(open.getTime())) {
      return NextResponse.json({ error: "Tanggal buka pendaftaran tidak valid" }, { status: 400 });
    }
    registrationOpenAt = open;
  }

  if (registrationOpenAt.getTime() > registrationCloseAt.getTime()) {
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
        title: eventTitle,
        description: `Ujian Kenaikan Tingkat ${eventTitle}`,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        registrationCloseAt: registrationCloseAt.toISOString(),
        branchId,
        categories: [{ name: "Pendaftaran UKT", fee: 0 }],
      }),
    },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal membuat periode UKT") },
      { status: res.status },
    );
  }

  const event = data.data as { id?: string } | undefined;
  if (event?.id) {
    const meta = mergeUktPeriodMeta(
      { archived: false, locked: false },
      {
        registrationOpenAt: registrationOpenAt.toISOString(),
        examAt: examAt ?? null,
        examLocation: examLocation ?? null,
        bidangUjianName: bidangUjianName ?? null,
        bendaharaCabangName: bendaharaCabangName ?? null,
        beltFees: (beltFees as Partial<Record<BeltFeeKey, number>> | undefined) ?? null,
        komisiRanting: komisiRanting ?? null,
        by: authResult.user.email,
      },
    );
    await saveUktPeriodMeta(authResult.token, event.id, meta);

    if (notifyRanting) {
      const openLabel = formatUktRegistrationDeadline(registrationOpenAt.toISOString());
      const closeLabel = formatUktRegistrationDeadline(registrationCloseAt.toISOString());
      const examLabel = examAt
        ? formatUktRegistrationDeadline(examAt)
        : "belum ditentukan";
      await notifyUktDojoAdmins({
        token: authResult.token,
        actorEmail: authResult.user.email,
        title: `Periode UKT ${formatUktPeriodLabel(semester, year)} dibuka`,
        content: `${eventTitle}: daftar ${openLabel} s/d ${closeLabel}. Ujian: ${examLabel}${examLocation ? ` · ${examLocation}` : ""}. Segera cek syarat anggota ranting.`,
        type: "SUCCESS",
      });
      meta.notifiedOpenAt =
        Date.now() >= registrationOpenAt.getTime()
          ? new Date().toISOString()
          : undefined;
      if (meta.notifiedOpenAt) {
        await saveUktPeriodMeta(authResult.token, event.id, meta);
      }
    }
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_PERIOD_CREATE",
    details: `Created UKT period: ${eventTitle}`,
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
  const parsed = uktPeriodPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const {
    eventId,
    title,
    registrationCloseAt,
    registrationOpenAt,
    examAt,
    examLocation,
    bidangUjianName,
    bendaharaCabangName,
    beltFees,
    komisiRanting,
    notifyRanting,
  } = parsed.data;

  const hasMetaPatch =
    registrationOpenAt !== undefined ||
    examAt !== undefined ||
    examLocation !== undefined ||
    bidangUjianName !== undefined ||
    bendaharaCabangName !== undefined ||
    beltFees !== undefined ||
    komisiRanting !== undefined;

  if (!title && !registrationCloseAt && !hasMetaPatch) {
    return NextResponse.json({ error: "Tidak ada perubahan" }, { status: 400 });
  }

  const canEdit = canCreateEventsByWilayah(authResult.user.roles);
  if (!canEdit) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat mengubah periode UKT" },
      { status: 403 },
    );
  }

  const existing = await fetchEventRecord(authResult.token, eventId);
  if (!existing) {
    return NextResponse.json({ error: "Periode UKT tidak ditemukan" }, { status: 404 });
  }

  const prevClose = existing.registrationCloseAt
    ? new Date(String(existing.registrationCloseAt))
    : new Date(String(existing.startDate));

  if (registrationCloseAt || registrationOpenAt) {
    const close = registrationCloseAt
      ? new Date(registrationCloseAt)
      : prevClose;
    const currentMeta = await loadUktPeriodMeta(authResult.token, eventId);
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
      patchBody = buildEventPatchBody(existing, { title, registrationCloseAt });
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
        { error: inkaiErrorMessage(data, "Gagal mengubah periode UKT") },
        { status: res.status },
      );
    }
    eventResult = data.data;
  }

  if (hasMetaPatch || registrationCloseAt) {
    const current = await loadUktPeriodMeta(authResult.token, eventId);
    const next = mergeUktPeriodMeta(current, {
      registrationOpenAt,
      examAt,
      examLocation,
      bidangUjianName,
      bendaharaCabangName,
      beltFees: beltFees ?? undefined,
      komisiRanting,
      by: authResult.user.email,
    });

    const extended =
      Boolean(registrationCloseAt) &&
      new Date(registrationCloseAt!).getTime() > prevClose.getTime();

    if (extended && notifyRanting !== false) {
      next.notifiedExtendedAt = new Date().toISOString();
      await notifyUktDojoAdmins({
        token: authResult.token,
        actorEmail: authResult.user.email,
        title: "Batas pendaftaran UKT diperpanjang",
        content: `${String(existing.title ?? "UKT")}: batas baru ${formatUktRegistrationDeadline(registrationCloseAt!)}. Ranting dapat mendaftarkan peserta lagi.`,
        type: "SUCCESS",
      });
    }

    await saveUktPeriodMeta(authResult.token, eventId, next);
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_PERIOD_UPDATE",
    details: `Updated UKT period ${eventId}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({ event: eventResult });
}

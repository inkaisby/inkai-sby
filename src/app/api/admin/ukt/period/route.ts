import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { uktPeriodPatchSchema, uktPeriodSchema } from "@/lib/security/schemas";
import { buildUktEventDates, buildUktEventTitle } from "@/lib/ukt";
import { SITE_BRANCH_NAME, SITE_PROVINCE_NAME } from "@/lib/site";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

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
    if (close.getTime() > nextStart.getTime()) {
      nextStart = close;
    }
    if (close.getTime() > nextEnd.getTime()) {
      nextEnd = close;
    }
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

  const { semester, year, title } = parsed.data;
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

  const role = getPrimaryAdminRole(authResult.user.roles);
  const canCreate = ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(role);
  if (!canCreate) {
    return NextResponse.json({ error: "Hanya admin cabang yang dapat membuat periode UKT baru" }, { status: 403 });
  }

  const branchId = await resolveSurabayaBranchId(authResult.token);
  if (!branchId) {
    return NextResponse.json({ error: "Cabang tidak ditemukan" }, { status: 404 });
  }

  const { startDate, endDate, registrationCloseAt } = buildUktEventDates(semester, year);

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

  const event = data.data;
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

  const { eventId, title, registrationCloseAt } = parsed.data;
  if (!title && !registrationCloseAt) {
    return NextResponse.json({ error: "Tidak ada perubahan" }, { status: 400 });
  }

  const role = getPrimaryAdminRole(authResult.user.roles);
  const canEdit = ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(role);
  if (!canEdit) {
    return NextResponse.json({ error: "Hanya admin cabang yang dapat mengubah periode UKT" }, { status: 403 });
  }

  const existing = await fetchEventRecord(authResult.token, eventId);
  if (!existing) {
    return NextResponse.json({ error: "Periode UKT tidak ditemukan" }, { status: 404 });
  }

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
    {
      method: "PATCH",
      body: JSON.stringify(patchBody),
    },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal mengubah periode UKT") },
      { status: res.status },
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_PERIOD_UPDATE",
    details: `Updated UKT period ${eventId}: ${JSON.stringify({ title, registrationCloseAt })}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({ event: data.data });
}

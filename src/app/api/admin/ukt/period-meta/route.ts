import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { canEditKyuBaru } from "@/lib/belt";
import { inkaiErrorMessage, inkaiFetch } from "@/lib/inkai-api/server";
import { parseUktPeriodMetaValue, uktPeriodMetaKey } from "@/lib/ukt";
import { uktPeriodMetaSchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }
  if (!canEditKyuBaru(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat mengarsipkan periode" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = uktPeriodMetaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { eventId, archived, locked } = parsed.data;
  const key = uktPeriodMetaKey(eventId);

  const existingRes = await inkaiFetch(
    `/v1/settings/${encodeURIComponent(key)}`,
    {},
    authResult.token,
  );
  const existingValue = existingRes.res.ok
    ? ((existingRes.data.data as { value?: unknown })?.value ?? null)
    : null;
  const current = parseUktPeriodMetaValue(existingValue);

  const now = new Date().toISOString();
  const next = {
    archived: archived ?? current.archived,
    locked: locked ?? current.locked ?? archived === true,
    archivedAt:
      archived === true
        ? now
        : archived === false
          ? undefined
          : current.archivedAt,
    lockedAt:
      locked === true || (archived === true && locked !== false)
        ? now
        : locked === false
          ? undefined
          : current.lockedAt,
    by: authResult.user.email,
  };

  const { res, data } = await inkaiFetch(
    `/v1/settings/${encodeURIComponent(key)}`,
    { method: "PUT", body: JSON.stringify({ value: next }) },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal menyimpan arsip periode") },
      { status: res.status },
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_PERIOD_META",
    details: JSON.stringify({ eventId, ...next }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    data: next,
    message: next.archived
      ? "Periode diarsipkan & dikunci"
      : next.locked
        ? "Periode dikunci"
        : "Periode dibuka kembali",
  });
}

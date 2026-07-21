import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { canEditKyuBaru } from "@/lib/belt";
import { inkaiErrorMessage } from "@/lib/inkai-api/server";
import { uktPeriodMetaSchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";
import {
  loadUktPeriodMeta,
  mergeUktPeriodMeta,
  saveUktPeriodMeta,
} from "@/lib/ukt-period-meta-store";

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }
  if (!canEditKyuBaru(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat mengubah meta periode" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = uktPeriodMetaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { eventId, ...patch } = parsed.data;
  const current = await loadUktPeriodMeta(authResult.token, eventId);
  const next = mergeUktPeriodMeta(current, {
    ...patch,
    by: authResult.user.email,
  });

  const saved = await saveUktPeriodMeta(authResult.token, eventId, next);
  if (!saved.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(saved.errorData as Record<string, unknown>, "Gagal menyimpan meta periode") },
      { status: saved.status },
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
        : "Meta periode disimpan",
  });
}

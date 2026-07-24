import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { canEditKyuBaru } from "@/lib/belt";
import { inkaiErrorMessage, inkaiFetch } from "@/lib/inkai-api/server";
import { uktDepositKey } from "@/lib/ukt";
import { uktDepositSchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { assertUktPeriodMutable } from "@/lib/ukt-period-meta-store";

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const isCabang = canEditKyuBaru(authResult.user.roles);
  if (!isCabang) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat mengubah status setoran" },
      { status: 403 },
    );
  }

  const rlKey = `ukt:deposit:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 20, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const body = await request.json();
  const parsed = uktDepositSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { eventId, dojoId, status, note } = parsed.data;

  const periodMutable = await assertUktPeriodMutable(authResult.token, eventId);
  if (!periodMutable.ok) {
    return NextResponse.json(
      { error: periodMutable.error },
      { status: periodMutable.status },
    );
  }

  const key = uktDepositKey(eventId, dojoId);
  const value = {
    status,
    note: note?.trim() || "",
    at: new Date().toISOString(),
    by: authResult.user.email,
  };

  const { res, data } = await inkaiFetch(
    `/v1/settings/${encodeURIComponent(key)}`,
    { method: "PUT", body: JSON.stringify({ value }) },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal menyimpan status setoran") },
      { status: res.status },
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_DEPOSIT_STATUS",
    details: JSON.stringify({ eventId, dojoId, status }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    data: value,
    message: "Status setoran diperbarui",
  });
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { canEditKyuBaru } from "@/lib/belt";
import { uktWaiverSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { uktRegistrationWaiverKey } from "@/lib/ukt";
import { assertUktPeriodMutable } from "@/lib/ukt-period-meta-store";
import { notifyUktMember } from "@/lib/ukt-notify";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  if (!canEditKyuBaru(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat memberi pengecualian pendaftaran" },
      { status: 403 },
    );
  }

  const rlKey = `ukt:waiver:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 20, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const body = await request.json().catch(() => null);
  const parsed = uktWaiverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { eventId, memberId, blockers, note } = parsed.data;

  const periodMutable = await assertUktPeriodMutable(authResult.token, eventId);
  if (!periodMutable.ok) {
    return NextResponse.json(
      { error: periodMutable.error },
      { status: periodMutable.status },
    );
  }

  const key = uktRegistrationWaiverKey(eventId, memberId);
  const value = {
    blockers,
    note,
    at: new Date().toISOString(),
    by: authResult.user.email,
  };

  const { res, data } = await inkaiFetch(
    `/v1/settings/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      body: JSON.stringify({ value }),
    },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal menyimpan pengecualian") },
      { status: res.status },
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_REGISTRATION_WAIVER",
    details: `Waiver ${memberId} event ${eventId}: ${blockers.join(", ")} — ${note}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  const { res: memberRes, data: memberData } = await inkaiFetch(
    `/v1/members/${memberId}`,
    {},
    authResult.token,
  );
  const memberName = memberRes.ok
    ? String((memberData.data as { fullName?: string }).fullName ?? "Anggota")
    : "Anggota";

  await notifyUktMember({
    token: authResult.token,
    memberId,
    title: "UKT — Pengecualian pendaftaran",
    content: `${memberName}: admin cabang memberi pengecualian syarat UKT (${blockers.join(", ")}). Catatan: ${note}`,
    type: "INFO",
  });

  return NextResponse.json({ success: true, waiver: value });
}

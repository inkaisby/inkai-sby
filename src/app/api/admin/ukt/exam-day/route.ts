import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { canEditKyuBaru } from "@/lib/belt";
import { inkaiErrorMessage, inkaiFetch } from "@/lib/inkai-api/server";
import { notifyUktStatusChange } from "@/lib/ukt-notify";
import {
  uktExamAttendanceKey,
  uktExamResultKey,
} from "@/lib/ukt";
import { uktExamDaySchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { assertUktPeriodMutable } from "@/lib/ukt-period-meta-store";

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }
  if (!canEditKyuBaru(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat mengelola hari-H UKT" },
      { status: 403 },
    );
  }

  const rlKey = `ukt:exam-day:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 20, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const body = await request.json();
  const parsed = uktExamDaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const {
    eventId,
    presentRegistrationIds = [],
    absentRegistrationIds = [],
    examResults = [],
  } = parsed.data;

  const periodMutable = await assertUktPeriodMutable(authResult.token, eventId);
  if (!periodMutable.ok) {
    return NextResponse.json(
      { error: periodMutable.error },
      { status: periodMutable.status },
    );
  }

  const stamp = {
    at: new Date().toISOString(),
    by: authResult.user.email,
  };

  let attendanceOk = 0;
  let attendanceFail = 0;
  let resultOk = 0;
  let resultFail = 0;

  for (const registrationId of presentRegistrationIds) {
    const key = uktExamAttendanceKey(eventId, registrationId);
    const { res } = await inkaiFetch(
      `/v1/settings/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        body: JSON.stringify({ value: { present: true, ...stamp } }),
      },
      authResult.token,
    );
    if (res.ok) attendanceOk++;
    else attendanceFail++;
  }

  for (const registrationId of absentRegistrationIds) {
    const key = uktExamAttendanceKey(eventId, registrationId);
    const { res } = await inkaiFetch(
      `/v1/settings/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        body: JSON.stringify({ value: { present: false, ...stamp } }),
      },
      authResult.token,
    );
    if (res.ok) attendanceOk++;
    else attendanceFail++;
  }

  for (const item of examResults) {
    const key = uktExamResultKey(eventId, item.registrationId);
    const { res } = await inkaiFetch(
      `/v1/settings/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          value: { result: item.result, ...stamp },
        }),
      },
      authResult.token,
    );
    if (!res.ok) {
      resultFail++;
      continue;
    }
    resultOk++;

    const { res: regRes, data: regData } = await inkaiFetch(
      `/v1/events/register/${item.registrationId}`,
      {},
      authResult.token,
    );
    if (regRes.ok) {
      const reg = regData.data as Record<string, unknown>;
      const member = reg.member as { id?: string; fullName?: string } | undefined;
      const event = reg.event as { title?: string } | undefined;
      const memberId = String(member?.id ?? reg.memberId ?? "");
      if (memberId) {
        const displayStatus =
          item.result === "LULUS"
            ? "lulus"
            : item.result === "GAGAL"
              ? "gagal"
              : "mengulang";
        await notifyUktStatusChange({
          token: authResult.token,
          memberId,
          memberName: String(member?.fullName ?? "Anggota"),
          periodTitle: String(event?.title ?? "UKT"),
          displayStatus,
        });
      }
    }
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_EXAM_DAY",
    details: JSON.stringify({
      eventId,
      present: presentRegistrationIds.length,
      absent: absentRegistrationIds.length,
      results: examResults.length,
      attendanceOk,
      resultOk,
    }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  if (attendanceFail + resultFail > 0 && attendanceOk + resultOk === 0) {
    return NextResponse.json(
      { error: inkaiErrorMessage({}, "Gagal menyimpan data hari-H") },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    attendanceOk,
    attendanceFail,
    resultOk,
    resultFail,
    message: `Hari-H: ${attendanceOk} kehadiran, ${resultOk} hasil ujian disimpan`,
  });
}

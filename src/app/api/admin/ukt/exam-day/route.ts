import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { canEditKyuBaru } from "@/lib/belt";
import { putAppSettingPrismaFirst } from "@/lib/app-setting-write";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { notifyUktStatusChange } from "@/lib/ukt-notify";
import {
  uktExamAttendanceKey,
  uktExamResultKey,
} from "@/lib/ukt";
import { uktExamDaySchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { assertUktPeriodMutable } from "@/lib/ukt-period-meta-store";
import { prisma } from "@/lib/prisma";

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
    const saved = await putAppSettingPrismaFirst({
      key,
      value: { present: true, ...stamp },
      token: authResult.token,
      label: "ukt/exam-day-attendance",
    });
    if (saved.ok) attendanceOk++;
    else attendanceFail++;
  }

  for (const registrationId of absentRegistrationIds) {
    const key = uktExamAttendanceKey(eventId, registrationId);
    const saved = await putAppSettingPrismaFirst({
      key,
      value: { present: false, ...stamp },
      token: authResult.token,
      label: "ukt/exam-day-attendance",
    });
    if (saved.ok) attendanceOk++;
    else attendanceFail++;
  }

  for (const item of examResults) {
    const key = uktExamResultKey(eventId, item.registrationId);
    const saved = await putAppSettingPrismaFirst({
      key,
      value: { result: item.result, ...stamp },
      token: authResult.token,
      label: "ukt/exam-day-result",
    });
    if (!saved.ok) {
      resultFail++;
      continue;
    }
    resultOk++;

    // Notifikasi best-effort — jangan gagalkan simpan hasil.
    try {
      const local = await prisma.eventRegistration.findFirst({
        where: { id: item.registrationId },
        select: {
          memberId: true,
          member: { select: { fullName: true } },
          event: { select: { title: true } },
        },
      });
      let memberId = local?.memberId ?? "";
      let memberName = local?.member?.fullName ?? "Anggota";
      let periodTitle = local?.event?.title ?? "UKT";

      if (!memberId) {
        const { res: regRes, data: regData } = await inkaiFetch(
          `/v1/events/register/${item.registrationId}`,
          {},
          authResult.token,
          { timeoutMs: 5_000, retries: 0 },
        );
        if (regRes.ok) {
          const reg = regData.data as Record<string, unknown>;
          const member = reg.member as
            | { id?: string; fullName?: string }
            | undefined;
          const event = reg.event as { title?: string } | undefined;
          memberId = String(member?.id ?? reg.memberId ?? "");
          memberName = String(member?.fullName ?? "Anggota");
          periodTitle = String(event?.title ?? "UKT");
        }
      }

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
          memberName,
          periodTitle,
          displayStatus,
        });
      }
    } catch (error) {
      console.warn("[ukt/exam-day] notify skipped", error);
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
      { error: "Gagal menyimpan data hari-H ke database" },
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

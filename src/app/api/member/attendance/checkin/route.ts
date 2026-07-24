import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { memberAttendanceCheckinSchema } from "@/lib/security/schemas";
import {
  loadGeofencedDojosForCabang,
  pickNearestInGeofence,
  matchDojosInGeofence,
} from "@/lib/attendance-geofence";
import { jakartaDayKey, isCheckedInOnJakartaDay } from "@/lib/ukt";
import { notifyAttendanceCheckIn } from "@/lib/attendance-notify";
import { consumeBiometricCheckInToken } from "@/lib/attendance-webauthn";
import { formatMemberName } from "@/lib/belt";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  const token = await getInkaiAccessToken();
  if (!session?.user.memberId || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = memberAttendanceCheckinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data lokasi tidak valid" },
      { status: 400 },
    );
  }

  const memberId = session.user.memberId;
  const today = jakartaDayKey();

  // Anti-kebocoran: max 1 check-in sukses / hari (Asia/Jakarta)
  try {
    const { res, data } = await inkaiFetch("/v1/attendance/me", {}, token);
    if (res.ok) {
      const items = (data.data as Array<Record<string, unknown>>) ?? [];
      if (
        isCheckedInOnJakartaDay(
          items.map((a) => ({ checkInAt: String(a.checkInAt) })),
          today,
        )
      ) {
        return NextResponse.json(
          { error: "Sudah absen hari ini" },
          { status: 409 },
        );
      }
    }
  } catch (error) {
    console.error("[attendance/checkin:today]", error);
  }

  const dojos = await loadGeofencedDojosForCabang();
  const { latitude, longitude } = parsed.data;
  let resolvedDojoId = parsed.data.dojoId;
  let resolvedDojoName = "";

  if (resolvedDojoId) {
    const target = dojos.find((d) => d.id === resolvedDojoId);
    if (!target) {
      return NextResponse.json(
        { error: "Dojo tidak ditemukan atau belum punya geofence" },
        { status: 400 },
      );
    }
    const inFence = matchDojosInGeofence(latitude, longitude, [target]);
    if (!inFence.length) {
      return NextResponse.json(
        {
          error: `Lokasi di luar area ${target.name}. Dekati titik absensi dojo.`,
        },
        { status: 400 },
      );
    }
    resolvedDojoName = target.name;
  } else {
    const nearest = pickNearestInGeofence(latitude, longitude, dojos);
    if (!nearest) {
      return NextResponse.json(
        {
          error:
            "Di luar area absensi. Dekati dojo ber-geofence atau pilih lokasi lewat “Bukan di sini?”.",
        },
        { status: 400 },
      );
    }
    resolvedDojoId = nearest.dojo.id;
    resolvedDojoName = nearest.dojo.name;
  }

  let biometricOk = false;
  const bioToken =
    typeof (body as { biometricToken?: string } | null)?.biometricToken ===
    "string"
      ? (body as { biometricToken: string }).biometricToken
      : "";
  if (bioToken) {
    biometricOk = await consumeBiometricCheckInToken(session.user.id, bioToken);
  }

  const method =
    parsed.data.method ||
    (parsed.data.qrPayload ? "QR_SCAN" : biometricOk ? "GPS" : "GPS");

  const payload = {
    latitude,
    longitude,
    method,
    qrPayload: parsed.data.qrPayload,
    dojoId: resolvedDojoId,
    eventId: parsed.data.eventId,
    memberId,
  };

  const attempts = [
    { path: "/v1/attendance/checkin", method: "POST" as const },
    { path: "/v1/attendance/check-in", method: "POST" as const },
    { path: "/v1/attendance", method: "POST" as const },
  ];

  let lastError = "Gagal melakukan absensi";
  let lastStatus = 400;
  let attendance: unknown = null;

  for (const attempt of attempts) {
    const { res, data } = await inkaiFetch(
      attempt.path,
      { method: attempt.method, body: JSON.stringify(payload) },
      token,
    );
    if (res.ok) {
      attendance = data.data;
      break;
    }
    if (res.status === 404 || res.status === 405) {
      lastError = inkaiErrorMessage(data, lastError);
      lastStatus = res.status;
      continue;
    }
    return NextResponse.json(
      { error: inkaiErrorMessage(data, lastError) },
      { status: res.status },
    );
  }

  if (!attendance) {
    return NextResponse.json({ error: lastError }, { status: lastStatus });
  }

  if (!resolvedDojoName && resolvedDojoId) {
    const d = await prisma.dojo.findFirst({
      where: { id: resolvedDojoId },
      select: { name: true },
    });
    resolvedDojoName = d?.name || "";
  }

  const memberName = formatMemberName(
    session.user.name || session.user.email || "Anggota",
  );
  void notifyAttendanceCheckIn({
    token,
    memberUserId: session.user.id,
    memberName,
    dojoId: resolvedDojoId!,
    dojoName: resolvedDojoName || "dojo",
    biometric: biometricOk,
  });

  return NextResponse.json({
    success: true,
    message: `Absensi berhasil dicatat di ${resolvedDojoName || "dojo"}`,
    attendance,
    dojoId: resolvedDojoId,
    dojoName: resolvedDojoName,
    biometric: biometricOk,
  });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { memberAttendanceCheckinSchema } from "@/lib/security/schemas";
import {
  loadGeofencedDojosForCabang,
  pickNearestInGeofence,
  matchDojosInGeofence,
  parseDojoQrPayload,
} from "@/lib/attendance-geofence";
import { jakartaDayKey, isCheckedInOnJakartaDay } from "@/lib/ukt";
import { hasLatberAttendanceOnJakartaDay } from "@/lib/latber-attendance";
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
    const alreadyLatber = await hasLatberAttendanceOnJakartaDay(memberId, today);
    if (alreadyLatber) {
      return NextResponse.json(
        { error: "Sudah absen hari ini" },
        { status: 409 },
      );
    }
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
  const qrPayloadRaw = parsed.data.qrPayload?.trim() || "";
  const dojoIdFromQr = qrPayloadRaw ? parseDojoQrPayload(qrPayloadRaw) : null;
  const isQrScan = Boolean(dojoIdFromQr || parsed.data.method === "QR_SCAN");

  // Jika QR Scan aktif & mengandung dojoId valid: QR melegitimasi keberadaan fisik di dojo
  if (dojoIdFromQr) {
    resolvedDojoId = dojoIdFromQr;
  }

  if (resolvedDojoId) {
    const target = dojos.find((d) => d.id === resolvedDojoId);
    if (target) {
      resolvedDojoName = target.name;
    } else {
      const dbDojo = await prisma.dojo.findFirst({
        where: { id: resolvedDojoId, isDeleted: false },
        select: { id: true, name: true },
      });
      if (dbDojo) {
        resolvedDojoName = dbDojo.name;
      } else if (!isQrScan) {
        return NextResponse.json(
          { error: "Dojo tidak ditemukan atau belum terdaftar" },
          { status: 400 },
        );
      }
    }

    // Jika bukan QR scan dan dojo punya titik koordinat, periksa geofence toleransi (500m jika manual)
    if (!isQrScan && target) {
      const inFence = matchDojosInGeofence(latitude, longitude, [target], 500);
      if (!inFence.length) {
        return NextResponse.json(
          {
            error: `Lokasi Anda terpaut jauh dari ${target.name}. Gunakan Scan Kode QR Ranting atau mendekat ke dojo.`,
          },
          { status: 400 },
        );
      }
    }
  } else {
    // Otomatis terdekat via GPS (toleransi 200m, fallback 500m terdekat)
    const nearest = pickNearestInGeofence(latitude, longitude, dojos, 200);
    if (nearest) {
      resolvedDojoId = nearest.dojo.id;
      resolvedDojoName = nearest.dojo.name;
    } else {
      // Fallback: periksa apakah ada dojo terdekat dalam radius 500m
      const relaxedNearest = pickNearestInGeofence(latitude, longitude, dojos, 500);
      if (relaxedNearest) {
        resolvedDojoId = relaxedNearest.dojo.id;
        resolvedDojoName = relaxedNearest.dojo.name;
      } else {
        return NextResponse.json(
          {
            error:
              "Di luar area absensi dojo. Dekati dojo ber-geofence, pilih lokasi via “Bukan di sini?”, atau Scan Kode QR Ranting.",
          },
          { status: 400 },
        );
      }
    }
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
    (isQrScan ? "QR_SCAN" : biometricOk ? "GPS" : "GPS");

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

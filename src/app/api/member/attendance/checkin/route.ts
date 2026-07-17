import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { memberAttendanceCheckinSchema } from "@/lib/security/schemas";

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

  const payload = {
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    method: parsed.data.method || (parsed.data.qrPayload ? "QR_SCAN" : "GPS"),
    qrPayload: parsed.data.qrPayload,
    dojoId: parsed.data.dojoId,
    eventId: parsed.data.eventId,
    memberId: session.user.memberId,
  };

  const attempts = [
    { path: "/v1/attendance/checkin", method: "POST" as const },
    { path: "/v1/attendance/check-in", method: "POST" as const },
    { path: "/v1/attendance", method: "POST" as const },
  ];

  let lastError = "Gagal melakukan absensi";
  let lastStatus = 400;

  for (const attempt of attempts) {
    const { res, data } = await inkaiFetch(
      attempt.path,
      { method: attempt.method, body: JSON.stringify(payload) },
      token,
    );
    if (res.ok) {
      return NextResponse.json({
        success: true,
        message: "Absensi berhasil dicatat",
        attendance: data.data,
      });
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

  return NextResponse.json({ error: lastError }, { status: lastStatus });
}

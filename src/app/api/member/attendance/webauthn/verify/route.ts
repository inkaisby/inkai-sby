import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  consumeWebAuthnChallenge,
  issueBiometricCheckInToken,
  loadAttendanceWebAuthnCredential,
} from "@/lib/attendance-webauthn";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const credentialId = String(
    (body as { credentialId?: string } | null)?.credentialId || "",
  ).trim();
  const challenge = String(
    (body as { challenge?: string } | null)?.challenge || "",
  ).trim();

  if (!credentialId || !challenge) {
    return NextResponse.json(
      { error: "Verifikasi biometrik tidak lengkap" },
      { status: 400 },
    );
  }

  const stored = await loadAttendanceWebAuthnCredential(session.user.id);
  if (!stored || stored.credentialId !== credentialId) {
    return NextResponse.json(
      { error: "Credential biometrik tidak dikenali" },
      { status: 400 },
    );
  }

  const ok = await consumeWebAuthnChallenge(session.user.id, challenge);
  if (!ok) {
    return NextResponse.json(
      { error: "Challenge biometrik tidak valid atau kedaluwarsa" },
      { status: 400 },
    );
  }

  const biometricToken = await issueBiometricCheckInToken(session.user.id);
  return NextResponse.json({ success: true, biometricToken });
}

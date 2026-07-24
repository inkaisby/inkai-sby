import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  issueWebAuthnChallenge,
  loadAttendanceWebAuthnCredential,
  saveAttendanceWebAuthnCredential,
  webAuthnRpId,
} from "@/lib/attendance-webauthn";
import { SITE_URL } from "@/lib/site";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    new URL(SITE_URL).host;
  const rpID = webAuthnRpId(host.split(",")[0].trim());
  const existing = await loadAttendanceWebAuthnCredential(session.user.id);
  const challenge = await issueWebAuthnChallenge(session.user.id);

  if (url.searchParams.get("mode") === "auth") {
    if (!existing) {
      return NextResponse.json(
        { error: "Biometrik belum diaktifkan" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      options: {
        challenge,
        timeout: 60000,
        rpId: rpID,
        allowCredentials: [
          {
            type: "public-key",
            id: existing.credentialId,
            transports: existing.transports,
          },
        ],
        userVerification: "required",
      },
      registered: true,
    });
  }

  return NextResponse.json({
    options: {
      challenge,
      rp: { name: "INKAI Surabaya Absensi", id: rpID },
      user: {
        id: session.user.id,
        name: session.user.email || session.user.id,
        displayName: session.user.name || "Anggota",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      timeout: 60000,
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      attestation: "none",
    },
    registered: Boolean(existing),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const credentialId = String(
    (body as { credentialId?: string }).credentialId || "",
  ).trim();
  const challenge = String(
    (body as { challenge?: string }).challenge || "",
  ).trim();
  const publicKey = String(
    (body as { publicKey?: string }).publicKey || "",
  ).trim();
  const transports = Array.isArray((body as { transports?: unknown }).transports)
    ? ((body as { transports: unknown[] }).transports.filter(
        (t) => typeof t === "string",
      ) as string[])
    : undefined;

  if (!credentialId || !challenge) {
    return NextResponse.json(
      { error: "Credential tidak lengkap" },
      { status: 400 },
    );
  }

  const { consumeWebAuthnChallenge } = await import(
    "@/lib/attendance-webauthn"
  );
  const ok = await consumeWebAuthnChallenge(session.user.id, challenge);
  if (!ok) {
    return NextResponse.json(
      { error: "Challenge biometrik tidak valid atau kedaluwarsa" },
      { status: 400 },
    );
  }

  await saveAttendanceWebAuthnCredential(session.user.id, {
    credentialId,
    publicKey: publicKey || undefined,
    transports,
  });

  return NextResponse.json({ success: true, registered: true });
}

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const CRED_KEY = (userId: string) => `attendance-webauthn:${userId}`;
const CHALLENGE_KEY = (userId: string) => `attendance-webauthn-challenge:${userId}`;

export type StoredWebAuthnCredential = {
  credentialId: string;
  /** base64url public key bytes (COSE) — opsional untuk verifikasi penuh nanti */
  publicKey?: string;
  transports?: string[];
  createdAt: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function toBase64Url(buf: ArrayBuffer | Uint8Array | Buffer): string {
  const b = Buffer.isBuffer(buf)
    ? buf
    : Buffer.from(buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf);
  return b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function fromBase64Url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

export async function loadAttendanceWebAuthnCredential(
  userId: string,
): Promise<StoredWebAuthnCredential | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: CRED_KEY(userId) },
  });
  const v = asRecord(row?.value);
  if (!v || typeof v.credentialId !== "string") return null;
  return {
    credentialId: v.credentialId,
    publicKey: typeof v.publicKey === "string" ? v.publicKey : undefined,
    transports: Array.isArray(v.transports)
      ? v.transports.filter((t): t is string => typeof t === "string")
      : undefined,
    createdAt: typeof v.createdAt === "string" ? v.createdAt : new Date().toISOString(),
  };
}

export async function saveAttendanceWebAuthnCredential(
  userId: string,
  cred: Omit<StoredWebAuthnCredential, "createdAt"> & { createdAt?: string },
) {
  const value: StoredWebAuthnCredential = {
    credentialId: cred.credentialId,
    publicKey: cred.publicKey,
    transports: cred.transports,
    createdAt: cred.createdAt || new Date().toISOString(),
  };
  await prisma.appSetting.upsert({
    where: { key: CRED_KEY(userId) },
    create: { key: CRED_KEY(userId), value },
    update: { value },
  });
}

export async function deleteAttendanceWebAuthnCredential(userId: string) {
  await prisma.appSetting.deleteMany({ where: { key: CRED_KEY(userId) } });
}

export async function issueWebAuthnChallenge(userId: string): Promise<string> {
  const challenge = toBase64Url(randomBytes(32));
  const value = {
    challenge,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  await prisma.appSetting.upsert({
    where: { key: CHALLENGE_KEY(userId) },
    create: { key: CHALLENGE_KEY(userId), value },
    update: { value },
  });
  return challenge;
}

export async function consumeWebAuthnChallenge(
  userId: string,
  challenge: string,
): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({
    where: { key: CHALLENGE_KEY(userId) },
  });
  const v = asRecord(row?.value);
  if (!v || typeof v.challenge !== "string") return false;
  if (v.challenge !== challenge) return false;
  const expiresAt = typeof v.expiresAt === "number" ? v.expiresAt : 0;
  if (Date.now() > expiresAt) return false;
  await prisma.appSetting.deleteMany({ where: { key: CHALLENGE_KEY(userId) } });
  return true;
}

/** Token sekali pakai setelah biometrik sukses (5 menit) agar check-in boleh method biometric. */
export async function issueBiometricCheckInToken(userId: string): Promise<string> {
  const token = toBase64Url(randomBytes(24));
  const key = `attendance-bio-ok:${userId}`;
  const value = { token, expiresAt: Date.now() + 5 * 60 * 1000 };
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  return token;
}

export async function consumeBiometricCheckInToken(
  userId: string,
  token: string,
): Promise<boolean> {
  const key = `attendance-bio-ok:${userId}`;
  const row = await prisma.appSetting.findUnique({ where: { key } });
  const v = asRecord(row?.value);
  if (!v || typeof v.token !== "string" || v.token !== token) return false;
  const expiresAt = typeof v.expiresAt === "number" ? v.expiresAt : 0;
  if (Date.now() > expiresAt) return false;
  await prisma.appSetting.deleteMany({ where: { key } });
  return true;
}

export function webAuthnRpId(host: string): string {
  return host.replace(/:\d+$/, "");
}

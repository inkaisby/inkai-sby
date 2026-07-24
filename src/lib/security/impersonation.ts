import { createHash, randomUUID } from "crypto";
import { cookies } from "next/headers";
import { EncryptJWT, jwtDecrypt } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  getPrimaryAdminRole,
  type SessionUser,
} from "@/lib/rbac";
import { buildPresenceScopeWhere } from "@/lib/presence";
import { writeLocalAuditLog } from "@/lib/audit";

import { IMPERSONATION_CONFIRM_PHRASE } from "@/lib/security/impersonation-constants";
export { IMPERSONATION_CONFIRM_PHRASE } from "@/lib/security/impersonation-constants";

export const IMPERSONATION_COOKIE = "inkai_impersonation";
/** Durasi cookie impersonasi (15 menit) — dipersingkat agar risiko sesi bocor lebih kecil (Mode A). */
export const IMPERSONATION_TTL_SEC = 15 * 60;

export type ImpersonationClaims = {
  actorId: string;
  targetUserId: string;
  exp: number;
  sessionId: string;
};

export type ImpersonationOverlay = {
  impersonatorId: string;
  impersonatingUserId: string;
  impersonationExp: number;
  impersonationSessionId: string;
  user: SessionUser;
};

function isImpersonationEnabled() {
  return process.env.IMPERSONATION_ENABLED !== "false";
}

function getSecretKey() {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "";
  if (!secret) {
    throw new Error("AUTH_SECRET tidak dikonfigurasi");
  }
  return createHash("sha256").update(secret).digest();
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function roleRank(roles: string[]): number {
  const primary = getPrimaryAdminRole(roles);
  const ranks: Record<string, number> = {
    ADMINISTRATOR: 0,
    ADMIN_PUSAT: 0,
    ADMIN: 0,
    ADMIN_PROVINCE: 1,
    ADMIN_BRANCH: 2,
    ADMIN_DOJO: 3,
    MEMBER: 4,
    PARENT: 4,
  };
  return ranks[primary] ?? 4;
}

export function isPusatRole(roles: string[]) {
  const r = getPrimaryAdminRole(roles);
  return r === "ADMINISTRATOR" || r === "ADMIN_PUSAT" || r === "ADMIN";
}

export function canStartImpersonation(roles: string[]) {
  if (!isImpersonationEnabled()) return false;
  const primary = getPrimaryAdminRole(roles);
  if (primary === "ADMIN_DOJO") return false;
  return isPusatRole(roles) || primary === "ADMIN_BRANCH";
}

export async function encryptImpersonationClaims(
  claims: Omit<ImpersonationClaims, "exp"> & { exp?: number },
): Promise<string> {
  const exp =
    claims.exp ?? Math.floor(Date.now() / 1000) + IMPERSONATION_TTL_SEC;
  return new EncryptJWT({
    actorId: claims.actorId,
    targetUserId: claims.targetUserId,
    sessionId: claims.sessionId,
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .encrypt(getSecretKey());
}

export async function decryptImpersonationToken(
  token: string,
): Promise<ImpersonationClaims | null> {
  try {
    const { payload } = await jwtDecrypt(token, getSecretKey());
    const actorId = typeof payload.actorId === "string" ? payload.actorId : "";
    const targetUserId =
      typeof payload.targetUserId === "string" ? payload.targetUserId : "";
    const sessionId =
      typeof payload.sessionId === "string" ? payload.sessionId : "";
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    if (!actorId || !targetUserId || !sessionId || !exp) return null;
    if (exp * 1000 <= Date.now()) return null;
    return { actorId, targetUserId, sessionId, exp };
  } catch {
    return null;
  }
}

export async function readImpersonationClaims(): Promise<ImpersonationClaims | null> {
  if (!isImpersonationEnabled()) return null;
  try {
    const jar = await cookies();
    const raw = jar.get(IMPERSONATION_COOKIE)?.value;
    if (!raw) return null;
    return decryptImpersonationToken(raw);
  } catch {
    return null;
  }
}

export async function setImpersonationCookie(claims: ImpersonationClaims) {
  const token = await encryptImpersonationClaims(claims);
  const jar = await cookies();
  jar.set(IMPERSONATION_COOKIE, token, cookieOptions(IMPERSONATION_TTL_SEC));
}

export async function clearImpersonationCookie() {
  const jar = await cookies();
  jar.delete(IMPERSONATION_COOKIE);
}

async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false, isActive: true },
    select: {
      id: true,
      email: true,
      fullName: true,
      photoUrl: true,
      managedProvinceId: true,
      managedBranchId: true,
      managedDojoId: true,
      roles: { select: { name: true } },
      member: { select: { id: true } },
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.fullName || user.email,
    roles: user.roles.map((r) => r.name),
    managedProvinceId: user.managedProvinceId,
    managedBranchId: user.managedBranchId,
    managedDojoId: user.managedDojoId,
    memberId: user.member?.id ?? null,
    photoUrl: user.photoUrl,
    image: user.photoUrl,
  };
}

/** Overlay sesi target bila cookie valid dan actor cocok dengan JWT sub. */
export async function resolveImpersonationOverlay(
  actorId: string | undefined | null,
): Promise<ImpersonationOverlay | null> {
  if (!actorId || !isImpersonationEnabled()) return null;
  const claims = await readImpersonationClaims();
  if (!claims || claims.actorId !== actorId) return null;

  const target = await loadSessionUser(claims.targetUserId);
  if (!target) return null;

  return {
    impersonatorId: claims.actorId,
    impersonatingUserId: claims.targetUserId,
    impersonationExp: claims.exp,
    impersonationSessionId: claims.sessionId,
    user: target,
  };
}

export async function isCurrentlyImpersonating(): Promise<boolean> {
  const claims = await readImpersonationClaims();
  return Boolean(claims);
}

export type StartImpersonationInput = {
  actor: SessionUser;
  targetUserId: string;
  reason: string;
  password: string;
  confirmPhrase: string;
  ip?: string | null;
  userAgent?: string | null;
};

export type StartImpersonationResult =
  | { ok: true; sessionId: string; target: SessionUser }
  | { ok: false; status: number; error: string; auditAction?: string };

export async function startImpersonation(
  input: StartImpersonationInput,
): Promise<StartImpersonationResult> {
  const deny = (
    status: number,
    error: string,
  ): StartImpersonationResult => {
    writeLocalAuditLog({
      userId: input.actor.id,
      email: input.actor.email,
      action: "SECURITY_IMPERSONATE_DENIED",
      details: `targetUserId=${input.targetUserId} reason=${error}`,
      ip: input.ip,
      userAgent: input.userAgent,
    });
    return { ok: false, status, error, auditAction: "SECURITY_IMPERSONATE_DENIED" };
  };

  if (!isImpersonationEnabled()) {
    return deny(403, "Impersonasi dinonaktifkan");
  }

  if (!canStartImpersonation(input.actor.roles)) {
    return deny(403, "Peran tidak diizinkan melakukan impersonasi");
  }

  if (input.confirmPhrase.trim() !== IMPERSONATION_CONFIRM_PHRASE) {
    return deny(400, `Frasa konfirmasi harus tepat: ${IMPERSONATION_CONFIRM_PHRASE}`);
  }

  const reason = input.reason.trim();
  if (reason.length < 3) {
    return deny(400, "Alasan wajib diisi (min. 3 karakter)");
  }

  const existing = await readImpersonationClaims();
  if (existing) {
    return deny(409, "Sudah dalam mode impersonasi — hentikan dulu");
  }

  if (input.targetUserId === input.actor.id) {
    return deny(400, "Tidak dapat mengambil alih akun sendiri");
  }

  const actorRow = await prisma.user.findFirst({
    where: { id: input.actor.id, isDeleted: false },
    select: { passwordHash: true },
  });
  if (!actorRow?.passwordHash) {
    return deny(400, "Password tidak dapat diverifikasi");
  }
  const passwordOk = await bcrypt.compare(input.password, actorRow.passwordHash);
  if (!passwordOk) {
    return deny(401, "Password salah");
  }

  const targetRow = await prisma.user.findFirst({
    where: { id: input.targetUserId, isDeleted: false },
    select: {
      id: true,
      email: true,
      fullName: true,
      photoUrl: true,
      isActive: true,
      managedProvinceId: true,
      managedBranchId: true,
      managedDojoId: true,
      roles: { select: { name: true } },
      member: { select: { id: true } },
    },
  });
  if (!targetRow || !targetRow.isActive) {
    return deny(404, "Target tidak ditemukan atau tidak aktif");
  }

  const targetRoles = targetRow.roles.map((r) => r.name);
  if (isPusatRole(targetRoles)) {
    return deny(403, "Tidak dapat mengambil alih akun pusat");
  }

  if (roleRank(targetRoles) <= roleRank(input.actor.roles)) {
    return deny(403, "Target harus memiliki peran yang lebih rendah");
  }

  const actorPrimary = getPrimaryAdminRole(input.actor.roles);
  if (actorPrimary === "ADMIN_BRANCH") {
    const scope = buildPresenceScopeWhere(input.actor);
    if (!scope) {
      return deny(403, "Di luar cakupan cabang");
    }
    const inScope = await prisma.user.findFirst({
      where: { AND: [{ id: targetRow.id }, scope] },
      select: { id: true },
    });
    if (!inScope) {
      return deny(403, "Target di luar cakupan cabang Anda");
    }
  }

  const sessionId = randomUUID();
  const exp = Math.floor(Date.now() / 1000) + IMPERSONATION_TTL_SEC;
  await setImpersonationCookie({
    actorId: input.actor.id,
    targetUserId: targetRow.id,
    sessionId,
    exp,
  });

  const target: SessionUser = {
    id: targetRow.id,
    email: targetRow.email,
    name: targetRow.fullName || targetRow.email,
    roles: targetRoles,
    managedProvinceId: targetRow.managedProvinceId,
    managedBranchId: targetRow.managedBranchId,
    managedDojoId: targetRow.managedDojoId,
    memberId: targetRow.member?.id ?? null,
    photoUrl: targetRow.photoUrl,
    image: targetRow.photoUrl,
  };

  writeLocalAuditLog({
    userId: input.actor.id,
    email: input.actor.email,
    action: "SECURITY_IMPERSONATE_START",
    details: `targetUserId=${target.id} targetEmail=${target.email} sessionId=${sessionId} reason=${reason.slice(0, 200)}`,
    ip: input.ip,
    userAgent: input.userAgent,
  });

  void prisma.notification
    .create({
      data: {
        userId: target.id,
        title: "Sesi diambil alih sementara",
        content: `Akun Anda sedang diakses oleh pengurus untuk keperluan dukungan. Alasan: ${reason.slice(0, 200)}`,
        type: "WARNING",
        audience: "ADMIN",
      },
    })
    .catch(() => {});

  return { ok: true, sessionId, target };
}

export async function stopImpersonation(opts: {
  actorId: string;
  actorEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const claims = await readImpersonationClaims();
  if (!claims || claims.actorId !== opts.actorId) {
    await clearImpersonationCookie();
    return { stopped: false as const };
  }

  await clearImpersonationCookie();

  writeLocalAuditLog({
    userId: opts.actorId,
    email: opts.actorEmail,
    action: "SECURITY_IMPERSONATE_STOP",
    details: `targetUserId=${claims.targetUserId} sessionId=${claims.sessionId}`,
    ip: opts.ip,
    userAgent: opts.userAgent,
  });

  void prisma.notification
    .create({
      data: {
        userId: claims.targetUserId,
        title: "Sesi ambil alih berakhir",
        content: "Akses sementara pengurus ke akun Anda telah dihentikan.",
        type: "INFO",
        audience: "ADMIN",
      },
    })
    .catch(() => {});

  return { stopped: true as const, targetUserId: claims.targetUserId };
}

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeLocalAuditLog } from "@/lib/audit";
import { normalizeNia } from "@/lib/member-profile-locks";
import { normalizeNiaKey } from "@/lib/security/password";

/** Match Inkai backend register/change-password cost. */
export const NIA_LOGIN_BCRYPT_ROUNDS = 12;

export type ProvisionNiaLoginResult =
  | {
      status: "created";
      memberId: string;
      userId: string;
      email: string;
      nia: string;
    }
  | {
      status: "skipped";
      memberId: string;
      reason:
        | "archived"
        | "no_nia"
        | "already_has_user"
        | "not_found";
      nia?: string | null;
      userId?: string | null;
      email?: string | null;
    }
  | {
      status: "failed";
      memberId: string;
      reason: string;
      nia?: string | null;
    };

function emailBaseForNia(nia: string) {
  const compact = nia.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "member";
  return `nia.${compact}@members.inkaisby.local`;
}

function emailWithMemberSuffix(nia: string, memberId: string) {
  const compact = nia.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "member";
  const suffix = memberId.replace(/-/g, "").slice(0, 4).toLowerCase() || "x";
  return `nia.${compact}-${suffix}@members.inkaisby.local`;
}

async function resolveUniqueNiaEmail(nia: string, memberId: string) {
  const base = emailBaseForNia(nia);
  const clash = await prisma.user.findFirst({
    where: { email: { equals: base, mode: "insensitive" } },
    select: { id: true },
  });
  if (!clash) return base;

  const fallback = emailWithMemberSuffix(nia, memberId);
  const clash2 = await prisma.user.findFirst({
    where: { email: { equals: fallback, mode: "insensitive" } },
    select: { id: true },
  });
  if (!clash2) return fallback;

  const longSuffix = memberId.replace(/-/g, "").slice(0, 12).toLowerCase();
  return `nia.${compactSafe(nia)}.${longSuffix}@members.inkaisby.local`;
}

function compactSafe(nia: string) {
  return nia.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "member";
}

async function ensureMemberRole(userId: string) {
  const role = await prisma.role.upsert({
    where: { name: "MEMBER" },
    create: { name: "MEMBER" },
    update: {},
    select: { id: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { roles: { connect: { id: role.id } } },
  });
}

/**
 * Buat User login untuk anggota ber-NIA yang belum punya akun.
 * Tidak menimpa password / akun yang sudah ada (idempotent).
 */
export async function provisionMemberNiaLogin(
  memberId: string,
  opts?: { actorUserId?: string | null; actorEmail?: string | null },
): Promise<ProvisionNiaLoginResult> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      fullName: true,
      nia: true,
      userId: true,
      isDeleted: true,
      user: { select: { id: true, email: true } },
    },
  });

  if (!member) {
    return { status: "skipped", memberId, reason: "not_found" };
  }
  if (member.isDeleted) {
    return { status: "skipped", memberId, reason: "archived", nia: member.nia };
  }

  const nia = normalizeNia(member.nia);
  if (!nia) {
    return {
      status: "skipped",
      memberId,
      reason: "no_nia",
      nia: member.nia,
    };
  }

  // Canonicalize stored NIA if needed (non-fatal).
  if (member.nia !== nia) {
    try {
      await prisma.member.update({
        where: { id: memberId },
        data: { nia },
      });
    } catch (err) {
      console.warn("[provisionMemberNiaLogin] normalize NIA write skipped:", err);
    }
  }

  if (member.userId || member.user) {
    writeLocalAuditLog({
      userId: opts?.actorUserId,
      email: opts?.actorEmail,
      action: "MEMBER_NIA_LOGIN_SKIP",
      details: `memberId=${memberId} nia=${nia} reason=already_has_user`,
    });
    return {
      status: "skipped",
      memberId,
      reason: "already_has_user",
      nia,
      userId: member.userId ?? member.user?.id ?? null,
      email: member.user?.email ?? null,
    };
  }

  try {
    const passwordHash = await bcrypt.hash(
      normalizeNiaKey(nia),
      NIA_LOGIN_BCRYPT_ROUNDS,
    );
    const email = await resolveUniqueNiaEmail(nia, memberId);

    const created = await prisma.user.create({
      data: {
        email,
        fullName: member.fullName,
        passwordHash,
        isActive: true,
        member: { connect: { id: memberId } },
        roles: {
          connectOrCreate: {
            where: { name: "MEMBER" },
            create: { name: "MEMBER" },
          },
        },
      },
      select: { id: true, email: true },
    });

    await ensureMemberRole(created.id);

    const linked = await prisma.user.findFirst({
      where: {
        id: created.id,
        member: { id: memberId },
      },
      select: { id: true, email: true, member: { select: { userId: true } } },
    });
    if (!linked?.member?.userId) {
      throw new Error(`Relasi User↔Member gagal untuk ${memberId}`);
    }

    writeLocalAuditLog({
      userId: opts?.actorUserId,
      email: opts?.actorEmail,
      action: "MEMBER_NIA_LOGIN_CREATE",
      details: `memberId=${memberId} nia=${nia} userId=${created.id} email=${created.email}`,
    });

    return {
      status: "created",
      memberId,
      userId: created.id,
      email: created.email,
      nia,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "provision_failed";
    console.error("[provisionMemberNiaLogin]", memberId, err);
    writeLocalAuditLog({
      userId: opts?.actorUserId,
      email: opts?.actorEmail,
      action: "MEMBER_NIA_LOGIN_FAIL",
      details: `memberId=${memberId} nia=${nia} reason=${reason.slice(0, 200)}`,
    });
    return { status: "failed", memberId, reason, nia };
  }
}

/** Best-effort wrapper for write hooks — never throws. */
export async function tryProvisionMemberNiaLogin(
  memberId: string | null | undefined,
  opts?: { actorUserId?: string | null; actorEmail?: string | null },
): Promise<ProvisionNiaLoginResult | null> {
  if (!memberId) return null;
  try {
    return await provisionMemberNiaLogin(memberId, opts);
  } catch (err) {
    console.error("[tryProvisionMemberNiaLogin]", memberId, err);
    return {
      status: "failed",
      memberId,
      reason: err instanceof Error ? err.message : "unknown",
    };
  }
}

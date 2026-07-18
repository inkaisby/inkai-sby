import { prisma } from "@/lib/prisma";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { writeAuditLog } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { buildMemberFilter, type SessionUser } from "@/lib/rbac";
import {
  clearMemberLifecycle,
  getMemberImpact,
  reasonLabel,
  setMemberLifecycle,
  statusKindLabel,
  type DeactivateReasonCode,
  type MemberStatusKind,
} from "@/lib/member-lifecycle";
import { isCabangAdmin } from "@/lib/wilayah-rbac";

function normalizeStatus(status: string) {
  return status.trim().toUpperCase();
}

function namesMatch(a: string, b: string) {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

async function syncLinkedUserActive(userId: string | null, isActive: boolean) {
  if (!userId) return;
  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });
}

async function notifyMemberLifecycle(opts: {
  token: string;
  userId: string | null;
  title: string;
  content: string;
  type?: string;
}) {
  if (!opts.userId) return;
  try {
    await notifyUser({
      userId: opts.userId,
      title: opts.title,
      content: opts.content,
      type: opts.type ?? "WARNING",
      token: opts.token,
    });
  } catch {
    // non-blocking
  }
}

export async function findScopedMember(
  user: SessionUser,
  id: string,
  opts?: { includeDeleted?: boolean },
) {
  return prisma.member.findFirst({
    where: {
      AND: [{ id }, buildMemberFilter(user, opts)],
    },
    select: {
      id: true,
      fullName: true,
      nia: true,
      status: true,
      userId: true,
      isDeleted: true,
      updatedAt: true,
    },
  });
}

export async function deactivateMember(opts: {
  user: SessionUser;
  token: string;
  memberId: string;
  statusKind: MemberStatusKind;
  reasonCode: DeactivateReasonCode;
  reasonNote?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const member = await findScopedMember(opts.user, opts.memberId);
  if (!member) return { ok: false as const, error: "Anggota tidak ditemukan", status: 404 };

  const current = normalizeStatus(member.status);
  if (current === "INACTIVE" || current === "SUSPENDED") {
    return { ok: false as const, error: "Anggota sudah nonaktif / ditangguhkan", status: 400 };
  }
  if (current === "PENDING" || current === "REJECTED") {
    return {
      ok: false as const,
      error:
        "Gunakan Tolak untuk pendaftaran, atau Hapus jika data salah. Nonaktif hanya untuk anggota aktif.",
      status: 400,
    };
  }

  const targetStatus = opts.statusKind;
  await prisma.member.update({
    where: { id: opts.memberId },
    data: { status: targetStatus },
  });
  await syncLinkedUserActive(member.userId, false);

  const changedAt = new Date().toISOString();
  await setMemberLifecycle(opts.memberId, {
    statusKind: opts.statusKind,
    reasonCode: opts.reasonCode,
    reasonNote: opts.reasonNote?.trim() || null,
    changedAt,
    changedByUserId: opts.user.id,
    changedByEmail: opts.user.email ?? null,
    changedByName: opts.user.name ?? null,
    previousStatus: member.status,
  });

  await inkaiFetch(
    `/v1/members/${opts.memberId}`,
    { method: "PATCH", body: JSON.stringify({ status: targetStatus }) },
    opts.token,
  );

  const kindLabel = statusKindLabel(opts.statusKind);
  const why = reasonLabel(opts.reasonCode);
  const note = opts.reasonNote?.trim();

  writeAuditLog({
    userId: opts.user.id,
    email: opts.user.email,
    action: "MEMBER_DEACTIVATE",
    details: JSON.stringify({
      memberId: opts.memberId,
      fullName: member.fullName,
      statusKind: opts.statusKind,
      reasonCode: opts.reasonCode,
      reasonNote: note || null,
    }),
    ip: opts.ip,
    userAgent: opts.userAgent,
    token: opts.token,
  });

  await notifyMemberLifecycle({
    token: opts.token,
    userId: member.userId,
    title: `Keanggotaan ${kindLabel.toLowerCase()}`,
    content: `Status keanggotaan Anda sekarang: ${kindLabel}. Alasan: ${why}${note ? ` — ${note}` : ""}. Hubungi ketua ranting/cabang jika ada pertanyaan.`,
    type: "WARNING",
  });

  return {
    ok: true as const,
    status: targetStatus,
    message: `Anggota ${kindLabel.toLowerCase()}. Login diblokir; riwayat & NIA tetap tersimpan.`,
  };
}

export async function activateMember(opts: {
  user: SessionUser;
  token: string;
  memberId: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const member = await findScopedMember(opts.user, opts.memberId);
  if (!member) return { ok: false as const, error: "Anggota tidak ditemukan", status: 404 };

  const current = normalizeStatus(member.status);
  if (current !== "INACTIVE" && current !== "SUSPENDED") {
    return {
      ok: false as const,
      error: "Hanya anggota nonaktif / ditangguhkan yang dapat diaktifkan ulang",
      status: 400,
    };
  }

  await prisma.member.update({
    where: { id: opts.memberId },
    data: { status: "Active" },
  });
  await syncLinkedUserActive(member.userId, true);
  await clearMemberLifecycle(opts.memberId);

  await inkaiFetch(
    `/v1/members/${opts.memberId}`,
    { method: "PATCH", body: JSON.stringify({ status: "Active" }) },
    opts.token,
  );

  writeAuditLog({
    userId: opts.user.id,
    email: opts.user.email,
    action: "MEMBER_ACTIVATE",
    details: JSON.stringify({
      memberId: opts.memberId,
      fullName: member.fullName,
    }),
    ip: opts.ip,
    userAgent: opts.userAgent,
    token: opts.token,
  });

  await notifyMemberLifecycle({
    token: opts.token,
    userId: member.userId,
    title: "Keanggotaan diaktifkan kembali",
    content:
      "Status keanggotaan Anda kembali Aktif. Login dan layanan anggota sudah dibuka kembali.",
    type: "SUCCESS",
  });

  return {
    ok: true as const,
    status: "Active",
    message: "Anggota diaktifkan kembali",
  };
}

export async function softDeleteMember(opts: {
  user: SessionUser;
  token: string;
  memberId: string;
  confirmName?: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const roles = opts.user.roles;
  const member = await findScopedMember(opts.user, opts.memberId);
  if (!member) return { ok: false as const, error: "Anggota tidak ditemukan", status: 404 };

  const hasOfficialNia = Boolean(member.nia?.trim());
  const isOfficialRecord =
    hasOfficialNia || normalizeStatus(member.status) === "ACTIVE";

  if (isOfficialRecord && !isCabangAdmin(roles)) {
    return {
      ok: false as const,
      error:
        "Anggota aktif atau ber-NIA hanya dapat dihapus oleh pengurus cabang. Gunakan Nonaktifkan jika anggota berhenti latihan.",
      status: 403,
    };
  }

  if (isOfficialRecord) {
    const confirm = opts.confirmName?.trim() || "";
    if (!confirm || !namesMatch(confirm, member.fullName)) {
      return {
        ok: false as const,
        error: `Ketik nama lengkap "${member.fullName}" untuk mengonfirmasi penghapusan`,
        status: 400,
      };
    }
  }

  const impact = await getMemberImpact(opts.memberId);

  await prisma.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: opts.memberId },
      data: { isDeleted: true, status: "INACTIVE" },
    });
    if (member.userId) {
      await tx.user.update({
        where: { id: member.userId },
        data: { isActive: false },
      });
    }
  });

  await setMemberLifecycle(opts.memberId, {
    statusKind: "INACTIVE",
    reasonCode: "LAINNYA",
    reasonNote: "Diarsipkan (soft-delete)",
    changedAt: new Date().toISOString(),
    changedByUserId: opts.user.id,
    changedByEmail: opts.user.email ?? null,
    changedByName: opts.user.name ?? null,
    previousStatus: member.status,
  });

  await inkaiFetch(`/v1/members/${opts.memberId}`, { method: "DELETE" }, opts.token);

  writeAuditLog({
    userId: opts.user.id,
    email: opts.user.email,
    action: "MEMBER_SOFT_DELETE",
    details: JSON.stringify({
      memberId: opts.memberId,
      fullName: member.fullName,
      nia: member.nia,
      impact,
    }),
    ip: opts.ip,
    userAgent: opts.userAgent,
    token: opts.token,
  });

  await notifyMemberLifecycle({
    token: opts.token,
    userId: member.userId,
    title: "Data keanggotaan diarsipkan",
    content:
      "Data keanggotaan Anda telah diarsipkan oleh pengurus. Hubungi sekretariat cabang jika ini tidak sesuai.",
    type: "WARNING",
  });

  return {
    ok: true as const,
    impact,
    message:
      "Anggota diarsipkan (soft-delete). Data riwayat tetap ada; tidak tampil di daftar aktif.",
  };
}

export async function restoreMember(opts: {
  user: SessionUser;
  token: string;
  memberId: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  if (!isCabangAdmin(opts.user.roles)) {
    return {
      ok: false as const,
      error: "Hanya pengurus cabang yang dapat memulihkan anggota dari arsip",
      status: 403,
    };
  }

  const member = await findScopedMember(opts.user, opts.memberId, {
    includeDeleted: true,
  });
  if (!member || !member.isDeleted) {
    return { ok: false as const, error: "Anggota arsip tidak ditemukan", status: 404 };
  }

  await prisma.member.update({
    where: { id: opts.memberId },
    data: { isDeleted: false, status: "INACTIVE" },
  });
  // Tetap nonaktif setelah restore — admin harus aktifkan ulang secara sadar
  await syncLinkedUserActive(member.userId, false);

  await setMemberLifecycle(opts.memberId, {
    statusKind: "INACTIVE",
    reasonCode: "LAINNYA",
    reasonNote: "Dipulihkan dari arsip (masih nonaktif)",
    changedAt: new Date().toISOString(),
    changedByUserId: opts.user.id,
    changedByEmail: opts.user.email ?? null,
    changedByName: opts.user.name ?? null,
    previousStatus: "ARCHIVED",
  });

  await inkaiFetch(
    `/v1/members/${opts.memberId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "INACTIVE", isDeleted: false }),
    },
    opts.token,
  );

  writeAuditLog({
    userId: opts.user.id,
    email: opts.user.email,
    action: "MEMBER_RESTORE",
    details: JSON.stringify({
      memberId: opts.memberId,
      fullName: member.fullName,
    }),
    ip: opts.ip,
    userAgent: opts.userAgent,
    token: opts.token,
  });

  return {
    ok: true as const,
    status: "INACTIVE",
    message:
      "Anggota dipulihkan dari arsip sebagai Nonaktif. Aktifkan kembali jika sudah siap.",
  };
}

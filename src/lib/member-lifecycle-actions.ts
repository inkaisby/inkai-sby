import { prisma } from "@/lib/prisma";
import {
  isPrismaBusyError,
  PRISMA_BUSY_USER_MESSAGE,
} from "@/lib/prisma-errors";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { writeAuditLog } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { buildMemberFilter, type SessionUser } from "@/lib/rbac";
import {
  clearMemberLifecycle,
  getMemberImpact,
  lifecycleSettingKey,
  reasonLabel,
  setMemberLifecycle,
  statusKindLabel,
  type DeactivateReasonCode,
  type MemberImpactSummary,
  type MemberStatusKind,
} from "@/lib/member-lifecycle";
import { isCabangAdmin } from "@/lib/wilayah-rbac";

const EMPTY_IMPACT: MemberImpactSummary = {
  unpaidBillingCount: 0,
  unpaidBillingAmount: 0,
  openEventRegistrationCount: 0,
  uktOpenCount: 0,
};

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
  try {
    const member = await findScopedMember(opts.user, opts.memberId);
    if (!member) {
      return { ok: false as const, error: "Anggota tidak ditemukan", status: 404 };
    }

    const current = normalizeStatus(member.status);
    if (current === "INACTIVE" || current === "SUSPENDED") {
      return {
        ok: false as const,
        error: "Anggota sudah nonaktif / ditangguhkan",
        status: 400,
      };
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
  } catch (err) {
    console.error("[deactivateMember]", err);
    if (isPrismaBusyError(err)) {
      return {
        ok: false as const,
        error: PRISMA_BUSY_USER_MESSAGE,
        status: 503,
      };
    }
    return {
      ok: false as const,
      error: "Gagal menonaktifkan anggota",
      status: 500,
    };
  }
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

const BULK_ARCHIVE_PHRASE = "ARSIPKAN";

export async function softDeleteMember(opts: {
  user: SessionUser;
  token: string;
  memberId: string;
  confirmName?: string;
  /** Bulk: ketik ARSIPKAN menggantikan konfirmasi nama per anggota. */
  confirmPhrase?: string;
  /**
   * Mode massal: lewati impact/notify & jangan tunggu Inkai DELETE
   * (sinkron lokal dulu; Inkai best-effort di background).
   */
  bulkFast?: boolean;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    const member = await findScopedMember(opts.user, opts.memberId);
    if (!member) {
      return { ok: false as const, error: "Anggota tidak ditemukan", status: 404 };
    }

    const hasOfficialNia = Boolean(member.nia?.trim());
    const isOfficialRecord =
      hasOfficialNia || normalizeStatus(member.status) === "ACTIVE";

    // Ranting & cabang boleh arsip dalam scope; aktif/ber-NIA wajib ketik nama
    // (atau frasa ARSIPKAN untuk aksi bulk).
    if (isOfficialRecord) {
      const bulkOk =
        opts.confirmPhrase?.trim().toUpperCase() === BULK_ARCHIVE_PHRASE;
      const confirm = opts.confirmName?.trim() || "";
      if (!bulkOk && (!confirm || !namesMatch(confirm, member.fullName))) {
        return {
          ok: false as const,
          error: `Ketik nama lengkap "${member.fullName}" untuk mengonfirmasi penghapusan`,
          status: 400,
        };
      }
    }

    const fast = Boolean(opts.bulkFast);

    // Impact hanya untuk audit single-delete — lewati di bulk.
    let impact: MemberImpactSummary = EMPTY_IMPACT;
    if (!fast) {
      try {
        impact = await getMemberImpact(opts.memberId);
      } catch (err) {
        if (!isPrismaBusyError(err)) {
          console.error("[softDeleteMember] impact", err);
        }
      }
    }

    // Hindari interactive $transaction (tahan koneksi session-mode lebih lama).
    await prisma.member.update({
      where: { id: opts.memberId },
      data: { isDeleted: true, status: "INACTIVE" },
    });
    if (member.userId) {
      await prisma.user.updateMany({
        where: { id: member.userId },
        data: { isActive: false },
      });
    }

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

    // Inkai sync: tunggu di single; fire-and-forget di bulk (paling lambat).
    const inkaiPromise = inkaiFetch(
      `/v1/members/${opts.memberId}`,
      { method: "DELETE" },
      opts.token,
    );
    if (fast) {
      void inkaiPromise.catch(() => {});
    } else {
      await inkaiPromise;
    }

    writeAuditLog({
      userId: opts.user.id,
      email: opts.user.email,
      action: "MEMBER_SOFT_DELETE",
      details: JSON.stringify({
        memberId: opts.memberId,
        fullName: member.fullName,
        nia: member.nia,
        impact: fast ? undefined : impact,
        bulkFast: fast || undefined,
      }),
      ip: opts.ip,
      userAgent: opts.userAgent,
      token: opts.token,
    });

    if (!fast) {
      await notifyMemberLifecycle({
        token: opts.token,
        userId: member.userId,
        title: "Data keanggotaan diarsipkan",
        content:
          "Data keanggotaan Anda telah diarsipkan oleh pengurus. Hubungi sekretariat cabang jika ini tidak sesuai.",
        type: "WARNING",
      });
    } else {
      void notifyMemberLifecycle({
        token: opts.token,
        userId: member.userId,
        title: "Data keanggotaan diarsipkan",
        content:
          "Data keanggotaan Anda telah diarsipkan oleh pengurus. Hubungi sekretariat cabang jika ini tidak sesuai.",
        type: "WARNING",
      });
    }

    return {
      ok: true as const,
      impact,
      message:
        "Anggota diarsipkan (soft-delete). Data riwayat tetap ada; tidak tampil di daftar aktif.",
    };
  } catch (err) {
    console.error("[softDeleteMember]", err);
    if (isPrismaBusyError(err)) {
      return {
        ok: false as const,
        error: PRISMA_BUSY_USER_MESSAGE,
        status: 503,
      };
    }
    return {
      ok: false as const,
      error: "Gagal mengarsipkan anggota",
      status: 500,
    };
  }
}

/**
 * Arsip massal cepat: updateMany lokal + lifecycle, Inkai DELETE di background.
 */
export async function softDeleteMembersBulk(opts: {
  user: SessionUser;
  token: string;
  memberIds: string[];
  confirmPhrase?: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  if (opts.confirmPhrase?.trim().toUpperCase() !== BULK_ARCHIVE_PHRASE) {
    return {
      results: opts.memberIds.map((id) => ({
        id,
        ok: false as const,
        error: 'Ketik "ARSIPKAN" untuk mengonfirmasi arsip massal',
      })),
    };
  }

  const ids = [...new Set(opts.memberIds.filter(Boolean))];
  if (ids.length === 0) return { results: [] as Array<{ id: string; ok: boolean; error?: string }> };

  try {
    const members = await prisma.member.findMany({
      where: {
        AND: [{ id: { in: ids } }, buildMemberFilter(opts.user)],
      },
      select: {
        id: true,
        fullName: true,
        nia: true,
        status: true,
        userId: true,
      },
    });
    const found = new Map(members.map((m) => [m.id, m]));
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    const okIds: string[] = [];
    const userIds: string[] = [];

    for (const id of ids) {
      const m = found.get(id);
      if (!m) {
        results.push({ id, ok: false, error: "Anggota tidak ditemukan" });
        continue;
      }
      okIds.push(id);
      if (m.userId) userIds.push(m.userId);
      results.push({ id, ok: true });
    }

    if (okIds.length === 0) return { results };

    await prisma.member.updateMany({
      where: { id: { in: okIds } },
      data: { isDeleted: true, status: "INACTIVE" },
    });

    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: uniqueUserIds } },
        data: { isActive: false },
      });
    }

    const changedAt = new Date().toISOString();
    // Lifecycle berurutan tipis agar pool session tidak meledak.
    for (const id of okIds) {
      const m = found.get(id)!;
      await setMemberLifecycle(id, {
        statusKind: "INACTIVE",
        reasonCode: "LAINNYA",
        reasonNote: "Diarsipkan (soft-delete)",
        changedAt,
        changedByUserId: opts.user.id,
        changedByEmail: opts.user.email ?? null,
        changedByName: opts.user.name ?? null,
        previousStatus: m.status,
      });
    }

    // Inkai + notifikasi: background (jangan blok response).
    for (const id of okIds) {
      void inkaiFetch(`/v1/members/${id}`, { method: "DELETE" }, opts.token);
      const m = found.get(id);
      if (m?.userId) {
        void notifyMemberLifecycle({
          token: opts.token,
          userId: m.userId,
          title: "Data keanggotaan diarsipkan",
          content:
            "Data keanggotaan Anda telah diarsipkan oleh pengurus. Hubungi sekretariat cabang jika ini tidak sesuai.",
          type: "WARNING",
        });
      }
    }

    writeAuditLog({
      userId: opts.user.id,
      email: opts.user.email,
      action: "MEMBER_SOFT_DELETE_BULK",
      details: JSON.stringify({
        count: okIds.length,
        memberIds: okIds,
      }),
      ip: opts.ip,
      userAgent: opts.userAgent,
      token: opts.token,
    });

    return { results };
  } catch (err) {
    console.error("[softDeleteMembersBulk]", err);
    if (isPrismaBusyError(err)) {
      return {
        results: ids.map((id) => ({
          id,
          ok: false as const,
          error: PRISMA_BUSY_USER_MESSAGE,
        })),
        busy: true as const,
      };
    }
    return {
      results: ids.map((id) => ({
        id,
        ok: false as const,
        error: "Gagal mengarsipkan anggota",
      })),
    };
  }
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

const BULK_PURGE_PHRASE = "HAPUS";

/**
 * Hapus permanen massal anggota arsip — sedikit round-trip Prisma
 * (bukan N× query per anggota) agar tidak kehabisan pool serverless.
 */
export async function purgeArchivedMembersBulk(opts: {
  user: SessionUser;
  token: string;
  memberIds: string[];
  confirmPhrase?: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const phrase = opts.confirmPhrase?.trim().toUpperCase() || "";
  if (phrase !== BULK_PURGE_PHRASE) {
    return {
      results: opts.memberIds.map((id) => ({
        id,
        ok: false as const,
        error: 'Ketik "HAPUS" untuk mengonfirmasi penghapusan permanen',
      })),
    };
  }

  const ids = [...new Set(opts.memberIds.filter(Boolean))];
  if (ids.length === 0) {
    return { results: [] as Array<{ id: string; ok: boolean; error?: string }> };
  }

  try {
    const members = await prisma.member.findMany({
      where: {
        AND: [
          { id: { in: ids } },
          { isDeleted: true },
          buildMemberFilter(opts.user),
        ],
      },
      select: { id: true, fullName: true, nia: true, userId: true },
    });
    const found = new Map(members.map((m) => [m.id, m]));
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    const okIds: string[] = [];
    const userIds: string[] = [];

    for (const id of ids) {
      const m = found.get(id);
      if (!m) {
        results.push({
          id,
          ok: false,
          error: "Hanya anggota di arsip yang dapat dihapus permanen",
        });
        continue;
      }
      okIds.push(id);
      if (m.userId) userIds.push(m.userId);
      results.push({ id, ok: true });
    }

    if (okIds.length === 0) return { results };

    // Sequential batch (bukan interactive $transaction) — cocok Transaction pooler.
    const billings = await prisma.billing.findMany({
      where: { memberId: { in: okIds } },
      select: { id: true },
    });
    const billingIds = billings.map((b) => b.id);
    if (billingIds.length > 0) {
      await prisma.payment.deleteMany({
        where: { billingId: { in: billingIds } },
      });
      await prisma.billing.deleteMany({ where: { id: { in: billingIds } } });
    }

    const orders = await prisma.storeOrder.findMany({
      where: { memberId: { in: okIds } },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length > 0) {
      await prisma.storeOrderItem.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await prisma.storeOrder.deleteMany({ where: { id: { in: orderIds } } });
    }

    await prisma.attendance.deleteMany({ where: { memberId: { in: okIds } } });
    await prisma.memberRank.deleteMany({ where: { memberId: { in: okIds } } });
    await prisma.eventRegistration.deleteMany({
      where: { memberId: { in: okIds } },
    });
    await prisma.verification.deleteMany({
      where: { memberId: { in: okIds } },
    });
    await prisma.appSetting.deleteMany({
      where: { key: { in: okIds.map(lifecycleSettingKey) } },
    });
    await prisma.member.deleteMany({ where: { id: { in: okIds } } });

    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: uniqueUserIds } },
        data: { isActive: false },
      });
    }

    for (const id of okIds) {
      void inkaiFetch(`/v1/members/${id}`, { method: "DELETE" }, opts.token);
    }

    writeAuditLog({
      userId: opts.user.id,
      email: opts.user.email,
      action: "MEMBER_PURGE_BULK",
      details: JSON.stringify({
        count: okIds.length,
        memberIds: okIds,
      }),
      ip: opts.ip,
      userAgent: opts.userAgent,
      token: opts.token,
    });

    return { results };
  } catch (err) {
    console.error("[purgeArchivedMembersBulk]", err);
    if (isPrismaBusyError(err)) {
      return {
        results: ids.map((id) => ({
          id,
          ok: false as const,
          error: PRISMA_BUSY_USER_MESSAGE,
        })),
        busy: true as const,
      };
    }
    return {
      results: ids.map((id) => ({
        id,
        ok: false as const,
        error: "Gagal menghapus permanen (ada data terkait)",
      })),
    };
  }
}

/**
 * Hapus permanen satu anggota arsip (wrapper bulk).
 */
export async function purgeArchivedMember(opts: {
  user: SessionUser;
  token: string;
  memberId: string;
  confirmPhrase?: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const bulk = await purgeArchivedMembersBulk({
    user: opts.user,
    token: opts.token,
    memberIds: [opts.memberId],
    confirmPhrase: opts.confirmPhrase,
    ip: opts.ip,
    userAgent: opts.userAgent,
  });
  const row = bulk.results[0];
  if ("busy" in bulk && bulk.busy) {
    return {
      ok: false as const,
      error: PRISMA_BUSY_USER_MESSAGE,
      status: 503,
    };
  }
  if (!row?.ok) {
    const msg = row?.error || "Gagal menghapus permanen";
    return {
      ok: false as const,
      error: msg,
      status: msg.includes("HAPUS") ? 400 : 404,
    };
  }
  return {
    ok: true as const,
    message: "Anggota dihapus permanen dari arsip",
  };
}

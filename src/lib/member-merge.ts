import { prisma } from "@/lib/prisma";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { writeAuditLog } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { buildMemberFilter, type SessionUser } from "@/lib/rbac";
import { isCabangAdmin, isRantingAdmin } from "@/lib/wilayah-rbac";
import { setMemberLifecycle } from "@/lib/member-lifecycle";
import { hardDuplicates, findMemberDuplicates } from "@/lib/member-duplicate";

export function canMergeMembers(roles: string[]) {
  return isCabangAdmin(roles) || isRantingAdmin(roles);
}

type MergeMemberRow = {
  id: string;
  fullName: string;
  nia: string | null;
  nik: string | null;
  status: string;
  userId: string | null;
  dojoId: string;
  isDeleted: boolean;
  gender: string | null;
  birthPlace: string | null;
  birthDate: Date | null;
  address: string | null;
  currentRank: string;
  birthCertificateUrl: string | null;
  bpjsCardUrl: string | null;
  bpjsCardNumber: string | null;
  bpjsOcrExtracted: unknown;
  createdAt: Date;
  user: { id: string; email: string | null; phoneNumber: string | null } | null;
  _count: {
    billings: number;
    attendances: number;
    eventRegistrations: number;
    ranks: number;
  };
};

function normalizeStatus(status: string) {
  return status.trim().toUpperCase();
}

function scoreMember(m: MergeMemberRow): number {
  const st = normalizeStatus(m.status);
  let score = 0;
  if (st === "ACTIVE") score += 100;
  if (st === "PENDING") score += 10;
  if (st === "REJECTED") score -= 20;
  if (m.nia?.trim()) score += 40;
  if (m.nik?.trim()) score += 15;
  if (m.birthCertificateUrl || m.bpjsCardUrl) score += 20;
  score += Math.min(m._count.billings, 20) * 2;
  score += Math.min(m._count.attendances, 30);
  score += Math.min(m._count.eventRegistrations, 10) * 3;
  score += Math.min(m._count.ranks, 10);
  // Prefer older operational record slightly
  score += Math.max(0, 10 - Math.floor((Date.now() - m.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  return score;
}

/** Pilih anggota yang dipertahankan (data operasional) vs yang digabung. */
export function resolveMergeSides(
  a: MergeMemberRow,
  b: MergeMemberRow,
): { keep: MergeMemberRow; merge: MergeMemberRow } {
  const scoreA = scoreMember(a);
  const scoreB = scoreMember(b);
  if (scoreA === scoreB) {
    // Prefer yang punya akun sebagai sumber login, tapi body = yang Active tanpa akun jika ada
    const aActiveNoUser = normalizeStatus(a.status) === "ACTIVE" && !a.userId;
    const bActiveNoUser = normalizeStatus(b.status) === "ACTIVE" && !b.userId;
    if (aActiveNoUser && !bActiveNoUser) return { keep: a, merge: b };
    if (bActiveNoUser && !aActiveNoUser) return { keep: b, merge: a };
    return a.createdAt <= b.createdAt ? { keep: a, merge: b } : { keep: b, merge: a };
  }
  return scoreA >= scoreB ? { keep: a, merge: b } : { keep: b, merge: a };
}

export function isMergePairEligible(
  keep: MergeMemberRow,
  merge: MergeMemberRow,
  roles: string[],
): { ok: true } | { ok: false; error: string } {
  if (keep.id === merge.id) {
    return { ok: false, error: "Tidak dapat menggabungkan anggota dengan dirinya sendiri" };
  }
  if (keep.isDeleted || merge.isDeleted) {
    return { ok: false, error: "Tidak dapat menggabungkan anggota yang sudah diarsipkan" };
  }

  const bothHaveAccount = Boolean(keep.userId && merge.userId);
  if (bothHaveAccount && !isCabangAdmin(roles)) {
    return {
      ok: false,
      error:
        "Kedua data punya akun login. Hanya pengurus cabang yang dapat menggabungkan (pilih email yang dipertahankan).",
    };
  }

  const neitherHasAccount = !keep.userId && !merge.userId;
  if (neitherHasAccount) {
    return {
      ok: false,
      error:
        "Tidak ada akun login untuk digabungkan. Hapus/arsipkan salah satu data duplikat saja.",
    };
  }

  return { ok: true };
}

async function loadMergeMember(user: SessionUser, id: string) {
  return prisma.member.findFirst({
    where: {
      AND: [{ id }, buildMemberFilter(user)],
    },
    select: {
      id: true,
      fullName: true,
      nia: true,
      nik: true,
      status: true,
      userId: true,
      dojoId: true,
      isDeleted: true,
      gender: true,
      birthPlace: true,
      birthDate: true,
      address: true,
      currentRank: true,
      birthCertificateUrl: true,
      bpjsCardUrl: true,
      bpjsCardNumber: true,
      bpjsOcrExtracted: true,
      createdAt: true,
      user: { select: { id: true, email: true, phoneNumber: true } },
      _count: {
        select: {
          billings: true,
          attendances: true,
          eventRegistrations: true,
          ranks: true,
        },
      },
    },
  });
}

function pickScalar<T>(keep: T, from: T): T {
  if (keep === null || keep === undefined || keep === "") return from;
  return keep;
}

/**
 * Gabungkan dua anggota: pertahankan data operasional `keep`,
 * pindahkan akun login dari `merge` bila perlu, reparent riwayat, arsipkan `merge`.
 */
export async function mergeMembers(opts: {
  user: SessionUser;
  token: string;
  keepMemberId: string;
  mergeMemberId: string;
  /** Jika keduanya punya akun: "keep" | "merge" — email mana yang dipertahankan. */
  preferUserFrom?: "keep" | "merge";
  ip?: string | null;
  userAgent?: string | null;
}) {
  if (!canMergeMembers(opts.user.roles)) {
    return { ok: false as const, error: "Tidak berwenang menggabungkan anggota", status: 403 };
  }

  const [rawA, rawB] = await Promise.all([
    loadMergeMember(opts.user, opts.keepMemberId),
    loadMergeMember(opts.user, opts.mergeMemberId),
  ]);
  if (!rawA || !rawB) {
    return { ok: false as const, error: "Anggota tidak ditemukan di cakupan Anda", status: 404 };
  }

  // Hormati preferensi keep/merge dari klien, tapi validasi pasangan
  let keep = rawA;
  let merge = rawB;
  // Jika klien kirim IDs terbalik dari skor, tetap hormati keepMemberId sebagai yang dipertahankan
  const eligibility = isMergePairEligible(keep, merge, opts.user.roles);
  if (!eligibility.ok) {
    return { ok: false as const, error: eligibility.error, status: 400 };
  }

  // Pastikan pasangan benar-benar duplikat keras (NIK/NIA/nama+TTL)
  const dupHits = hardDuplicates(
    await findMemberDuplicates({
      fullName: keep.fullName,
      birthDate: keep.birthDate
        ? keep.birthDate.toISOString().slice(0, 10)
        : merge.birthDate
          ? merge.birthDate.toISOString().slice(0, 10)
          : undefined,
      nik: keep.nik || merge.nik,
      nia: keep.nia || merge.nia,
      excludeMemberId: keep.id,
    }),
  );
  if (!dupHits.some((h) => h.id === merge.id)) {
    return {
      ok: false as const,
      error:
        "Kedua anggota tidak terdeteksi sebagai duplikat (NIK / NIA / nama+tanggal lahir). Periksa data terlebih dahulu.",
      status: 400,
    };
  }

  let linkedUserId: string | null = keep.userId;
  let deactivateUserId: string | null = null;

  if (keep.userId && merge.userId) {
    const prefer = opts.preferUserFrom ?? "keep";
    if (prefer === "merge") {
      linkedUserId = merge.userId;
      deactivateUserId = keep.userId;
    } else {
      linkedUserId = keep.userId;
      deactivateUserId = merge.userId;
    }
  } else if (!keep.userId && merge.userId) {
    linkedUserId = merge.userId;
  }

  const keepId = keep.id;
  const mergeId = merge.id;

  try {
    await prisma.$transaction(async (tx) => {
      // Lepas unique keys dari merge dulu agar tidak bentrok
      await tx.member.update({
        where: { id: mergeId },
        data: {
          userId: null,
          nik: null,
          nia: null,
        },
      });

      // Event registrations: hapus duplikat event yang sama di keep
      const mergeRegs = await tx.eventRegistration.findMany({
        where: { memberId: mergeId },
        select: { id: true, eventId: true },
      });
      if (mergeRegs.length > 0) {
        const keepEventIds = new Set(
          (
            await tx.eventRegistration.findMany({
              where: { memberId: keepId },
              select: { eventId: true },
            })
          ).map((r) => r.eventId),
        );
        const conflictIds = mergeRegs
          .filter((r) => keepEventIds.has(r.eventId))
          .map((r) => r.id);
        if (conflictIds.length > 0) {
          await tx.eventRegistration.deleteMany({ where: { id: { in: conflictIds } } });
        }
        await tx.eventRegistration.updateMany({
          where: { memberId: mergeId },
          data: { memberId: keepId },
        });
      }

      await tx.billing.updateMany({
        where: { memberId: mergeId },
        data: { memberId: keepId },
      });
      await tx.attendance.updateMany({
        where: { memberId: mergeId },
        data: { memberId: keepId },
      });
      await tx.memberRank.updateMany({
        where: { memberId: mergeId },
        data: { memberId: keepId },
      });
      await tx.verification.updateMany({
        where: { memberId: mergeId },
        data: { memberId: keepId },
      });
      await tx.storeOrder.updateMany({
        where: { memberId: mergeId },
        data: { memberId: keepId },
      });

      const nextStatus =
        normalizeStatus(keep.status) === "PENDING" ||
        normalizeStatus(keep.status) === "REJECTED"
          ? "Active"
          : keep.status;

      await tx.member.update({
        where: { id: keepId },
        data: {
          userId: linkedUserId,
          status: nextStatus,
          nia: pickScalar(keep.nia, merge.nia),
          nik: pickScalar(keep.nik, merge.nik),
          gender: pickScalar(keep.gender, merge.gender),
          birthPlace: pickScalar(keep.birthPlace, merge.birthPlace),
          birthDate: keep.birthDate ?? merge.birthDate,
          address: pickScalar(keep.address, merge.address),
          birthCertificateUrl: pickScalar(
            keep.birthCertificateUrl,
            merge.birthCertificateUrl,
          ),
          bpjsCardUrl: pickScalar(keep.bpjsCardUrl, merge.bpjsCardUrl),
          bpjsCardNumber: pickScalar(keep.bpjsCardNumber, merge.bpjsCardNumber),
          bpjsOcrExtracted:
            keep.bpjsOcrExtracted != null
              ? (keep.bpjsOcrExtracted as object)
              : merge.bpjsOcrExtracted != null
                ? (merge.bpjsOcrExtracted as object)
                : undefined,
        },
      });

      await tx.member.update({
        where: { id: mergeId },
        data: {
          isDeleted: true,
          status: "INACTIVE",
        },
      });

      if (linkedUserId) {
        await tx.user.update({
          where: { id: linkedUserId },
          data: { isActive: true },
        });
      }
      if (deactivateUserId && deactivateUserId !== linkedUserId) {
        await tx.user.update({
          where: { id: deactivateUserId },
          data: { isActive: false },
        });
      }
    });
  } catch (error) {
    console.error("[mergeMembers]", error);
    return {
      ok: false as const,
      error: "Gagal menggabungkan data di database",
      status: 500,
    };
  }

  await setMemberLifecycle(mergeId, {
    statusKind: "INACTIVE",
    reasonCode: "LAINNYA",
    reasonNote: `Digabung ke anggota ${keep.fullName} (${keepId})`,
    changedAt: new Date().toISOString(),
    changedByUserId: opts.user.id,
    changedByEmail: opts.user.email ?? null,
    changedByName: opts.user.name ?? null,
    previousStatus: merge.status,
  });

  // Sync Inkai: aktifkan keep, arsipkan merge
  const keepPatch: Record<string, unknown> = {
    status: "Active",
  };
  if (pickScalar(keep.nia, merge.nia)) keepPatch.nia = pickScalar(keep.nia, merge.nia);
  if (pickScalar(keep.nik, merge.nik)) keepPatch.nik = pickScalar(keep.nik, merge.nik);

  await inkaiFetch(
    `/v1/members/${keepId}`,
    { method: "PATCH", body: JSON.stringify(keepPatch) },
    opts.token,
  );
  // Jika keep sebelumnya PENDING, approve registration
  if (normalizeStatus(keep.status) === "PENDING") {
    await inkaiFetch(
      `/v1/members/${keepId}/registration`,
      { method: "PATCH", body: JSON.stringify({ action: "approve" }) },
      opts.token,
    );
  }
  await inkaiFetch(`/v1/members/${mergeId}`, { method: "DELETE" }, opts.token);

  writeAuditLog({
    userId: opts.user.id,
    email: opts.user.email,
    action: "MEMBER_MERGE",
    details: JSON.stringify({
      keepMemberId: keepId,
      mergeMemberId: mergeId,
      keepName: keep.fullName,
      mergeName: merge.fullName,
      linkedUserId,
      deactivateUserId,
    }),
    ip: opts.ip,
    userAgent: opts.userAgent,
    token: opts.token,
  });

  if (linkedUserId) {
    try {
      await notifyUser({
        userId: linkedUserId,
        title: "Akun digabungkan",
        content:
          "Data keanggotaan Anda telah digabungkan oleh pengurus. Silakan login dengan email yang sama; riwayat iuran/absensi dari data ranting ikut tersambung.",
        type: "SUCCESS",
        token: opts.token,
      });
    } catch {
      // non-blocking
    }
  }

  const email =
    linkedUserId === merge.userId
      ? merge.user?.email
      : linkedUserId === keep.userId
        ? keep.user?.email
        : keep.user?.email ?? merge.user?.email;

  return {
    ok: true as const,
    keepMemberId: keepId,
    mergeMemberId: mergeId,
    linkedEmail: email ?? null,
    message: email
      ? `Berhasil digabung. Akun login: ${email}. Data duplikat diarsipkan.`
      : "Berhasil digabung. Data duplikat diarsipkan.",
  };
}

/** Cari kandidat merge (duplikat keras) untuk satu anggota. */
export async function findMergeCandidatesForMember(
  user: SessionUser,
  memberId: string,
) {
  const member = await loadMergeMember(user, memberId);
  if (!member) {
    return {
      member: null as MergeMemberRow | null,
      candidates: [] as Array<{
        member: MergeMemberRow;
        reasons: string[];
        suggestedKeepId: string;
        mergeEligible: boolean;
        mergeBlockReason: string | null;
        suggestedMergeId: string;
      }>,
    };
  }

  const hits = hardDuplicates(
    await findMemberDuplicates({
      fullName: member.fullName,
      birthDate: member.birthDate
        ? member.birthDate.toISOString().slice(0, 10)
        : undefined,
      nik: member.nik,
      nia: member.nia,
      excludeMemberId: member.id,
    }),
  );

  const candidates: Array<{
    member: MergeMemberRow;
    reasons: string[];
    suggestedKeepId: string;
    suggestedMergeId: string;
    mergeEligible: boolean;
    mergeBlockReason: string | null;
  }> = [];

  for (const hit of hits) {
    const row = await loadMergeMember(user, hit.id);
    if (!row) continue;
    const sides = resolveMergeSides(member, row);
    const elig = isMergePairEligible(sides.keep, sides.merge, user.roles);
    candidates.push({
      member: row,
      reasons: hit.reasons,
      suggestedKeepId: sides.keep.id,
      suggestedMergeId: sides.merge.id,
      mergeEligible: elig.ok,
      mergeBlockReason: elig.ok ? null : elig.error,
    });
  }

  return { member, candidates };
}

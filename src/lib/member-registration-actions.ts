import { prisma, prismaUserFacingError } from "@/lib/prisma";
import {
  inkaiFetchWithServiceRetry,
  isInkaiAuthFailure,
  shouldApplyInkaiPrismaFallback,
  shouldHardFailInkaiMutation,
  inkaiErrorMessage,
} from "@/lib/inkai-api/server";
import { buildMemberFilter, type SessionUser } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

export type RegistrationDecisionResult =
  | {
      ok: true;
      status: string;
      message: string;
      inkaiOk: boolean;
    }
  | { ok: false; error: string; status: number };

async function syncUserActiveOnApprove(userId: string | null) {
  if (!userId) return;
  await prisma.user.updateMany({
    where: { id: userId },
    data: { isActive: true },
  });
}

export async function applyMemberRegistrationDecision(opts: {
  user: SessionUser;
  token: string;
  memberId: string;
  action: "approve" | "reject";
  nia?: string;
  ip?: string | null;
  userAgent?: string | null;
  auditSuffix?: string;
}): Promise<RegistrationDecisionResult> {
  const scoped = await prisma.member.findFirst({
    where: {
      AND: [{ id: opts.memberId }, buildMemberFilter(opts.user)],
    },
    select: {
      id: true,
      fullName: true,
      status: true,
      userId: true,
    },
  });
  if (!scoped) {
    return {
      ok: false,
      error: "Anggota tidak ditemukan di cakupan Anda",
      status: 404,
    };
  }

  const { res, data } = await inkaiFetchWithServiceRetry(
    `/v1/members/${opts.memberId}/registration`,
    {
      method: "PATCH",
      body: JSON.stringify({
        action: opts.action,
        nia: opts.nia,
      }),
    },
    opts.token,
  );

  const inkaiOk = res.ok;
  if (shouldHardFailInkaiMutation(res, data)) {
    return {
      ok: false,
      error: inkaiErrorMessage(data, "Gagal memproses registrasi anggota"),
      status: res.status === 401 ? 502 : res.status,
    };
  }

  if (!inkaiOk) {
    console.warn(
      `[registration] Inkai failed status=${res.status}; Prisma fallback for ${opts.memberId} action=${opts.action}`,
    );
  }

  const nextStatus = opts.action === "approve" ? "Active" : "Rejected";
  try {
    await prisma.member.update({
      where: { id: opts.memberId },
      data: { status: nextStatus },
      select: { id: true, status: true },
    });
    if (opts.action === "approve") {
      await syncUserActiveOnApprove(scoped.userId);
    }
  } catch (err) {
    console.error("[registration] prisma update failed:", err);
    if (!inkaiOk) {
      const mapped = prismaUserFacingError(
        err,
        "Gagal menyimpan status registrasi di database lokal",
      );
      return { ok: false, error: mapped.error, status: mapped.status };
    }
  }

  const auditAction =
    opts.action === "approve" ? "MEMBER_APPROVE" : "MEMBER_REJECT";
  writeAuditLog({
    userId: opts.user.id,
    email: opts.user.email,
    action: auditAction,
    details: `${opts.action} ${scoped.fullName} (${opts.memberId})${inkaiOk ? "" : " [prisma-fallback]"}${opts.auditSuffix ?? ""}`,
    ip: opts.ip,
    userAgent: opts.userAgent,
    token: opts.token,
  });

  const payload = data.data as { status?: string } | undefined;
  return {
    ok: true,
    status: payload?.status ?? nextStatus,
    message:
      opts.action === "approve"
        ? inkaiOk
          ? "Anggota berhasil disetujui"
          : "Anggota disetujui (tersimpan di portal)"
        : inkaiOk
          ? "Anggota berhasil ditolak"
          : "Anggota ditolak (tersimpan di portal)",
    inkaiOk,
  };
}

export { shouldApplyInkaiPrismaFallback, shouldHardFailInkaiMutation, isInkaiAuthFailure };

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { assertDojoInScope } from "@/lib/pengaturan";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { getClientIp } from "@/lib/security/request";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNotes: z.string().optional(),
});

function parseTargetDojoId(data: string): string | null {
  try {
    const parsed = JSON.parse(data) as { targetDojoId?: string };
    return parsed.targetDojoId?.trim() || null;
  } catch {
    return null;
  }
}

async function applyDojoTransfer(
  claim: {
    type: string;
    memberId: string;
    data: string;
  },
  user: SessionUser,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (claim.type !== "DOJO_TRANSFER" && claim.type !== "TRANSFER") {
    return { ok: true };
  }
  const targetDojoId = parseTargetDojoId(claim.data);
  if (!targetDojoId) {
    return { ok: false, error: "Ranting tujuan tidak valid" };
  }
  const target = await assertDojoInScope(user, targetDojoId);
  if (!target || target.isDeleted) {
    return {
      ok: false,
      error: "Ranting tujuan di luar cakupan atau tidak valid",
    };
  }
  await prisma.member.update({
    where: { id: claim.memberId },
    data: { dojoId: targetDojoId },
  });
  return { ok: true };
}

async function applyProfileChange(claim: {
  type: string;
  memberId: string;
  data: string;
}) {
  if (claim.type !== "PROFILE_CHANGE") return;
  try {
    const parsed = JSON.parse(claim.data) as {
      requested?: {
        email?: string;
        nia?: string;
        currentRank?: string;
        mshNumber?: string;
      };
    };
    const req = parsed.requested;
    if (!req) return;

    const memberData: Record<string, unknown> = {};
    if (req.nia !== undefined) memberData.nia = req.nia;
    if (req.currentRank !== undefined) memberData.currentRank = req.currentRank;
    if (req.mshNumber !== undefined) memberData.mshNumber = req.mshNumber;

    if (Object.keys(memberData).length > 0) {
      await prisma.member.update({
        where: { id: claim.memberId },
        data: memberData,
      });
    }

    if (req.email) {
      const member = await prisma.member.findUnique({
        where: { id: claim.memberId },
        select: { userId: true },
      });
      if (member?.userId) {
        await prisma.user.update({
          where: { id: member.userId },
          data: { email: req.email },
        });
      }
    }
  } catch {
    // ignore malformed data
  }
}

async function notifyVerificationResult(opts: {
  memberId: string;
  type: string;
  approved: boolean;
  adminNotes?: string;
  token: string;
}) {
  try {
    const member = await prisma.member.findFirst({
      where: { id: opts.memberId },
      select: { userId: true },
    });
    if (!member?.userId) return;
    const { notifyUser } = await import("@/lib/notifications");
    await notifyUser({
      userId: member.userId,
      title: opts.approved ? "Verifikasi disetujui" : "Verifikasi ditolak",
      content: opts.approved
        ? `Pengajuan Anda (${opts.type || "verifikasi"}) telah disetujui pengurus.`
        : `Pengajuan Anda (${opts.type || "verifikasi"}) ditolak.${opts.adminNotes ? ` Catatan: ${opts.adminNotes}` : ""}`,
      type: opts.approved ? "SUCCESS" : "WARNING",
      token: opts.token,
    });
  } catch {
    // non-blocking
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const status = parsed.data.action === "approve" ? "APPROVED" : "REJECTED";
  const local = await prisma.verification.findUnique({
    where: { id },
    include: {
      member: { select: { id: true, dojoId: true, fullName: true } },
    },
  });

  if (local?.member?.dojoId) {
    const scoped = await assertDojoInScope(authResult.user, local.member.dojoId);
    if (!scoped) {
      return NextResponse.json(
        { error: "Anggota di luar cakupan wilayah Anda" },
        { status: 403 },
      );
    }
  }

  // Destination dojo must be in scope before approving a transfer
  if (
    local &&
    parsed.data.action === "approve" &&
    (local.type === "DOJO_TRANSFER" || local.type === "TRANSFER")
  ) {
    const targetDojoId = parseTargetDojoId(local.data);
    if (!targetDojoId) {
      return NextResponse.json(
        { error: "Ranting tujuan tidak valid" },
        { status: 400 },
      );
    }
    const target = await assertDojoInScope(authResult.user, targetDojoId);
    if (!target || target.isDeleted) {
      return NextResponse.json(
        { error: "Ranting tujuan di luar cakupan atau tidak valid" },
        { status: 403 },
      );
    }
  }

  const { res, data } = await inkaiFetch(
    `/v1/verifications/${id}/process`,
    {
      method: "POST",
      body: JSON.stringify({
        status,
        adminNotes: parsed.data.adminNotes,
      }),
    },
    authResult.token,
  );

  if (!res.ok) {
    // Fail closed — jangan approve/reject lokal saat API sibuk/gagal (authz bypass risk)
    const statusCode = res.status === 404 ? 404 : res.status >= 500 ? 503 : res.status;
    return NextResponse.json(
      {
        error: inkaiErrorMessage(
          data,
          "Gagal memproses verifikasi. Coba lagi saat API tersedia.",
        ),
      },
      { status: statusCode },
    );
  }

  if (local && parsed.data.action === "approve") {
    const transfer = await applyDojoTransfer(local, authResult.user);
    if (!transfer.ok) {
      return NextResponse.json({ error: transfer.error }, { status: 403 });
    }
    await applyProfileChange(local);
    await prisma.verification
      .update({
        where: { id },
        data: {
          status: "APPROVED",
          adminNotes: parsed.data.adminNotes ?? local.adminNotes,
        },
      })
      .catch(() => null);
  } else if (local && parsed.data.action === "reject") {
    await prisma.verification
      .update({
        where: { id },
        data: {
          status: "REJECTED",
          adminNotes: parsed.data.adminNotes ?? local.adminNotes,
        },
      })
      .catch(() => null);
  }

  if (local?.memberId) {
    await notifyVerificationResult({
      memberId: local.memberId,
      type: local.type,
      approved: parsed.data.action === "approve",
      adminNotes: parsed.data.adminNotes,
      token: authResult.token,
    });
  }

  writeAuditLog({
    token: authResult.token,
    action:
      parsed.data.action === "approve"
        ? "ADMIN_VERIFICATION_APPROVE"
        : "ADMIN_VERIFICATION_REJECT",
    details: `verification=${id}; member=${local?.memberId ?? "?"}; type=${local?.type ?? "?"}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    success: true,
    status,
    message:
      parsed.data.action === "approve"
        ? "Verifikasi berhasil disetujui"
        : "Verifikasi berhasil ditolak",
  });
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { canAssignNia, canEditKyuBaru, formatRankLabel } from "@/lib/belt";
import { memberActionSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import { generateSimplePassword } from "@/lib/security/password";
import {
  getMemberImpact,
  getMemberLifecycle,
  type MemberImpactSummary,
} from "@/lib/member-lifecycle";
import {
  activateMember,
  deactivateMember,
  restoreMember,
  softDeleteMember,
} from "@/lib/member-lifecycle-actions";
import {
  canSoftDeleteMembers,
  canToggleMemberActive,
  canManageIuranByWilayah,
} from "@/lib/wilayah-rbac";
import { buildMemberFilter, type SessionUser } from "@/lib/rbac";
import { prisma, withPrismaFallback } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export const maxDuration = 30;

const EMPTY_IMPACT: MemberImpactSummary = {
  unpaidBillingCount: 0,
  unpaidBillingAmount: 0,
  openEventRegistrationCount: 0,
  uktOpenCount: 0,
};

function asBillingList(data: Record<string, unknown>): Array<Record<string, unknown>> {
  const raw = data.data;
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  return [];
}

async function loadLocalMemberFallback(id: string, user: SessionUser) {
  return prisma.member.findFirst({
    where: {
      AND: [{ id }, buildMemberFilter(user, { anyDeleted: true })],
    },
    include: {
      dojo: { include: { branch: { select: { name: true } } } },
      user: {
        select: { email: true, phoneNumber: true, photoUrl: true },
      },
      ranks: { orderBy: { date: "desc" }, take: 10 },
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { id } = await context.params;
  const billingQs = new URLSearchParams({ limit: "30", memberId: id });

  // Paralel: member + billing + metadata lokal (jangan waterfall).
  const [memberFetch, billingFetch, lifecycleResult, impactResult] =
    await Promise.all([
      inkaiFetch(`/v1/members/${id}`, {}, authResult.token),
      inkaiFetch(`/v1/billing?${billingQs}`, {}, authResult.token),
      withPrismaFallback("member-detail-lifecycle", () => getMemberLifecycle(id), null),
      withPrismaFallback(
        "member-detail-impact",
        () => getMemberImpact(id),
        EMPTY_IMPACT,
      ),
    ]);

  let member = (memberFetch.data.data as Record<string, unknown>) ?? {};
  if (!memberFetch.res.ok) {
    const local = await withPrismaFallback(
      "member-detail-local",
      () => loadLocalMemberFallback(id, authResult.user),
      null,
    );
    if (!local.data) {
      return NextResponse.json(
        {
          error: inkaiErrorMessage(
            memberFetch.data,
            "Anggota tidak ditemukan",
          ),
        },
        { status: memberFetch.res.status },
      );
    }
    const row = local.data;
    member = {
      ...row,
      birthDate: row.birthDate?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  let billings: Array<Record<string, unknown>> = [];
  const nested = member.billings;
  if (Array.isArray(nested) && nested.length > 0) {
    billings = nested as Array<Record<string, unknown>>;
  } else if (billingFetch.res.ok) {
    billings = asBillingList(billingFetch.data).filter((b) => {
      const mid =
        (b.member as { id?: string } | undefined)?.id ??
        (b.memberId as string | undefined);
      return !mid || String(mid) === id;
    });
  }

  const fullName = String(member.fullName || "");
  const suggestedPassword = generateSimplePassword(fullName);

  // Pastikan monthlyDuesAmount tersedia (Inkai atau Prisma lokal)
  let monthlyDuesAmount =
    typeof member.monthlyDuesAmount === "number"
      ? member.monthlyDuesAmount
      : Number(member.monthlyDuesAmount);
  if (!Number.isFinite(monthlyDuesAmount)) {
    const localDues = await withPrismaFallback(
      "member-detail-dues",
      () =>
        prisma.member.findFirst({
          where: { id },
          select: { monthlyDuesAmount: true },
        }),
      null,
    );
    monthlyDuesAmount = localDues.data?.monthlyDuesAmount ?? 50_000;
  }

  return NextResponse.json({
    member: {
      ...member,
      monthlyDuesAmount,
      billings,
      suggestedPassword,
      lifecycle: lifecycleResult.data,
      impact: impactResult.data,
    },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = memberActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const action = parsed.data.action;
  const roles = authResult.user.roles;
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");
  const token = authResult.token;

  if (action === "set_nia") {
    if (!canAssignNia(roles)) {
      return NextResponse.json(
        { error: "Hanya pengurus cabang yang dapat mengisi NIA" },
        { status: 403 },
      );
    }
    const nia = parsed.data.nia?.trim();
    if (!nia) {
      return NextResponse.json({ error: "NIA wajib diisi" }, { status: 400 });
    }

    const { res, data } = await inkaiFetch(
      `/v1/members/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ nia }),
      },
      token,
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: inkaiErrorMessage(data, "Gagal menyimpan NIA") },
        { status: res.status },
      );
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "MEMBER_SET_NIA",
      details: `Set NIA ${nia} for member ${id}`,
      ip,
      userAgent,
      token,
    });

    return NextResponse.json({
      success: true,
      member: data.data,
      message: "NIA berhasil disimpan",
    });
  }

  if (action === "set_rank") {
    if (!canEditKyuBaru(roles)) {
      return NextResponse.json(
        { error: "Hanya pengurus cabang yang dapat mengubah sabuk anggota" },
        { status: 403 },
      );
    }
    const rawRank = parsed.data.currentRank?.trim();
    const currentRank = formatRankLabel(rawRank) || rawRank;
    if (!currentRank) {
      return NextResponse.json({ error: "Sabuk wajib dipilih" }, { status: 400 });
    }

    const { res: prevRes, data: prevData } = await inkaiFetch(
      `/v1/members/${id}`,
      {},
      token,
    );
    const prevMember = prevRes.ok
      ? ((prevData.data as { currentRank?: string } | undefined) ?? null)
      : null;
    const previousRank = String(prevMember?.currentRank ?? "").trim();

    const { res, data } = await inkaiFetch(
      `/v1/members/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ currentRank }),
      },
      token,
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: inkaiErrorMessage(data, "Gagal memperbarui sabuk") },
        { status: res.status },
      );
    }

    if (previousRank !== currentRank) {
      try {
        await prisma.memberRank.create({
          data: {
            memberId: id,
            rank: currentRank,
            date: new Date(),
            location: "Koreksi cabang",
            isVerified: true,
          },
        });
      } catch (err) {
        console.error("[set_rank] memberRank create failed:", err);
      }
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "MEMBER_SET_RANK",
      details: `Set sabuk ${previousRank || "—"} → ${currentRank} for member ${id}`,
      ip,
      userAgent,
      token,
    });

    return NextResponse.json({
      success: true,
      member: data.data,
      currentRank,
      message: `Sabuk diperbarui: ${currentRank}`,
    });
  }

  if (action === "set_dues") {
    if (!canManageIuranByWilayah(roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang mengubah iuran bulanan anggota" },
        { status: 403 },
      );
    }
    const amount = parsed.data.monthlyDuesAmount;
    if (amount == null || Number.isNaN(amount)) {
      return NextResponse.json(
        { error: "Nominal iuran wajib diisi" },
        { status: 400 },
      );
    }

    const scoped = await prisma.member.findFirst({
      where: {
        AND: [{ id }, buildMemberFilter(authResult.user)],
      },
      select: { id: true, fullName: true, monthlyDuesAmount: true },
    });
    if (!scoped) {
      return NextResponse.json(
        { error: "Anggota tidak ditemukan di cakupan Anda" },
        { status: 404 },
      );
    }

    const { res, data } = await inkaiFetch(
      `/v1/members/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ monthlyDuesAmount: amount }),
      },
      token,
    );

    // Selalu sinkron lokal (sumber generate tagihan & detail)
    try {
      await prisma.member.update({
        where: { id },
        data: { monthlyDuesAmount: amount },
      });
    } catch (err) {
      console.error("[set_dues] prisma update failed:", err);
      if (!res.ok) {
        return NextResponse.json(
          { error: inkaiErrorMessage(data, "Gagal menyimpan iuran bulanan") },
          { status: res.status },
        );
      }
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "MEMBER_SET_DUES",
      details: `Set iuran/bln ${scoped.monthlyDuesAmount} → ${amount} for ${scoped.fullName} (${id})`,
      ip,
      userAgent,
      token,
    });

    return NextResponse.json({
      success: true,
      monthlyDuesAmount: amount,
      message: `Iuran/bln diperbarui: Rp ${amount.toLocaleString("id-ID")}`,
    });
  }

  if (action === "deactivate") {
    if (!canToggleMemberActive(roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang mengubah status anggota" },
        { status: 403 },
      );
    }
    if (!parsed.data.reasonCode) {
      return NextResponse.json(
        { error: "Alasan nonaktif wajib dipilih" },
        { status: 400 },
      );
    }
    const result = await deactivateMember({
      user: authResult.user,
      token,
      memberId: id,
      statusKind: parsed.data.statusKind || "INACTIVE",
      reasonCode: parsed.data.reasonCode,
      reasonNote: parsed.data.reasonNote,
      ip,
      userAgent,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      status: result.status,
      message: result.message,
    });
  }

  if (action === "activate") {
    if (!canToggleMemberActive(roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang mengubah status anggota" },
        { status: 403 },
      );
    }
    const result = await activateMember({
      user: authResult.user,
      token,
      memberId: id,
      ip,
      userAgent,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      status: result.status,
      message: result.message,
    });
  }

  if (action === "delete") {
    if (!canSoftDeleteMembers(roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang menghapus anggota" },
        { status: 403 },
      );
    }
    const result = await softDeleteMember({
      user: authResult.user,
      token,
      memberId: id,
      confirmName: parsed.data.confirmName,
      ip,
      userAgent,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      impact: result.impact,
      message: result.message,
    });
  }

  if (action === "restore") {
    const result = await restoreMember({
      user: authResult.user,
      token,
      memberId: id,
      ip,
      userAgent,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      status: result.status,
      message: result.message,
    });
  }

  const { res, data } = await inkaiFetch(
    `/v1/members/${id}/registration`,
    {
      method: "PATCH",
      body: JSON.stringify({
        action: parsed.data.action,
        nia: parsed.data.nia,
      }),
    },
    token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal memproses anggota") },
      { status: res.status },
    );
  }

  const payload = data.data as { status?: string } | undefined;
  return NextResponse.json({
    success: true,
    status: payload?.status,
    message:
      parsed.data.action === "approve"
        ? "Anggota berhasil disetujui"
        : "Anggota berhasil ditolak",
  });
}

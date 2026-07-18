import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { canAssignNia } from "@/lib/belt";
import { memberActionSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import { generateSimplePassword } from "@/lib/security/password";
import {
  getMemberImpact,
  getMemberLifecycle,
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
} from "@/lib/wilayah-rbac";

type RouteContext = { params: Promise<{ id: string }> };

function asBillingList(data: Record<string, unknown>): Array<Record<string, unknown>> {
  const raw = data.data;
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  return [];
}

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { id } = await context.params;
  const { res, data } = await inkaiFetch(`/v1/members/${id}`, {}, authResult.token);

  // Fallback: anggota arsip mungkin tidak ada di API list
  let member = (data.data as Record<string, unknown>) ?? {};
  if (!res.ok) {
    const { prisma } = await import("@/lib/prisma");
    const { buildMemberFilter } = await import("@/lib/rbac");
    const local = await prisma.member.findFirst({
      where: {
        AND: [{ id }, buildMemberFilter(authResult.user, { anyDeleted: true })],
      },
      include: {
        dojo: { include: { branch: { select: { name: true } } } },
        user: {
          select: { email: true, phoneNumber: true, photoUrl: true },
        },
        ranks: { orderBy: { date: "desc" }, take: 10 },
      },
    });
    if (!local) {
      return NextResponse.json(
        { error: inkaiErrorMessage(data, "Anggota tidak ditemukan") },
        { status: res.status },
      );
    }
    member = {
      ...local,
      birthDate: local.birthDate?.toISOString() ?? null,
      createdAt: local.createdAt.toISOString(),
      updatedAt: local.updatedAt.toISOString(),
    };
  }

  let billings: Array<Record<string, unknown>> = [];
  const nested = member.billings;
  if (Array.isArray(nested) && nested.length > 0) {
    billings = nested as Array<Record<string, unknown>>;
  } else if (authResult.token && res.ok) {
    const qs = new URLSearchParams({ limit: "100", memberId: id });
    const { res: bRes, data: bData } = await inkaiFetch(
      `/v1/billing?${qs}`,
      {},
      authResult.token,
    );
    if (bRes.ok) {
      billings = asBillingList(bData).filter((b) => {
        const mid =
          (b.member as { id?: string } | undefined)?.id ??
          (b.memberId as string | undefined);
        return !mid || String(mid) === id;
      });
    }
  }

  const [lifecycle, impact] = await Promise.all([
    getMemberLifecycle(id),
    getMemberImpact(id),
  ]);

  const fullName = String(member.fullName || "");
  const suggestedPassword = generateSimplePassword(fullName);

  return NextResponse.json({
    member: {
      ...member,
      billings,
      suggestedPassword,
      lifecycle,
      impact,
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

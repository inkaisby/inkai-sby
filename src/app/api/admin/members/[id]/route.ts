import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { canAssignNia } from "@/lib/belt";
import { memberActionSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import { generateSimplePassword } from "@/lib/security/password";

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

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Anggota tidak ditemukan") },
      { status: res.status },
    );
  }

  const member = (data.data as Record<string, unknown>) ?? {};

  // Iuran: coba filter memberId, fallback filter dari list
  let billings: Array<Record<string, unknown>> = [];
  const nested = member.billings;
  if (Array.isArray(nested) && nested.length > 0) {
    billings = nested as Array<Record<string, unknown>>;
  } else {
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

  const fullName = String(member.fullName || "");
  const suggestedPassword = generateSimplePassword(fullName);

  return NextResponse.json({
    member: {
      ...member,
      billings,
      suggestedPassword,
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

  if (parsed.data.action === "set_nia") {
    if (!canAssignNia(authResult.user.roles)) {
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
      authResult.token,
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
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    return NextResponse.json({
      success: true,
      member: data.data,
      message: "NIA berhasil disimpan",
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
    authResult.token,
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

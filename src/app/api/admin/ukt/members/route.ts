import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { buildDojoFilter, getPrimaryAdminRole } from "@/lib/rbac";
import { uktMemberCreateSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = uktMemberCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const role = getPrimaryAdminRole(authResult.user.roles);
  let dojoId = parsed.data.dojoId;

  if (role === "ADMIN_DOJO") {
    if (!authResult.user.managedDojoId) {
      return NextResponse.json({ error: "Dojo tidak terkonfigurasi" }, { status: 403 });
    }
    dojoId = authResult.user.managedDojoId;
  } else if (!dojoId) {
    const { res, data } = await inkaiFetch("/v1/org/dojos/all", {}, authResult.token);
    if (!res.ok) {
      return NextResponse.json({ error: "Dojo tidak ditemukan" }, { status: 404 });
    }
    const dojos = (data.data as Array<{ id: string; name: string }>) ?? [];
    const filter = buildDojoFilter(authResult.user);
    const scoped = dojos.filter((d) => {
      if (filter.id) return d.id === filter.id;
      if (filter.branchId) return true;
      return true;
    });
    if (!scoped[0]) {
      return NextResponse.json({ error: "Dojo tidak ditemukan" }, { status: 404 });
    }
    dojoId = scoped[0].id;
  }

  const { res, data } = await inkaiFetch(
    "/v1/members",
    {
      method: "POST",
      body: JSON.stringify({
        fullName: parsed.data.fullName.toUpperCase(),
        gender: parsed.data.gender || null,
        birthPlace: parsed.data.birthPlace || null,
        birthDate: parsed.data.birthDate || null,
        address: parsed.data.address || null,
        dojoId,
        currentRank: "Putih (Kyu 10)",
        status: "Active",
      }),
    },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal membuat anggota") },
      { status: res.status },
    );
  }

  const member = data.data as Record<string, unknown>;
  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_MEMBER_CREATE",
    details: `Created member ${member.fullName}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({ success: true, member });
}

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");
  if (!memberId) {
    return NextResponse.json({ error: "memberId wajib" }, { status: 400 });
  }

  const { res, data } = await inkaiFetch(`/v1/members/${memberId}`, {}, authResult.token);
  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Anggota tidak ditemukan") },
      { status: res.status },
    );
  }

  return NextResponse.json({ member: data.data });
}

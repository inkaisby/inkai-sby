import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { memberActionSchema } from "@/lib/security/schemas";

type RouteContext = { params: Promise<{ id: string }> };

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

  return NextResponse.json({ member: data.data });
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

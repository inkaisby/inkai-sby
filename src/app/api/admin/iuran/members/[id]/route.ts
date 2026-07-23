import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getIuranMemberLedgerDetail } from "@/lib/iuran-ledger";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await context.params;
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || 100);
  const offset = Number(url.searchParams.get("offset") || 0);

  const detail = await getIuranMemberLedgerDetail(authResult.user, id, {
    limit: Number.isFinite(limit) ? limit : 100,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  if (!detail) {
    return NextResponse.json(
      { error: "Anggota tidak ditemukan atau di luar wilayah Anda" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, ...detail });
}

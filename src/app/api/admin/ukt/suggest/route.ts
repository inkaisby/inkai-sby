import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const dojoId = searchParams.get("dojo")?.trim() || "";

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const qs = new URLSearchParams();
  qs.set("search", q);
  qs.set("limit", "8");
  if (dojoId) qs.set("dojoId", dojoId);

  const { res, data } = await inkaiFetch(`/v1/members?${qs}`, {}, authResult.token);
  if (!res.ok) {
    return NextResponse.json({ suggestions: [] });
  }

  const members = (data.data as Array<Record<string, unknown>>) ?? [];
  return NextResponse.json({
    suggestions: members.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      nia: m.nia,
      dojoName: (m.dojo as { name?: string } | undefined)?.name,
      currentRank: m.currentRank,
    })),
  });
}

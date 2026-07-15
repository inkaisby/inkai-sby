import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { inkaiFetch } from "@/lib/inkai-api/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: RouteContext) {
  const session = await auth();
  const token = await getInkaiAccessToken();
  if (!session || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { res } = await inkaiFetch(
    `/v1/notifications/${id}/read`,
    { method: "PATCH" },
    token,
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Gagal memperbarui" }, { status: res.status });
  }

  return NextResponse.json({ success: true });
}

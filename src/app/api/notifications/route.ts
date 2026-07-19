import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { inkaiFetch } from "@/lib/inkai-api/server";

type NotifRow = {
  id: string;
  title?: string;
  content?: string;
  type?: string;
  isRead?: boolean;
  createdAt?: string;
};

export async function GET() {
  const session = await auth();
  const token = await getInkaiAccessToken();
  if (!session || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { res, data } = await inkaiFetch("/v1/notifications/my", {}, token);
  if (!res.ok) {
    return NextResponse.json({ error: "Gagal memuat notifikasi" }, { status: res.status });
  }

  const list = ((data.data as NotifRow[]) ?? []).slice(0, 50);
  const unreadCount = list.filter((n) => !n.isRead).length;

  return NextResponse.json({
    data: list,
    notifications: list,
    unreadCount,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  const token = await getInkaiAccessToken();
  if (!session || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { markAll?: boolean };
  if (body.markAll) {
    const { res } = await inkaiFetch(
      "/v1/notifications/read-all",
      { method: "PATCH" },
      token,
    );
    if (!res.ok) {
      return NextResponse.json({ error: "Gagal memperbarui notifikasi" }, { status: res.status });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

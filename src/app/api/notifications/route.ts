import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { enrichSessionUser } from "@/lib/managed-dojos";
import { canAccessAdmin, type SessionUser } from "@/lib/rbac";
import {
  filterNotificationsForAdminScope,
  filterNotificationsForMemberInbox,
  withFilterStats,
} from "@/lib/admin-notify-scope";

type NotifRow = {
  id: string;
  title?: string;
  content?: string;
  type?: string;
  isRead?: boolean;
  createdAt?: string;
  userId?: string;
  audience?: string;
};

export async function GET() {
  const session = await auth();
  const token = await getInkaiAccessToken();
  if (!session || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { res, data } = await inkaiFetch(
    "/v1/notifications/my?limit=100",
    {},
    token,
  );
  if (!res.ok) {
    return NextResponse.json({ error: "Gagal memuat notifikasi" }, { status: res.status });
  }

  const raw = ((data.data as NotifRow[]) ?? []).slice(0, 100);
  const sessionUser = session.user as SessionUser;

  let filtered: NotifRow[];
  if (canAccessAdmin(sessionUser)) {
    const user = await enrichSessionUser(sessionUser);
    filtered = await filterNotificationsForAdminScope(user, raw);
  } else {
    filtered = filterNotificationsForMemberInbox(sessionUser.id, raw);
  }

  const { items: list, stats } = withFilterStats(raw, filtered.slice(0, 50));
  if (stats.dropped > 0) {
    console.info(
      `[notifications] filtered dropped=${stats.dropped} input=${stats.input} output=${stats.output} user=${sessionUser.id}`,
    );
  }

  const unreadCount = list.filter((n) => !n.isRead).length;

  return NextResponse.json({
    data: list,
    notifications: list,
    unreadCount,
    filterStats: stats,
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
    // Inkai mark-all sudah scoped ke userId caller — aman setelah fix fan-out write.
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

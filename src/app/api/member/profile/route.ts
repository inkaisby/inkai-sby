import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { fetchMyMemberProfile } from "@/lib/inkai-api/member-data";
import { formatMemberName, formatRankLabel, resolveMemberDisplayRank } from "@/lib/belt";

export async function GET() {
  const session = await auth();
  const token = await getInkaiAccessToken();
  if (!session?.user.memberId || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member = await fetchMyMemberProfile(token);
  if (!member) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  const dojo = member.dojo as
    | { name?: string; branch?: { name?: string } }
    | undefined;
  const belt = resolveMemberDisplayRank({
    currentRank: String(member.currentRank ?? ""),
    ranks: member.ranks as Array<{
      rank?: string | null;
      date?: string | Date | null;
    }>,
    eventRegistrations: member.eventRegistrations as Array<{
      status?: string | null;
      registeredRank?: string | null;
      event?: { title?: string | null } | null;
    }>,
  });

  return NextResponse.json(
    {
      nia: String(member.nia ?? ""),
      fullName: formatMemberName(String(member.fullName ?? "")),
      belt: formatRankLabel(belt) || belt || null,
      dojo: [dojo?.name, dojo?.branch?.name].filter(Boolean).join(" - ") || "—",
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}

export async function PATCH(request: Request) {
  const session = await auth();
  const token = await getInkaiAccessToken();
  if (!session?.user.memberId || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { res, data } = await inkaiFetch(
    "/v1/members/me",
    { method: "PATCH", body: JSON.stringify(body) },
    token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal memperbarui profil") },
      { status: res.status },
    );
  }

  return NextResponse.json({ success: true, message: "Profil berhasil diperbarui" });
}

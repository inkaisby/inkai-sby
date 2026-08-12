import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { getMemberLatberStatus } from "@/lib/member-latber-status";

export async function GET() {
  const session = await auth();
  if (!session?.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = await getInkaiAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await getMemberLatberStatus(
    token,
    session.user.memberId,
    session.user.name,
  );
  return NextResponse.json(payload);
}

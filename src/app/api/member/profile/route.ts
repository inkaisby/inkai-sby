import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";

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

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user.memberId || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { res, data } = await inkaiFetch(
    "/v1/members/me",
    { method: "PATCH", body: JSON.stringify(body) },
    session.accessToken,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal memperbarui profil") },
      { status: res.status },
    );
  }

  return NextResponse.json({ success: true, message: "Profil berhasil diperbarui" });
}

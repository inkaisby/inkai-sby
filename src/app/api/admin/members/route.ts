import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { uktMemberCreateSchema } from "@/lib/security/schemas";
import { createAdminMember } from "@/lib/admin-member-create";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = uktMemberCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return NextResponse.json(
      { error: first || "Data tidak valid" },
      { status: 400 },
    );
  }

  return createAdminMember({
    user: authResult.user,
    token: authResult.token,
    input: parsed.data,
    request,
    auditAction: "MEMBER_CREATE",
  });
}

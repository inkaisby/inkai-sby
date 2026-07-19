import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { assertJsonRequest, getClientIp } from "@/lib/security/request";
import { memberMergeSchema } from "@/lib/security/schemas";
import { canMergeMembers, mergeMembers } from "@/lib/member-merge";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }
  if (!canMergeMembers(authResult.user.roles)) {
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
  if (!assertJsonRequest(request)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 415 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = memberMergeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  const result = await mergeMembers({
    user: authResult.user,
    token: authResult.token,
    keepMemberId: parsed.data.keepMemberId,
    mergeMemberId: parsed.data.mergeMemberId,
    preferUserFrom: parsed.data.preferUserFrom,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    keepMemberId: result.keepMemberId,
    mergeMemberId: result.mergeMemberId,
    linkedEmail: result.linkedEmail,
  });
}

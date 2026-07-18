import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { memberBulkActionSchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";
import { canToggleMemberActive } from "@/lib/wilayah-rbac";
import { deactivateMember } from "@/lib/member-lifecycle-actions";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }
  if (!canToggleMemberActive(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Anda tidak berwenang menonaktifkan anggota" },
      { status: 403 },
    );
  }

  const parsed = memberBulkActionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const memberId of parsed.data.memberIds) {
    const result = await deactivateMember({
      user: authResult.user,
      token: authResult.token,
      memberId,
      statusKind: parsed.data.statusKind,
      reasonCode: parsed.data.reasonCode,
      reasonNote: parsed.data.reasonNote,
      ip,
      userAgent,
    });
    results.push(
      result.ok
        ? { id: memberId, ok: true }
        : { id: memberId, ok: false, error: result.error },
    );
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;

  return NextResponse.json({
    success: failCount === 0,
    okCount,
    failCount,
    results,
    message:
      failCount === 0
        ? `${okCount} anggota berhasil dinonaktifkan`
        : `${okCount} berhasil, ${failCount} gagal`,
  });
}

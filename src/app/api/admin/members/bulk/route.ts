import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { memberBulkActionSchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";
import {
  canSoftDeleteMembers,
  canToggleMemberActive,
} from "@/lib/wilayah-rbac";
import {
  deactivateMember,
  softDeleteMember,
} from "@/lib/member-lifecycle-actions";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const parsed = memberBulkActionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  if (parsed.data.action === "delete") {
    if (!canSoftDeleteMembers(authResult.user.roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang menghapus anggota" },
        { status: 403 },
      );
    }
    const phrase = parsed.data.confirmPhrase?.trim().toUpperCase() || "";
    if (phrase !== "ARSIPKAN") {
      return NextResponse.json(
        { error: 'Ketik "ARSIPKAN" untuk mengonfirmasi arsip massal' },
        { status: 400 },
      );
    }
    for (const memberId of parsed.data.memberIds) {
      const result = await softDeleteMember({
        user: authResult.user,
        token: authResult.token,
        memberId,
        confirmPhrase: phrase,
        ip,
        userAgent,
      });
      results.push(
        result.ok
          ? { id: memberId, ok: true }
          : { id: memberId, ok: false, error: result.error },
      );
    }
  } else if (!canToggleMemberActive(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Anda tidak berwenang mengubah status anggota" },
      { status: 403 },
    );
  } else if (parsed.data.action === "approve") {
    for (const memberId of parsed.data.memberIds) {
      const { res, data } = await inkaiFetch(
        `/v1/members/${memberId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ action: "approve" }),
        },
        authResult.token,
      );
      results.push(
        res.ok
          ? { id: memberId, ok: true }
          : {
              id: memberId,
              ok: false,
              error: inkaiErrorMessage(data, "Gagal approve"),
            },
      );
    }
  } else {
    if (!parsed.data.reasonCode) {
      return NextResponse.json(
        { error: "Alasan nonaktif wajib" },
        { status: 400 },
      );
    }
    for (const memberId of parsed.data.memberIds) {
      const result = await deactivateMember({
        user: authResult.user,
        token: authResult.token,
        memberId,
        statusKind: parsed.data.statusKind || "INACTIVE",
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
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  const verb =
    parsed.data.action === "approve"
      ? "disetujui"
      : parsed.data.action === "delete"
        ? "diarsipkan"
        : "dinonaktifkan";

  return NextResponse.json({
    success: failCount === 0,
    okCount,
    failCount,
    results,
    message:
      failCount === 0
        ? `${okCount} anggota berhasil ${verb}`
        : `${okCount} berhasil, ${failCount} gagal`,
  });
}

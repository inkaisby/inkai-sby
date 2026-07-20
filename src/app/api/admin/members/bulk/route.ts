import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { memberBulkActionSchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";
import {
  canSoftDeleteMembers,
  canToggleMemberActive,
  isCabangAdmin,
} from "@/lib/wilayah-rbac";
import {
  deactivateMember,
  purgeArchivedMembersBulk,
  restoreMember,
  softDeleteMembersBulk,
} from "@/lib/member-lifecycle-actions";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { PRISMA_BUSY_USER_MESSAGE } from "@/lib/prisma-errors";

export const maxDuration = 60;

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
  const action = parsed.data.action;
  const memberIds = parsed.data.memberIds;

  function markRestBusy(fromIndex: number, error: string) {
    for (let j = fromIndex; j < memberIds.length; j++) {
      results.push({ id: memberIds[j], ok: false, error });
    }
  }

  if (action === "purge") {
    if (!canSoftDeleteMembers(authResult.user.roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang menghapus anggota" },
        { status: 403 },
      );
    }
    const phrase = parsed.data.confirmPhrase?.trim().toUpperCase() || "";
    if (phrase !== "HAPUS") {
      return NextResponse.json(
        { error: 'Ketik "HAPUS" untuk mengonfirmasi hapus permanen' },
        { status: 400 },
      );
    }
    const bulk = await purgeArchivedMembersBulk({
      user: authResult.user,
      token: authResult.token,
      memberIds,
      confirmPhrase: phrase,
      ip,
      userAgent,
    });
    results.push(...bulk.results);
    if ("busy" in bulk && bulk.busy) {
      return NextResponse.json(
        {
          error: PRISMA_BUSY_USER_MESSAGE,
          okCount: 0,
          failCount: results.length,
          results,
          message: PRISMA_BUSY_USER_MESSAGE,
        },
        { status: 503 },
      );
    }
  } else if (action === "restore") {
    if (!isCabangAdmin(authResult.user.roles)) {
      return NextResponse.json(
        { error: "Hanya pengurus cabang yang dapat memulihkan arsip" },
        { status: 403 },
      );
    }
    for (const memberId of memberIds) {
      const result = await restoreMember({
        user: authResult.user,
        token: authResult.token,
        memberId,
        ip,
        userAgent,
      });
      results.push(
        result.ok
          ? { id: memberId, ok: true }
          : { id: memberId, ok: false, error: result.error },
      );
    }
  } else if (action === "delete") {
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
    const bulk = await softDeleteMembersBulk({
      user: authResult.user,
      token: authResult.token,
      memberIds,
      confirmPhrase: phrase,
      ip,
      userAgent,
    });
    results.push(...bulk.results);
    if ("busy" in bulk && bulk.busy) {
      return NextResponse.json(
        {
          error: PRISMA_BUSY_USER_MESSAGE,
          okCount: 0,
          failCount: results.length,
          results,
          message: PRISMA_BUSY_USER_MESSAGE,
        },
        { status: 503 },
      );
    }
  } else if (!canToggleMemberActive(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Anda tidak berwenang mengubah status anggota" },
      { status: 403 },
    );
  } else if (action === "approve") {
    for (const memberId of memberIds) {
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
    for (let i = 0; i < memberIds.length; i++) {
      const memberId = memberIds[i];
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
      if (!result.ok && result.status === 503) {
        results.push({ id: memberId, ok: false, error: result.error });
        markRestBusy(i + 1, result.error);
        break;
      }
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
    action === "approve"
      ? "disetujui"
      : action === "delete"
        ? "diarsipkan"
        : action === "purge"
          ? "dihapus permanen"
          : action === "restore"
            ? "dipulihkan"
            : "dinonaktifkan";

  const busyFail = results.some(
    (r) => !r.ok && r.error === PRISMA_BUSY_USER_MESSAGE,
  );

  if (okCount === 0 && busyFail) {
    return NextResponse.json(
      {
        error: PRISMA_BUSY_USER_MESSAGE,
        okCount,
        failCount,
        results,
        message: PRISMA_BUSY_USER_MESSAGE,
      },
      { status: 503 },
    );
  }

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

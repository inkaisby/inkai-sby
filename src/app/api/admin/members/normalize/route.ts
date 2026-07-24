import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import {
  canEditKyuBaru,
  formatRankLabel,
  needsRankNormalization,
  normalizeGenderStorage,
} from "@/lib/belt";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import {
  rateLimitAsync,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

/**
 * Normalisasi massal currentRank + gender anggota di cakupan admin.
 * PUTIH → Putih (Kyu 10), MALE → L, dll.
 */
export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const rlKey = `admin-members-normalize:${authResult.user.id}`;
  const limit = await rateLimitAsync(rlKey, { max: 30, windowMs: 60_000 });
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfterSec ?? 60, rlKey);
  }

  if (!canEditKyuBaru(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat menjalankan normalisasi data" },
      { status: 403 },
    );
  }

  const { res, data } = await inkaiFetch(
    "/v1/members?limit=200&page=1",
    {},
    authResult.token,
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal memuat anggota") },
      { status: res.status },
    );
  }

  const members = (data.data as Array<Record<string, unknown>>) ?? [];
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const m of members) {
    const id = String(m.id || "");
    if (!id) continue;

    const patch: Record<string, unknown> = {};
    const rank = String(m.currentRank || "");
    if (needsRankNormalization(rank)) {
      patch.currentRank = formatRankLabel(rank);
    }

    const genderNorm = normalizeGenderStorage(
      typeof m.gender === "string" ? m.gender : null,
    );
    if (
      genderNorm &&
      String(m.gender || "").trim().toUpperCase() !== genderNorm
    ) {
      patch.gender = genderNorm;
    }

    if (Object.keys(patch).length === 0) {
      skipped += 1;
      continue;
    }

    const { res: pRes, data: pData } = await inkaiFetch(
      `/v1/members/${id}`,
      { method: "PATCH", body: JSON.stringify(patch) },
      authResult.token,
    );
    if (!pRes.ok) {
      errors.push(
        `${String(m.fullName || id)}: ${inkaiErrorMessage(pData, "gagal")}`,
      );
      continue;
    }
    updated += 1;
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "MEMBER_DATA_NORMALIZE",
    details: `Normalized ${updated} members (${skipped} skipped, ${errors.length} errors)`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    updated,
    skipped,
    errors: errors.slice(0, 10),
    message: `Normalisasi selesai: ${updated} diperbarui, ${skipped} sudah sesuai`,
  });
}

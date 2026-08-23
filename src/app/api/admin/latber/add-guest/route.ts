import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { canRegisterMembersToEvents } from "@/lib/wilayah-rbac";
import { latberGuestAddSchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { getPrimaryAdminRole } from "@/lib/rbac";
import {
  assertDojoAllowed,
  getManagedDojoIdsFromUser,
} from "@/lib/managed-dojos";
import { createLatberGuestAndRegister } from "@/lib/latber-guest";
import { assertLatberPeriodMutable } from "@/lib/latber-period-meta-store";
import { findMemberDuplicates } from "@/lib/member-duplicate";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    if (!authResult.token) {
      return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
    }

    if (!canRegisterMembersToEvents(authResult.user.roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang mendaftarkan peserta ke Latber" },
        { status: 403 },
      );
    }

    const rlKey = `latber:add-guest:${authResult.user.id}`;
    const limited = await rateLimitAsync(rlKey, { max: 20, windowMs: 60_000 });
    if (!limited.success) {
      return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
    }

    const body = await request.json().catch(() => null);
    const parsed = latberGuestAddSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak valid" },
        { status: 400 },
      );
    }

    const role = getPrimaryAdminRole(authResult.user.roles);
    if (role === "ADMIN_DOJO") {
      if (!assertDojoAllowed(authResult.user, parsed.data.dojoId)) {
        return NextResponse.json(
          { error: "Ranting di luar cakupan akun Anda" },
          { status: 403 },
        );
      }
      const allowlist = getManagedDojoIdsFromUser(authResult.user);
      if (allowlist.length === 0) {
        return NextResponse.json(
          { error: "Ranting tidak terkonfigurasi" },
          { status: 403 },
        );
      }
    }

    const periodMutable = await assertLatberPeriodMutable(
      authResult.token,
      parsed.data.eventId,
    );
    if (!periodMutable.ok) {
      return NextResponse.json(
        { error: periodMutable.error },
        { status: 403 },
      );
    }

    const fullName = parsed.data.fullName.trim().toUpperCase();
    if (!parsed.data.confirmSoftDuplicate) {
      const dups = await findMemberDuplicates({ fullName });
      const soft = dups.filter((d) => d.severity !== "hard").slice(0, 5);
      if (soft.length > 0) {
        return NextResponse.json(
          {
            error: `Nama mirip dengan anggota yang sudah ada (${soft[0].fullName}). Konfirmasi untuk lanjut atau daftar anggota yang ada.`,
            code: "SOFT_DUPLICATE",
            softDuplicates: soft.map((d) => ({
              id: d.id,
              fullName: d.fullName,
              nia: d.nia,
              dojoName: d.dojoName,
            })),
          },
          { status: 409 },
        );
      }
    }

    const result = await createLatberGuestAndRegister({
      eventId: parsed.data.eventId,
      fullName,
      dojoId: parsed.data.dojoId,
      currentRank: parsed.data.currentRank,
      phoneNumber: parsed.data.phoneNumber,
      token: authResult.token,
      registeredByUserId: authResult.user.id,
      audit: {
        userId: authResult.user.id,
        email: authResult.user.email,
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
      },
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status ?? 400 },
      );
    }

    return NextResponse.json({
      success: true,
      memberId: result.memberId,
      registrationId: result.registrationId,
      billingId: result.billingId,
      memberName: result.memberName,
    });
  } catch (error) {
    console.error("[latber-admin-add-guest]", error);
    return NextResponse.json(
      { error: "Gagal mendaftarkan peserta" },
      { status: 500 },
    );
  }
}

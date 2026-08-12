import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { canRegisterMembersToEvents } from "@/lib/wilayah-rbac";
import { latberRegisterSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";
import { prisma } from "@/lib/prisma";
import {
  forceRegisterLatberInDb,
  resolveLatberRegisterFeeAmount,
  validateLatberRegistrationEligibility,
} from "@/lib/latber-register";
import { assertLatberPeriodMutable } from "@/lib/latber-period-meta-store";

export const maxDuration = 30;

async function loadScopedMemberForRegister(
  user: Parameters<typeof getManagedDojoIdsFromUser>[0],
  memberId: string,
  primaryRole: string,
) {
  const allowlist =
    primaryRole === "ADMIN_DOJO" ? getManagedDojoIdsFromUser(user) : [];
  if (primaryRole === "ADMIN_DOJO" && allowlist.length === 0) {
    return null;
  }
  return prisma.member.findFirst({
    where: {
      id: memberId,
      isDeleted: false,
      ...(allowlist.length > 0 ? { dojoId: { in: allowlist } } : {}),
    },
    select: {
      id: true,
      fullName: true,
      currentRank: true,
      dojoId: true,
    },
  });
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    if (!authResult.token) {
      return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
    }

    if (!canRegisterMembersToEvents(authResult.user.roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang mendaftarkan anggota ke event" },
        { status: 403 },
      );
    }

    const rlKey = `latber:register:${authResult.user.id}`;
    const limited = await rateLimitAsync(rlKey, { max: 20, windowMs: 60_000 });
    if (!limited.success) {
      return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const parsed = latberRegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const { eventId, memberId } = parsed.data;

    const periodMutable = await assertLatberPeriodMutable(authResult.token, eventId);
    if (!periodMutable.ok) {
      return NextResponse.json(
        { error: periodMutable.error },
        { status: periodMutable.status },
      );
    }

    const primaryRole = getPrimaryAdminRole(authResult.user.roles);
    const eligibility = await validateLatberRegistrationEligibility(
      authResult.token,
      eventId,
      memberId,
    );
    if (!eligibility.ok) {
      return NextResponse.json({ error: eligibility.error }, { status: 400 });
    }

    const scopedMember = await loadScopedMemberForRegister(
      authResult.user,
      memberId,
      primaryRole,
    );
    if (!scopedMember) {
      return NextResponse.json(
        {
          error:
            primaryRole === "ADMIN_DOJO"
              ? "Anggota di luar ranting Anda"
              : "Anggota tidak ditemukan",
        },
        { status: 403 },
      );
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, isDeleted: false },
      select: { title: true },
    });
    const periodTitle = event?.title ?? "Latber";
    const amount = await resolveLatberRegisterFeeAmount({
      token: authResult.token,
      eventId,
    });

    const dbReg = await forceRegisterLatberInDb({
      eventId,
      memberId,
      registeredByUserId: authResult.user.id,
      periodTitle,
      amount,
      status: "APPROVED",
    });
    if (!dbReg.ok) {
      return NextResponse.json({ error: dbReg.error }, { status: 400 });
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "LATBER_REGISTER",
      details: `Registered ${dbReg.memberName} for ${periodTitle}`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    return NextResponse.json({
      success: true,
      registrationId: dbReg.registrationId,
      billingId: dbReg.billingId,
      billingAmount: dbReg.billingAmount,
      billingStatus: dbReg.billingStatus,
    });
  } catch (error) {
    console.error("[Latber Register]", error);
    const message =
      error instanceof Error ? error.message : "Gagal mendaftarkan anggota";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

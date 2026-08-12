import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";
import { buildMemberFilter, getPrimaryAdminRole } from "@/lib/rbac";
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";
import { formatRankLabel } from "@/lib/belt";
import { isLatberEventTitle } from "@/lib/latber";
import {
  resolveLatberRegisterFeeAmount,
  validateLatberRegistrationEligibility,
} from "@/lib/latber-register";

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const primaryRole = getPrimaryAdminRole(authResult.user.roles);
  if (primaryRole === "ADMIN_DOJO") {
    const allowlist = getManagedDojoIdsFromUser(authResult.user);
    if (allowlist.length === 0) {
      return NextResponse.json(
        { error: "Akun belum terhubung ke ranting" },
        { status: 403 },
      );
    }
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");
  if (!memberId) {
    return NextResponse.json({ error: "memberId wajib" }, { status: 400 });
  }

  const scopedMember = await prisma.member.findFirst({
    where: { AND: [{ id: memberId }, buildMemberFilter(authResult.user)] },
    select: {
      id: true,
      fullName: true,
      nia: true,
      currentRank: true,
      dojoId: true,
      dojo: { select: { name: true } },
      user: { select: { photoUrl: true } },
    },
  });
  if (!scopedMember) {
    return NextResponse.json(
      { error: "Anggota tidak ditemukan atau di luar cakupan" },
      { status: 403 },
    );
  }

  const periodId = searchParams.get("periodId")?.trim() || null;

  if (periodId) {
    const event = await prisma.event.findFirst({
      where: { id: periodId, isDeleted: false },
      select: { id: true, title: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Periode Latihan Bersama tidak ditemukan" }, { status: 404 });
    }
    if (!isLatberEventTitle(event.title)) {
      return NextResponse.json({ error: "Event bukan periode Latihan Bersama" }, { status: 400 });
    }

    const eligibility = await validateLatberRegistrationEligibility(
      authResult.token,
      periodId,
      memberId,
    );
    const feeAmount = await resolveLatberRegisterFeeAmount({
      token: authResult.token,
      eventId: periodId,
    });

    const latberRow = {
      memberId: scopedMember.id,
      registrationId: null as string | null,
      photoUrl: scopedMember.user?.photoUrl ?? null,
      nia: scopedMember.nia,
      fullName: scopedMember.fullName,
      currentRank:
        formatRankLabel(scopedMember.currentRank) ||
        scopedMember.currentRank ||
        null,
      dojoName: scopedMember.dojo?.name ?? "—",
      dojoId: scopedMember.dojoId,
      status: "BELUM_DAFTAR",
      billingId: null as string | null,
      billingStatus: null as string | null,
      billingAmount: feeAmount,
      selfRegistration: false,
      memberPaymentConfirmedAt: null,
      hydrateOk: eligibility.ok,
      hydrateError: eligibility.ok ? null : eligibility.error,
    };

    return NextResponse.json({ latberRow });
  }

  const { res, data } = await inkaiFetch(`/v1/members/${memberId}`, {}, authResult.token);
  if (!res.ok) {
    return NextResponse.json(
      { error: "Anggota tidak ditemukan" },
      { status: res.status === 404 ? 404 : 400 },
    );
  }

  return NextResponse.json({ member: data.data });
}

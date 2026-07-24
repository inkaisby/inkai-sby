import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { buildMemberFilter, getPrimaryAdminRole } from "@/lib/rbac";
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";
import { formatRankLabel } from "@/lib/belt";

/**
 * On-demand Belum Daftar stubs for registrants-first UI.
 * GET /api/admin/ukt/candidates?periodId=&dojo=&limit=
 */
export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

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
  const periodId = searchParams.get("periodId")?.trim();
  if (!periodId) {
    return NextResponse.json({ error: "periodId wajib" }, { status: 400 });
  }

  const dojoId = searchParams.get("dojo")?.trim() || "";
  const limitRaw = Number(searchParams.get("limit") || "40");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), 80)
    : 40;

  const event = await prisma.event.findFirst({
    where: { id: periodId, isDeleted: false },
    select: { id: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Periode UKT tidak ditemukan" }, { status: 404 });
  }

  const allowlist =
    primaryRole === "ADMIN_DOJO"
      ? getManagedDojoIdsFromUser(authResult.user)
      : [];
  if (dojoId && allowlist.length > 0 && !allowlist.includes(dojoId)) {
    return NextResponse.json({ candidates: [] });
  }

  const registered = await prisma.eventRegistration.findMany({
    where: {
      eventId: periodId,
      status: { notIn: ["CANCELLED", "REJECTED"] },
    },
    select: { memberId: true },
    take: 2000,
  });
  const registeredIds = registered.map((r) => r.memberId);

  const dojoScope =
    dojoId
      ? { dojoId }
      : allowlist.length > 0
        ? { dojoId: { in: allowlist } }
        : {};

  const members = await prisma.member.findMany({
    where: {
      AND: [
        buildMemberFilter(authResult.user),
        { isDeleted: false },
        dojoScope,
        registeredIds.length > 0
          ? { id: { notIn: registeredIds } }
          : {},
      ],
    },
    select: {
      id: true,
      fullName: true,
      nia: true,
      currentRank: true,
      dojoId: true,
      birthPlace: true,
      birthDate: true,
      gender: true,
      address: true,
      birthCertificateUrl: true,
      bpjsCardUrl: true,
      dojo: { select: { name: true } },
      user: { select: { photoUrl: true } },
    },
    orderBy: { fullName: "asc" },
    take: limit,
  });

  // #region agent log
  console.info("[ukt-dbg f0acf0]", {
    hypothesisId: "E",
    location: "candidates/route.ts",
    message: "belum daftar candidates",
    data: {
      role: primaryRole,
      count: members.length,
      registeredCount: registeredIds.length,
      hasDojo: Boolean(dojoId),
    },
  });
  // #endregion

  const candidates = members.map((m) => ({
    memberId: m.id,
    registrationId: null as string | null,
    photoUrl: m.user?.photoUrl ?? null,
    nia: m.nia,
    fullName: m.fullName,
    birthPlace: m.birthPlace,
    birthDate: m.birthDate?.toISOString() ?? null,
    gender: m.gender,
    address: m.address,
    kyuLama: formatRankLabel(m.currentRank) || m.currentRank || null,
    kyuBaru: null as string | null,
    memberCurrentRank: formatRankLabel(m.currentRank) || m.currentRank || null,
    birthCertificateUrl: m.birthCertificateUrl,
    bpjsCardUrl: m.bpjsCardUrl,
    dojoName: m.dojo?.name ?? "—",
    dojoId: m.dojoId,
    status: "BELUM_DAFTAR",
    billingId: null as string | null,
    billingStatus: null as string | null,
    billingAmount: null as number | null,
    outstandingDues: 0,
    pendingVerifications: 0,
    attendanceCount: 0,
    attendancePct: 0,
    examResult: null,
    examPresent: null,
    registrationWaiver: null,
    selfRegistration: false,
    memberPaymentConfirmedAt: null,
  }));

  return NextResponse.json({ candidates });
}

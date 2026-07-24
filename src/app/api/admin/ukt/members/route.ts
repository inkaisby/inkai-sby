import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { uktMemberCreateSchema } from "@/lib/security/schemas";
import { createAdminMember } from "@/lib/admin-member-create";
import { prisma } from "@/lib/prisma";
import { buildMemberFilter, getPrimaryAdminRole } from "@/lib/rbac";
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";
import { formatRankLabel } from "@/lib/belt";
import { parseUktEventTitle } from "@/lib/ukt";
import { validateUktRegistrationEligibility } from "@/lib/ukt-register";
import { fetchDuesExemptMemberIds } from "@/lib/member-local-fields";

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
    auditAction: "UKT_MEMBER_CREATE",
  });
}

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  // Fail-closed: admin ranting tanpa ranting terkelola tidak berhak melihat data anggota manapun.
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

  // Verifikasi anggota berada dalam cakupan RBAC sebelum meneruskan ke Inkai (anti-IDOR).
  const scopedMember = await prisma.member.findFirst({
    where: { AND: [{ id: memberId }, buildMemberFilter(authResult.user)] },
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
  });
  if (!scopedMember) {
    return NextResponse.json(
      { error: "Anggota tidak ditemukan atau di luar cakupan" },
      { status: 403 },
    );
  }

  const periodId = searchParams.get("periodId")?.trim() || null;

  // Hydrate Belum Daftar untuk registrants-first UI (gate fields per anggota).
  if (periodId) {
    const event = await prisma.event.findFirst({
      where: { id: periodId, isDeleted: false },
      select: { id: true, title: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Periode UKT tidak ditemukan" }, { status: 404 });
    }

    const parsedTitle = parseUktEventTitle(event.title);
    const eligibility = await validateUktRegistrationEligibility(
      authResult.token,
      periodId,
      memberId,
      { primaryRole },
    );

    const exempt = await fetchDuesExemptMemberIds([memberId]);
    const blockers = eligibility.ok ? [] : eligibility.blockers;
    const hasDocs =
      Boolean(scopedMember.birthCertificateUrl?.trim()) &&
      Boolean(scopedMember.bpjsCardUrl?.trim());

    // Estimasi absensi/iuran dari blocker bila tidak lolos; 0 jika lolos gate.
    let outstandingDues = 0;
    let attendancePct = 0;
    let attendanceCount = 0;
    if (!eligibility.ok) {
      if (blockers.includes("IURAN_TUNGGAKAN") && !exempt.has(memberId)) {
        outstandingDues = 1;
      }
      if (blockers.includes("ABSENSI_KURANG")) {
        attendancePct = 0;
      }
    } else if (parsedTitle) {
      // Lolos absensi → set ke ambang agar UI tidak memblokir palsu
      attendancePct = 75;
      attendanceCount = 36;
    }
    if (exempt.has(memberId)) outstandingDues = 0;

    const uktRow = {
      memberId: scopedMember.id,
      registrationId: null as string | null,
      photoUrl: scopedMember.user?.photoUrl ?? null,
      nia: scopedMember.nia,
      fullName: scopedMember.fullName,
      birthPlace: scopedMember.birthPlace,
      birthDate: scopedMember.birthDate?.toISOString() ?? null,
      gender: scopedMember.gender,
      address: scopedMember.address,
      kyuLama:
        formatRankLabel(scopedMember.currentRank) ||
        scopedMember.currentRank ||
        null,
      kyuBaru: null as string | null,
      memberCurrentRank:
        formatRankLabel(scopedMember.currentRank) ||
        scopedMember.currentRank ||
        null,
      birthCertificateUrl: scopedMember.birthCertificateUrl,
      bpjsCardUrl: scopedMember.bpjsCardUrl,
      dojoName: scopedMember.dojo?.name ?? "—",
      dojoId: scopedMember.dojoId,
      status: "BELUM_DAFTAR",
      billingId: null as string | null,
      billingStatus: null as string | null,
      billingAmount: null as number | null,
      outstandingDues,
      pendingVerifications: 0,
      attendanceCount,
      attendancePct,
      examResult: null,
      examPresent: null,
      registrationWaiver: null,
      selfRegistration: false,
      memberPaymentConfirmedAt: null,
      hydrateOk: eligibility.ok,
      hydrateBlockers: blockers,
      hydrateHasDocs: hasDocs,
    };

    return NextResponse.json({ uktRow });
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

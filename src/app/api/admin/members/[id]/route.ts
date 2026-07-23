import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { canAssignNia, canEditKyuBaru, formatMemberName, formatRankLabel } from "@/lib/belt";
import { memberActionSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import { generateSimplePassword } from "@/lib/security/password";
import {
  getMemberImpact,
  getMemberLifecycle,
  type MemberImpactSummary,
} from "@/lib/member-lifecycle";
import {
  activateMember,
  deactivateMember,
  restoreMember,
  softDeleteMember,
} from "@/lib/member-lifecycle-actions";
import {
  canSoftDeleteMembers,
  canToggleMemberActive,
  canManageIuranByWilayah,
} from "@/lib/wilayah-rbac";
import { buildMemberFilter, type SessionUser } from "@/lib/rbac";
import { adminDojoGrantBlocksMemberAction } from "@/lib/admin-dojo-grants";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { assertDojoInScope } from "@/lib/pengaturan";
import {
  mshAllowedForRank,
  normalizeMsh,
} from "@/lib/member-profile-locks";
import { notifyAdminsAboutMemberMsh } from "@/lib/member-msh-notify";

type RouteContext = { params: Promise<{ id: string }> };

export const maxDuration = 30;

const EMPTY_IMPACT: MemberImpactSummary = {
  unpaidBillingCount: 0,
  unpaidBillingAmount: 0,
  openEventRegistrationCount: 0,
  uktOpenCount: 0,
};

function asBillingList(data: Record<string, unknown>): Array<Record<string, unknown>> {
  const raw = data.data;
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  return [];
}

async function loadLocalMemberFallback(id: string, user: SessionUser) {
  return prisma.member.findFirst({
    where: {
      AND: [{ id }, buildMemberFilter(user, { anyDeleted: true })],
    },
    include: {
      dojo: { include: { branch: { select: { name: true } } } },
      user: {
        select: { email: true, phoneNumber: true, photoUrl: true },
      },
      ranks: { orderBy: { date: "desc" }, take: 10 },
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { id } = await context.params;
  const billingQs = new URLSearchParams({ limit: "30", memberId: id });

  // Paralel: member + billing + metadata lokal (jangan waterfall).
  const [memberFetch, billingFetch, lifecycleResult, impactResult] =
    await Promise.all([
      inkaiFetch(`/v1/members/${id}`, {}, authResult.token),
      inkaiFetch(`/v1/billing?${billingQs}`, {}, authResult.token),
      withPrismaFallback("member-detail-lifecycle", () => getMemberLifecycle(id), null),
      withPrismaFallback(
        "member-detail-impact",
        () => getMemberImpact(id),
        EMPTY_IMPACT,
      ),
    ]);

  let member = (memberFetch.data.data as Record<string, unknown>) ?? {};
  if (!memberFetch.res.ok) {
    const local = await withPrismaFallback(
      "member-detail-local",
      () => loadLocalMemberFallback(id, authResult.user),
      null,
    );
    if (!local.data) {
      return NextResponse.json(
        {
          error: inkaiErrorMessage(
            memberFetch.data,
            "Anggota tidak ditemukan",
          ),
        },
        { status: memberFetch.res.status },
      );
    }
    const row = local.data;
    member = {
      ...row,
      birthDate: row.birthDate?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  let billings: Array<Record<string, unknown>> = [];
  const nested = member.billings;
  if (Array.isArray(nested) && nested.length > 0) {
    billings = nested as Array<Record<string, unknown>>;
  } else if (billingFetch.res.ok) {
    billings = asBillingList(billingFetch.data).filter((b) => {
      const mid =
        (b.member as { id?: string } | undefined)?.id ??
        (b.memberId as string | undefined);
      return !mid || String(mid) === id;
    });
  }

  // Overlay dokumen + akun login dari Prisma lokal (Inkai sering tidak kirim nested user)
  const localExtras = await withPrismaFallback(
    "member-detail-local-extras",
    () =>
      prisma.member.findFirst({
        where: { id },
        select: {
          monthlyDuesAmount: true,
          allowEventWithoutDues: true,
          birthCertificateUrl: true,
          bpjsCardUrl: true,
          bpjsCardNumber: true,
          mshNumber: true,
          user: {
            select: { email: true, phoneNumber: true, photoUrl: true },
          },
        },
      }),
    null,
  );

  let monthlyDuesAmount =
    typeof member.monthlyDuesAmount === "number"
      ? member.monthlyDuesAmount
      : Number(member.monthlyDuesAmount);
  if (!Number.isFinite(monthlyDuesAmount)) {
    monthlyDuesAmount = localExtras.data?.monthlyDuesAmount ?? 50_000;
  }

  if (localExtras.data) {
    const existingUser =
      member.user && typeof member.user === "object"
        ? (member.user as Record<string, unknown>)
        : {};
    const localUser = localExtras.data.user;
    member = {
      ...member,
      birthCertificateUrl: localExtras.data.birthCertificateUrl,
      bpjsCardUrl: localExtras.data.bpjsCardUrl,
      bpjsCardNumber: localExtras.data.bpjsCardNumber,
      allowEventWithoutDues: localExtras.data.allowEventWithoutDues,
      mshNumber:
        localExtras.data.mshNumber ??
        (typeof member.mshNumber === "string" ? member.mshNumber : null),
      user: localUser
        ? {
            ...existingUser,
            email:
              (typeof existingUser.email === "string" && existingUser.email) ||
              localUser.email,
            phoneNumber:
              (typeof existingUser.phoneNumber === "string" &&
                existingUser.phoneNumber) ||
              localUser.phoneNumber,
            photoUrl:
              (typeof existingUser.photoUrl === "string" &&
                existingUser.photoUrl) ||
              localUser.photoUrl,
          }
        : member.user ?? null,
    };
  }

  return NextResponse.json({
    member: {
      ...member,
      monthlyDuesAmount,
      billings,
      lifecycle: lifecycleResult.data,
      impact: impactResult.data,
    },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = memberActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const action = parsed.data.action;
  const roles = authResult.user.roles;
  const grantBlock = adminDojoGrantBlocksMemberAction(
    authResult.adminDojoGrants,
    action,
  );
  if (grantBlock) {
    return NextResponse.json({ error: grantBlock }, { status: 403 });
  }
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");
  const token = authResult.token;

  if (action === "set_nia") {
    if (!canAssignNia(roles)) {
      return NextResponse.json(
        { error: "Hanya pengurus cabang yang dapat mengisi NIA" },
        { status: 403 },
      );
    }
    const nia = parsed.data.nia?.trim();
    if (!nia) {
      return NextResponse.json({ error: "NIA wajib diisi" }, { status: 400 });
    }

    const { res, data } = await inkaiFetch(
      `/v1/members/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ nia }),
      },
      token,
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: inkaiErrorMessage(data, "Gagal menyimpan NIA") },
        { status: res.status },
      );
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "MEMBER_SET_NIA",
      details: `Set NIA ${nia} for member ${id}`,
      ip,
      userAgent,
      token,
    });

    return NextResponse.json({
      success: true,
      member: data.data,
      message: "NIA berhasil disimpan",
    });
  }

  if (action === "set_msh") {
    if (!canManageIuranByWilayah(roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang mengisi No. MSH anggota" },
        { status: 403 },
      );
    }
    const scoped = await prisma.member.findFirst({
      where: {
        AND: [{ id }, buildMemberFilter(authResult.user)],
      },
      select: {
        id: true,
        fullName: true,
        currentRank: true,
        mshNumber: true,
        dojoId: true,
        dojo: { select: { name: true } },
      },
    });
    if (!scoped) {
      return NextResponse.json(
        { error: "Anggota tidak ditemukan di cakupan Anda" },
        { status: 404 },
      );
    }
    if (!mshAllowedForRank(scoped.currentRank)) {
      return NextResponse.json(
        { error: "No. MSH hanya untuk sabuk Hitam (DAN)" },
        { status: 400 },
      );
    }

    const msh =
      parsed.data.mshNumber === null || parsed.data.mshNumber === ""
        ? null
        : normalizeMsh(parsed.data.mshNumber);
    if (parsed.data.mshNumber != null && String(parsed.data.mshNumber).trim() && !msh) {
      return NextResponse.json(
        { error: "No. MSH tidak valid" },
        { status: 400 },
      );
    }
    if (msh) {
      const clash = await prisma.member.findFirst({
        where: { mshNumber: msh, id: { not: id }, isDeleted: false },
        select: { fullName: true },
      });
      if (clash) {
        return NextResponse.json(
          { error: `No. MSH sudah dipakai anggota lain (${clash.fullName})` },
          { status: 409 },
        );
      }
    }

    const prev = scoped.mshNumber?.trim() || null;
    if (prev === msh) {
      return NextResponse.json({
        success: true,
        member: { id, mshNumber: msh },
        message: "No. MSH tidak berubah",
      });
    }

    await prisma.member.update({
      where: { id },
      data: { mshNumber: msh },
    });

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "MEMBER_SET_MSH",
      details: `Set MSH ${msh ?? "(hapus)"} for member ${id} (was ${prev ?? "—"})`,
      ip,
      userAgent,
      token,
    });

    void notifyAdminsAboutMemberMsh({
      dojoId: scoped.dojoId,
      token,
      excludeUserId: authResult.user.id,
      title: msh ? "No. MSH anggota diperbarui" : "No. MSH anggota dihapus",
      content: msh
        ? `${scoped.fullName} (${scoped.dojo.name}): No. MSH ${msh}${prev ? ` (sebelumnya ${prev})` : ""}.`
        : `${scoped.fullName} (${scoped.dojo.name}): No. MSH dihapus (sebelumnya ${prev}).`,
    });

    return NextResponse.json({
      success: true,
      member: { id, mshNumber: msh },
      message: msh ? "No. MSH berhasil disimpan" : "No. MSH dihapus",
    });
  }

  if (action === "set_name") {
    if (!canManageIuranByWilayah(roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang mengubah nama anggota" },
        { status: 403 },
      );
    }
    const fullName = formatMemberName(parsed.data.fullName);
    if (!fullName || fullName.length < 2) {
      return NextResponse.json(
        { error: "Nama wajib diisi (min. 2 karakter)" },
        { status: 400 },
      );
    }

    const scoped = await prisma.member.findFirst({
      where: {
        AND: [{ id }, buildMemberFilter(authResult.user)],
      },
      select: { id: true, fullName: true },
    });
    if (!scoped) {
      return NextResponse.json(
        { error: "Anggota tidak ditemukan di cakupan Anda" },
        { status: 404 },
      );
    }

    if (formatMemberName(scoped.fullName) === fullName) {
      return NextResponse.json({
        success: true,
        member: { id, fullName },
        message: "Nama tidak berubah",
      });
    }

    const { res, data } = await inkaiFetch(
      `/v1/members/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ fullName }),
      },
      token,
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: inkaiErrorMessage(data, "Gagal menyimpan nama") },
        { status: res.status },
      );
    }

    try {
      await prisma.member.update({
        where: { id },
        data: { fullName },
      });
    } catch (err) {
      console.error("[set_name] prisma update failed:", err);
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "MEMBER_SET_NAME",
      details: `Rename ${scoped.fullName} → ${fullName} (${id})`,
      ip,
      userAgent,
      token,
    });

    return NextResponse.json({
      success: true,
      member: { id, fullName },
      fullName,
      message: "Nama berhasil disimpan",
    });
  }

  if (action === "set_rank") {
    if (!canEditKyuBaru(roles)) {
      return NextResponse.json(
        { error: "Hanya pengurus cabang yang dapat mengubah sabuk anggota" },
        { status: 403 },
      );
    }
    const rawRank = parsed.data.currentRank?.trim();
    const currentRank = formatRankLabel(rawRank) || rawRank;
    if (!currentRank) {
      return NextResponse.json({ error: "Sabuk wajib dipilih" }, { status: 400 });
    }

    const { res: prevRes, data: prevData } = await inkaiFetch(
      `/v1/members/${id}`,
      {},
      token,
    );
    const prevMember = prevRes.ok
      ? ((prevData.data as { currentRank?: string } | undefined) ?? null)
      : null;
    const previousRank = String(prevMember?.currentRank ?? "").trim();

    const { res, data } = await inkaiFetch(
      `/v1/members/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ currentRank }),
      },
      token,
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: inkaiErrorMessage(data, "Gagal memperbarui sabuk") },
        { status: res.status },
      );
    }

    if (previousRank !== currentRank) {
      try {
        await prisma.memberRank.create({
          data: {
            memberId: id,
            rank: currentRank,
            date: new Date(),
            location: "Koreksi cabang",
            isVerified: true,
          },
        });
      } catch (err) {
        console.error("[set_rank] memberRank create failed:", err);
      }
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "MEMBER_SET_RANK",
      details: `Set sabuk ${previousRank || "—"} → ${currentRank} for member ${id}`,
      ip,
      userAgent,
      token,
    });

    return NextResponse.json({
      success: true,
      member: data.data,
      currentRank,
      message: `Sabuk diperbarui: ${currentRank}`,
    });
  }

  if (action === "set_dojo") {
    if (!canEditKyuBaru(roles)) {
      return NextResponse.json(
        {
          error:
            "Hanya pengurus cabang yang dapat memindahkan anggota antar ranting",
        },
        { status: 403 },
      );
    }
    const nextDojoId = parsed.data.dojoId?.trim();
    if (!nextDojoId) {
      return NextResponse.json(
        { error: "Ranting tujuan wajib dipilih" },
        { status: 400 },
      );
    }

    const scoped = await prisma.member.findFirst({
      where: {
        AND: [{ id }, buildMemberFilter(authResult.user)],
      },
      select: {
        id: true,
        fullName: true,
        dojoId: true,
        dojo: { select: { name: true } },
      },
    });
    if (!scoped) {
      return NextResponse.json(
        { error: "Anggota tidak ditemukan di cakupan Anda" },
        { status: 404 },
      );
    }

    const targetDojo = await assertDojoInScope(authResult.user, nextDojoId);
    if (!targetDojo || targetDojo.isDeleted) {
      return NextResponse.json(
        { error: "Ranting tujuan di luar cakupan atau tidak valid" },
        { status: 400 },
      );
    }

    if (scoped.dojoId === nextDojoId) {
      return NextResponse.json({
        success: true,
        dojoId: nextDojoId,
        dojoName: targetDojo.name,
        message: `Anggota sudah di ranting ${targetDojo.name}`,
      });
    }

    const previousDojoName = scoped.dojo?.name || "—";

    const { res, data } = await inkaiFetch(
      `/v1/members/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ dojoId: nextDojoId }),
      },
      token,
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: inkaiErrorMessage(data, "Gagal memindahkan ranting") },
        { status: res.status },
      );
    }

    try {
      await prisma.member.update({
        where: { id },
        data: { dojoId: nextDojoId },
      });
    } catch (err) {
      console.error("[set_dojo] prisma update failed:", err);
      return NextResponse.json(
        {
          error:
            "Ranting terbarui di sistem pusat, tetapi gagal sinkron lokal. Muat ulang halaman.",
        },
        { status: 500 },
      );
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "MEMBER_SET_DOJO",
      details: `Pindah ranting ${previousDojoName} → ${targetDojo.name} for ${scoped.fullName} (${id})`,
      ip,
      userAgent,
      token,
    });

    return NextResponse.json({
      success: true,
      member: data.data,
      dojoId: nextDojoId,
      dojoName: targetDojo.name,
      message: `Dipindah: ${previousDojoName} → ${targetDojo.name}`,
    });
  }

  if (action === "set_dues") {
    if (!canManageIuranByWilayah(roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang mengubah iuran bulanan anggota" },
        { status: 403 },
      );
    }
    const amount = parsed.data.monthlyDuesAmount;
    if (amount == null || Number.isNaN(amount)) {
      return NextResponse.json(
        { error: "Nominal iuran wajib diisi" },
        { status: 400 },
      );
    }

    const scoped = await prisma.member.findFirst({
      where: {
        AND: [{ id }, buildMemberFilter(authResult.user)],
      },
      select: { id: true, fullName: true, monthlyDuesAmount: true },
    });
    if (!scoped) {
      return NextResponse.json(
        { error: "Anggota tidak ditemukan di cakupan Anda" },
        { status: 404 },
      );
    }

    const { res, data } = await inkaiFetch(
      `/v1/members/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ monthlyDuesAmount: amount }),
      },
      token,
    );

    // Selalu sinkron lokal (sumber generate tagihan & detail)
    try {
      await prisma.member.update({
        where: { id },
        data: { monthlyDuesAmount: amount },
      });
    } catch (err) {
      console.error("[set_dues] prisma update failed:", err);
      if (!res.ok) {
        return NextResponse.json(
          { error: inkaiErrorMessage(data, "Gagal menyimpan iuran bulanan") },
          { status: res.status },
        );
      }
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "MEMBER_SET_DUES",
      details: `Set iuran/bln ${scoped.monthlyDuesAmount} → ${amount} for ${scoped.fullName} (${id})`,
      ip,
      userAgent,
      token,
    });

    return NextResponse.json({
      success: true,
      monthlyDuesAmount: amount,
      message: `Iuran/bln diperbarui: Rp ${amount.toLocaleString("id-ID")}`,
    });
  }

  if (action === "set_dues_exemption") {
    if (!canManageIuranByWilayah(roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang mengubah pengecualian iuran anggota" },
        { status: 403 },
      );
    }
    const allowEventWithoutDues = parsed.data.allowEventWithoutDues;
    if (allowEventWithoutDues == null) {
      return NextResponse.json(
        { error: "Status pengecualian iuran wajib diisi" },
        { status: 400 },
      );
    }

    const scoped = await prisma.member.findFirst({
      where: {
        AND: [{ id }, buildMemberFilter(authResult.user)],
      },
      select: {
        id: true,
        fullName: true,
        allowEventWithoutDues: true,
      },
    });
    if (!scoped) {
      return NextResponse.json(
        { error: "Anggota tidak ditemukan di cakupan Anda" },
        { status: 404 },
      );
    }

    await prisma.member.update({
      where: { id },
      data: { allowEventWithoutDues },
    });

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "MEMBER_SET_DUES_EXEMPTION",
      details: `Pengecualian iuran ${scoped.allowEventWithoutDues ? "aktif" : "nonaktif"} → ${allowEventWithoutDues ? "aktif" : "nonaktif"} for ${scoped.fullName} (${id})`,
      ip,
      userAgent,
      token,
    });

    return NextResponse.json({
      success: true,
      allowEventWithoutDues,
      message: allowEventWithoutDues
        ? "Pengecualian iuran diaktifkan — anggota boleh daftar event/UKT tanpa lunas iuran"
        : "Pengecualian iuran dinonaktifkan",
    });
  }

  if (action === "reset_password") {
    if (!canToggleMemberActive(roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang mereset password anggota" },
        { status: 403 },
      );
    }

    const scoped = await prisma.member.findFirst({
      where: {
        AND: [{ id }, buildMemberFilter(authResult.user)],
      },
      select: {
        id: true,
        fullName: true,
        userId: true,
        user: { select: { id: true, email: true } },
      },
    });
    if (!scoped) {
      return NextResponse.json(
        { error: "Anggota tidak ditemukan di cakupan Anda" },
        { status: 404 },
      );
    }
    if (!scoped.userId || !scoped.user?.email) {
      return NextResponse.json(
        {
          error:
            "Anggota belum punya akun login. Minta anggota daftar mandiri atau gabungkan dengan data yang sudah berakun.",
        },
        { status: 400 },
      );
    }

    const temporaryPassword = generateSimplePassword(scoped.fullName);
    const { res, data } = await inkaiFetch(
      `/v1/members/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ password: temporaryPassword }),
      },
      token,
    );

    // Sinkron hash lokal (login memakai User.passwordHash yang sama)
    try {
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      await prisma.user.update({
        where: { id: scoped.userId },
        data: { passwordHash },
      });
    } catch (err) {
      console.error("[reset_password] prisma user update failed:", err);
      if (!res.ok) {
        return NextResponse.json(
          {
            error: inkaiErrorMessage(
              data,
              "Gagal mereset password anggota",
            ),
          },
          { status: res.status },
        );
      }
    }

    if (!res.ok) {
      // Hash lokal sudah diubah — login masih bisa lewat DB bersama
      console.warn(
        "[reset_password] Inkai PATCH gagal setelah update lokal:",
        inkaiErrorMessage(data, "unknown"),
      );
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "MEMBER_RESET_PASSWORD",
      details: `Reset password for ${scoped.fullName} (${id}; ${scoped.user.email})`,
      ip,
      userAgent,
      token,
    });

    return NextResponse.json({
      success: true,
      email: scoped.user.email,
      temporaryPassword,
      message: `Password sementara dibuat untuk ${scoped.user.email}. Salin sekarang — tidak ditampilkan lagi.`,
    });
  }

  if (action === "set_documents") {
    const hasAkte = Object.prototype.hasOwnProperty.call(
      parsed.data,
      "birthCertificateUrl",
    );
    const hasBpjs = Object.prototype.hasOwnProperty.call(
      parsed.data,
      "bpjsCardUrl",
    );
    const hasBpjsNo = Object.prototype.hasOwnProperty.call(
      parsed.data,
      "bpjsCardNumber",
    );
    if (!hasAkte && !hasBpjs && !hasBpjsNo) {
      return NextResponse.json(
        { error: "Tidak ada field dokumen yang diubah" },
        { status: 400 },
      );
    }

    const scoped = await prisma.member.findFirst({
      where: {
        AND: [{ id }, buildMemberFilter(authResult.user, { anyDeleted: true })],
      },
      select: {
        id: true,
        fullName: true,
        birthCertificateUrl: true,
        bpjsCardUrl: true,
        bpjsCardNumber: true,
      },
    });
    if (!scoped) {
      return NextResponse.json(
        { error: "Anggota tidak ditemukan di cakupan Anda" },
        { status: 404 },
      );
    }

    const normalizeUrl = (v: string | null | undefined) => {
      if (v == null) return null;
      const t = String(v).trim();
      return t ? t : null;
    };
    const normalizeBpjsNo = (v: string | null | undefined) => {
      if (v == null) return null;
      const t = String(v).replace(/\s+/g, "").trim();
      return t ? t : null;
    };

    const nextAkte = hasAkte
      ? normalizeUrl(parsed.data.birthCertificateUrl)
      : scoped.birthCertificateUrl;
    const nextBpjs = hasBpjs
      ? normalizeUrl(parsed.data.bpjsCardUrl)
      : scoped.bpjsCardUrl;
    const nextBpjsNo = hasBpjsNo
      ? normalizeBpjsNo(parsed.data.bpjsCardNumber)
      : scoped.bpjsCardNumber;

    try {
      await prisma.member.update({
        where: { id },
        data: {
          birthCertificateUrl: nextAkte,
          bpjsCardUrl: nextBpjs,
          bpjsCardNumber: nextBpjsNo,
        },
      });
    } catch (err) {
      console.error("[set_documents] prisma update failed:", err);
      return NextResponse.json(
        { error: "Gagal menyimpan dokumen di database" },
        { status: 500 },
      );
    }

    const patchBody: Record<string, string | null> = {};
    if (hasAkte) patchBody.birthCertificateUrl = nextAkte;
    if (hasBpjs) patchBody.bpjsCardUrl = nextBpjs;
    if (hasBpjsNo) patchBody.bpjsCardNumber = nextBpjsNo;

    await inkaiFetch(
      `/v1/members/${id}`,
      { method: "PATCH", body: JSON.stringify(patchBody) },
      token,
    );

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "MEMBER_SET_DOCUMENTS",
      details: JSON.stringify({
        memberId: id,
        fullName: scoped.fullName,
        birthCertificateUrl: hasAkte ? nextAkte : undefined,
        bpjsCardUrl: hasBpjs ? nextBpjs : undefined,
        bpjsCardNumber: hasBpjsNo ? nextBpjsNo : undefined,
      }),
      ip,
      userAgent,
      token,
    });

    return NextResponse.json({
      success: true,
      birthCertificateUrl: nextAkte,
      bpjsCardUrl: nextBpjs,
      bpjsCardNumber: nextBpjsNo,
      message: "Dokumen anggota disimpan",
    });
  }

  if (action === "deactivate") {
    if (!canToggleMemberActive(roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang mengubah status anggota" },
        { status: 403 },
      );
    }
    if (!parsed.data.reasonCode) {
      return NextResponse.json(
        { error: "Alasan nonaktif wajib dipilih" },
        { status: 400 },
      );
    }
    const result = await deactivateMember({
      user: authResult.user,
      token,
      memberId: id,
      statusKind: parsed.data.statusKind || "INACTIVE",
      reasonCode: parsed.data.reasonCode,
      reasonNote: parsed.data.reasonNote,
      ip,
      userAgent,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      status: result.status,
      message: result.message,
    });
  }

  if (action === "activate") {
    if (!canToggleMemberActive(roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang mengubah status anggota" },
        { status: 403 },
      );
    }
    const result = await activateMember({
      user: authResult.user,
      token,
      memberId: id,
      ip,
      userAgent,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      status: result.status,
      message: result.message,
    });
  }

  if (action === "delete") {
    if (!canSoftDeleteMembers(roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang menghapus anggota" },
        { status: 403 },
      );
    }
    const result = await softDeleteMember({
      user: authResult.user,
      token,
      memberId: id,
      confirmName: parsed.data.confirmName,
      ip,
      userAgent,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      impact: result.impact,
      message: result.message,
    });
  }

  if (action === "restore") {
    const result = await restoreMember({
      user: authResult.user,
      token,
      memberId: id,
      ip,
      userAgent,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      status: result.status,
      message: result.message,
    });
  }

  const { res, data } = await inkaiFetch(
    `/v1/members/${id}/registration`,
    {
      method: "PATCH",
      body: JSON.stringify({
        action: parsed.data.action,
        nia: parsed.data.nia,
      }),
    },
    token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal memproses anggota") },
      { status: res.status },
    );
  }

  const payload = data.data as { status?: string } | undefined;
  return NextResponse.json({
    success: true,
    status: payload?.status,
    message:
      parsed.data.action === "approve"
        ? "Anggota berhasil disetujui"
        : "Anggota berhasil ditolak",
  });
}

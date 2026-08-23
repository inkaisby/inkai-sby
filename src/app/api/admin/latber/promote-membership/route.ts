import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { canRegisterMembersToEvents } from "@/lib/wilayah-rbac";
import { latberPromoteMembershipSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { getPrimaryAdminRole } from "@/lib/rbac";
import {
  assertDojoAllowed,
  getManagedDojoIdsFromUser,
} from "@/lib/managed-dojos";
import { prisma } from "@/lib/prisma";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { DEFAULT_MEMBER_RANK, formatRankLabel } from "@/lib/belt";
import { parseFlexibleBirthDate } from "@/lib/parse-birth-date";
import {
  activeHardDuplicates,
  findMemberDuplicates,
  formatDuplicateError,
  releasableArchivedIdConflicts,
  releaseIdentifiersFromArchivedMembers,
} from "@/lib/member-duplicate";
import { normalizeNia } from "@/lib/member-profile-locks";
import { tryProvisionMemberNiaLogin } from "@/lib/member-nia-login";
import {
  deleteLatberGuestMeta,
  isMembershipReady,
  loadLatberGuestMeta,
  upsertLatberGuestMeta,
} from "@/lib/latber-guest";

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
        { error: "Anda tidak berwenang menambah keanggotaan" },
        { status: 403 },
      );
    }

    const rlKey = `latber:promote:${authResult.user.id}`;
    const limited = await rateLimitAsync(rlKey, { max: 20, windowMs: 60_000 });
    if (!limited.success) {
      return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
    }

    const body = await request.json().catch(() => null);
    const parsed = latberPromoteMembershipSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak valid" },
        { status: 400 },
      );
    }

    const memberId = parsed.data.memberId;
    const guestMeta = await loadLatberGuestMeta(memberId);
    if (!guestMeta) {
      return NextResponse.json(
        { error: "Peserta ini bukan tamu Latber — tidak perlu promote" },
        { status: 400 },
      );
    }

    const role = getPrimaryAdminRole(authResult.user.roles);
    const allowlist =
      role === "ADMIN_DOJO" ? getManagedDojoIdsFromUser(authResult.user) : [];
    if (role === "ADMIN_DOJO" && allowlist.length === 0) {
      return NextResponse.json(
        { error: "Ranting tidak terkonfigurasi" },
        { status: 403 },
      );
    }

    const member = await prisma.member.findFirst({
      where: {
        id: memberId,
        isDeleted: false,
        ...(allowlist.length > 0 ? { dojoId: { in: allowlist } } : {}),
      },
      select: {
        id: true,
        fullName: true,
        dojoId: true,
        status: true,
        gender: true,
        birthPlace: true,
        birthDate: true,
        address: true,
        nik: true,
        nia: true,
        currentRank: true,
        userId: true,
        user: { select: { phoneNumber: true } },
      },
    });
    if (!member) {
      return NextResponse.json(
        { error: "Anggota tidak ditemukan di cakupan Anda" },
        { status: 404 },
      );
    }

    const fullName = (
      parsed.data.fullName?.trim() || member.fullName
    ).toUpperCase();
    const gender = parsed.data.gender?.trim() || member.gender || null;
    const birthPlace = parsed.data.birthPlace?.trim()
      ? parsed.data.birthPlace.trim().toUpperCase()
      : member.birthPlace;
    let birthDateIso: string | null = member.birthDate
      ? member.birthDate.toISOString().slice(0, 10)
      : null;
    if (parsed.data.birthDate?.trim()) {
      const iso = parseFlexibleBirthDate(parsed.data.birthDate.trim());
      if (!iso) {
        return NextResponse.json(
          { error: "Format tanggal lahir tidak valid" },
          { status: 400 },
        );
      }
      birthDateIso = iso;
    }
    const address = parsed.data.address?.trim()
      ? parsed.data.address.trim().toUpperCase()
      : member.address;
    const nikRaw = parsed.data.nik?.trim();
    const nik =
      nikRaw && /^\d{16}$/.test(nikRaw)
        ? nikRaw
        : member.nik && /^\d{16}$/.test(member.nik)
          ? member.nik
          : null;
    const phoneNumber =
      parsed.data.phoneNumber?.trim() ||
      guestMeta.phoneNumber ||
      member.user?.phoneNumber ||
      null;
    const nia = normalizeNia(parsed.data.nia) || member.nia || null;
    const currentRank =
      formatRankLabel(parsed.data.currentRank?.trim() || "") ||
      parsed.data.currentRank?.trim() ||
      member.currentRank ||
      DEFAULT_MEMBER_RANK;
    const dojoId = parsed.data.dojoId || member.dojoId;
    if (role === "ADMIN_DOJO" && !assertDojoAllowed(authResult.user, dojoId)) {
      return NextResponse.json(
        { error: "Ranting di luar cakupan akun Anda" },
        { status: 403 },
      );
    }

    if (
      !isMembershipReady({
        fullName,
        dojoId,
        gender,
        birthPlace,
        birthDate: birthDateIso,
        address,
        phoneNumber,
      })
    ) {
      return NextResponse.json(
        {
          error:
            "Lengkapi identitas dulu: jenis kelamin, tempat/tanggal lahir, alamat, dan telepon",
          code: "MEMBERSHIP_INCOMPLETE",
        },
        { status: 400 },
      );
    }

    const duplicates = await findMemberDuplicates({
      fullName,
      birthDate: birthDateIso ?? undefined,
      nik: nik || undefined,
      nia: nia || undefined,
      excludeMemberId: memberId,
    });
    const activeHard = activeHardDuplicates(duplicates);
    if (activeHard.length > 0) {
      return NextResponse.json(
        {
          error: formatDuplicateError(activeHard, "admin"),
          duplicates: activeHard,
          code: "DUPLICATE_MEMBER",
        },
        { status: 409 },
      );
    }

    const releasable = releasableArchivedIdConflicts(duplicates);
    if (releasable.length > 0) {
      try {
        await releaseIdentifiersFromArchivedMembers({
          hits: releasable,
          token: authResult.token,
        });
      } catch (err) {
        console.error("[latber-promote:releaseArchived]", err);
        return NextResponse.json(
          {
            error: formatDuplicateError(releasable, "admin"),
            code: "DUPLICATE_ARCHIVED_IDENTITY",
          },
          { status: 409 },
        );
      }
    }

    const inkaiPatch: Record<string, unknown> = {
      fullName,
      name: fullName,
      gender,
      birthPlace,
      birthDate: birthDateIso,
      address,
      currentRank,
      status: "Active",
      dojoId,
    };
    if (nik) inkaiPatch.nik = nik;
    if (nia) inkaiPatch.nia = nia;
    if (phoneNumber) inkaiPatch.phoneNumber = phoneNumber;

    const { res, data } = await inkaiFetch(
      `/v1/members/${memberId}`,
      { method: "PATCH", body: JSON.stringify(inkaiPatch) },
      authResult.token,
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: inkaiErrorMessage(data, "Gagal memperbarui identitas") },
        { status: res.status >= 400 ? res.status : 502 },
      );
    }

    await prisma.member.update({
      where: { id: memberId },
      data: {
        fullName,
        gender,
        birthPlace,
        birthDate: birthDateIso ? new Date(birthDateIso) : null,
        address,
        nik,
        nia,
        currentRank,
        status: "Active",
        dojoId,
      },
    });

    if (phoneNumber && member.userId) {
      await prisma.user
        .update({
          where: { id: member.userId },
          data: { phoneNumber },
        })
        .catch(() => undefined);
    }

    // Simpan HP di meta sampai punya akun (bila belum).
    if (phoneNumber && !member.userId) {
      await upsertLatberGuestMeta(memberId, {
        ...guestMeta,
        phoneNumber,
      });
    }

    let provisioned = false;
    if (nia) {
      const prov = await tryProvisionMemberNiaLogin(memberId, {
        actorUserId: authResult.user.id,
        actorEmail: authResult.user.email,
      });
      provisioned = prov?.status === "created";
    }

    await deleteLatberGuestMeta(memberId);

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "LATBER_PROMOTE_MEMBERSHIP",
      details: `Promote Latber guest ${fullName} (${memberId}) → Active${nia ? ` nia=${nia}` : ""}`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    return NextResponse.json({
      success: true,
      memberId,
      status: "Active",
      provisioned,
    });
  } catch (error) {
    console.error("[latber-promote-membership]", error);
    return NextResponse.json(
      { error: "Gagal menambah keanggotaan" },
      { status: 500 },
    );
  }
}

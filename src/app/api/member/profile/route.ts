import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { fetchMyMemberProfile } from "@/lib/inkai-api/member-data";
import {
  formatMemberName,
  formatRankLabel,
  isBlackBeltRank,
  resolveMemberDisplayRank,
} from "@/lib/belt";
import { memberSelfProfileSchema } from "@/lib/security/schemas";
import { prisma } from "@/lib/prisma";
import { parseFlexibleBirthDate } from "@/lib/parse-birth-date";
import {
  isFieldLocked,
  mshAllowedForRank,
  normalizeEmail,
  normalizeMsh,
  normalizeNia,
  normalizeSelfRank,
} from "@/lib/member-profile-locks";
import { notifyAdminsAboutMemberMsh } from "@/lib/member-msh-notify";
import { forbidIfImpersonating } from "@/lib/security/impersonation-guard";

function hasOwn(obj: object, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeUrl(v: string | null | undefined) {
  if (v == null) return null;
  const t = String(v).trim();
  return t ? t : null;
}

function normalizeBpjsNo(v: string | null | undefined) {
  if (v == null) return null;
  const t = String(v).replace(/\s+/g, "").trim();
  return t ? t : null;
}

function toBirthDateIso(raw: string | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  const t = raw.trim();
  if (!t) return null;
  const parsed = parseFlexibleBirthDate(t);
  if (parsed) return parsed;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const session = await auth();
  const token = await getInkaiAccessToken();
  if (!session?.user.memberId || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member = await fetchMyMemberProfile(token);
  if (!member) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  const dojo = member.dojo as
    | { name?: string; branch?: { name?: string } }
    | undefined;
  const belt = resolveMemberDisplayRank({
    currentRank: String(member.currentRank ?? ""),
    ranks: member.ranks as Array<{
      rank?: string | null;
      date?: string | Date | null;
    }>,
    eventRegistrations: member.eventRegistrations as Array<{
      status?: string | null;
      registeredRank?: string | null;
      event?: { title?: string | null } | null;
    }>,
  });
  const beltLabel = formatRankLabel(belt) || belt || null;
  const mshNumber =
    typeof member.mshNumber === "string" ? member.mshNumber : null;

  return NextResponse.json(
    {
      nia: String(member.nia ?? ""),
      fullName: formatMemberName(String(member.fullName ?? "")),
      belt: beltLabel,
      dojo: [dojo?.name, dojo?.branch?.name].filter(Boolean).join(" - ") || "—",
      mshNumber: isBlackBeltRank(beltLabel) ? mshNumber : null,
      isBlackBelt: isBlackBeltRank(beltLabel),
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}

export async function PATCH(request: Request) {
  const session = await auth();
  const token = await getInkaiAccessToken();
  if (!session?.user.memberId || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberId = String(session.user.memberId);
  const raw = await request.json().catch(() => null);
  const parsed = memberSelfProfileSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "Data tidak valid";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const body = parsed.data;
  const local = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      userId: true,
      dojoId: true,
      fullName: true,
      nia: true,
      mshNumber: true,
      currentRank: true,
      emailSelfEditedAt: true,
      niaSelfEditedAt: true,
      rankSelfEditedAt: true,
      mshSelfEditedAt: true,
      dojo: { select: { name: true } },
      user: { select: { id: true, email: true } },
    },
  });
  if (!local) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  const locks = {
    emailSelfEditedAt: local.emailSelfEditedAt,
    niaSelfEditedAt: local.niaSelfEditedAt,
    rankSelfEditedAt: local.rankSelfEditedAt,
    mshSelfEditedAt: local.mshSelfEditedAt,
  };

  const inkaiPatch: Record<string, unknown> = {};
  const prismaMember: Record<string, unknown> = {};
  const prismaUser: Record<string, unknown> = {};
  const now = new Date();

  if (body.fullName !== undefined) {
    const name = body.fullName.trim().toUpperCase();
    inkaiPatch.fullName = name;
    prismaMember.fullName = name;
    prismaUser.fullName = name;
  }
  if (body.gender !== undefined) {
    inkaiPatch.gender = body.gender;
    prismaMember.gender = body.gender;
  }
  if (body.birthPlace !== undefined) {
    const place = body.birthPlace.trim().toUpperCase();
    inkaiPatch.birthPlace = place;
    prismaMember.birthPlace = place;
  }
  if (body.birthDate !== undefined) {
    const iso = toBirthDateIso(body.birthDate);
    if (iso === undefined) {
      return NextResponse.json(
        { error: "Format tanggal lahir tidak valid" },
        { status: 400 },
      );
    }
    inkaiPatch.birthDate = iso;
    prismaMember.birthDate = iso ? new Date(`${iso}T00:00:00.000Z`) : null;
  }
  if (body.address !== undefined) {
    const address = body.address.trim().toUpperCase();
    inkaiPatch.address = address;
    prismaMember.address = address;
  }
  if (body.phoneNumber !== undefined) {
    inkaiPatch.phoneNumber = body.phoneNumber.trim();
    prismaUser.phoneNumber = body.phoneNumber.trim();
  }
  if (hasOwn(body, "nik")) {
    const nik =
      body.nik == null || body.nik === "" ? null : String(body.nik).trim();
    if (nik) {
      const clash = await prisma.member.findFirst({
        where: { nik, id: { not: memberId }, isDeleted: false },
        select: { fullName: true },
      });
      if (clash) {
        return NextResponse.json(
          {
            error: `NIK sudah dipakai anggota lain (${clash.fullName}). Hubungi pengurus jika ini milik Anda.`,
          },
          { status: 409 },
        );
      }
    }
    inkaiPatch.nik = nik;
    prismaMember.nik = nik;
  }
  if (hasOwn(body, "photoUrl")) {
    const photo = normalizeUrl(body.photoUrl);
    inkaiPatch.photoUrl = photo;
    prismaUser.photoUrl = photo;
  }
  if (hasOwn(body, "birthCertificateUrl")) {
    const url = normalizeUrl(body.birthCertificateUrl);
    inkaiPatch.birthCertificateUrl = url;
    prismaMember.birthCertificateUrl = url;
  }
  if (hasOwn(body, "bpjsCardUrl")) {
    const url = normalizeUrl(body.bpjsCardUrl);
    inkaiPatch.bpjsCardUrl = url;
    prismaMember.bpjsCardUrl = url;
  }
  if (hasOwn(body, "bpjsCardNumber")) {
    const no = normalizeBpjsNo(body.bpjsCardNumber);
    inkaiPatch.bpjsCardNumber = no;
    prismaMember.bpjsCardNumber = no;
  }

  // --- Email / NIA / sabuk / MSH: edit mandiri maksimal 1x ---
  if (body.email !== undefined) {
    const blocked = await forbidIfImpersonating();
    if (blocked) return blocked;

    if (isFieldLocked(locks, "email")) {
      return NextResponse.json(
        {
          error:
            "Email sudah pernah diubah. Selanjutnya ajukan perubahan lewat formulir pengajuan.",
          code: "LOCKED_EMAIL",
        },
        { status: 403 },
      );
    }
    const email = normalizeEmail(body.email);
    if (!email) {
      return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
    }
    const clash = await prisma.user.findFirst({
      where: {
        email,
        id: { not: local.userId || session.user.id },
        isDeleted: false,
      },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json(
        { error: "Email sudah dipakai akun lain" },
        { status: 409 },
      );
    }
    prismaUser.email = email;
    prismaMember.emailSelfEditedAt = now;
  }

  if (body.nia !== undefined) {
    if (isFieldLocked(locks, "nia")) {
      return NextResponse.json(
        {
          error:
            "NIA sudah pernah diubah. Selanjutnya ajukan perubahan lewat formulir pengajuan.",
          code: "LOCKED_NIA",
        },
        { status: 403 },
      );
    }
    const nia = normalizeNia(body.nia);
    if (nia) {
      const clash = await prisma.member.findFirst({
        where: { nia, id: { not: memberId }, isDeleted: false },
        select: { fullName: true },
      });
      if (clash) {
        return NextResponse.json(
          { error: `NIA sudah dipakai anggota lain (${clash.fullName})` },
          { status: 409 },
        );
      }
    }
    inkaiPatch.nia = nia;
    prismaMember.nia = nia;
    prismaMember.niaSelfEditedAt = now;
  }

  if (body.currentRank !== undefined) {
    if (isFieldLocked(locks, "currentRank")) {
      return NextResponse.json(
        {
          error:
            "Sabuk sudah pernah diubah. Selanjutnya ajukan perubahan lewat formulir pengajuan.",
          code: "LOCKED_RANK",
        },
        { status: 403 },
      );
    }
    const rank = normalizeSelfRank(body.currentRank);
    if (!rank) {
      return NextResponse.json({ error: "Sabuk tidak valid" }, { status: 400 });
    }
    inkaiPatch.currentRank = rank;
    prismaMember.currentRank = rank;
    prismaMember.rankSelfEditedAt = now;
  }

  if (body.mshNumber !== undefined) {
    if (isFieldLocked(locks, "mshNumber")) {
      return NextResponse.json(
        {
          error:
            "No. MSH sudah pernah diubah. Selanjutnya ajukan perubahan lewat formulir pengajuan.",
          code: "LOCKED_MSH",
        },
        { status: 403 },
      );
    }
    const nextRank =
      (prismaMember.currentRank as string | undefined) || local.currentRank;
    if (!mshAllowedForRank(nextRank)) {
      return NextResponse.json(
        { error: "No. MSH hanya untuk sabuk Hitam (DAN)" },
        { status: 400 },
      );
    }
    const msh = normalizeMsh(body.mshNumber);
    if (msh) {
      const clash = await prisma.member.findFirst({
        where: { mshNumber: msh, id: { not: memberId }, isDeleted: false },
        select: { fullName: true },
      });
      if (clash) {
        return NextResponse.json(
          { error: `No. MSH sudah dipakai anggota lain (${clash.fullName})` },
          { status: 409 },
        );
      }
    }
    prismaMember.mshNumber = msh;
    prismaMember.mshSelfEditedAt = now;
  }

  if (
    Object.keys(inkaiPatch).length === 0 &&
    Object.keys(prismaMember).length === 0 &&
    Object.keys(prismaUser).length === 0
  ) {
    return NextResponse.json(
      { error: "Tidak ada perubahan yang dikirim" },
      { status: 400 },
    );
  }

  if (Object.keys(inkaiPatch).length > 0) {
    const { res, data } = await inkaiFetch(
      "/v1/members/me",
      { method: "PATCH", body: JSON.stringify(inkaiPatch) },
      token,
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: inkaiErrorMessage(data, "Gagal memperbarui profil") },
        { status: res.status },
      );
    }
  }

  try {
    if (Object.keys(prismaMember).length > 0) {
      await prisma.member.update({
        where: { id: memberId },
        data: prismaMember,
      });
    }
    if (Object.keys(prismaUser).length > 0) {
      const userId = local.userId || session.user.id;
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: prismaUser,
        });
      }
    }
  } catch (err) {
    console.error("[member/profile PATCH] prisma sync failed:", err);
  }

  if (
    Object.prototype.hasOwnProperty.call(prismaMember, "mshNumber") &&
    local.dojoId
  ) {
    const msh =
      typeof prismaMember.mshNumber === "string"
        ? prismaMember.mshNumber
        : null;
    const prev = local.mshNumber?.trim() || null;
    void notifyAdminsAboutMemberMsh({
      dojoId: local.dojoId,
      token,
      excludeUserId: session.user.id,
      title: msh ? "Anggota mengisi No. MSH" : "Anggota menghapus No. MSH",
      content: msh
        ? `${local.fullName} (${local.dojo.name}): No. MSH ${msh}${prev ? ` (sebelumnya ${prev})` : ""}.`
        : `${local.fullName} (${local.dojo.name}): No. MSH dihapus.`,
    });
  }

  return NextResponse.json({
    success: true,
    message: "Profil berhasil diperbarui",
  });
}

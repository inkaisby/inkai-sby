import { NextResponse } from "next/server";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import {
  assertJsonRequest,
  assertSameOriginLoose,
  getClientIp,
} from "@/lib/security/request";
import { registerSchema } from "@/lib/security/schemas";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { validatePassword } from "@/lib/security/password";
import { DEFAULT_MEMBER_RANK } from "@/lib/belt";
import { SITE_BRANCH_NAME, SITE_PROVINCE_NAME } from "@/lib/site";
import {
  findMemberDuplicates,
  formatDuplicateError,
  hardDuplicates,
} from "@/lib/member-duplicate";
import {
  mshAllowedForRank,
  normalizeMsh,
} from "@/lib/member-profile-locks";
import { prisma } from "@/lib/prisma";
import { notifyAdminsAboutMemberMsh } from "@/lib/member-msh-notify";

export async function POST(request: Request) {
  try {
    if (!assertJsonRequest(request)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 415 });
    }
    if (!assertSameOriginLoose(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = getClientIp(request);
    const limit = await rateLimitAsync(`register:${ip}`, {
      max: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!limit.success) return rateLimitResponse(limit.retryAfterSec ?? 300);

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak valid" },
        { status: 400 },
      );
    }

    const pwCheck = validatePassword(parsed.data.password);
    if (!pwCheck.valid) {
      return NextResponse.json(
        { error: pwCheck.error || "Password tidak valid" },
        { status: 400 },
      );
    }

    const {
      name,
      email,
      password,
      dojoId,
      nik,
      gender,
      birthPlace,
      birthDate,
      address,
      currentRank,
      phoneNumber,
      nia,
      mshNumber,
    } = parsed.data;

    const rank = currentRank?.trim() || DEFAULT_MEMBER_RANK;
    const mshRaw = mshNumber?.trim() || "";
    const msh = mshRaw ? normalizeMsh(mshRaw) : null;
    if (mshRaw && !msh) {
      return NextResponse.json(
        { error: "No. MSH tidak valid" },
        { status: 400 },
      );
    }
    if (msh) {
      if (!mshAllowedForRank(rank)) {
        return NextResponse.json(
          { error: "No. MSH hanya untuk sabuk Hitam (DAN)" },
          { status: 400 },
        );
      }
      const clash = await prisma.member.findFirst({
        where: { mshNumber: msh, isDeleted: false },
        select: { fullName: true },
      });
      if (clash) {
        return NextResponse.json(
          { error: `No. MSH sudah dipakai anggota lain (${clash.fullName})` },
          { status: 409 },
        );
      }
    }

    const dojoRes = await inkaiFetch(`/v1/org/dojo/${dojoId}`, {}, null);
    if (!dojoRes.res.ok) {
      return NextResponse.json({ error: "Dojo tidak ditemukan" }, { status: 400 });
    }
    const dojoPayload = dojoRes.data.data as {
      name?: string;
      branch?: { name?: string; province?: { name?: string } };
    } | undefined;
    const branchName = dojoPayload?.branch?.name ?? "";
    const provinceName = dojoPayload?.branch?.province?.name ?? "";
    const dojoName = dojoPayload?.name || "Ranting";
    if (
      branchName.toUpperCase() !== SITE_BRANCH_NAME ||
      provinceName.toUpperCase() !== SITE_PROVINCE_NAME
    ) {
      return NextResponse.json(
        { error: "Dojo tidak valid untuk Cabang Surabaya" },
        { status: 400 },
      );
    }

    const duplicates = await findMemberDuplicates({
      fullName: name,
      birthDate: birthDate || undefined,
      nik: nik || undefined,
      nia: nia || undefined,
    });
    const hard = hardDuplicates(duplicates);
    if (hard.length > 0) {
      return NextResponse.json(
        {
          error: formatDuplicateError(hard, "public"),
          code: "DUPLICATE_MEMBER",
        },
        { status: 409 },
      );
    }

    const { res, data } = await inkaiFetch(
      "/v1/auth/register",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          fullName: name.toUpperCase(),
          phoneNumber: phoneNumber || undefined,
          dojoId,
          nik: nik || undefined,
          gender: gender || undefined,
          birthPlace: birthPlace?.trim()
            ? birthPlace.trim().toUpperCase()
            : undefined,
          birthDate: birthDate || undefined,
          address: address?.trim()
            ? address.trim().toUpperCase()
            : undefined,
          currentRank: rank,
          nia: nia?.trim() ? nia.trim().toUpperCase() : undefined,
        }),
      },
      null,
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: inkaiErrorMessage(data, "Registrasi gagal") },
        { status: res.status },
      );
    }

    // Persist MSH ke Prisma lokal (Inkai auth register tidak menyimpan MSH).
    // Fire-and-forget agar response daftar tetap cepat.
    if (msh) {
      void persistRegisterMsh({
        msh,
        nik,
        email,
        name,
        dojoId,
        dojoName,
        registerPayload: data.data,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Registrasi berhasil, menunggu verifikasi admin",
    });
  } catch {
    return NextResponse.json({ error: "Terjadi kesalahan saat pendaftaran" }, { status: 500 });
  }
}

async function persistRegisterMsh(opts: {
  msh: string;
  nik: string;
  email: string;
  name: string;
  dojoId: string;
  dojoName: string;
  registerPayload: unknown;
}) {
  try {
    const payload = opts.registerPayload as
      | {
          member?: { id?: string };
          user?: { memberId?: string };
        }
      | undefined;

    let memberId: string | null =
      (typeof payload?.member?.id === "string" && payload.member.id) ||
      (typeof payload?.user?.memberId === "string" && payload.user.memberId) ||
      null;

    let fullName = opts.name;
    let dojoLabel = opts.dojoName;

    if (!memberId) {
      const byNik = await prisma.member.findFirst({
        where: { nik: opts.nik, isDeleted: false },
        select: {
          id: true,
          fullName: true,
          dojo: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      if (byNik) {
        memberId = byNik.id;
        fullName = byNik.fullName;
        dojoLabel = byNik.dojo?.name || dojoLabel;
      }
    }

    if (!memberId) {
      const byUser = await prisma.user.findFirst({
        where: { email: opts.email.toLowerCase(), isDeleted: false },
        select: {
          member: {
            select: {
              id: true,
              fullName: true,
              dojo: { select: { name: true } },
            },
          },
        },
      });
      if (byUser?.member) {
        memberId = byUser.member.id;
        fullName = byUser.member.fullName;
        dojoLabel = byUser.member.dojo?.name || dojoLabel;
      }
    }

    if (!memberId) return;

    await prisma.member.update({
      where: { id: memberId },
      data: { mshNumber: opts.msh },
    });

    void notifyAdminsAboutMemberMsh({
      dojoId: opts.dojoId,
      title: "No. MSH pendaftaran mandiri",
      content: `${fullName} (${dojoLabel}): No. MSH ${opts.msh} (daftar mandiri).`,
    });
  } catch (err) {
    console.error("[register:msh]", err);
  }
}

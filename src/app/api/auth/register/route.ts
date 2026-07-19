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
    } = parsed.data;

    const dojoRes = await inkaiFetch(`/v1/org/dojo/${dojoId}`, {}, null);
    if (!dojoRes.res.ok) {
      return NextResponse.json({ error: "Dojo tidak ditemukan" }, { status: 400 });
    }
    const dojoPayload = dojoRes.data.data as {
      branch?: { name?: string; province?: { name?: string } };
    } | undefined;
    const branchName = dojoPayload?.branch?.name ?? "";
    const provinceName = dojoPayload?.branch?.province?.name ?? "";
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
          birthPlace: birthPlace || undefined,
          birthDate: birthDate || undefined,
          address: address || undefined,
          currentRank: currentRank?.trim() || DEFAULT_MEMBER_RANK,
          nia: nia || undefined,
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

    return NextResponse.json({
      success: true,
      message: "Registrasi berhasil, menunggu verifikasi admin",
    });
  } catch {
    return NextResponse.json({ error: "Terjadi kesalahan saat pendaftaran" }, { status: 500 });
  }
}

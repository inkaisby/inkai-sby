import { NextResponse } from "next/server";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import {
  assertJsonRequest,
  assertSameOrigin,
  getClientIp,
} from "@/lib/security/request";
import { registerSchema } from "@/lib/security/schemas";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { SITE_BRANCH_NAME, SITE_PROVINCE_NAME } from "@/lib/site";

export async function POST(request: Request) {
  try {
    if (!assertJsonRequest(request)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 415 });
    }
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = getClientIp(request);
    const limit = rateLimit(`register:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 });
    if (!limit.success) return rateLimitResponse(limit.retryAfterSec ?? 300);

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak valid" },
        { status: 400 },
      );
    }

    const { name, email, password, dojoId } = parsed.data;

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

    const { res, data } = await inkaiFetch(
      "/v1/auth/register",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          fullName: name,
          phoneNumber: parsed.data.phoneNumber || undefined,
          dojoId,
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

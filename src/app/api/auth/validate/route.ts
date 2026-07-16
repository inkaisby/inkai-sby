import { NextResponse } from "next/server";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  assertJsonRequest,
  assertSameOrigin,
  getClientIp,
} from "@/lib/security/request";

export async function POST(request: Request) {
  try {
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!assertJsonRequest(request)) {
      return NextResponse.json(
        { error: "Content-Type harus application/json" },
        { status: 415 },
      );
    }

    const ip = getClientIp(request);
    const ipLimit = rateLimit(`validate-login:${ip}`, {
      max: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!ipLimit.success) return rateLimitResponse(ipLimit.retryAfterSec ?? 60);

    const body = (await request.json()) as {
      identifier?: string;
      password?: string;
    };
    const identifier = body.identifier?.trim() ?? "";
    const password = body.password ?? "";

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Email/NIA dan password wajib diisi" },
        { status: 400 },
      );
    }

    const loginLimit = rateLimit(`login:${identifier}`, {
      max: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!loginLimit.success) {
      return NextResponse.json(
        {
          error:
            "Terlalu banyak percobaan login. Tunggu beberapa menit lalu coba lagi.",
          code: "RATE_LIMITED",
        },
        { status: 429 },
      );
    }

    let res: Response;
    let data: Record<string, unknown>;
    try {
      ({ res, data } = await inkaiFetch(
        "/v1/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ identifier, password }),
        },
        null,
      ));
    } catch {
      return NextResponse.json(
        {
          error:
            "Server autentikasi sedang bermasalah (koneksi database penuh/tidak responsif). Coba lagi beberapa menit.",
          code: "SERVER_ERROR",
        },
        { status: 503 },
      );
    }

    if (res.status >= 500) {
      return NextResponse.json(
        {
          error:
            "Server autentikasi sedang bermasalah. Password Anda belum tentu salah — coba lagi beberapa menit.",
          code: "SERVER_ERROR",
        },
        { status: 503 },
      );
    }

    if (res.status === 429) {
      return NextResponse.json(
        {
          error:
            typeof data.message === "string"
              ? data.message
              : "Akun terkunci sementara karena terlalu banyak percobaan gagal.",
          code: "RATE_LIMITED",
        },
        { status: 429 },
      );
    }

    if (res.status === 403) {
      return NextResponse.json(
        {
          error:
            typeof data.message === "string"
              ? data.message
              : "Akun dinonaktifkan. Hubungi admin.",
          code: "DISABLED",
        },
        { status: 403 },
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "Email/NIA atau password salah.",
          code: "INVALID_CREDENTIALS",
        },
        { status: 401 },
      );
    }

    const token = typeof data.token === "string" ? data.token : null;
    const payload = data.data as { user?: { id?: string; email?: string } } | undefined;
    const user = payload?.user;
    if (!token || !user?.id || !user.email) {
      return NextResponse.json(
        { error: "Respons login tidak valid", code: "BAD_RESPONSE" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        error: "Terjadi kesalahan saat memverifikasi login",
        code: "SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

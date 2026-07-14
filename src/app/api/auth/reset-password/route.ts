import { NextResponse } from "next/server";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { validatePassword } from "@/lib/security/password";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`reset:${ip}`, { max: 10, windowMs: 60 * 60 * 1000 });
    if (!limit.success) return rateLimitResponse(limit.retryAfterSec ?? 300);

    const { token, password } = (await request.json()) as {
      token?: string;
      password?: string;
    };
    if (!token || !password) {
      return NextResponse.json({ error: "Token dan password wajib" }, { status: 400 });
    }

    const pw = validatePassword(password);
    if (!pw.valid) {
      return NextResponse.json({ error: pw.error }, { status: 400 });
    }

    const { res, data } = await inkaiFetch(
      "/v1/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({ token, newPassword: password }),
      },
      null,
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: inkaiErrorMessage(data, "Reset password gagal") },
        { status: res.status },
      );
    }

    return NextResponse.json({ success: true, message: "Password berhasil diperbarui" });
  } catch {
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}

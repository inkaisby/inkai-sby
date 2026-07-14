import { NextResponse } from "next/server";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`forgot:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 });
    if (!limit.success) return rateLimitResponse(limit.retryAfterSec ?? 300);

    const { email } = (await request.json()) as { email?: string };
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email wajib diisi" }, { status: 400 });
    }

    await inkaiFetch(
      "/v1/auth/forgot-password",
      { method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase() }) },
      null,
    );

    return NextResponse.json({
      success: true,
      message: "Jika email terdaftar, instruksi reset telah dikirim.",
    });
  } catch {
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}

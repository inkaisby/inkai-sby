import { NextResponse } from "next/server";
import { getInkaiApiBaseUrl } from "@/lib/inkai-api/server";

/**
 * Liveness for Inkai API + DB — also used as a warm-up ping from /login
 * so cold serverless on inkai-backend is less likely at submit time.
 * Does not expose the upstream base URL.
 */
export async function GET() {
  const started = Date.now();
  try {
    const base = getInkaiApiBaseUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(`${base}/health/db`, {
        cache: "no-store",
        signal: controller.signal,
      });
      return NextResponse.json({
        ok: res.ok,
        database: res.ok,
        ms: Date.now() - started,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return NextResponse.json(
      { ok: false, database: false, ms: Date.now() - started },
      { status: 503 },
    );
  }
}

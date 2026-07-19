import { NextResponse } from "next/server";

/** Liveness only — do not expose upstream API base URL. */
export async function GET() {
  try {
    const base =
      process.env.INKAI_API_URL?.trim() ||
      process.env.NEXT_PUBLIC_INKAI_API_URL?.trim();
    if (!base) {
      return NextResponse.json({ ok: false }, { status: 503 });
    }
    const res = await fetch(`${base.replace(/\/$/, "")}/health/db`, {
      cache: "no-store",
    });
    return NextResponse.json({ ok: res.ok, database: res.ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

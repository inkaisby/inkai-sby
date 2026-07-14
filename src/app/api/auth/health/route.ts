import { NextResponse } from "next/server";
import { getInkaiApiBaseUrl } from "@/lib/inkai-api/server";

export async function GET() {
  try {
    const base = getInkaiApiBaseUrl();
    const res = await fetch(`${base}/health/db`, { cache: "no-store" });
    return NextResponse.json({ ok: res.ok, api: base, database: res.ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

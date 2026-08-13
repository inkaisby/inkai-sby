import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { latberRekapSchema } from "@/lib/security/schemas";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  buildLatberRekapXlsxBuffer,
  latberRekapDownloadName,
} from "@/lib/latber-rekap-xlsx";
import type { LatberRekapRow } from "@/lib/latber";

export const maxDuration = 30;

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const rlKey = `latber:rekap:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 20, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const parsed = latberRekapSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data rekap tidak valid" }, { status: 400 });
  }

  const data = parsed.data;
  const rows = data.rows as LatberRekapRow[];
  const buffer = await buildLatberRekapXlsxBuffer({
    periodTitle: data.periodTitle,
    feeAmount: data.feeAmount,
    komisiRanting: data.komisiRanting,
    rows,
  });
  const filename = latberRekapDownloadName(data.periodTitle);

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { uktHasilUjianRecapSchema } from "@/lib/security/schemas";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  buildUktHasilUjianXlsxBuffer,
  uktHasilUjianDownloadName,
} from "@/lib/ukt-hasil-ujian-xlsx";
import type { UktHasilUjianRecapRow } from "@/lib/ukt";

export const maxDuration = 30;

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const rlKey = `ukt:rekap-hasil:${authResult.user.id}`;
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

  const parsed = uktHasilUjianRecapSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data rekap tidak valid" }, { status: 400 });
  }

  const data = parsed.data;
  const rows = data.rows as UktHasilUjianRecapRow[];
  const buffer = await buildUktHasilUjianXlsxBuffer({
    semester: data.semester,
    year: data.year,
    examAt: data.examAt,
    ketuaCabangName: data.ketuaCabangName,
    bidangUjianName: data.bidangUjianName,
    rows,
  });
  const filename = uktHasilUjianDownloadName({
    semester: data.semester,
    year: data.year,
    examAt: data.examAt,
    rows,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

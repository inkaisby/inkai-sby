import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  buildUktPesertaXlsxBuffer,
  uktPesertaXlsxDownloadName,
  type UktPesertaPaper,
} from "@/lib/ukt-peserta-xlsx";
import type { UktMemberRow, UktSemester } from "@/lib/ukt";

export const maxDuration = 30;

export async function POST(request: Request) {
  const { user } = await requireAdminSession();
  const rlKey = `ukt:export-peserta-excel:${user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 30, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  let body: {
    semester?: UktSemester;
    year?: number;
    paper?: UktPesertaPaper;
    sekretariatAddress?: string;
    rows?: UktMemberRow[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  if (!body.semester || !body.year || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Parameter ekspor tidak lengkap" }, { status: 400 });
  }

  const paper: UktPesertaPaper = body.paper === "F4" ? "F4" : "A4";

  try {
    const buffer = await buildUktPesertaXlsxBuffer({
      semester: body.semester,
      year: body.year,
      paper,
      sekretariatAddress: body.sekretariatAddress,
      rows: body.rows,
    });

    const filename = uktPesertaXlsxDownloadName({
      semester: body.semester,
      year: body.year,
      paper,
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal membuat file Excel" },
      { status: 500 },
    );
  }
}

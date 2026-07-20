import { NextResponse } from "next/server";
import {
  assertJsonRequest,
  assertSameOriginLoose,
  getClientIp,
} from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  findMemberDuplicates,
  hardDuplicates,
} from "@/lib/member-duplicate";
import { z } from "zod";

const checkSchema = z.object({
  fullName: z.string().trim().max(100).optional().or(z.literal("")),
  birthDate: z.string().trim().max(32).optional().or(z.literal("")),
  nik: z
    .string()
    .trim()
    .regex(/^\d{0,16}$/)
    .optional()
    .or(z.literal("")),
  nia: z.string().trim().max(32).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  try {
    if (!assertJsonRequest(request)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 415 });
    }
    if (!assertSameOriginLoose(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = getClientIp(request);
    const limit = await rateLimitAsync(`register-check:${ip}`, {
      max: 30,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.success) return rateLimitResponse(limit.retryAfterSec ?? 60);

    const body = await request.json().catch(() => ({}));
    const parsed = checkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const { fullName, birthDate, nik, nia } = parsed.data;
    if (!fullName && !nik && !nia) {
      return NextResponse.json({
        duplicates: [],
        suggestions: [],
        blocked: false,
      });
    }

    // Soft name-only checks need ≥3 chars; hard keys can be shorter
    if (
      !nik &&
      !nia &&
      (!fullName || fullName.trim().length < 3) &&
      !birthDate
    ) {
      return NextResponse.json({
        duplicates: [],
        suggestions: [],
        blocked: false,
      });
    }

    const duplicates = await findMemberDuplicates({
      fullName: fullName || undefined,
      birthDate: birthDate || undefined,
      nik: nik || undefined,
      nia: nia || undefined,
    });

    const hard = hardDuplicates(duplicates);
    // Public UI: jangan bocorkan NIK; cukup identitas aman
    return NextResponse.json({
      blocked: hard.length > 0,
      suggestions: duplicates.slice(0, 5).map((d) => ({
        id: d.id,
        fullName: d.fullName,
        nia: d.nia,
        dojoName: d.dojoName,
        status: d.status,
        hasAccount: d.hasAccount,
        isArchived: d.isArchived,
        matchReasons: d.reasons,
        severity: d.severity,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Gagal memeriksa duplikat" }, { status: 500 });
  }
}

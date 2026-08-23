import { NextResponse } from "next/server";
import {
  createLatberGuestAndRegister,
  getLatberServiceToken,
} from "@/lib/latber-guest";
import { latberGuestAddSchema } from "@/lib/security/schemas";
import {
  assertJsonRequest,
  assertSameOriginLoose,
  getClientIp,
} from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { findMemberDuplicates } from "@/lib/member-duplicate";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    if (!assertJsonRequest(request)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 415 });
    }
    if (!assertSameOriginLoose(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = getClientIp(request);
    const limited = await rateLimitAsync(`latber-public-guest:${ip}`, {
      max: 8,
      windowMs: 60_000,
    });
    if (!limited.success) {
      return rateLimitResponse(limited.retryAfterSec ?? 60);
    }

    const token = getLatberServiceToken();

    const body = await request.json().catch(() => null);
    const parsed = latberGuestAddSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak valid" },
        { status: 400 },
      );
    }

    const fullName = parsed.data.fullName.trim().toUpperCase();
    if (!parsed.data.confirmSoftDuplicate) {
      const dups = await findMemberDuplicates({ fullName });
      const soft = dups.filter((d) => d.severity !== "hard").slice(0, 5);
      if (soft.length > 0) {
        return NextResponse.json(
          {
            error: `Nama mirip dengan anggota yang sudah ada (${soft[0].fullName}). Konfirmasi untuk lanjut atau daftar anggota yang ada.`,
            code: "SOFT_DUPLICATE",
            softDuplicates: soft.map((d) => ({
              id: d.id,
              fullName: d.fullName,
              nia: d.nia,
              dojoName: d.dojoName,
            })),
          },
          { status: 409 },
        );
      }
    }

    const result = await createLatberGuestAndRegister({
      eventId: parsed.data.eventId,
      fullName,
      dojoId: parsed.data.dojoId,
      currentRank: parsed.data.currentRank,
      phoneNumber: parsed.data.phoneNumber,
      token,
      registeredByUserId: null,
      audit: {
        ip,
        userAgent: request.headers.get("user-agent"),
      },
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status ?? 400 },
      );
    }

    return NextResponse.json({
      success: true,
      memberId: result.memberId,
      registrationId: result.registrationId,
      billingId: result.billingId,
      memberName: result.memberName,
    });
  } catch (error) {
    console.error("[latber-public-add-guest]", error);
    return NextResponse.json(
      { error: "Gagal mendaftarkan peserta" },
      { status: 500 },
    );
  }
}

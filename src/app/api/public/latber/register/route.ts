import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { forceRegisterLatberInDb } from "@/lib/latber-register";
import { validateLatberPublicEligibility } from "@/lib/latber-public";
import { resolveLatberPeriodFees } from "@/lib/latber";
import { notifyDojoAndBranchAdmins } from "@/lib/admin-notify-scope";
import { notifyLatberStatusChange } from "@/lib/latber-notify";
import { writeAuditLog } from "@/lib/audit";
import {
  assertJsonRequest,
  assertSameOriginLoose,
  getClientIp,
} from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { formatLatberPeriodLabel } from "@/lib/latber";

export const maxDuration = 30;

const bodySchema = z.object({
  eventId: z.string().uuid(),
  memberId: z.string().uuid(),
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
    const limited = await rateLimitAsync(`latber-public-register:${ip}`, {
      max: 15,
      windowMs: 60_000,
    });
    if (!limited.success) {
      return rateLimitResponse(limited.retryAfterSec ?? 60);
    }

    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const { eventId, memberId } = parsed.data;
    const eligibility = await validateLatberPublicEligibility(eventId);
    if (!eligibility.ok) {
      return NextResponse.json({ error: eligibility.error }, { status: 403 });
    }

    const member = await prisma.member.findFirst({
      where: { id: memberId, isDeleted: false },
      select: {
        id: true,
        fullName: true,
        nia: true,
        status: true,
        dojoId: true,
        dojo: { select: { name: true } },
      },
    });
    if (!member) {
      return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
    }

    const st = String(member.status ?? "").toLowerCase();
    if (
      st === "inactive" ||
      st === "suspended" ||
      st === "rejected"
    ) {
      return NextResponse.json(
        { error: "Anggota tidak aktif — tidak dapat didaftarkan" },
        { status: 403 },
      );
    }

    const fees = resolveLatberPeriodFees(eligibility.meta);
    const amount = fees.feeAmount;

    const dbReg = await forceRegisterLatberInDb({
      eventId,
      memberId,
      registeredByUserId: null,
      periodTitle: eligibility.title,
      amount,
      baseFeeAmount: fees.feeAmount,
      uniqueTail: null,
      status: "APPROVED",
      approvePendingSelfReg: true,
    });
    if (!dbReg.ok) {
      return NextResponse.json({ error: dbReg.error }, { status: 400 });
    }

    const periodLabel = formatLatberPeriodLabel(eligibility.title);
    const serviceToken =
      process.env.INKAI_SERVICE_TOKEN?.trim() ||
      process.env.CRON_INKAI_TOKEN?.trim() ||
      "";
    if (serviceToken && member.dojoId) {
      void notifyDojoAndBranchAdmins({
        dojoId: member.dojoId,
        token: serviceToken,
        title: "Pendaftaran Latber (walk-in)",
        content: `${dbReg.memberName} (${member.dojo?.name ?? "Ranting"}) mendaftar ${periodLabel} — Rp ${amount.toLocaleString("id-ID")}.`,
      });
      void notifyLatberStatusChange({
        token: serviceToken,
        memberId,
        memberName: dbReg.memberName,
        periodTitle: periodLabel,
        displayStatus: "belum_bayar",
        extra: `Nominal transfer: Rp ${amount.toLocaleString("id-ID")}.`,
      });
    }

    writeAuditLog({
      action: "LATBER_WALKIN_REGISTER",
      details: `Walk-in register ${dbReg.memberName} (${memberId}) → ${eligibility.title} amount=${amount}`,
      ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      success: true,
      registrationId: dbReg.registrationId,
      billingId: dbReg.billingId,
      billingAmount: dbReg.billingAmount,
      billingStatus: dbReg.billingStatus,
      memberName: dbReg.memberName,
    });
  } catch (error) {
    console.error("[latber-public-register]", error);
    return NextResponse.json(
      { error: "Gagal mendaftarkan peserta" },
      { status: 500 },
    );
  }
}

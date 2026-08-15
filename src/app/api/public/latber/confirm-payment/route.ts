import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setLatberBillingWaitingVerification } from "@/lib/latber-register";
import { notifyDojoAndBranchAdmins } from "@/lib/admin-notify-scope";
import { writeAuditLog } from "@/lib/audit";
import {
  assertJsonRequest,
  assertSameOriginLoose,
  getClientIp,
} from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { formatLatberPeriodLabel, isLatberEventTitle } from "@/lib/latber";

export const maxDuration = 30;

const bodySchema = z.object({
  eventId: z.string().uuid(),
  registrationId: z.string().uuid(),
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
    const limited = await rateLimitAsync(`latber-public-confirm:${ip}`, {
      max: 20,
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

    const { eventId, registrationId } = parsed.data;

    const registration = await prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
      select: {
        id: true,
        status: true,
        memberId: true,
        member: {
          select: {
            fullName: true,
            dojoId: true,
            dojo: { select: { name: true } },
          },
        },
        event: { select: { title: true, isDeleted: true } },
      },
    });
    if (!registration || registration.event.isDeleted) {
      return NextResponse.json(
        { error: "Pendaftaran tidak ditemukan" },
        { status: 404 },
      );
    }
    if (!isLatberEventTitle(registration.event.title)) {
      return NextResponse.json(
        { error: "Bukan periode Latihan Bersama" },
        { status: 400 },
      );
    }

    const st = String(registration.status ?? "").toUpperCase();
    if (st === "CANCELLED" || st === "REJECTED") {
      return NextResponse.json(
        { error: "Pendaftaran sudah dibatalkan atau ditolak" },
        { status: 400 },
      );
    }

    const billing = await prisma.billing.findFirst({
      where: {
        registrationId,
        isDeleted: false,
        status: { in: ["PENDING", "WAITING_VERIFICATION"] },
      },
      select: { id: true, status: true, amount: true },
      orderBy: { createdAt: "desc" },
    });
    if (!billing) {
      return NextResponse.json(
        { error: "Tagihan belum tersedia untuk pendaftaran ini" },
        { status: 400 },
      );
    }

    if (String(billing.status).toUpperCase() === "WAITING_VERIFICATION") {
      return NextResponse.json({
        success: true,
        alreadyConfirmed: true,
        billingId: billing.id,
        billingStatus: "WAITING_VERIFICATION",
        displayStatus: "menunggu_verifikasi",
      });
    }

    const billingStatus = await setLatberBillingWaitingVerification({
      token: null,
      billingId: billing.id,
      note: "Konfirmasi bayar walk-in publik — menunggu verifikasi bendahara",
    });

    const periodLabel = formatLatberPeriodLabel(registration.event.title);
    const serviceToken =
      process.env.INKAI_SERVICE_TOKEN?.trim() ||
      process.env.CRON_INKAI_TOKEN?.trim() ||
      "";
    if (serviceToken && registration.member.dojoId) {
      void notifyDojoAndBranchAdmins({
        dojoId: registration.member.dojoId,
        token: serviceToken,
        title: "Konfirmasi bayar Latber (walk-in)",
        content: `${registration.member.fullName} (${registration.member.dojo?.name ?? "Ranting"}) mengonfirmasi bayar ${periodLabel} — Rp ${Math.round(billing.amount).toLocaleString("id-ID")}. Menunggu verifikasi.`,
      });
    }

    writeAuditLog({
      action: "LATBER_WALKIN_CONFIRM_PAYMENT",
      details: `Walk-in confirm payment reg=${registrationId} billing=${billing.id} → WAITING_VERIFICATION`,
      ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      success: true,
      billingId: billing.id,
      billingStatus,
      displayStatus: "menunggu_verifikasi",
    });
  } catch (error) {
    console.error("[latber-public-confirm-payment]", error);
    return NextResponse.json(
      { error: "Gagal mengonfirmasi pembayaran" },
      { status: 500 },
    );
  }
}

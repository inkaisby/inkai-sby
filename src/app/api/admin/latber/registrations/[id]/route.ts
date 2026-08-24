import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { canEditKyuBaru } from "@/lib/belt";
import { latberRegistrationUpdateSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/prisma";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";
import { assertLatberPeriodMutable } from "@/lib/latber-period-meta-store";
import {
  ensureLatberBillingForAcceptedRegistration,
  resolveLatberRegisterFeeAmount,
  setLatberBillingWaitingVerification,
} from "@/lib/latber-register";
import {
  deleteLatberSelfRegistrationMeta,
  loadLatberSelfRegistrationMeta,
} from "@/lib/latber-self-registration";
import {
  notifyLatberBranchAdmins,
  notifyLatberStatusChange,
} from "@/lib/latber-notify";
import { loadLatberPeriodMeta } from "@/lib/latber-period-meta-store";
import { resolveLatberPeriodFees } from "@/lib/latber";
import { postKasFromLatberPaid, voidKasFromBilling } from "@/lib/kas-hooks";
import {
  creditLatberAttendanceForPaidRegistration,
  removeLatberAttendanceCredit,
} from "@/lib/latber-attendance";
import {
  deleteBillingsHard,
  forceDeleteRegistrationInDb,
  forceUnlinkBillingsInDb,
} from "@/lib/billing-delete";

type RouteContext = { params: Promise<{ id: string }> };

async function resolveEventIdForRegistration(
  registrationId: string,
  hintEventId?: string | null,
): Promise<string | null> {
  const local = await prisma.eventRegistration.findFirst({
    where: { id: registrationId },
    select: { eventId: true },
  });
  const resolved = local?.eventId ?? null;
  if (resolved && hintEventId && String(hintEventId) !== String(resolved)) {
    void import("@/lib/security/security-events").then(({ writeSecurityEvent }) => {
      writeSecurityEvent({
        action: "SECURITY_LATBER_EVENT_ID_MISMATCH",
        details: `registrationId=${registrationId} hint=${hintEventId} resolved=${resolved}`,
      });
    });
  }
  return resolved;
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const rlKey = `latber:registrations-patch:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 30, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = latberRegistrationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const data = parsed.data;
  const role = getPrimaryAdminRole(authResult.user.roles);
  const isCabang = canEditKyuBaru(authResult.user.roles);

  const eventIdForAssert = await resolveEventIdForRegistration(id, data.eventId);
  if (!eventIdForAssert) {
    return NextResponse.json(
      { error: "Periode Latihan Bersama tidak dapat diverifikasi untuk pendaftaran ini" },
      { status: 400 },
    );
  }

  const periodMutable = await assertLatberPeriodMutable(
    authResult.token,
    eventIdForAssert,
  );
  if (!periodMutable.ok) {
    return NextResponse.json(
      { error: periodMutable.error },
      { status: periodMutable.status },
    );
  }

  if (data.action === "accept_self_registration") {
    const localReg = await prisma.eventRegistration.findFirst({
      where: { id },
      select: {
        id: true,
        status: true,
        eventId: true,
        memberId: true,
        member: {
          select: { fullName: true, dojoId: true, currentRank: true },
        },
        event: { select: { title: true } },
      },
    });
    if (!localReg) {
      return NextResponse.json({ error: "Pendaftaran tidak ditemukan" }, { status: 404 });
    }

    if (role === "ADMIN_DOJO") {
      const allowlist = getManagedDojoIdsFromUser(authResult.user);
      if (allowlist.length === 0) {
        return NextResponse.json({ error: "Ranting tidak terkonfigurasi" }, { status: 403 });
      }
      if (
        !localReg.member.dojoId ||
        !allowlist.includes(localReg.member.dojoId)
      ) {
        return NextResponse.json(
          { error: "Pendaftaran di luar ranting Anda" },
          { status: 403 },
        );
      }
    }

    const existingBilling = await prisma.billing.findFirst({
      where: {
        registrationId: id,
        isDeleted: false,
        status: { in: ["PENDING", "WAITING_VERIFICATION", "PAID"] },
      },
      select: { id: true, status: true },
    });
    if (existingBilling && localReg.status === "APPROVED") {
      return NextResponse.json({
        success: true,
        alreadyAccepted: true,
        billingId: existingBilling.id,
        billingStatus: existingBilling.status,
      });
    }

    if (localReg.status !== "PENDING" && localReg.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Pendaftaran tidak dalam status menunggu Terima" },
        { status: 400 },
      );
    }

    const selfMeta = await loadLatberSelfRegistrationMeta(
      localReg.eventId,
      localReg.memberId,
    );
    const hadPaymentConfirm = Boolean(selfMeta?.memberPaymentConfirmedAt);
    const periodTitle = localReg.event.title ?? "Latihan Bersama";
    const memberName = localReg.member.fullName;

    await prisma.eventRegistration.update({
      where: { id },
      data: { status: "APPROVED", registeredRank: localReg.member.currentRank },
    });

    void inkaiFetch(
      `/v1/events/register/${id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          status: "APPROVED",
          registeredRank: localReg.member.currentRank,
        }),
      },
      authResult.token,
    ).catch(() => undefined);

    const amount = await resolveLatberRegisterFeeAmount({
      token: authResult.token,
      eventId: localReg.eventId,
    });
    const billing = await ensureLatberBillingForAcceptedRegistration({
      registrationId: id,
      memberId: localReg.memberId,
      eventId: localReg.eventId,
      periodTitle,
      amount,
    });
    if (!billing) {
      return NextResponse.json({ error: "Gagal membuat tagihan Latihan Bersama" }, { status: 400 });
    }

    let billingStatus = billing.billingStatus;
    if (
      hadPaymentConfirm &&
      billingStatus !== "PAID" &&
      billingStatus !== "SUCCESS"
    ) {
      billingStatus = await setLatberBillingWaitingVerification({
        token: authResult.token,
        billingId: billing.billingId,
        note: "Diterima ranting (daftar mandiri) — menunggu verifikasi cabang",
      });
    }

    await deleteLatberSelfRegistrationMeta(localReg.eventId, localReg.memberId);

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "LATBER_ACCEPT_SELF_REGISTRATION",
      details: hadPaymentConfirm
        ? `Accepted self Latber ${memberName} (${id}) → WAITING_VERIFICATION`
        : `Accepted self Latber ${memberName} (${id})`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    if (hadPaymentConfirm) {
      void notifyLatberStatusChange({
        token: authResult.token,
        memberId: localReg.memberId,
        memberName,
        periodTitle,
        displayStatus: "menunggu_verifikasi",
        extra:
          "Ranting sudah menerima pendaftaran dan pembayaran, diteruskan ke cabang.",
      }).catch((err) => console.error("[Latber accept] notify member", err));

      void notifyLatberBranchAdmins({
        token: authResult.token,
        title: "Latber — Ranting konfirmasi daftar mandiri",
        content: `${memberName} dikonfirmasi ranting dan diteruskan ke cabang (${periodTitle}). Status: Menunggu Verifikasi.`,
        actorEmail: authResult.user.email,
        type: "INFO",
      }).catch((err) => console.error("[Latber accept] notify cabang", err));
    } else {
      void notifyLatberStatusChange({
        token: authResult.token,
        memberId: localReg.memberId,
        memberName,
        periodTitle,
        displayStatus: "belum_bayar",
        extra: "Pengajuan diterima ranting. Silakan bayar ke ketua ranting.",
      }).catch((err) => console.error("[Latber accept] notify member", err));
    }

    return NextResponse.json({
      success: true,
      billingId: billing.billingId,
      billingStatus,
      status: "APPROVED",
    });
  }

  if (data.action === "reject_self_registration") {
    const localReg = await prisma.eventRegistration.findFirst({
      where: { id },
      select: {
        id: true,
        status: true,
        eventId: true,
        memberId: true,
        member: { select: { fullName: true, dojoId: true } },
      },
    });
    if (!localReg) {
      return NextResponse.json({ error: "Pendaftaran tidak ditemukan" }, { status: 404 });
    }

    if (role === "ADMIN_DOJO") {
      const allowlist = getManagedDojoIdsFromUser(authResult.user);
      if (allowlist.length === 0) {
        return NextResponse.json({ error: "Ranting tidak terkonfigurasi" }, { status: 403 });
      }
      if (
        !localReg.member.dojoId ||
        !allowlist.includes(localReg.member.dojoId)
      ) {
        return NextResponse.json(
          { error: "Pendaftaran di luar ranting Anda" },
          { status: 403 },
        );
      }
    }

    if (localReg.status !== "PENDING") {
      return NextResponse.json(
        { error: "Hanya pengajuan menunggu Terima yang dapat ditolak" },
        { status: 400 },
      );
    }

    const rejectMeta = await loadLatberSelfRegistrationMeta(
      localReg.eventId,
      localReg.memberId,
    );
    const hadPaymentConfirm = Boolean(rejectMeta?.memberPaymentConfirmedAt);

    await prisma.eventRegistration.update({
      where: { id },
      data: { status: "REJECTED" },
    });
    void inkaiFetch(
      `/v1/events/register/${id}`,
      { method: "PUT", body: JSON.stringify({ status: "REJECTED" }) },
      authResult.token,
    ).catch(() => undefined);

    await deleteLatberSelfRegistrationMeta(localReg.eventId, localReg.memberId);

    await prisma.eventRegistration.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "LATBER_REJECT_SELF_REGISTRATION",
      details: `Rejected self Latber ${localReg.member.fullName} (${id})`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    const periodTitle = await prisma.event
      .findFirst({ where: { id: localReg.eventId }, select: { title: true } })
      .then((e) => e?.title ?? "Latihan Bersama");

    void notifyLatberStatusChange({
      token: authResult.token,
      memberId: localReg.memberId,
      memberName: localReg.member.fullName,
      periodTitle,
      displayStatus: "ditolak",
      extra: hadPaymentConfirm
        ? "Koordinasikan pengembalian pembayaran dengan ketua ranting bila sudah menyetor."
        : "Pengajuan ditolak ranting.",
    }).catch((err) => console.error("[Latber reject] notify member", err));

    return NextResponse.json({ success: true, status: "REJECTED" });
  }

  if (data.action === "mark_paid") {
    if (!isCabang) {
      return NextResponse.json(
        { error: "Hanya admin cabang yang dapat memverifikasi pembayaran" },
        { status: 403 },
      );
    }

    const localReg = await prisma.eventRegistration.findFirst({
      where: { id },
      select: {
        status: true,
        memberId: true,
        eventId: true,
        member: { select: { dojoId: true, fullName: true, nia: true } },
      },
    });
    if (localReg) {
      const selfMeta = await loadLatberSelfRegistrationMeta(
        localReg.eventId,
        localReg.memberId,
      );
      const linkedBilling = await prisma.billing.findFirst({
        where: { registrationId: id, isDeleted: false },
        select: { id: true },
      });
      const pendingSelf =
        String(localReg.status).toUpperCase() === "PENDING" &&
        (Boolean(selfMeta) || !linkedBilling);
      if (pendingSelf) {
        return NextResponse.json(
          {
            error:
              "Daftar mandiri harus diterima ranting (Terima) sebelum verifikasi cabang",
          },
          { status: 400 },
        );
      }
    }

    const unpaidBilling = await prisma.billing.findFirst({
      where: {
        registrationId: id,
        isDeleted: false,
        status: { notIn: ["PAID", "SUCCESS", "CANCELLED"] },
      },
      select: { id: true, amount: true },
      orderBy: { createdAt: "desc" },
    });

    if (!unpaidBilling) {
      const paidBilling = await prisma.billing.findFirst({
        where: {
          registrationId: id,
          isDeleted: false,
          status: { in: ["PAID", "SUCCESS"] },
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      if (paidBilling) {
        return NextResponse.json({
          success: true,
          alreadyPaid: true,
          billingId: paidBilling.id,
          billingStatus: "PAID",
        });
      }
      return NextResponse.json(
        { error: "Tagihan Latihan Bersama belum tersedia atau sudah lunas" },
        { status: 400 },
      );
    }

    const billing = unpaidBilling;

    let verified = false;
    for (const attempt of [
      {
        path: `/v1/billing/${billing.id}/status`,
        method: "PATCH" as const,
        body: { status: "PAID", adminNotes: "Verifikasi cabang — Latihan Bersama" },
      },
      {
        path: "/v1/billing/verify",
        method: "POST" as const,
        body: { billingId: billing.id, status: "PAID" },
      },
    ]) {
      const { res } = await inkaiFetch(
        attempt.path,
        { method: attempt.method, body: JSON.stringify(attempt.body) },
        authResult.token,
      );
      if (res.ok) {
        verified = true;
        break;
      }
    }
    await prisma.billing.update({
      where: { id: billing.id },
      data: { status: "PAID" },
    }).catch(() => undefined);

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "LATBER_MARK_PAID",
      details: `Verified Latber payment reg=${id} billing=${billing.id}${verified ? "" : " (local)"}`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    if (localReg) {
      const periodMeta = await loadLatberPeriodMeta(
        authResult.token,
        localReg.eventId,
      );
      const fees = resolveLatberPeriodFees(periodMeta);
      const eventTitle = await prisma.event
        .findFirst({ where: { id: localReg.eventId }, select: { title: true } })
        .then((e) => e?.title ?? "Latihan Bersama");
      await postKasFromLatberPaid({
        user: authResult.user,
        billingId: billing.id,
        feeAmount: unpaidBilling.amount ?? fees.feeAmount,
        komisiRanting: fees.komisiRanting,
        memberName: localReg.member.fullName ?? "Peserta",
        memberNia: localReg.member.nia,
        periodTitle: eventTitle,
        memberDojoId: localReg.member.dojoId,
      }).catch((err) => console.error("[Latber mark_paid] kas", err));
      void creditLatberAttendanceForPaidRegistration({
        memberId: localReg.memberId,
        eventId: localReg.eventId,
        eventAt: periodMeta.eventAt ?? null,
        dojoId: localReg.member.dojoId,
      }).catch((err) => console.error("[Latber mark_paid] attendance credit", err));
    }

    return NextResponse.json({
      success: true,
      billingId: billing.id,
      billingStatus: "PAID",
    });
  }

  if (data.action === "mark_cash") {
    const localReg = await prisma.eventRegistration.findFirst({
      where: { id },
      select: {
        status: true,
        memberId: true,
        eventId: true,
        member: { select: { dojoId: true, fullName: true, nia: true } },
      },
    });
    if (!localReg) {
      return NextResponse.json(
        { error: "Pendaftaran tidak ditemukan" },
        { status: 404 },
      );
    }

    if (role === "ADMIN_DOJO") {
      const allowlist = getManagedDojoIdsFromUser(authResult.user);
      if (allowlist.length === 0) {
        return NextResponse.json(
          { error: "Ranting tidak terkonfigurasi" },
          { status: 403 },
        );
      }
      if (
        !localReg.member.dojoId ||
        !allowlist.includes(localReg.member.dojoId)
      ) {
        return NextResponse.json(
          { error: "Pendaftaran di luar ranting Anda" },
          { status: 403 },
        );
      }
    }

    const selfMeta = await loadLatberSelfRegistrationMeta(
      localReg.eventId,
      localReg.memberId,
    );
    const linkedBilling = await prisma.billing.findFirst({
      where: { registrationId: id, isDeleted: false },
      select: { id: true },
    });
    const pendingSelf =
      String(localReg.status).toUpperCase() === "PENDING" &&
      (Boolean(selfMeta) || !linkedBilling);
    if (pendingSelf) {
      return NextResponse.json(
        {
          error:
            "Daftar mandiri harus diterima ranting (Terima) sebelum Tunai",
        },
        { status: 400 },
      );
    }

    const unpaidBilling = await prisma.billing.findFirst({
      where: {
        registrationId: id,
        isDeleted: false,
        status: { notIn: ["PAID", "SUCCESS", "CANCELLED"] },
      },
      select: { id: true, amount: true },
      orderBy: { createdAt: "desc" },
    });

    if (!unpaidBilling) {
      const paidBilling = await prisma.billing.findFirst({
        where: {
          registrationId: id,
          isDeleted: false,
          status: { in: ["PAID", "SUCCESS"] },
        },
        select: {
          id: true,
          payment: { select: { paymentMethod: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      if (paidBilling) {
        if (
          String(paidBilling.payment?.paymentMethod ?? "").toUpperCase() !==
          "CASH"
        ) {
          await prisma.payment.upsert({
            where: { billingId: paidBilling.id },
            create: {
              billingId: paidBilling.id,
              paymentMethod: "CASH",
              paidAt: new Date(),
            },
            update: {
              paymentMethod: "CASH",
              paidAt: new Date(),
            },
          });
        }
        return NextResponse.json({
          success: true,
          alreadyPaid: true,
          billingId: paidBilling.id,
          billingStatus: "PAID",
          paymentMethod: "CASH",
        });
      }
      return NextResponse.json(
        { error: "Tagihan Latihan Bersama belum tersedia atau sudah lunas" },
        { status: 400 },
      );
    }

    const billing = unpaidBilling;

    let verified = false;
    for (const attempt of [
      {
        path: "/v1/billing/pay",
        method: "POST" as const,
        body: {
          billingId: billing.id,
          status: "PAID",
          paymentMethod: "CASH",
          proofUrl: "—",
          adminNotes: "Lunas tunai — Latihan Bersama",
        },
      },
      {
        path: `/v1/billing/${billing.id}/status`,
        method: "PATCH" as const,
        body: { status: "PAID", adminNotes: "Lunas tunai — Latihan Bersama" },
      },
    ]) {
      const { res } = await inkaiFetch(
        attempt.path,
        { method: attempt.method, body: JSON.stringify(attempt.body) },
        authResult.token,
      );
      if (res.ok) {
        verified = true;
        break;
      }
    }

    await prisma.billing.update({
      where: { id: billing.id },
      data: { status: "PAID" },
    }).catch(() => undefined);

    await prisma.payment.upsert({
      where: { billingId: billing.id },
      create: {
        billingId: billing.id,
        paymentMethod: "CASH",
        paidAt: new Date(),
      },
      update: {
        paymentMethod: "CASH",
        paidAt: new Date(),
      },
    });

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "LATBER_MARK_CASH",
      details: `Cash Latber payment reg=${id} billing=${billing.id}${verified ? "" : " (local)"}`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    const periodMeta = await loadLatberPeriodMeta(
      authResult.token,
      localReg.eventId,
    );
    const fees = resolveLatberPeriodFees(periodMeta);
    const eventTitle = await prisma.event
      .findFirst({ where: { id: localReg.eventId }, select: { title: true } })
      .then((e) => e?.title ?? "Latihan Bersama");
    await postKasFromLatberPaid({
      user: authResult.user,
      billingId: billing.id,
      feeAmount: unpaidBilling.amount ?? fees.feeAmount,
      komisiRanting: fees.komisiRanting,
      memberName: localReg.member.fullName ?? "Peserta",
      memberNia: localReg.member.nia,
      periodTitle: eventTitle,
      memberDojoId: localReg.member.dojoId,
    }).catch((err) => console.error("[Latber mark_cash] kas", err));
    void creditLatberAttendanceForPaidRegistration({
      memberId: localReg.memberId,
      eventId: localReg.eventId,
      eventAt: periodMeta.eventAt ?? null,
      dojoId: localReg.member.dojoId,
    }).catch((err) => console.error("[Latber mark_cash] attendance credit", err));

    return NextResponse.json({
      success: true,
      billingId: billing.id,
      billingStatus: "PAID",
      paymentMethod: "CASH",
    });
  }

  if (data.action === "mark_lunas") {
    const localReg = await prisma.eventRegistration.findFirst({
      where: { id },
      select: {
        memberId: true,
        member: { select: { dojoId: true, fullName: true } },
      },
    });
    if (!localReg) {
      return NextResponse.json(
        { error: "Pendaftaran tidak ditemukan" },
        { status: 404 },
      );
    }

    if (role === "ADMIN_DOJO") {
      const allowlist = getManagedDojoIdsFromUser(authResult.user);
      if (allowlist.length === 0) {
        return NextResponse.json(
          { error: "Ranting tidak terkonfigurasi" },
          { status: 403 },
        );
      }
      if (
        !localReg.member.dojoId ||
        !allowlist.includes(localReg.member.dojoId)
      ) {
        return NextResponse.json(
          { error: "Pendaftaran di luar ranting Anda" },
          { status: 403 },
        );
      }
    } else if (!isCabang) {
      return NextResponse.json(
        { error: "Tidak berhak mengubah Tunai menjadi Lunas" },
        { status: 403 },
      );
    }

    const paidBilling = await prisma.billing.findFirst({
      where: {
        registrationId: id,
        isDeleted: false,
        status: { in: ["PAID", "SUCCESS"] },
      },
      select: {
        id: true,
        payment: { select: { id: true, paymentMethod: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!paidBilling) {
      return NextResponse.json(
        { error: "Tagihan belum lunas tunai" },
        { status: 400 },
      );
    }

    const method = String(paidBilling.payment?.paymentMethod ?? "").toUpperCase();
    if (method === "TRANSFER") {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        billingId: paidBilling.id,
        billingStatus: "PAID",
        paymentMethod: "TRANSFER",
      });
    }
    if (method !== "CASH") {
      return NextResponse.json(
        { error: "Hanya status Tunai yang dapat diubah menjadi Lunas" },
        { status: 400 },
      );
    }

    await prisma.payment.update({
      where: { billingId: paidBilling.id },
      data: { paymentMethod: "TRANSFER" },
    });

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "LATBER_MARK_LUNAS",
      details: `Tunai → Lunas reg=${id} billing=${paidBilling.id}`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    return NextResponse.json({
      success: true,
      billingId: paidBilling.id,
      billingStatus: "PAID",
      paymentMethod: "TRANSFER",
    });
  }

  if (data.action === "submit_for_verification") {
    const localReg = await prisma.eventRegistration.findFirst({
      where: { id },
      select: {
        id: true,
        memberId: true,
        member: { select: { fullName: true, dojoId: true } },
        event: { select: { title: true } },
      },
    });
    if (!localReg) {
      return NextResponse.json({ error: "Pendaftaran tidak ditemukan" }, { status: 404 });
    }

    if (role === "ADMIN_DOJO") {
      const allowlist = getManagedDojoIdsFromUser(authResult.user);
      if (allowlist.length === 0) {
        return NextResponse.json({ error: "Ranting tidak terkonfigurasi" }, { status: 403 });
      }
      if (
        !localReg.member.dojoId ||
        !allowlist.includes(localReg.member.dojoId)
      ) {
        return NextResponse.json(
          { error: "Pendaftaran di luar ranting Anda" },
          { status: 403 },
        );
      }
    }

    const billing = await prisma.billing.findFirst({
      where: {
        registrationId: id,
        isDeleted: false,
        status: { in: ["PENDING", "WAITING_VERIFICATION"] },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (!billing) {
      return NextResponse.json(
        { error: "Tagihan Latihan Bersama belum tersedia. Daftar ulang atau hubungi cabang." },
        { status: 400 },
      );
    }

    const status = await setLatberBillingWaitingVerification({
      token: authResult.token,
      billingId: billing.id,
      note: "Diajukan ranting — menunggu verifikasi cabang (Latihan Bersama)",
    });

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "LATBER_SUBMIT_PAYMENT",
      details: `Submitted Latber payment for verification (reg=${id}, billing=${billing.id})`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    return NextResponse.json({
      success: true,
      billingId: billing.id,
      billingStatus: status,
      message: "Diajukan ke cabang — menunggu verifikasi (belum lunas)",
    });
  }

  return NextResponse.json({ error: "Aksi tidak dikenali" }, { status: 400 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const token = authResult.token;
  const isCabang = canEditKyuBaru(authResult.user.roles);
  const primaryRole = getPrimaryAdminRole(authResult.user.roles);
  const isDojo = primaryRole === "ADMIN_DOJO";
  const canForcePaid = isCabang || isDojo;
  const { id } = await context.params;

  const rlKey = `latber:registrations-delete:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 30, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const billingIds = new Set<string>();
  let memberId = "";
  let memberDojoId = "";
  let memberName = "";
  let periodTitle = "Latihan Bersama";
  let eventIdForAssert: string | null = null;
  let sawPaid = false;

  const localReg = await prisma.eventRegistration.findFirst({
    where: { id },
    select: {
      eventId: true,
      memberId: true,
      member: { select: { fullName: true, dojoId: true } },
      event: { select: { title: true } },
    },
  });

  if (localReg) {
    memberId = localReg.memberId;
    memberDojoId = localReg.member.dojoId ?? "";
    memberName = localReg.member.fullName;
    periodTitle = localReg.event.title ?? "Latber";
    eventIdForAssert = localReg.eventId;
  }

  if (isDojo) {
    const allowlist = getManagedDojoIdsFromUser(authResult.user);
    if (allowlist.length === 0) {
      return NextResponse.json({ error: "Ranting tidak terkonfigurasi" }, { status: 403 });
    }
    if (!memberDojoId || !allowlist.includes(memberDojoId)) {
      return NextResponse.json(
        { error: "Peserta di luar ranting Anda" },
        { status: 403 },
      );
    }
  }

  if (!eventIdForAssert) {
    return NextResponse.json(
      { error: "Periode Latihan Bersama tidak dapat diverifikasi untuk pendaftaran ini" },
      { status: 400 },
    );
  }

  const locals = await prisma.billing.findMany({
    where: { registrationId: id, isDeleted: false },
    select: { id: true, status: true, type: true, description: true },
  });
  for (const b of locals) {
    if (b.id) {
      billingIds.add(b.id);
      const st = String(b.status ?? "").toUpperCase();
      if (st === "PAID" || st === "SUCCESS") sawPaid = true;
    }
  }

  if (sawPaid && !canForcePaid) {
    return NextResponse.json(
      { error: "Anda tidak berwenang membatalkan peserta yang tagihannya sudah lunas" },
      { status: 403 },
    );
  }

  if (billingIds.size > 0) {
    for (const billingId of billingIds) {
      await voidKasFromBilling(billingId, authResult.user.id).catch((err) =>
        console.error("[Latber DELETE] void kas", billingId, err),
      );
    }
    await deleteBillingsHard(token, billingIds, {
      continueOnFailure: Boolean(canForcePaid),
    });
  }

  let regDeleted = false;
  const { res, data } = await inkaiFetch(
    `/v1/events/register/${id}`,
    { method: "DELETE" },
    token,
    { timeoutMs: 5_000, retries: 0 },
  );
  if (res.ok || res.status === 404) {
    regDeleted = true;
  } else if (canForcePaid) {
    if (billingIds.size > 0) {
      await forceUnlinkBillingsInDb(billingIds);
    }
    const dbDelete = await forceDeleteRegistrationInDb(id);
    regDeleted = dbDelete.ok;
    if (!dbDelete.ok) {
      return NextResponse.json(
        { error: dbDelete.error || inkaiErrorMessage(data, "Gagal membatalkan pendaftaran") },
        { status: 500 },
      );
    }
  } else {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal membatalkan pendaftaran") },
      { status: res.status },
    );
  }

  if (regDeleted && billingIds.size > 0) {
    try {
      await prisma.billing.updateMany({
        where: { id: { in: [...billingIds] } },
        data: { isDeleted: true },
      });
    } catch {
      /* ignore */
    }
  }

  if (eventIdForAssert && memberId) {
    await deleteLatberSelfRegistrationMeta(eventIdForAssert, memberId);
    await removeLatberAttendanceCredit(memberId, eventIdForAssert);
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "LATBER_REGISTRATION_CANCEL",
    details: `Cancelled Latber registration (${id}) member=${memberName} period=${periodTitle}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token,
  });

  return NextResponse.json({
    success: true,
    message:
      billingIds.size > 0
        ? "Pendaftaran dan tagihan Latihan Bersama berhasil dihapus"
        : "Pendaftaran dibatalkan",
  });
}

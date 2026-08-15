import { prisma } from "@/lib/prisma";
import { inkaiFetch } from "@/lib/inkai-api/server";
import {
  DEFAULT_LATBER_FEE,
  isLatberRegistrationOpen,
  latberPeriodMetaKey,
  parseLatberPeriodMetaValue,
  resolveLatberPeriodFees,
} from "@/lib/latber";
import { loadLatberPeriodMeta } from "@/lib/latber-period-meta-store";

export async function resolveLatberRegisterFeeAmount(opts: {
  token: string;
  eventId: string;
}): Promise<number> {
  try {
    const meta = await loadLatberPeriodMeta(opts.token, opts.eventId);
    return resolveLatberPeriodFees(meta).feeAmount;
  } catch {
    return DEFAULT_LATBER_FEE;
  }
}

export async function validateLatberRegistrationEligibility(
  token: string,
  eventId: string,
  _memberId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, isDeleted: false },
    select: {
      title: true,
      startDate: true,
      endDate: true,
      registrationCloseAt: true,
    },
  });
  if (!event) {
    return { ok: false, error: "Periode Latihan Bersama tidak ditemukan" };
  }

  let registrationOpenAt: string | undefined;
  try {
    const { res, data } = await inkaiFetch(
      `/v1/settings/${encodeURIComponent(latberPeriodMetaKey(eventId))}`,
      {},
      token,
      { timeoutMs: 5_000, retries: 0 },
    );
    if (res.ok) {
      const meta = parseLatberPeriodMetaValue(
        (data.data as { value?: unknown } | undefined)?.value ?? null,
      );
      registrationOpenAt = meta.registrationOpenAt;
      if (meta.archived || meta.locked) {
        return { ok: false, error: "Periode Latihan Bersama sudah ditutup" };
      }
    }
  } catch {
    /* ignore */
  }

  const schedule = {
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    registrationCloseAt: event.registrationCloseAt?.toISOString() ?? null,
    registrationOpenAt: registrationOpenAt ?? null,
  };

  if (!isLatberRegistrationOpen(schedule)) {
    return { ok: false, error: "Pendaftaran Latihan Bersama belum dibuka atau sudah ditutup" };
  }

  return { ok: true };
}

export async function forceRegisterLatberInDb(opts: {
  eventId: string;
  memberId: string;
  registeredByUserId?: string | null;
  periodTitle: string;
  amount: number;
  /** Base fee tanpa kode unik (rekap/nota). Default = amount. */
  baseFeeAmount?: number;
  uniqueTail?: number | null;
  status?: "APPROVED" | "PENDING";
  /** Walk-in publik: upgrade PENDING mandiri → APPROVED + tagihan. */
  approvePendingSelfReg?: boolean;
}): Promise<
  | {
      ok: true;
      registrationId: string;
      billingId: string | null;
      billingAmount: number;
      billingStatus: string;
      memberName: string;
    }
  | { ok: false; error: string }
> {
  const amount = Math.max(0, Math.round(opts.amount));
  const baseFeeAmount = Math.max(0, Math.round(opts.baseFeeAmount ?? amount));
  const uniqueTail =
    typeof opts.uniqueTail === "number" &&
    opts.uniqueTail >= 1 &&
    opts.uniqueTail <= 999
      ? opts.uniqueTail
      : null;
  const regStatus = opts.status ?? "APPROVED";
  try {
    const existing = await prisma.eventRegistration.findFirst({
      where: { eventId: opts.eventId, memberId: opts.memberId },
      select: { id: true, status: true },
    });
    if (existing) {
      const st = String(existing.status ?? "").toUpperCase();
      if (st !== "CANCELLED" && st !== "REJECTED") {
        if (st === "PENDING" && regStatus === "APPROVED") {
          if (!opts.approvePendingSelfReg) {
            return {
              ok: false,
              error:
                "Anggota sudah mengajukan daftar mandiri — gunakan tombol Terima",
            };
          }
        } else if (st === "PENDING" && regStatus === "PENDING") {
          return { ok: false, error: "Anggota sudah terdaftar pada periode ini" };
        } else if (st !== "PENDING") {
          return { ok: false, error: "Anggota sudah terdaftar pada periode ini" };
        }
      }
    }

    const member = await prisma.member.findFirst({
      where: { id: opts.memberId, isDeleted: false },
      select: { fullName: true, currentRank: true },
    });
    if (!member) return { ok: false, error: "Anggota tidak ditemukan" };

    const event = await prisma.event.findFirst({
      where: { id: opts.eventId, isDeleted: false },
      select: { id: true, title: true, registrationCloseAt: true, endDate: true },
    });
    if (!event) return { ok: false, error: "Periode Latihan Bersama tidak ditemukan" };

    const registration = existing
      ? await prisma.eventRegistration.update({
          where: { id: existing.id },
          data: {
            status: regStatus,
            registeredRank: member.currentRank,
            registeredByUserId: opts.registeredByUserId ?? null,
          },
        })
      : await prisma.eventRegistration.create({
          data: {
            eventId: opts.eventId,
            memberId: opts.memberId,
            registeredByUserId: opts.registeredByUserId ?? null,
            status: regStatus,
            registeredRank: member.currentRank,
          },
        });

    if (regStatus === "PENDING") {
      return {
        ok: true,
        registrationId: registration.id,
        billingId: null,
        billingAmount: amount,
        billingStatus: "NONE",
        memberName: member.fullName,
      };
    }

    const existingBilling = await prisma.billing.findFirst({
      where: {
        registrationId: registration.id,
        isDeleted: false,
        status: { notIn: ["CANCELLED"] },
      },
      select: { id: true, amount: true, status: true },
    });
    if (existingBilling) {
      return {
        ok: true,
        registrationId: registration.id,
        billingId: existingBilling.id,
        billingAmount: existingBilling.amount,
        billingStatus: existingBilling.status,
        memberName: member.fullName,
      };
    }

    const dueDate =
      event.registrationCloseAt ?? event.endDate ?? new Date();
    const desc = `LATBER — ${opts.periodTitle || event.title || "Pendaftaran"}`;

    const billing = await prisma.billing.create({
      data: {
        memberId: opts.memberId,
        registrationId: registration.id,
        type: "EVENT",
        amount,
        baseFeeAmount,
        uniqueTail,
        description: desc,
        dueDate,
        status: "PENDING",
        isDeleted: false,
      },
    });

    return {
      ok: true,
      registrationId: registration.id,
      billingId: billing.id,
      billingAmount: billing.amount,
      billingStatus: "PENDING",
      memberName: member.fullName,
    };
  } catch (error) {
    console.error("[latber-register] forceRegisterLatberInDb failed", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Gagal mendaftarkan anggota di database",
    };
  }
}

export async function ensureLatberBillingForAcceptedRegistration(opts: {
  registrationId: string;
  memberId: string;
  eventId: string;
  periodTitle: string;
  amount: number;
}): Promise<{ billingId: string; billingAmount: number; billingStatus: string } | null> {
  const existing = await prisma.billing.findFirst({
    where: {
      registrationId: opts.registrationId,
      isDeleted: false,
      status: { notIn: ["CANCELLED"] },
    },
    select: { id: true, amount: true, status: true },
  });
  if (existing) {
    return {
      billingId: existing.id,
      billingAmount: existing.amount,
      billingStatus: existing.status,
    };
  }

  const event = await prisma.event.findFirst({
    where: { id: opts.eventId, isDeleted: false },
    select: { title: true, registrationCloseAt: true, endDate: true },
  });
  const dueDate =
    event?.registrationCloseAt ?? event?.endDate ?? new Date();
  const desc = `LATBER — ${opts.periodTitle || event?.title || "Pendaftaran"}`;
  const amount = Math.max(0, Math.round(opts.amount));

  const billing = await prisma.billing.create({
    data: {
      memberId: opts.memberId,
      registrationId: opts.registrationId,
      type: "EVENT",
      amount,
      baseFeeAmount: amount,
      description: desc,
      dueDate,
      status: "PENDING",
      isDeleted: false,
    },
  });

  return {
    billingId: billing.id,
    billingAmount: billing.amount,
    billingStatus: billing.status,
  };
}

export async function setLatberBillingWaitingVerification(opts: {
  token?: string | null;
  billingId: string;
  note: string;
}): Promise<"WAITING_VERIFICATION"> {
  const status = "WAITING_VERIFICATION" as const;
  const token = opts.token?.trim() || "";
  let submitted = false;
  if (token) {
    for (const attempt of [
      {
        path: `/v1/billing/${opts.billingId}/status`,
        method: "PATCH" as const,
        body: { status, adminNotes: opts.note },
      },
      {
        path: `/v1/billing/${opts.billingId}`,
        method: "PATCH" as const,
        body: { status, adminNotes: opts.note },
      },
    ]) {
      const { res } = await inkaiFetch(
        attempt.path,
        { method: attempt.method, body: JSON.stringify(attempt.body) },
        token,
      );
      if (res.ok) {
        submitted = true;
        break;
      }
    }
  }
  if (!submitted) {
    await prisma.billing.update({
      where: { id: opts.billingId },
      data: { status },
    });
  }
  return status;
}

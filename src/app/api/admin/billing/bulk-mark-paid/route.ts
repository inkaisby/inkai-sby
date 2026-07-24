import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { writeBillingAudit } from "@/lib/audit";
import {
  isMonthlyDuesBilling,
  periodKey,
} from "@/lib/iuran-ledger";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";
import { buildMemberFilter, getPrimaryAdminRole } from "@/lib/rbac";
import { getClientIp } from "@/lib/security/request";
import { canManageIuranByWilayah } from "@/lib/wilayah-rbac";

export const maxDuration = 60;

const schema = z.object({
  memberIds: z.array(z.string().uuid()).min(1).max(100),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  adminNotes: z.string().trim().max(500).optional(),
});

async function markPaidLocal(billingId: string) {
  await prisma.billing.update({
    where: { id: billingId },
    data: { status: "PAID" },
  });
  const existing = await prisma.payment.findUnique({
    where: { billingId },
  });
  if (existing) {
    await prisma.payment.update({
      where: { billingId },
      data: {
        paymentMethod: existing.paymentMethod || "CASH",
        paidAt: existing.paidAt ?? new Date(),
        proofUrl: existing.proofUrl || "—",
      },
    });
  } else {
    await prisma.payment.create({
      data: {
        billingId,
        paymentMethod: "CASH",
        paidAt: new Date(),
        proofUrl: "—",
      },
    });
  }
}

/**
 * Bulk tandai lunas tunai untuk tagihan iuran bulanan periode tertentu.
 * Dipakai setoran massal hari latihan di rekening koran.
 */
export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }
  if (!canManageIuranByWilayah(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Anda tidak berwenang menandai lunas iuran" },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { memberIds, year, month, adminNotes } = parsed.data;
  const key = periodKey(year, month);
  const note = adminNotes?.trim() || `Lunas tunai massal ${key}`;

  const members = await prisma.member.findMany({
    where: {
      AND: [{ id: { in: memberIds } }, buildMemberFilter(authResult.user)],
    },
    select: { id: true, fullName: true, dojoId: true },
  });

  if (members.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada anggota dalam wilayah Anda" },
      { status: 403 },
    );
  }

  const role = getPrimaryAdminRole(authResult.user.roles);
  const allowlist =
    role === "ADMIN_DOJO"
      ? authResult.user.managedDojoIds && authResult.user.managedDojoIds.length > 0
        ? authResult.user.managedDojoIds
        : authResult.user.managedDojoId
          ? [authResult.user.managedDojoId]
          : []
      : [];

  const scopedMembers =
    allowlist.length > 0
      ? members.filter((m) => allowlist.includes(m.dojoId))
      : members;

  const scopedIds = scopedMembers.map((m) => m.id);
  const billings = await prisma.billing.findMany({
    where: {
      memberId: { in: scopedIds },
      isDeleted: false,
      status: { in: ["PENDING", "WAITING_VERIFICATION", "REJECTED"] },
    },
    select: {
      id: true,
      memberId: true,
      type: true,
      amount: true,
      status: true,
      description: true,
      dueDate: true,
    },
  });

  const targets = billings.filter((b) => {
    if (!isMonthlyDuesBilling(b.type, b.description)) return false;
    const due = b.dueDate.toISOString().slice(0, 7);
    const desc = String(b.description ?? "");
    return (
      due === key ||
      desc.includes(key) ||
      desc.includes(`Iuran bulanan ${key}`)
    );
  });

  let paid = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const b of targets) {
    let ok = false;
    const { res, data } = await inkaiFetch(
      "/v1/billing/verify",
      {
        method: "POST",
        body: JSON.stringify({
          billingId: b.id,
          status: "PAID",
          adminNotes: note,
        }),
      },
      authResult.token,
    );
    if (res.ok) {
      ok = true;
    } else {
      try {
        await markPaidLocal(b.id);
        ok = true;
      } catch {
        failed += 1;
        errors.push(
          `${b.id}: ${inkaiErrorMessage(data, "Gagal menandai lunas")}`,
        );
      }
    }
    if (ok) {
      paid += 1;
      writeBillingAudit({
        userId: authResult.user.id,
        email: authResult.user.email,
        action: "BILLING_VERIFY",
        memberId: b.memberId,
        billingId: b.id,
        billingAction: "mark_paid",
        notes: note,
        amount: b.amount,
        details: formatBulkDetail(b.memberId, b.id, b.amount, note),
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        token: authResult.token,
      });
    }
  }

  const skippedMembers = scopedIds.filter(
    (id) => !targets.some((t) => t.memberId === id),
  ).length;

  return NextResponse.json({
    success: true,
    period: key,
    paid,
    failed,
    skippedMembers,
    targetBillings: targets.length,
    errors: errors.slice(0, 10),
    message:
      paid > 0
        ? `Ditandai lunas: ${paid} tagihan (${key})${failed ? `, gagal ${failed}` : ""}`
        : targets.length === 0
          ? `Tidak ada tagihan iuran ${key} yang belum lunas pada pilihan`
          : `Gagal menandai lunas (${failed})`,
  });
}

function formatBulkDetail(
  memberId: string,
  billingId: string,
  amount: number,
  notes: string,
) {
  return `memberId=${memberId} billingId=${billingId} billingAction=mark_paid amount=${Math.round(amount)} notes=${notes.slice(0, 200)} bulk=1`;
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";
import { memberBillingPaymentReportSchema } from "@/lib/security/schemas";
import { isMonthlyDuesBilling } from "@/lib/iuran-ledger";
import { formatBillingAuditDetails, writeBillingAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

type RouteContext = { params: Promise<{ id: string }> };

function parsePaidAtDate(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

function startOfTodayLocal() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 59, 999);
}

async function trySubmitToInkai(
  token: string,
  billingId: string,
  paidAtIso: string,
  paymentMethod: string,
) {
  const payloads: Array<{ path: string; method: "POST" | "PATCH"; body: Record<string, unknown> }> = [
    {
      path: "/v1/billing/pay",
      method: "POST",
      body: {
        billingId,
        paymentMethod,
        status: "WAITING_VERIFICATION",
        paidAt: paidAtIso,
      },
    },
    {
      path: `/v1/billing/${billingId}/pay`,
      method: "POST",
      body: {
        paymentMethod,
        paidAt: paidAtIso,
        status: "WAITING_VERIFICATION",
      },
    },
    {
      path: `/v1/billing/${billingId}`,
      method: "PATCH",
      body: {
        paymentMethod,
        paidAt: paidAtIso,
        status: "WAITING_VERIFICATION",
      },
    },
  ];

  let lastError = "Gagal mengirim laporan setor";
  let lastStatus = 400;

  for (const attempt of payloads) {
    const { res, data } = await inkaiFetch(
      attempt.path,
      { method: attempt.method, body: JSON.stringify(attempt.body) },
      token,
    );
    if (res.ok) {
      return { ok: true as const, data };
    }
    if (res.status === 404 || res.status === 405) {
      lastError = inkaiErrorMessage(data, lastError);
      lastStatus = res.status;
      continue;
    }
    return {
      ok: false as const,
      error: inkaiErrorMessage(data, lastError),
      status: res.status,
    };
  }

  return { ok: false as const, error: lastError, status: lastStatus };
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  const token = await getInkaiAccessToken();
  const memberId = session?.user.memberId;
  if (!memberId || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = memberBillingPaymentReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  const billing = await prisma.billing.findFirst({
    where: { id, isDeleted: false },
    select: {
      id: true,
      memberId: true,
      amount: true,
      status: true,
      type: true,
      description: true,
    },
  });

  // 404 generik — jangan bocorkan keberadaan tagihan orang lain
  if (!billing || billing.memberId !== memberId) {
    return NextResponse.json({ error: "Tagihan tidak ditemukan" }, { status: 404 });
  }

  if (!isMonthlyDuesBilling(billing.type, billing.description)) {
    return NextResponse.json({ error: "Tagihan tidak ditemukan" }, { status: 404 });
  }

  if (billing.status !== "PENDING" && billing.status !== "REJECTED") {
    return NextResponse.json(
      { error: "Tagihan ini tidak dapat dilaporkan setor" },
      { status: 400 },
    );
  }

  if (Math.round(parsed.data.amount) !== Math.round(billing.amount)) {
    return NextResponse.json(
      { error: "Nominal harus sama dengan tagihan" },
      { status: 400 },
    );
  }

  const paidAt = parsePaidAtDate(parsed.data.paidAt);
  if (!paidAt) {
    return NextResponse.json({ error: "Tanggal bayar tidak valid" }, { status: 400 });
  }
  if (paidAt.getTime() > startOfTodayLocal().getTime()) {
    return NextResponse.json(
      { error: "Tanggal bayar tidak boleh di masa depan" },
      { status: 400 },
    );
  }

  const paymentMethod = parsed.data.paymentMethod?.trim() || "SETOR_RANTING";
  const paidAtIso = paidAt.toISOString();

  const inkai = await trySubmitToInkai(token, id, paidAtIso, paymentMethod);

  try {
    await prisma.billing.update({
      where: { id },
      data: { status: "WAITING_VERIFICATION" },
    });
    await prisma.payment.upsert({
      where: { billingId: id },
      create: {
        billingId: id,
        paymentMethod,
        paidAt,
        proofUrl: null,
      },
      update: {
        paymentMethod,
        paidAt,
        proofUrl: null,
      },
    });
  } catch {
    if (!inkai.ok) {
      return NextResponse.json(
        { error: inkai.error || "Gagal menyimpan laporan setor" },
        { status: inkai.status || 500 },
      );
    }
  }

  writeBillingAudit({
    userId: session.user.id,
    email: session.user.email,
    action: "BILLING_MEMBER_REPORT",
    memberId,
    billingId: id,
    billingAction: "member_report_setor",
    notes: `Setor ranting ${parsed.data.paidAt}`,
    amount: billing.amount,
    details: formatBillingAuditDetails(
      {
        memberId,
        billingId: id,
        billingAction: "member_report_setor",
        notes: `Setor ranting ${parsed.data.paidAt}`,
        amount: billing.amount,
      },
      `paidAt=${parsed.data.paidAt} method=${paymentMethod}`,
    ),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token,
  });

  return NextResponse.json({
    success: true,
    message: "Laporan setor terkirim. Menunggu konfirmasi pengurus ranting.",
    billing: inkai.ok ? inkai.data?.data : { id, status: "WAITING_VERIFICATION" },
  });
}

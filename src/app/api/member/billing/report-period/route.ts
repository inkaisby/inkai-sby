import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";
import { memberBillingPeriodReportSchema } from "@/lib/security/schemas";
import {
  isMonthlyDuesBilling,
  periodKey,
} from "@/lib/iuran-ledger";
import { getOperationalDefaults } from "@/lib/org-settings";
import { formatBillingAuditDetails, writeBillingAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

const MAX_LOOKBACK_MONTHS = 24;
const PAID = new Set(["PAID", "SUCCESS", "APPROVED"]);

function parsePeriod(raw: string): { year: number; month: number; key: string } | null {
  if (!/^\d{4}-\d{2}$/.test(raw)) return null;
  const [y, m] = raw.split("-").map(Number);
  if (y < 2020 || y > 2100 || m < 1 || m > 12) return null;
  return { year: y, month: m, key: periodKey(y, m) };
}

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

function dueDateFor(year: number, month: number) {
  return new Date(year, month, 0, 23, 59, 59);
}

function monthsFromNow(year: number, month: number) {
  const now = new Date();
  return (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
}

function billingMatchesPeriod(
  description: string | null,
  dueDate: Date,
  key: string,
) {
  const desc = String(description ?? "");
  if (desc.includes(key) || desc.includes(`Iuran bulanan ${key}`)) return true;
  const dueKey = periodKey(dueDate.getFullYear(), dueDate.getMonth() + 1);
  return dueKey === key;
}

async function trySubmitToInkai(
  token: string,
  billingId: string,
  paidAtIso: string,
  paymentMethod: string,
) {
  const payloads: Array<{
    path: string;
    method: "POST" | "PATCH";
    body: Record<string, unknown>;
  }> = [
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
    if (res.ok) return { ok: true as const, data };
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

async function ensureBillingForPeriod(params: {
  token: string;
  memberId: string;
  amount: number;
  key: string;
  year: number;
  month: number;
}) {
  const description = `Iuran bulanan ${params.key}`;
  const dueDate = dueDateFor(params.year, params.month);
  const body = {
    memberId: params.memberId,
    type: "MONTHLY",
    amount: params.amount,
    dueDate: dueDate.toISOString(),
    description,
  };

  const { res, data } = await inkaiFetch(
    "/v1/billing",
    { method: "POST", body: JSON.stringify(body) },
    params.token,
  );

  if (res.ok) {
    const created = data?.data as { id?: string } | undefined;
    const id = created?.id != null ? String(created.id) : null;
    if (id) {
      await prisma.billing.upsert({
        where: { id },
        create: {
          id,
          memberId: params.memberId,
          type: "MONTHLY",
          amount: params.amount,
          description,
          dueDate,
          status: "PENDING",
        },
        update: {
          amount: params.amount,
          description,
          dueDate,
          isDeleted: false,
        },
      });
      return { id, amount: params.amount };
    }
  }

  const local = await prisma.billing.create({
    data: {
      memberId: params.memberId,
      type: "MONTHLY",
      amount: params.amount,
      description,
      dueDate,
      status: "PENDING",
    },
    select: { id: true, amount: true },
  });
  return local;
}

export async function POST(request: Request) {
  const session = await auth();
  const token = await getInkaiAccessToken();
  const memberId = session?.user.memberId;
  if (!memberId || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = memberBillingPeriodReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  const period = parsePeriod(parsed.data.period);
  if (!period) {
    return NextResponse.json({ error: "Periode tidak valid" }, { status: 400 });
  }

  const age = monthsFromNow(period.year, period.month);
  if (age < 0) {
    return NextResponse.json(
      { error: "Periode tidak boleh di masa depan" },
      { status: 400 },
    );
  }
  if (age > MAX_LOOKBACK_MONTHS) {
    return NextResponse.json(
      { error: `Periode maksimal ${MAX_LOOKBACK_MONTHS} bulan ke belakang` },
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

  const member = await prisma.member.findFirst({
    where: { id: memberId, isDeleted: false },
    select: {
      id: true,
      status: true,
      monthlyDuesAmount: true,
      allowEventWithoutDues: true,
    },
  });
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (member.status && member.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Keanggotaan tidak aktif" },
      { status: 403 },
    );
  }

  const defaults = await getOperationalDefaults();
  const duesAmount =
    Number.isFinite(member.monthlyDuesAmount) && member.monthlyDuesAmount > 0
      ? member.monthlyDuesAmount
      : defaults.monthlyDuesAmount;

  const existing = await prisma.billing.findMany({
    where: { memberId, isDeleted: false },
    select: {
      id: true,
      type: true,
      description: true,
      dueDate: true,
      amount: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const match = existing.find(
    (b) =>
      isMonthlyDuesBilling(b.type, b.description) &&
      billingMatchesPeriod(b.description, b.dueDate, period.key),
  );

  if (match && PAID.has(match.status)) {
    return NextResponse.json(
      { error: `Iuran ${period.key} sudah lunas` },
      { status: 400 },
    );
  }
  if (match && match.status === "WAITING_VERIFICATION") {
    return NextResponse.json(
      { error: `Iuran ${period.key} sudah menunggu verifikasi ranting` },
      { status: 400 },
    );
  }

  let billingId = match?.id;
  let billingAmount = match?.amount ?? duesAmount;

  if (!billingId) {
    if (member.allowEventWithoutDues) {
      return NextResponse.json(
        {
          error:
            "Anggota berstatus pengecualian iuran — hubungi pengurus ranting untuk tagihan",
        },
        { status: 400 },
      );
    }
    const created = await ensureBillingForPeriod({
      token,
      memberId,
      amount: duesAmount,
      key: period.key,
      year: period.year,
      month: period.month,
    });
    billingId = created.id;
    billingAmount = created.amount;
  }

  const paymentMethod = parsed.data.paymentMethod?.trim() || "SETOR_RANTING";
  const paidAtIso = paidAt.toISOString();
  const inkai = await trySubmitToInkai(
    token,
    billingId,
    paidAtIso,
    paymentMethod,
  );

  try {
    await prisma.billing.update({
      where: { id: billingId },
      data: { status: "WAITING_VERIFICATION", amount: billingAmount },
    });
    await prisma.payment.upsert({
      where: { billingId },
      create: {
        billingId,
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
    billingId,
    billingAction: "member_report_setor",
    notes: `Setor ranting ${parsed.data.paidAt} periode ${period.key}`,
    amount: billingAmount,
    details: formatBillingAuditDetails(
      {
        memberId,
        billingId,
        billingAction: "member_report_setor",
        notes: `Setor ranting ${parsed.data.paidAt} periode ${period.key}`,
        amount: billingAmount,
      },
      `paidAt=${parsed.data.paidAt} period=${period.key} method=${paymentMethod}`,
    ),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token,
  });

  return NextResponse.json({
    success: true,
    message: `Laporan setor ${period.key} terkirim. Menunggu konfirmasi pengurus ranting.`,
    billingId,
    period: period.key,
  });
}

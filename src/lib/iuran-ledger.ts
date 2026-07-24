import { prisma } from "@/lib/prisma";
import { buildMemberFilter, type SessionUser } from "@/lib/rbac";

/** Tipe tagihan yang dihitung sebagai iuran bulanan (bukan UKT/event). */
const MONTHLY_TYPES = new Set([
  "MONTHLY",
  "MONTHLY_IURAN",
  "IURAN",
  "DUES",
]);

const UNPAID_STATUSES = new Set([
  "PENDING",
  "WAITING_VERIFICATION",
  "REJECTED",
]);

const PAID_STATUSES = new Set(["PAID", "SUCCESS", "APPROVED"]);

export type MonthStatus =
  | "PAID"
  | "WAITING"
  | "PENDING"
  | "REJECTED"
  | "EXEMPT"
  | "NO_BILL"
  | "INACTIVE";

export type ArrearsAging = "none" | "1" | "2" | "3plus";

export type IuranLedgerMemberRow = {
  id: string;
  fullName: string;
  nia: string | null;
  status: string;
  dojoId: string;
  dojoName: string;
  monthlyDuesAmount: number;
  allowEventWithoutDues: boolean;
  monthStatus: MonthStatus;
  arrearsAmount: number;
  arrearsCount: number;
  waitingCount: number;
  aging: ArrearsAging;
  oldestUnpaidDue: string | null;
};

export type IuranLedgerKpis = {
  arrearsAmount: number;
  pendingCount: number;
  waitingCount: number;
  paidMonthAmount: number;
  paidMonthCount: number;
  exemptCount: number;
  noBillCount: number;
  memberCount: number;
};

export type WaitingQueueItem = {
  billingId: string;
  memberId: string;
  fullName: string;
  nia: string | null;
  dojoName: string;
  amount: number;
  dueDate: string;
  description: string | null;
  proofUrl: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
};

export type IuranLedgerIndexResult = {
  rows: IuranLedgerMemberRow[];
  /** Seluruh baris terfilter (maks 2000) untuk export CSV. */
  exportRows: IuranLedgerMemberRow[];
  total: number;
  kpis: IuranLedgerKpis;
  waitingQueue: WaitingQueueItem[];
  period: string;
};

export type IuranLedgerBilling = {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  dueDate: string;
  createdAt: string;
  payment: {
    paymentMethod: string | null;
    proofUrl: string | null;
    paidAt: string | null;
  } | null;
};

export function periodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parsePeriod(monthParam?: string | null): {
  year: number;
  month: number;
  key: string;
} {
  const now = new Date();
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    if (y >= 2020 && y <= 2100 && m >= 1 && m <= 12) {
      return { year: y, month: m, key: periodKey(y, m) };
    }
  }
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return { year, month, key: periodKey(year, month) };
}

export function isMonthlyDuesBilling(
  type: string | null | undefined,
  description?: string | null,
): boolean {
  const t = String(type ?? "").toUpperCase();
  if (MONTHLY_TYPES.has(t)) return true;
  // Legacy rows: type UKT/event harus ditolak; deskripsi "Iuran bulanan YYYY-MM"
  if (t.includes("UKT") || t.includes("EVENT") || t.includes("REGISTRATION")) {
    return false;
  }
  const d = String(description ?? "");
  return /iuran\s*bulanan/i.test(d);
}

export function monthStatusLabel(status: MonthStatus): string {
  switch (status) {
    case "PAID":
      return "Lunas";
    case "WAITING":
      return "Menunggu verifikasi";
    case "PENDING":
      return "Belum bayar";
    case "REJECTED":
      return "Ditolak";
    case "EXEMPT":
      return "Pengecualian";
    case "NO_BILL":
      return "Belum digenerate";
    case "INACTIVE":
      return "Nonaktif";
    default:
      return status;
  }
}

export function agingLabel(aging: ArrearsAging): string {
  switch (aging) {
    case "1":
      return "1 bln";
    case "2":
      return "2 bln";
    case "3plus":
      return "3+ bln";
    default:
      return "—";
  }
}

function isActiveMemberStatus(status: string) {
  const s = status.trim().toUpperCase();
  return s === "ACTIVE" || s === "AKTIF";
}

function matchesPeriod(
  dueDate: Date,
  description: string | null | undefined,
  key: string,
) {
  const due = dueDate.toISOString().slice(0, 7);
  if (due === key) return true;
  const desc = String(description ?? "");
  return desc.includes(key) || desc.includes(`Iuran bulanan ${key}`);
}

function computeAging(
  unpaidDueDates: Date[],
  asOf: Date = new Date(),
): ArrearsAging {
  if (unpaidDueDates.length === 0) return "none";
  const oldest = unpaidDueDates.reduce((a, b) => (a < b ? a : b));
  const months =
    (asOf.getFullYear() - oldest.getFullYear()) * 12 +
    (asOf.getMonth() - oldest.getMonth());
  if (months <= 1) return "1";
  if (months === 2) return "2";
  return "3plus";
}

function resolveMonthStatus(opts: {
  allowEventWithoutDues: boolean;
  memberStatus: string;
  monthBillings: Array<{ status: string }>;
}): MonthStatus {
  if (opts.allowEventWithoutDues) return "EXEMPT";
  if (!isActiveMemberStatus(opts.memberStatus)) return "INACTIVE";
  if (opts.monthBillings.length === 0) return "NO_BILL";
  if (opts.monthBillings.some((b) => PAID_STATUSES.has(b.status))) return "PAID";
  if (opts.monthBillings.some((b) => b.status === "WAITING_VERIFICATION")) {
    return "WAITING";
  }
  if (opts.monthBillings.some((b) => b.status === "REJECTED")) return "REJECTED";
  return "PENDING";
}

export type LedgerIndexFilters = {
  q?: string;
  dojoId?: string;
  /** Filter daftar: all | arrears | waiting | paid | nobill | exempt */
  filter?: string;
  page?: number;
  pageSize?: number;
  sort?: "name" | "arrears" | "status";
  sortDir?: "asc" | "desc";
  includeInactive?: boolean;
};

/**
 * Agregasi rekening koran per anggota dari Prisma (source of truth tunggakan).
 * Write tetap lewat API Inkai + fallback Prisma; index/read ledger dari DB lokal
 * agar konsisten dengan monthlyDuesAmount & generate.
 */
export async function getIuranMemberLedgerIndex(
  user: SessionUser,
  period: { year: number; month: number; key: string },
  filters: LedgerIndexFilters = {},
): Promise<IuranLedgerIndexResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const sort = filters.sort ?? "name";
  const sortDir = filters.sortDir === "desc" ? "desc" : "asc";
  const filter = (filters.filter ?? "all").toLowerCase();

  const memberWhere = {
    AND: [
      buildMemberFilter(user),
      ...(filters.dojoId ? [{ dojoId: filters.dojoId }] : []),
      ...(filters.includeInactive
        ? []
        : [
            {
              OR: [
                { status: "Active" },
                { status: "ACTIVE" },
                { status: "Aktif" },
              ],
            },
          ]),
      ...(filters.q?.trim()
        ? [
            {
              OR: [
                {
                  fullName: {
                    contains: filters.q.trim(),
                    mode: "insensitive" as const,
                  },
                },
                {
                  nia: {
                    contains: filters.q.trim(),
                    mode: "insensitive" as const,
                  },
                },
              ],
            },
          ]
        : []),
    ],
  };

  const members = await prisma.member.findMany({
    where: memberWhere,
    select: {
      id: true,
      fullName: true,
      nia: true,
      status: true,
      dojoId: true,
      monthlyDuesAmount: true,
      allowEventWithoutDues: true,
      dojo: { select: { name: true } },
    },
    orderBy: { fullName: "asc" },
  });

  const memberIds = members.map((m) => m.id);
  const billings =
    memberIds.length === 0
      ? []
      : await prisma.billing.findMany({
          where: {
            memberId: { in: memberIds },
            isDeleted: false,
          },
          select: {
            id: true,
            memberId: true,
            type: true,
            amount: true,
            status: true,
            description: true,
            dueDate: true,
            payment: {
              select: { proofUrl: true, paidAt: true, paymentMethod: true },
            },
          },
        });

  const monthlyByMember = new Map<
    string,
    Array<{
      id: string;
      amount: number;
      status: string;
      description: string | null;
      dueDate: Date;
      proofUrl: string | null;
      paidAt: Date | null;
      paymentMethod: string | null;
    }>
  >();

  for (const b of billings) {
    if (!isMonthlyDuesBilling(b.type, b.description)) continue;
    const list = monthlyByMember.get(b.memberId) ?? [];
    list.push({
      id: b.id,
      amount: b.amount,
      status: b.status,
      description: b.description,
      dueDate: b.dueDate,
      proofUrl: b.payment?.proofUrl ?? null,
      paidAt: b.payment?.paidAt ?? null,
      paymentMethod: b.payment?.paymentMethod ?? null,
    });
    monthlyByMember.set(b.memberId, list);
  }

  const waitingQueue: WaitingQueueItem[] = [];
  const allRows: IuranLedgerMemberRow[] = [];

  let kpiArrears = 0;
  let kpiPending = 0;
  let kpiWaiting = 0;
  let kpiPaidAmount = 0;
  let kpiPaidCount = 0;
  let kpiExempt = 0;
  let kpiNoBill = 0;

  for (const m of members) {
    const list = monthlyByMember.get(m.id) ?? [];
    const unpaid = list.filter((b) => UNPAID_STATUSES.has(b.status));
    const arrearsAmount = unpaid.reduce((s, b) => s + b.amount, 0);
    const waitingCount = unpaid.filter(
      (b) => b.status === "WAITING_VERIFICATION",
    ).length;
    const monthBillings = list.filter((b) =>
      matchesPeriod(b.dueDate, b.description, period.key),
    );
    const monthStatus = resolveMonthStatus({
      allowEventWithoutDues: m.allowEventWithoutDues,
      memberStatus: m.status,
      monthBillings,
    });
    const aging = computeAging(unpaid.map((b) => b.dueDate));
    const oldest = unpaid.reduce<Date | null>((acc, b) => {
      if (!acc || b.dueDate < acc) return b.dueDate;
      return acc;
    }, null);

    for (const b of unpaid) {
      if (b.status !== "WAITING_VERIFICATION") continue;
      waitingQueue.push({
        billingId: b.id,
        memberId: m.id,
        fullName: m.fullName,
        nia: m.nia,
        dojoName: m.dojo.name,
        amount: b.amount,
        dueDate: b.dueDate.toISOString(),
        description: b.description,
        proofUrl: b.proofUrl,
        paidAt: b.paidAt?.toISOString() ?? null,
        paymentMethod: b.paymentMethod,
      });
    }

    // KPI dihitung dari seluruh scope (sebelum filter daftar)
    kpiArrears += arrearsAmount;
    kpiPending += unpaid.filter((b) => b.status === "PENDING").length;
    kpiWaiting += waitingCount;
    if (monthStatus === "EXEMPT") kpiExempt += 1;
    if (monthStatus === "NO_BILL") kpiNoBill += 1;
    for (const b of monthBillings) {
      if (PAID_STATUSES.has(b.status)) {
        kpiPaidAmount += b.amount;
        kpiPaidCount += 1;
      }
    }

    allRows.push({
      id: m.id,
      fullName: m.fullName,
      nia: m.nia,
      status: m.status,
      dojoId: m.dojoId,
      dojoName: m.dojo.name,
      monthlyDuesAmount: m.monthlyDuesAmount,
      allowEventWithoutDues: m.allowEventWithoutDues,
      monthStatus,
      arrearsAmount,
      arrearsCount: unpaid.length,
      waitingCount,
      aging,
      oldestUnpaidDue: oldest?.toISOString() ?? null,
    });
  }

  let filtered = allRows;
  if (filter === "arrears") {
    filtered = allRows.filter((r) => r.arrearsAmount > 0);
  } else if (filter === "waiting") {
    filtered = allRows.filter((r) => r.waitingCount > 0);
  } else if (filter === "paid") {
    filtered = allRows.filter((r) => r.monthStatus === "PAID");
  } else if (filter === "nobill") {
    filtered = allRows.filter((r) => r.monthStatus === "NO_BILL");
  } else if (filter === "exempt") {
    filtered = allRows.filter((r) => r.monthStatus === "EXEMPT");
  }

  filtered = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sort === "arrears") {
      cmp = a.arrearsAmount - b.arrearsAmount;
    } else if (sort === "status") {
      cmp = a.monthStatus.localeCompare(b.monthStatus);
    } else {
      cmp = a.fullName.localeCompare(b.fullName, "id");
    }
    return sortDir === "desc" ? -cmp : cmp;
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);
  const exportRows = filtered.slice(0, 2000);

  waitingQueue.sort((a, b) => a.fullName.localeCompare(b.fullName, "id"));

  return {
    rows,
    exportRows,
    total,
    kpis: {
      arrearsAmount: kpiArrears,
      pendingCount: kpiPending,
      waitingCount: kpiWaiting,
      paidMonthAmount: kpiPaidAmount,
      paidMonthCount: kpiPaidCount,
      exemptCount: kpiExempt,
      noBillCount: kpiNoBill,
      memberCount: members.length,
    },
    waitingQueue: waitingQueue.slice(0, 40),
    period: period.key,
  };
}

export async function getIuranMemberLedgerDetail(
  user: SessionUser,
  memberId: string,
  opts: { limit?: number; offset?: number } = {},
) {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 100));
  const offset = Math.max(0, opts.offset ?? 0);

  const member = await prisma.member.findFirst({
    where: {
      AND: [{ id: memberId }, buildMemberFilter(user, { anyDeleted: true })],
    },
    select: {
      id: true,
      fullName: true,
      nia: true,
      status: true,
      dojoId: true,
      monthlyDuesAmount: true,
      allowEventWithoutDues: true,
      isDeleted: true,
      dojo: { select: { id: true, name: true } },
    },
  });

  if (!member) return null;

  const allBillings = await prisma.billing.findMany({
    where: { memberId, isDeleted: false },
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
    include: {
      payment: {
        select: {
          paymentMethod: true,
          proofUrl: true,
          paidAt: true,
        },
      },
    },
  });

  const monthly = allBillings.filter((b) =>
    isMonthlyDuesBilling(b.type, b.description),
  );
  const total = monthly.length;
  const page = monthly.slice(offset, offset + limit);

  const unpaid = monthly.filter((b) => UNPAID_STATUSES.has(b.status));
  const arrearsAmount = unpaid.reduce((s, b) => s + b.amount, 0);
  const year = new Date().getFullYear();
  const paidThisYear = monthly.filter(
    (b) =>
      PAID_STATUSES.has(b.status) &&
      (b.payment?.paidAt?.getFullYear() === year ||
        b.dueDate.getFullYear() === year),
  );
  const paidYearAmount = paidThisYear.reduce((s, b) => s + b.amount, 0);

  const billingIds = monthly.map((b) => b.id);
  const auditOr =
    billingIds.length > 0
      ? [
          { details: { contains: `memberId=${memberId}` } },
          ...billingIds.slice(0, 30).map((id) => ({
            details: { contains: `billingId=${id}` },
          })),
        ]
      : [{ details: { contains: `memberId=${memberId}` } }];

  const auditRows = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          "BILLING_VERIFY",
          "BILLING_UPDATE",
          "BILLING_SUBMIT_VERIFICATION",
          "BILLING_GENERATE_MONTHLY",
          "BILLING_MEMBER_REPORT",
        ],
      },
      OR: auditOr,
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      action: true,
      email: true,
      details: true,
      createdAt: true,
    },
  });

  const billings: IuranLedgerBilling[] = page.map((b) => ({
    id: b.id,
    type: b.type,
    amount: b.amount,
    status: b.status,
    description: b.description,
    dueDate: b.dueDate.toISOString(),
    createdAt: b.createdAt.toISOString(),
    payment: b.payment
      ? {
          paymentMethod: b.payment.paymentMethod,
          proofUrl: b.payment.proofUrl,
          paidAt: b.payment.paidAt?.toISOString() ?? null,
        }
      : null,
  }));

  return {
    member: {
      id: member.id,
      fullName: member.fullName,
      nia: member.nia,
      status: member.status,
      dojoId: member.dojoId,
      dojoName: member.dojo.name,
      monthlyDuesAmount: member.monthlyDuesAmount,
      allowEventWithoutDues: member.allowEventWithoutDues,
      isDeleted: member.isDeleted,
    },
    summary: {
      arrearsAmount,
      arrearsCount: unpaid.length,
      paidYearAmount,
      paidYearCount: paidThisYear.length,
      aging: computeAging(unpaid.map((b) => b.dueDate)),
    },
    billings,
    auditTrail: auditRows.map((a) => ({
      id: a.id,
      action: a.action,
      email: a.email,
      details: a.details,
      createdAt: a.createdAt.toISOString(),
    })),
    total,
    limit,
    offset,
  };
}

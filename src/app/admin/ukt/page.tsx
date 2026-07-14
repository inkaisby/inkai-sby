import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import {
  buildDojoFilter,
  buildEventFilter,
  buildMemberFilter,
  canAccessAdmin,
  getPrimaryAdminRole,
  ROLE_LABELS,
} from "@/lib/rbac";
import { UktDashboard } from "@/components/admin/ukt/UktDashboard";
import type { UktMemberRow, UktSemester } from "@/lib/ukt";
import { InkaiLoadingScreen } from "@/components/ui/InkaiLoadingScreen";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type SearchParams = Promise<{
  period?: string;
  semester?: string;
  year?: string;
  q?: string;
  status?: string;
  dojo?: string;
  page?: string;
  pageSize?: string;
  view?: string;
}>;

function buildMemberWhere(
  memberFilter: ReturnType<typeof buildMemberFilter>,
  effectiveDojoFilter: string,
  q: string,
) {
  return {
    ...memberFilter,
    ...(effectiveDojoFilter ? { dojoId: effectiveDojoFilter } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" as const } },
            { nia: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

function applyViewFilter(rows: UktMemberRow[], viewFilter: string) {
  if (viewFilter === "registered") return rows.filter((r) => r.registrationId);
  if (viewFilter === "unregistered") return rows.filter((r) => !r.registrationId);
  if (viewFilter === "approved") return rows.filter((r) => ["APPROVED", "PAID", "SUCCESS"].includes(r.status));
  if (viewFilter === "pending") return rows.filter((r) => r.status === "PENDING");
  if (viewFilter === "rejected") return rows.filter((r) => r.status === "REJECTED");
  if (viewFilter === "paid") return rows.filter((r) => r.billingStatus === "PAID" || r.status === "PAID");
  return rows;
}

async function UktPageContent({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const params = await searchParams;
  const semester = (params.semester === "II" ? "II" : "I") as UktSemester;
  const year = Math.min(2100, Math.max(2020, parseInt(params.year || String(new Date().getFullYear()), 10)));
  const q = params.q?.trim() || "";
  const statusFilter = params.status?.trim() || "";
  const dojoFilter = params.dojo?.trim() || "";
  const viewFilter = params.view?.trim() || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = [25, 50, 100, 1000].includes(parseInt(params.pageSize || "25", 10))
    ? parseInt(params.pageSize || "25", 10)
    : 25;

  const user = session.user;
  const primaryRole = getPrimaryAdminRole(user.roles);
  const memberFilter = buildMemberFilter(user);
  const dojoWhere = buildDojoFilter(user);
  const eventFilter = buildEventFilter(user);

  const autoDojoId =
    primaryRole === "ADMIN_DOJO" && user.managedDojoId ? user.managedDojoId : "";
  const effectiveDojoFilter = autoDojoId || dojoFilter;

  let periods: { id: string; title: string; startDate: Date; endDate: Date }[] = [];
  let dojos: { id: string; name: string }[] = [];
  let selectedPeriodId: string | null = params.period || null;
  let members: {
    id: string;
    nia: string | null;
    fullName: string;
    birthPlace: string | null;
    birthDate: Date | null;
    gender: string | null;
    address: string | null;
    currentRank: string;
    birthCertificateUrl: string | null;
    bpjsCardUrl: string | null;
    dojoId: string;
    dojo: { name: string };
    user: { photoUrl: string | null } | null;
    _count: { billings: number; verifications: number };
  }[] = [];
  let registrations: {
    id: string;
    memberId: string;
    status: string;
    registeredRank: string | null;
    category: { name: string } | null;
  }[] = [];
  let billings: { registrationId: string | null; status: string; amount: number }[] = [];
  let invoiceAckSettings: { key: string; value: unknown }[] = [];

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [periodRows, dojoRows] = await Promise.all([
        tx.event.findMany({
          where: {
            ...eventFilter,
            isDeleted: false,
            title: { contains: "UKT", mode: "insensitive" },
          },
          orderBy: { startDate: "desc" },
          select: { id: true, title: true, startDate: true, endDate: true },
        }),
        tx.dojo.findMany({
          where: dojoWhere,
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      ]);

      const periodId = params.period || periodRows[0]?.id || null;

      const [regRows, memberRows, ackRows] = await Promise.all([
        periodId
          ? tx.eventRegistration.findMany({
              where: { eventId: periodId },
              select: {
                id: true,
                memberId: true,
                status: true,
                registeredRank: true,
                category: { select: { name: true } },
              },
            })
          : Promise.resolve([]),
        tx.member.findMany({
          where: buildMemberWhere(memberFilter, effectiveDojoFilter, q),
          include: {
            dojo: { select: { name: true } },
            user: { select: { photoUrl: true } },
            _count: {
              select: {
                billings: {
                  where: {
                    isDeleted: false,
                    status: { in: ["PENDING", "WAITING_VERIFICATION"] },
                  },
                },
                verifications: { where: { status: "PENDING" } },
              },
            },
          },
          orderBy: { fullName: "asc" },
        }),
        periodId
          ? tx.appSetting.findMany({
              where: { key: { startsWith: `ukt-invoice-ack:${periodId}:` } },
              select: { key: true, value: true },
            })
          : Promise.resolve([]),
      ]);

      const regIds = regRows.map((r) => r.id);
      const billingRows =
        regIds.length > 0
          ? await tx.billing.findMany({
              where: { registrationId: { in: regIds }, isDeleted: false },
              select: { registrationId: true, status: true, amount: true },
            })
          : [];

      return {
        periods: periodRows,
        dojos: dojoRows,
        selectedPeriodId: periodId,
        registrations: regRows,
        members: memberRows,
        billings: billingRows,
        invoiceAckSettings: ackRows,
      };
    });

    periods = result.periods;
    dojos = result.dojos;
    selectedPeriodId = result.selectedPeriodId;
    registrations = result.registrations;
    members = result.members;
    billings = result.billings;
    invoiceAckSettings = result.invoiceAckSettings;
  } catch (error) {
    console.error("[AdminUkt] DB error:", error);
    throw error;
  }

  const regMap = new Map(registrations.map((r) => [r.memberId, r]));
  const billingMap = new Map(
    billings.filter((b) => b.registrationId).map((b) => [b.registrationId!, b]),
  );

  let rows: UktMemberRow[] = members.map((m) => {
    const reg = regMap.get(m.id);
    const regBilling = reg ? billingMap.get(reg.id) : null;

    return {
      memberId: m.id,
      registrationId: reg?.id || null,
      photoUrl: m.user?.photoUrl || null,
      nia: m.nia,
      fullName: m.fullName,
      birthPlace: m.birthPlace,
      birthDate: m.birthDate?.toISOString() || null,
      gender: m.gender,
      address: m.address,
      kyuLama: reg?.registeredRank || m.currentRank,
      kyuBaru: reg?.category?.name || null,
      birthCertificateUrl: m.birthCertificateUrl,
      bpjsCardUrl: m.bpjsCardUrl,
      dojoName: m.dojo.name,
      dojoId: m.dojoId,
      status: reg?.status || "BELUM_DAFTAR",
      billingStatus: regBilling?.status || null,
      billingAmount: regBilling?.amount ?? null,
      outstandingDues: m._count.billings,
      pendingVerifications: m._count.verifications,
    };
  });

  if (statusFilter) {
    rows = rows.filter((r) => r.status === statusFilter);
  }
  rows = applyViewFilter(rows, viewFilter);

  const total = rows.length;
  const pagedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const invoiceAcks: Record<string, { acknowledged: boolean; at: string; by: string }> = {};
  for (const s of invoiceAckSettings) {
    const dojoId = s.key.split(":").pop()!;
    const val = s.value as { acknowledged?: boolean; at?: string; by?: string };
    invoiceAcks[dojoId] = {
      acknowledged: !!val.acknowledged,
      at: val.at || "",
      by: val.by || "",
    };
  }

  const canCreatePeriod = ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(
    primaryRole,
  );

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Ujian Kenaikan Tingkat (UKT)</h2>
        <p className="text-muted-foreground">
          {ROLE_LABELS[primaryRole] || primaryRole} — Kelola pendaftaran UKT anggota ranting
        </p>
      </div>

      <UktDashboard
        periods={periods.map((p) => ({
          id: p.id,
          title: p.title,
          startDate: p.startDate.toISOString(),
          endDate: p.endDate.toISOString(),
        }))}
        selectedPeriodId={selectedPeriodId}
        rows={pagedRows}
        dojos={dojos}
        total={total}
        page={page}
        pageSize={pageSize}
        q={q}
        statusFilter={statusFilter}
        dojoFilter={effectiveDojoFilter}
        viewFilter={viewFilter}
        userRoles={user.roles}
        primaryRole={primaryRole}
        semester={semester}
        year={year}
        invoiceAcks={invoiceAcks}
        canCreatePeriod={canCreatePeriod}
      />
    </>
  );
}

export default function AdminUktPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<InkaiLoadingScreen />}>
      <UktPageContent searchParams={searchParams} />
    </Suspense>
  );
}

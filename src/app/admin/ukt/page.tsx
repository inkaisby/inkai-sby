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
import { currentSemester } from "@/lib/ukt";
import { InkaiLoadingScreen } from "@/components/ui/InkaiLoadingScreen";

export const dynamic = "force-dynamic";

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

  const [periods, dojos] = await Promise.all([
    prisma.event.findMany({
      where: {
        ...eventFilter,
        isDeleted: false,
        title: { contains: "UKT", mode: "insensitive" },
      },
      orderBy: { startDate: "desc" },
      select: { id: true, title: true, startDate: true, endDate: true },
    }),
    prisma.dojo.findMany({
      where: dojoWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  let selectedPeriodId = params.period || periods[0]?.id || null;

  const [members, registrations, invoiceAckSettings] = await Promise.all([
    prisma.member.findMany({
      where: {
        ...memberFilter,
        ...(effectiveDojoFilter ? { dojoId: effectiveDojoFilter } : {}),
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { nia: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        dojo: true,
        user: { select: { photoUrl: true } },
        billings: {
          where: { isDeleted: false, status: { in: ["PENDING", "WAITING_VERIFICATION"] } },
          select: { id: true },
        },
        verifications: {
          where: { status: "PENDING" },
          select: { id: true },
        },
      },
      orderBy: { fullName: "asc" },
    }),
    selectedPeriodId
      ? prisma.eventRegistration.findMany({
          where: { eventId: selectedPeriodId },
          include: {
            category: true,
            member: {
              include: {
                dojo: true,
                user: { select: { photoUrl: true } },
                billings: {
                  where: { isDeleted: false },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    selectedPeriodId
      ? prisma.appSetting.findMany({
          where: { key: { startsWith: `ukt-invoice-ack:${selectedPeriodId}:` } },
        })
      : Promise.resolve([]),
  ]);

  const regMap = new Map(registrations.map((r) => [r.memberId, r]));

  let rows: UktMemberRow[] = members.map((m) => {
    const reg = regMap.get(m.id);
    const regBilling = reg
      ? registrations
          .find((r) => r.memberId === m.id)
          ?.member.billings.find((b) => b.registrationId === reg.id)
      : null;

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
      outstandingDues: m.billings.length,
      pendingVerifications: m.verifications.length,
    };
  });

  if (statusFilter) {
    rows = rows.filter((r) => r.status === statusFilter);
  }

  if (viewFilter === "registered") {
    rows = rows.filter((r) => r.registrationId);
  } else if (viewFilter === "unregistered") {
    rows = rows.filter((r) => !r.registrationId);
  } else if (viewFilter === "approved") {
    rows = rows.filter((r) => ["APPROVED", "PAID", "SUCCESS"].includes(r.status));
  } else if (viewFilter === "pending") {
    rows = rows.filter((r) => r.status === "PENDING");
  } else if (viewFilter === "rejected") {
    rows = rows.filter((r) => r.status === "REJECTED");
  } else if (viewFilter === "paid") {
    rows = rows.filter((r) => r.billingStatus === "PAID" || r.status === "PAID");
  }

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

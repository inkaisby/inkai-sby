import { auth } from "@/auth";
import { redirect } from "next/navigation";
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
import { beltFeesFromTemplates, DEFAULT_KOMISI_RANTING, UKT_KOMISI_SETTING_KEY } from "@/lib/ukt";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type SearchParams = Promise<{
  period?: string;
  semester?: string;
  year?: string;
}>;

async function UktPageContent({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const params = await searchParams;
  const semester = (params.semester === "II" ? "II" : "I") as UktSemester;
  const year = Math.min(2100, Math.max(2020, parseInt(params.year || String(new Date().getFullYear()), 10) || new Date().getFullYear()));

  const user = session.user;
  const primaryRole = getPrimaryAdminRole(user.roles);
  const memberFilter = buildMemberFilter(user);
  const dojoWhere = buildDojoFilter(user);
  const eventFilter = buildEventFilter(user);

  let dbError: string | null = null;
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
  let beltFees = beltFeesFromTemplates([]);
  let komisiRanting = DEFAULT_KOMISI_RANTING;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [periodRows, dojoRows, feeTemplates, komisiSetting] = await Promise.all([
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
        tx.rankFeeTemplate.findMany(),
        tx.appSetting.findUnique({ where: { key: UKT_KOMISI_SETTING_KEY } }),
      ]);

      const periodId = params.period || periodRows[0]?.id || null;

      const memberRows = await tx.member.findMany({
        where: memberFilter,
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
      });

      const regRows = periodId
        ? await tx.eventRegistration.findMany({
            where: { eventId: periodId },
            select: {
              id: true,
              memberId: true,
              status: true,
              registeredRank: true,
              category: { select: { name: true } },
            },
          })
        : [];

      const regIds = regRows.map((r) => r.id);
      const billingRows =
        regIds.length > 0
          ? await tx.billing.findMany({
              where: { registrationId: { in: regIds }, isDeleted: false },
              select: { registrationId: true, status: true, amount: true },
            })
          : [];

      const ackRows = periodId
        ? await tx.appSetting.findMany({
            where: { key: { startsWith: `ukt-invoice-ack:${periodId}:` } },
            select: { key: true, value: true },
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
        feeTemplates,
        komisiSetting,
      };
    });

    periods = result.periods;
    dojos = result.dojos;
    selectedPeriodId = result.selectedPeriodId;
    registrations = result.registrations;
    members = result.members;
    billings = result.billings;
    invoiceAckSettings = result.invoiceAckSettings;
    beltFees = beltFeesFromTemplates(result.feeTemplates);
    const komisiValue = result.komisiSetting?.value;
    komisiRanting =
      typeof komisiValue === "number" && Number.isFinite(komisiValue)
        ? Math.round(komisiValue)
        : DEFAULT_KOMISI_RANTING;
  } catch (error) {
    console.error("[AdminUkt] DB error:", error);
    const msg = error instanceof Error ? error.message : "";
    dbError =
      msg.includes("max clients") || msg.includes("pool") || msg.includes("connection")
        ? "Koneksi database sibuk. Tunggu beberapa detik lalu muat ulang."
        : "Gagal memuat data UKT. Silakan coba lagi.";
  }

  const regMap = new Map(registrations.map((r) => [r.memberId, r]));
  const billingMap = new Map(
    billings.filter((b) => b.registrationId).map((b) => [b.registrationId!, b]),
  );

  const allRows: UktMemberRow[] = members.map((m) => {
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

  const autoDojoId =
    primaryRole === "ADMIN_DOJO" && user.managedDojoId ? user.managedDojoId : "";

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
        allRows={allRows}
        dojos={dojos}
        userRoles={user.roles}
        primaryRole={primaryRole}
        semester={semester}
        year={year}
        invoiceAcks={invoiceAcks}
        canCreatePeriod={canCreatePeriod}
        dbError={dbError}
        defaultDojoFilter={autoDojoId}
        beltFees={beltFees}
        komisiRanting={komisiRanting}
      />
    </>
  );
}

export default function AdminUktPage({ searchParams }: { searchParams: SearchParams }) {
  return <UktPageContent searchParams={searchParams} />;
}

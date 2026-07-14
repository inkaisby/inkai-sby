import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  canAccessAdmin,
  getPrimaryAdminRole,
  ROLE_LABELS,
} from "@/lib/rbac";
import { UktDashboard } from "@/components/admin/ukt/UktDashboard";
import type { UktMemberRow, UktSemester } from "@/lib/ukt";
import type { AdminMemberRow } from "@/lib/inkai-api/admin-data";
import {
  beltFeesFromTemplates,
  DEFAULT_KOMISI_RANTING,
  UKT_KOMISI_SETTING_KEY,
} from "@/lib/ukt";
import {
  fetchAdminMembers,
  fetchEventDetail,
  fetchOrgStructure,
  fetchSettingsByPrefix,
  fetchUktKomisiRanting,
  fetchUktPeriods,
} from "@/lib/inkai-api/admin-data";
import { inkaiFetch } from "@/lib/inkai-api/server";

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
  if (!session.accessToken) redirect("/login");

  const params = await searchParams;
  const semester = (params.semester === "II" ? "II" : "I") as UktSemester;
  const year = Math.min(
    2100,
    Math.max(2020, parseInt(params.year || String(new Date().getFullYear()), 10) || new Date().getFullYear()),
  );

  const user = session.user;
  const token = session.accessToken;
  const primaryRole = getPrimaryAdminRole(user.roles);

  let dbError: string | null = null;
  let periods: { id: string; title: string; startDate: string; endDate: string }[] = [];
  let dojos: { id: string; name: string }[] = [];
  let selectedPeriodId: string | null = params.period || null;
  let allRows: UktMemberRow[] = [];
  let invoiceAcks: Record<string, { acknowledged: boolean; at: string; by: string }> = {};
  let beltFees = beltFeesFromTemplates([]);
  let komisiRanting = DEFAULT_KOMISI_RANTING;

  try {
    const [periodRows, org, membersResult, feesRes, komisi] = await Promise.all([
      fetchUktPeriods(token),
      fetchOrgStructure(token),
      fetchAdminMembers(token, { limit: 500, page: 1 }),
      inkaiFetch("/v1/events/rank-fee-templates", {}, token),
      fetchUktKomisiRanting(token, UKT_KOMISI_SETTING_KEY, DEFAULT_KOMISI_RANTING),
    ]);

    periods = periodRows.map((p) => ({
      id: String(p.id),
      title: String(p.title),
      startDate: String(p.startDate),
      endDate: String(p.endDate),
    }));

    dojos = org.dojos.map((d) => ({ id: String(d.id), name: String(d.name) }));
    selectedPeriodId = params.period || periods[0]?.id || null;
    komisiRanting = komisi;

    if (feesRes.res.ok) {
      const templates = (feesRes.data.data as Array<{ rankName: string; fee: number }>) ?? [];
      beltFees = beltFeesFromTemplates(templates);
    }

    const members = (membersResult.ok ? membersResult.members : []) as Array<
      AdminMemberRow & Record<string, unknown>
    >;
    const pendingBillings = await inkaiFetch("/v1/billing?status=PENDING&limit=500", {}, token);
    const waitingBillings = await inkaiFetch(
      "/v1/billing?status=WAITING_VERIFICATION&limit=500",
      {},
      token,
    );
    const pendingVerifications = await inkaiFetch("/v1/verifications/pending", {}, token);

    const billingCountByMember = new Map<string, number>();
    for (const list of [
      (pendingBillings.data.data as Array<Record<string, unknown>>) ?? [],
      (waitingBillings.data.data as Array<Record<string, unknown>>) ?? [],
    ]) {
      for (const b of list) {
        const memberId = String(b.memberId ?? "");
        if (memberId) billingCountByMember.set(memberId, (billingCountByMember.get(memberId) ?? 0) + 1);
      }
    }

    const verificationCountByMember = new Map<string, number>();
    for (const v of (pendingVerifications.data.data as Array<Record<string, unknown>>) ?? []) {
      const member = v.member as { id?: string } | undefined;
      const memberId = String(member?.id ?? "");
      if (memberId) verificationCountByMember.set(memberId, (verificationCountByMember.get(memberId) ?? 0) + 1);
    }

    const regMap = new Map<string, Record<string, unknown>>();
    const billingMap = new Map<string, Record<string, unknown>>();

    if (selectedPeriodId) {
      const eventDetail = await fetchEventDetail(token, selectedPeriodId);
      const registrations = (eventDetail?.registrations as Array<Record<string, unknown>>) ?? [];
      for (const reg of registrations) {
        regMap.set(String((reg.member as { id?: string })?.id ?? reg.memberId), reg);
        const member = reg.member as Record<string, unknown> | undefined;
        const billings = (member?.billings as Array<Record<string, unknown>>) ?? [];
        const billing = billings.find((b) => b.registrationId === reg.id) ?? billings[0];
        if (billing?.registrationId) billingMap.set(String(billing.registrationId), billing);
      }

      const ackSettings = await fetchSettingsByPrefix(token, `ukt-invoice-ack:${selectedPeriodId}:`);
      for (const s of ackSettings) {
        const dojoId = s.key.split(":").pop()!;
        const val = s.value as { acknowledged?: boolean; at?: string; by?: string };
        invoiceAcks[dojoId] = {
          acknowledged: !!val.acknowledged,
          at: val.at || "",
          by: val.by || "",
        };
      }
    }

    allRows = members.map((m) => {
      const reg = regMap.get(m.id);
      const regBilling = reg ? billingMap.get(String(reg.id)) : null;
      const category = reg?.category as { name?: string } | null | undefined;
      const memberUser = reg?.member as { user?: { photoUrl?: string } } | undefined;
      const memberData = (reg?.member as Record<string, unknown> | undefined) ?? m;

      return {
        memberId: m.id,
        registrationId: reg?.id ? String(reg.id) : null,
        photoUrl: memberUser?.user?.photoUrl ?? null,
        nia: m.nia,
        fullName: m.fullName,
        birthPlace: (memberData.birthPlace as string | null) ?? null,
        birthDate: memberData.birthDate ? String(memberData.birthDate) : null,
        gender: (memberData.gender as string | null) ?? null,
        address: (memberData.address as string | null) ?? null,
        kyuLama: String(reg?.registeredRank ?? m.currentRank),
        kyuBaru: category?.name ?? null,
        birthCertificateUrl: (memberData.birthCertificateUrl as string | null) ?? null,
        bpjsCardUrl: (memberData.bpjsCardUrl as string | null) ?? null,
        dojoName: m.dojo?.name ?? "—",
        dojoId: String((m as Record<string, unknown>).dojoId ?? ""),
        status: reg?.status ? String(reg.status) : "BELUM_DAFTAR",
        billingStatus: regBilling?.status ? String(regBilling.status) : null,
        billingAmount: regBilling?.amount != null ? Number(regBilling.amount) : null,
        outstandingDues: billingCountByMember.get(m.id) ?? 0,
        pendingVerifications: verificationCountByMember.get(m.id) ?? 0,
      };
    });
  } catch (error) {
    console.error("[AdminUkt] API error:", error);
    dbError = "Gagal memuat data UKT dari API. Silakan coba lagi.";
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
        periods={periods}
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

import { Suspense } from "react";
import { requireAdminSession } from "@/lib/admin-session";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { canManageIuranByWilayah } from "@/lib/wilayah-rbac";
import {
  getManagedDojoIdsFromUser,
  resolveActiveDojoId,
} from "@/lib/managed-dojos";
import { fetchAdminDojosScopedCached } from "@/lib/inkai-api/admin-data";
import { getOperationalDefaults } from "@/lib/org-settings";
import {
  getIuranMemberLedgerIndex,
  monthStatusLabel,
  parsePeriod,
} from "@/lib/iuran-ledger";
import {
  parsePage,
  parsePageSize,
} from "@/components/admin/pengaturan/SettingsTableToolbar";
import { DojoContextSwitcher } from "@/components/admin/DojoContextSwitcher";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Input } from "@/components/ui/input";
import { IuranOpsBar } from "./IuranOpsBar";
import { IuranLedgerClient } from "./IuranLedgerClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

type SearchParams = Promise<{
  q?: string;
  month?: string;
  dojoId?: string;
  filter?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
  sortDir?: string;
  memberId?: string;
  tab?: string;
}>;

function formatRp(n: number) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

export default function AdminIuranPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageLoader rows={6} />}>
      <AdminIuranContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminIuranContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user } = await requireAdminSession();
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const filter = params.filter?.trim() || "all";
  const sortRaw = params.sort?.trim() || "name";
  const sort =
    sortRaw === "arrears" || sortRaw === "status" || sortRaw === "name"
      ? sortRaw
      : "name";
  const sortDir = params.sortDir === "desc" ? "desc" : "asc";
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize, PAGE_SIZE_OPTIONS, 25);
  const period = parsePeriod(params.month);
  const canEdit = canManageIuranByWilayah(user.roles ?? []);
  const role = getPrimaryAdminRole(user.roles ?? []);
  const isDojoAdmin = role === "ADMIN_DOJO";
  const allowlist = getManagedDojoIdsFromUser(user);
  const resolved = resolveActiveDojoId(user, params.dojoId);
  const activeDojoId =
    resolved.ok && isDojoAdmin
      ? resolved.activeDojoId
      : params.dojoId?.trim() || "";
  const dojoId = isDojoAdmin
    ? activeDojoId || ""
    : params.dojoId?.trim() || "";

  const [defaults, dojos, ledger] = await Promise.all([
    getOperationalDefaults(),
    fetchAdminDojosScopedCached(user),
    getIuranMemberLedgerIndex(user, period, {
      q,
      dojoId: dojoId || undefined,
      filter,
      page,
      pageSize,
      sort,
      sortDir,
    }),
  ]);

  const switcherDojos = isDojoAdmin
    ? dojos.filter((d) => allowlist.includes(d.id))
    : dojos;

  const exportRows = ledger.exportRows.map((r) => ({
    fullName: r.fullName,
    nia: r.nia ?? "",
    dojo: r.dojoName,
    monthlyDues: r.monthlyDuesAmount,
    monthStatus: monthStatusLabel(r.monthStatus),
    arrears: r.arrearsAmount,
    aging: r.aging === "none" ? "" : r.aging,
    exemption: r.allowEventWithoutDues
      ? "Ya — tidak wajib lunas iuran untuk daftar event/UKT atau lainnya"
      : "Tidak",
  }));

  const baseParams: Record<string, string> = {
    ...(q ? { q } : {}),
    month: period.key,
    ...(filter !== "all" ? { filter } : {}),
    ...(dojoId ? { dojoId } : {}),
    ...(sort !== "name" ? { sort } : {}),
    ...(sortDir !== "asc" ? { sortDir } : {}),
    ...(params.memberId ? { memberId: params.memberId } : {}),
    ...(params.tab ? { tab: params.tab } : {}),
  };

  const { kpis } = ledger;

  return (
    <>
      <AdminPageHeader
        title="Iuran Anggota"
        description={
          <>
            Rekening koran iuran per anggota · Periode {period.key}
            <br />
            {canEdit ? (
              <span>
                Klik nama anggota untuk pengaturan, mutasi, dan pembayaran.
              </span>
            ) : (
              <span>Mode lihat saja — kelola iuran oleh ranting/cabang.</span>
            )}
          </>
        }
        actions={
          switcherDojos.length > 1 ? (
            <DojoContextSwitcher
              dojos={switcherDojos.map((d) => ({ id: d.id, name: d.name }))}
              value={dojoId}
              label="Ranting"
            />
          ) : null
        }
      />

      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <KpiChip label="Tunggakan" value={formatRp(kpis.arrearsAmount)} />
        <KpiChip label="Belum bayar" value={String(kpis.pendingCount)} />
        <KpiChip label="Menunggu verifikasi" value={String(kpis.waitingCount)} />
        <KpiChip
          label={`Lunas ${period.key}`}
          value={`${formatRp(kpis.paidMonthAmount)} (${kpis.paidMonthCount})`}
        />
        <KpiChip label="Pengecualian" value={String(kpis.exemptCount)} />
        <KpiChip label="Belum digenerate" value={String(kpis.noBillCount)} />
      </div>

      <IuranOpsBar
        canEdit={canEdit}
        defaultAmount={defaults.monthlyDuesAmount}
        exportMode="members"
        memberExportRows={exportRows}
      />

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <Input
          name="q"
          placeholder="Cari nama / NIA..."
          defaultValue={q}
          className="h-10 w-full sm:h-8 sm:max-w-xs sm:w-auto"
        />
        <Input
          name="month"
          type="month"
          defaultValue={period.key}
          className="h-10 w-full sm:h-8 sm:max-w-[160px] sm:w-auto"
          title="Periode status bulan"
        />
        {!isDojoAdmin || switcherDojos.length > 1 ? (
          <select
            name="dojoId"
            defaultValue={dojoId}
            className="h-10 w-full rounded-lg border px-2 text-sm sm:h-8 sm:w-auto"
          >
            <option value="">Semua ranting</option>
            {switcherDojos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        ) : null}
        <select
          name="filter"
          defaultValue={filter}
          className="h-10 w-full rounded-lg border px-2 text-sm sm:h-8 sm:w-auto"
        >
          <option value="all">Semua anggota</option>
          <option value="arrears">Ada tunggakan</option>
          <option value="waiting">Menunggu verifikasi</option>
          <option value="paid">Lunas bulan ini</option>
          <option value="nobill">Belum digenerate</option>
          <option value="exempt">Pengecualian</option>
        </select>
        <select
          name="sort"
          defaultValue={sort}
          className="h-10 w-full rounded-lg border px-2 text-sm sm:h-8 sm:w-auto"
        >
          <option value="name">Urut nama</option>
          <option value="arrears">Urut tunggakan</option>
          <option value="status">Urut status</option>
        </select>
        <select
          name="sortDir"
          defaultValue={sortDir}
          className="h-10 w-full rounded-lg border px-2 text-sm sm:h-8 sm:w-auto"
        >
          <option value="asc">Naik</option>
          <option value="desc">Turun</option>
        </select>
        <input type="hidden" name="pageSize" value={String(pageSize)} />
        <button
          type="submit"
          className="h-10 rounded-lg bg-inkai-red px-4 text-sm text-white sm:h-8 sm:py-1.5"
        >
          Filter
        </button>
      </form>

      <IuranLedgerClient
        rows={ledger.rows}
        total={ledger.total}
        page={page}
        pageSize={pageSize}
        canEdit={canEdit}
        defaultDuesAmount={defaults.monthlyDuesAmount}
        waitingQueue={ledger.waitingQueue}
        baseParams={baseParams}
        periodKey={period.key}
        initialMemberId={params.memberId?.trim() || undefined}
        initialTab={params.tab?.trim() || undefined}
      />
    </>
  );
}

function KpiChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[132px] shrink-0 rounded-xl border bg-background px-3 py-2 sm:min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

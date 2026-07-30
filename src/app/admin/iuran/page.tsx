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
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { IuranBrowser } from "./IuranBrowser";

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

  return (
    <IuranBrowser
      canEdit={canEdit}
      isDojoAdmin={isDojoAdmin}
      switcherDojos={switcherDojos.map((d) => ({ id: d.id, name: d.name }))}
      initialFilters={{
        q,
        month: period.key,
        dojoId,
        filter,
        sort,
        sortDir,
        page,
        pageSize,
      }}
      initialRows={ledger.rows}
      initialTotal={ledger.total}
      initialKpis={ledger.kpis}
      initialWaitingQueue={ledger.waitingQueue}
      initialDefaultDuesAmount={defaults.monthlyDuesAmount}
      initialExportRows={exportRows}
      initialMemberId={params.memberId?.trim() || undefined}
      initialTab={params.tab?.trim() || undefined}
    />
  );
}

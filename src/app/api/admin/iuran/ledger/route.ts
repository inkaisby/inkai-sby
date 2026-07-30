import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getPrimaryAdminRole } from "@/lib/rbac";
import {
  getManagedDojoIdsFromUser,
  resolveActiveDojoId,
} from "@/lib/managed-dojos";
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

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { user } = authResult;
  const sp = new URL(request.url).searchParams;
  const q = sp.get("q")?.trim() || "";
  const filter = sp.get("filter")?.trim() || "all";
  const sortRaw = sp.get("sort")?.trim() || "name";
  const sort =
    sortRaw === "arrears" || sortRaw === "status" || sortRaw === "name"
      ? sortRaw
      : "name";
  const sortDir = sp.get("sortDir") === "desc" ? "desc" : "asc";
  const page = parsePage(sp.get("page") ?? undefined);
  const pageSize = parsePageSize(
    sp.get("pageSize") ?? undefined,
    PAGE_SIZE_OPTIONS,
    25,
  );
  const period = parsePeriod(sp.get("month"));

  const role = getPrimaryAdminRole(user.roles ?? []);
  const isDojoAdmin = role === "ADMIN_DOJO";
  const resolved = resolveActiveDojoId(user, sp.get("dojoId"));
  const activeDojoId =
    resolved.ok && isDojoAdmin
      ? resolved.activeDojoId
      : sp.get("dojoId")?.trim() || "";
  const dojoId = isDojoAdmin
    ? activeDojoId || ""
    : sp.get("dojoId")?.trim() || "";

  const [defaults, ledger] = await Promise.all([
    getOperationalDefaults(),
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

  return NextResponse.json({
    rows: ledger.rows,
    total: ledger.total,
    page,
    pageSize,
    periodKey: period.key,
    kpis: ledger.kpis,
    waitingQueue: ledger.waitingQueue,
    defaultDuesAmount: defaults.monthlyDuesAmount,
    exportRows,
    dojoId,
  });
}

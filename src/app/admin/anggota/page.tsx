import { Suspense } from "react";
import Link from "next/link";
import { Users, Clock, UserCheck, UserX, FileWarning, IdCard } from "lucide-react";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import {
  canAccessAdmin,
  getPrimaryAdminRole,
  ROLE_LABELS,
} from "@/lib/rbac";
import {
  fetchAdminDojos,
  fetchAdminMembers,
} from "@/lib/inkai-api/admin-data";
import { isDocumentComplete } from "@/lib/memberCompleteness";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  SettingsPagination,
  parsePage,
  parsePageSize,
} from "@/components/admin/pengaturan/SettingsTableToolbar";
import { MembersTable } from "./MembersTable";
import { AnggotaAddButton } from "./AnggotaAddButton";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 1000];

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "PENDING", label: "Menunggu" },
  { value: "Active", label: "Aktif" },
  { value: "REJECTED", label: "Ditolak" },
] as const;

type SearchParams = Promise<{
  q?: string;
  status?: string;
  dojoId?: string;
  docs?: string;
  nia?: string;
  page?: string;
  pageSize?: string;
}>;

function buildHref(params: Record<string, string>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : "?";
}

export default function AdminAnggotaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageLoader rows={6} />}>
      <AdminAnggotaContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminAnggotaContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const status = params.status?.trim() || "";
  const docs = params.docs === "incomplete" ? "incomplete" : "";
  const niaFilter = params.nia === "missing" ? "missing" : "";
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize, PAGE_SIZE_OPTIONS, 25);

  const primaryRole = getPrimaryAdminRole(session.user.roles);
  const lockedDojoId =
    primaryRole === "ADMIN_DOJO" && session.user.managedDojoId
      ? session.user.managedDojoId
      : "";
  const dojoId = lockedDojoId || params.dojoId?.trim() || "";

  const [result, dojos, pendingCount, activeCount, rejectedCount, allCount] =
    await Promise.all([
      fetchAdminMembers(token, {
        page,
        limit: pageSize,
        search: q || undefined,
        status: status || undefined,
        dojoId: dojoId || undefined,
      }),
      lockedDojoId ? Promise.resolve([]) : fetchAdminDojos(token),
      fetchAdminMembers(token, {
        page: 1,
        limit: 1,
        status: "PENDING",
        dojoId: dojoId || undefined,
      }),
      fetchAdminMembers(token, {
        page: 1,
        limit: 1,
        status: "Active",
        dojoId: dojoId || undefined,
      }),
      fetchAdminMembers(token, {
        page: 1,
        limit: 1,
        status: "REJECTED",
        dojoId: dojoId || undefined,
      }),
      fetchAdminMembers(token, {
        page: 1,
        limit: 1,
        dojoId: dojoId || undefined,
      }),
    ]);

  let members = result.ok ? result.members : [];
  if (docs === "incomplete") {
    members = members.filter((m) => !isDocumentComplete(m));
  }
  if (niaFilter === "missing") {
    members = members.filter((m) => !m.nia?.trim());
  }

  const total = result.ok ? result.total : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const kpiBase = {
    q,
    dojoId: lockedDojoId ? "" : dojoId,
    docs,
    nia: niaFilter,
    pageSize: String(pageSize),
  };

  const hasFilters = Boolean(
    q || status || (!lockedDojoId && dojoId) || docs || niaFilter,
  );

  const kpis = [
    {
      key: "all",
      label: "Total",
      value: allCount.ok ? allCount.total : total,
      icon: Users,
      href: buildHref({ ...kpiBase, status: "", docs: "", nia: "" }),
      active: !status && !docs && !niaFilter,
    },
    {
      key: "pending",
      label: "Menunggu",
      value: pendingCount.ok ? pendingCount.total : 0,
      icon: Clock,
      href: buildHref({ ...kpiBase, status: "PENDING", docs: "", nia: "" }),
      active: status === "PENDING",
      accent: "text-amber-600",
    },
    {
      key: "active",
      label: "Aktif",
      value: activeCount.ok ? activeCount.total : 0,
      icon: UserCheck,
      href: buildHref({ ...kpiBase, status: "Active", docs: "", nia: "" }),
      active: status === "Active" && !niaFilter,
      accent: "text-emerald-600",
    },
    {
      key: "rejected",
      label: "Ditolak",
      value: rejectedCount.ok ? rejectedCount.total : 0,
      icon: UserX,
      href: buildHref({ ...kpiBase, status: "REJECTED", docs: "", nia: "" }),
      active: status === "REJECTED",
      accent: "text-destructive",
    },
    {
      key: "docs",
      label: "Dok. kurang",
      value: "—",
      icon: FileWarning,
      href: buildHref({
        ...kpiBase,
        status,
        nia: "",
        docs: docs === "incomplete" ? "" : "incomplete",
      }),
      active: docs === "incomplete",
      accent: "text-orange-600",
      hint: "Filter halaman",
    },
    {
      key: "nia",
      label: "Tanpa NIA",
      value: "—",
      icon: IdCard,
      href: buildHref({
        ...kpiBase,
        docs: "",
        nia: niaFilter === "missing" ? "" : "missing",
      }),
      active: niaFilter === "missing",
      accent: "text-amber-700",
      hint: "Filter halaman",
    },
  ] as const;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Kelola Anggota</h2>
          <p className="text-muted-foreground">
            {ROLE_LABELS[primaryRole] || primaryRole} — {total} anggota
            {dojoId && dojos.length
              ? ` · ${dojos.find((d) => d.id === dojoId)?.name || "Dojo"}`
              : ""}
          </p>
          {!result.ok && (
            <p className="mt-2 text-sm text-destructive">
              Gagal memuat data anggota dari API.
            </p>
          )}
        </div>
        <AnggotaAddButton
          dojos={dojos.map((d) => ({ id: d.id, name: d.name }))}
          defaultDojoId={lockedDojoId || dojoId || ""}
          lockDojo={Boolean(lockedDojoId)}
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link key={kpi.key} href={kpi.href} className="block">
              <Card
                className={`transition-all hover:shadow-md hover:ring-1 hover:ring-inkai-red/30 ${
                  kpi.active ? "ring-2 ring-inkai-red" : ""
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <Icon
                      className={`h-4 w-4 ${"accent" in kpi && kpi.accent ? kpi.accent : "text-inkai-red"}`}
                    />
                    <span className="text-lg font-bold tabular-nums">
                      {kpi.value}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {kpi.label}
                    {"hint" in kpi && kpi.hint ? (
                      <span className="block opacity-70">{kpi.hint}</span>
                    ) : null}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="pageSize" value={String(pageSize)} />
        {lockedDojoId ? (
          <input type="hidden" name="dojoId" value={lockedDojoId} />
        ) : null}

        <div className="min-w-[180px] flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Pencarian</label>
          <Input
            name="q"
            placeholder="Cari nama / NIA..."
            defaultValue={q}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <select
            name="status"
            defaultValue={status}
            className="h-8 min-w-[140px] rounded-lg border px-2 text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {!lockedDojoId ? (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Dojo / Ranting</label>
            <select
              name="dojoId"
              defaultValue={dojoId}
              className="h-8 min-w-[160px] rounded-lg border px-2 text-sm"
            >
              <option value="">Semua dojo</option>
              {dojos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Dokumen</label>
          <select
            name="docs"
            defaultValue={docs}
            className="h-8 min-w-[160px] rounded-lg border px-2 text-sm"
          >
            <option value="">Semua dokumen</option>
            <option value="incomplete">Belum lengkap</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">NIA</label>
          <select
            name="nia"
            defaultValue={niaFilter}
            className="h-8 min-w-[140px] rounded-lg border px-2 text-sm"
          >
            <option value="">Semua NIA</option>
            <option value="missing">Belum ada NIA</option>
          </select>
        </div>

        <button
          type="submit"
          className="h-8 rounded-lg bg-inkai-red px-4 text-sm text-white"
        >
          Filter
        </button>

        {hasFilters ? (
          <Link
            href={buildHref({ pageSize: String(pageSize) })}
            className="inline-flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
          >
            Reset
          </Link>
        ) : null}
      </form>

      {docs === "incomplete" || niaFilter === "missing" ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Filter tambahan diterapkan pada data halaman ini ({members.length}{" "}
          ditampilkan).
        </p>
      ) : null}

      <MembersTable members={members} userRoles={session.user.roles} />

      <SettingsPagination
        page={safePage}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        baseParams={{
          q,
          status,
          dojoId: lockedDojoId ? "" : dojoId,
          docs,
          nia: niaFilter,
        }}
      />
    </>
  );
}

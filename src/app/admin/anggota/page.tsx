import { Suspense } from "react";
import Link from "next/link";
import {
  Users,
  Clock,
  UserCheck,
  UserX,
  FileWarning,
  IdCard,
  UserMinus,
  Archive,
} from "lucide-react";
import { requireAdminSession } from "@/lib/admin-session";
import {
  getPrimaryAdminRole,
  ROLE_LABELS,
} from "@/lib/rbac";
import {
  fetchAdminDojos,
  fetchAdminMembers,
  fetchAdminMembersForDojoIds,
  fetchAdminMemberStatusCounts,
} from "@/lib/inkai-api/admin-data";
import {
  getManagedDojoIdsFromUser,
  resolveActiveDojoId,
} from "@/lib/managed-dojos";
import { prisma } from "@/lib/prisma";
import { isDocumentComplete } from "@/lib/memberCompleteness";
import {
  getMemberLifecycles,
  monthsSince,
} from "@/lib/member-lifecycle";
import { Card, CardContent } from "@/components/ui/card";
import {
  SettingsPagination,
  parsePage,
  parsePageSize,
} from "@/components/admin/pengaturan/SettingsTableToolbar";
import { DojoContextSwitcher } from "@/components/admin/DojoContextSwitcher";
import { MembersTable } from "./MembersTable";
import { AnggotaAddButton } from "./AnggotaAddButton";
import { AnggotaFiltersForm } from "./AnggotaFiltersForm";
import { NormalizeMembersButton } from "./NormalizeMembersButton";
import { ArchivedMembersPanel } from "./ArchivedMembersPanel";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { canEditKyuBaru } from "@/lib/belt";
import { canSoftDeleteMembers } from "@/lib/wilayah-rbac";
import type { AdminMemberRow } from "@/lib/inkai-api/admin-data";

/** Contoh: 19 Juli 2026 14:10 — untuk kolom Terdaftar di export CSV. */
function formatExportDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const date = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} ${time}`;
}

function anggotaExportRows(members: AdminMemberRow[]) {
  return members.map((m) => [
    m.nia ?? "",
    m.fullName,
    m.status,
    m.currentRank,
    m.dojo?.name ?? "",
    m.dojo?.branch?.name ?? "",
    formatExportDateTime(m.createdAt),
    m.birthCertificateUrl ? "Ada" : "Belum",
    m.bpjsCardUrl ? "Ada" : "Belum",
  ]);
}

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 1000];

type SearchParams = Promise<{
  q?: string;
  status?: string;
  dojoId?: string;
  docs?: string;
  nia?: string;
  inactiveMonths?: string;
  view?: string;
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
  const { session, token, user } = await requireAdminSession();

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const status = params.status?.trim() || "";
  const docs = params.docs === "incomplete" ? "incomplete" : "";
  const niaFilter = params.nia === "missing" ? "missing" : "";
  const view = params.view === "archive" ? "archive" : "";
  const inactiveMonthsRaw = Number(params.inactiveMonths || 0);
  const inactiveMonths =
    inactiveMonthsRaw === 3 ||
    inactiveMonthsRaw === 6 ||
    inactiveMonthsRaw === 12
      ? inactiveMonthsRaw
      : 0;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize, PAGE_SIZE_OPTIONS, 25);

  const primaryRole = getPrimaryAdminRole(user.roles);
  const isDojoAdmin = primaryRole === "ADMIN_DOJO";
  const allowlist = getManagedDojoIdsFromUser(user);
  const resolved = resolveActiveDojoId(user, params.dojoId);
  const activeDojoId =
    resolved.ok && isDojoAdmin
      ? resolved.activeDojoId
      : params.dojoId?.trim() || "";
  /** Filter query ke API/Prisma (kosong = semua dalam allowlist untuk multi-dojo). */
  const dojoId = isDojoAdmin
    ? activeDojoId || ""
    : params.dojoId?.trim() || "";
  const singleLockedDojo =
    isDojoAdmin && allowlist.length === 1 ? allowlist[0] : "";
  const canArchive = canSoftDeleteMembers(user.roles ?? []);

  const managedDojoOptions =
    isDojoAdmin && allowlist.length > 0
      ? await prisma.dojo.findMany({
          where: { id: { in: allowlist }, isDeleted: false },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  if (view === "archive") {
    return (
      <>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Arsip Anggota</h2>
            <p className="text-muted-foreground">
              Soft-delete — pulihkan ke status Nonaktif bila perlu.
            </p>
          </div>
          <Link
            href="/admin/anggota"
            className="inline-flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
          >
            Kembali ke daftar
          </Link>
        </div>
        <ArchivedMembersPanel
          userRoles={user.roles}
          defaultDojoId={singleLockedDojo || dojoId}
        />
      </>
    );
  }

  const memberFetchOpts = {
    page,
    limit: pageSize,
    search: q || undefined,
    status: status || undefined,
  };

  const scopedDojoIds = isDojoAdmin
    ? dojoId
      ? [dojoId]
      : allowlist
    : dojoId
      ? [dojoId]
      : [];

  const [result, dojos, statusCounts] = await Promise.all([
      isDojoAdmin
        ? fetchAdminMembersForDojoIds(token, scopedDojoIds, memberFetchOpts)
        : fetchAdminMembers(token, {
            ...memberFetchOpts,
            dojoId: dojoId || undefined,
          }),
      isDojoAdmin
        ? Promise.resolve(
            managedDojoOptions.map((d) => ({
              id: d.id,
              name: d.name,
              branchId: "",
            })),
          )
        : fetchAdminDojos(token),
      fetchAdminMemberStatusCounts(
        isDojoAdmin
          ? { dojoIds: scopedDojoIds }
          : { dojoId: dojoId || undefined },
      ),
    ]);

  const pendingCount = { ok: true as const, total: statusCounts.pending };
  const activeCount = { ok: true as const, total: statusCounts.active };
  const inactiveCount = { ok: true as const, total: statusCounts.inactive };
  const rejectedCount = { ok: true as const, total: statusCounts.rejected };
  const allCount = { ok: true as const, total: statusCounts.all };

  let members = result.ok ? result.members : [];
  if (docs === "incomplete") {
    members = members.filter((m) => !isDocumentComplete(m));
  }
  if (niaFilter === "missing") {
    members = members.filter((m) => !m.nia?.trim());
  }
  if (inactiveMonths > 0) {
    const lifecycles = await getMemberLifecycles(members.map((m) => m.id));
    members = members.filter((m) => {
      const st = m.status.trim().toUpperCase();
      if (st !== "INACTIVE" && st !== "SUSPENDED") return false;
      const meta = lifecycles.get(m.id);
      const months = monthsSince(meta?.changedAt);
      return months != null && months >= inactiveMonths;
    });
  }

  const total = result.ok ? result.total : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const kpiBase = {
    q,
    dojoId: singleLockedDojo ? "" : dojoId,
    docs,
    nia: niaFilter,
    pageSize: String(pageSize),
  };

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
      key: "inactive",
      label: "Nonaktif",
      value: inactiveCount.ok ? inactiveCount.total : 0,
      icon: UserMinus,
      href: buildHref({ ...kpiBase, status: "INACTIVE", docs: "", nia: "" }),
      active: status === "INACTIVE",
      accent: "text-slate-600",
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Kelola Anggota</h2>
          <p className="text-muted-foreground">
            {ROLE_LABELS[primaryRole] || primaryRole} — {total} anggota
            {allowlist.length > 1 && !dojoId
              ? ` · ${allowlist.length} ranting`
              : dojoId
                ? ` · ${
                    managedDojoOptions.find((d) => d.id === dojoId)?.name ||
                    dojos.find((d) => d.id === dojoId)?.name ||
                    "Dojo"
                  }`
                : ""}
          </p>
          {!result.ok && (
            <p className="mt-2 text-sm text-destructive">
              Gagal memuat data anggota dari API.
            </p>
          )}
        </div>
        {isDojoAdmin && managedDojoOptions.length > 1 ? (
          <DojoContextSwitcher
            dojos={managedDojoOptions}
            value={dojoId}
            label="Kelola ranting"
          />
        ) : null}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <AnggotaAddButton
          dojos={
            isDojoAdmin
              ? managedDojoOptions
              : dojos.map((d) => ({ id: d.id, name: d.name }))
          }
          defaultDojoId={singleLockedDojo || dojoId || ""}
          lockDojo={Boolean(singleLockedDojo)}
        />
        {canEditKyuBaru(user.roles ?? []) ? (
          <NormalizeMembersButton />
        ) : null}
        {canArchive ? (
          <Link
            href="/admin/anggota?view=archive"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-muted"
          >
            <Archive className="h-3.5 w-3.5" />
            Lihat arsip
          </Link>
        ) : null}
        <ExportCsvButton
          filename="anggota-export.csv"
          headers={[
            "NIA",
            "Nama",
            "Status",
            "Sabuk",
            "Dojo",
            "Cabang",
            "Terdaftar",
            "Dokumen Akte",
            "Dokumen BPJS",
          ]}
          rows={anggotaExportRows(members)}
        />
      </div>

      <AnggotaFiltersForm
        q={q}
        status={status}
        dojoId={singleLockedDojo ? "" : dojoId}
        docs={docs}
        nia={niaFilter}
        inactiveMonths={inactiveMonths ? String(inactiveMonths) : ""}
        pageSize={String(pageSize)}
        dojos={dojos.map((d) => ({ id: d.id, name: d.name }))}
        showDojoFilter={!singleLockedDojo && !isDojoAdmin}
        lockDojoId={
          singleLockedDojo ||
          (isDojoAdmin && allowlist.length > 1 ? dojoId : "")
        }
      />

      {docs === "incomplete" ||
      niaFilter === "missing" ||
      inactiveMonths > 0 ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Filter tambahan diterapkan pada data halaman ini ({members.length}{" "}
          ditampilkan).
          {inactiveMonths > 0
            ? ` Nonaktif/ditangguhkan ≥ ${inactiveMonths} bulan.`
            : ""}
        </p>
      ) : null}

      <MembersTable members={members} userRoles={user.roles} />

      <SettingsPagination
        page={safePage}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        baseParams={{
          q,
          status,
          dojoId: singleLockedDojo ? "" : dojoId,
          docs,
          nia: niaFilter,
          inactiveMonths: inactiveMonths ? String(inactiveMonths) : "",
        }}
      />
    </>
  );
}

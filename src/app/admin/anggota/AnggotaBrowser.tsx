"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive } from "lucide-react";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import {
  SettingsPagination,
} from "@/components/admin/pengaturan/SettingsTableToolbar";
import type { AdminMemberRow } from "@/lib/inkai-api/admin-data";
import type { MemberStatusCounts } from "@/lib/inkai-api/admin-data";
import { AnggotaAddButton } from "./AnggotaAddButton";
import { AnggotaFiltersForm } from "./AnggotaFiltersForm";
import {
  AnggotaKpiCards,
  type AnggotaKpiIconName,
  type AnggotaKpiItem,
} from "./AnggotaKpiCards";
import { MembersTable } from "./MembersTable";
import { NormalizeMembersButton } from "./NormalizeMembersButton";
import type { MemberSortKey, SortDir } from "@/lib/table-sort";
import { parseMemberSortKey, parseSortDir, toggleSortKey } from "@/lib/table-sort";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DojoContextSwitcher } from "@/components/admin/DojoContextSwitcher";
import type { ActiveRegistrationPeriod } from "@/lib/active-registration-periods";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

type DojoOption = { id: string; name: string };

type FilterState = {
  q: string;
  status: string;
  dojoId: string;
  docs: string;
  nia: string;
  account: string;
  dup: string;
  inactiveMonths: string;
  page: number;
  pageSize: number;
  sort: MemberSortKey;
  sortDir: SortDir;
};

function buildHref(params: Record<string, string>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : "?";
}

function filtersToParams(f: FilterState): Record<string, string> {
  return {
    q: f.q,
    status: f.status,
    dojoId: f.dojoId,
    docs: f.docs,
    nia: f.nia,
    account: f.account,
    dup: f.dup,
    inactiveMonths: f.inactiveMonths,
    page: f.page > 1 ? String(f.page) : "",
    pageSize: f.pageSize !== 25 ? String(f.pageSize) : "",
    sort: f.sort !== "fullName" ? f.sort : "",
    sortDir: f.sortDir === "desc" ? "desc" : "",
  };
}

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
    m.mshNumber ?? "",
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

function parseHrefToFilters(
  href: string,
  pageSizeFallback: number,
): Partial<FilterState> {
  const raw = href.startsWith("?") ? href.slice(1) : href;
  const qs = new URLSearchParams(raw);
  const pageSizeRaw = Number(qs.get("pageSize") || pageSizeFallback);
  return {
    q: qs.get("q")?.trim() || "",
    status: qs.get("status")?.trim() || "",
    dojoId: qs.get("dojoId")?.trim() || "",
    docs: qs.get("docs") === "incomplete" ? "incomplete" : "",
    nia: qs.get("nia") === "missing" ? "missing" : "",
    account: qs.get("account") === "missing" ? "missing" : "",
    dup: qs.get("dup") === "nia_nik" ? "nia_nik" : "",
    inactiveMonths: ["3", "6", "12"].includes(qs.get("inactiveMonths") || "")
      ? qs.get("inactiveMonths")!
      : "",
    page: Math.max(1, Number(qs.get("page") || 1) || 1),
    pageSize: PAGE_SIZE_OPTIONS.includes(pageSizeRaw) ? pageSizeRaw : 25,
    sort: parseMemberSortKey(qs.get("sort")),
    sortDir: parseSortDir(qs.get("sortDir")),
  };
}

export function AnggotaBrowser({
  roleLabel,
  scopeHint,
  initialMembers,
  initialTotal,
  initialStatusCounts,
  initialFilters,
  dojos,
  userRoles,
  showDojoFilter,
  lockDojoId,
  singleLockedDojo,
  canArchive,
  canNormalize,
  defaultDojoId,
  isDojoAdmin,
  hasError,
  activeUkt = null,
  activeLatber = null,
  canQuickReg = false,
}: {
  roleLabel?: string;
  scopeHint?: string;
  initialMembers: AdminMemberRow[];
  initialTotal: number;
  initialStatusCounts: MemberStatusCounts;
  initialFilters: FilterState;
  dojos: DojoOption[];
  userRoles: string[];
  showDojoFilter: boolean;
  lockDojoId: string;
  singleLockedDojo: string;
  canArchive: boolean;
  canNormalize: boolean;
  defaultDojoId: string;
  isDojoAdmin?: boolean;
  hasError?: boolean;
  activeUkt?: ActiveRegistrationPeriod;
  activeLatber?: ActiveRegistrationPeriod;
  canQuickReg?: boolean;
}) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [members, setMembers] = useState(initialMembers);
  const [total, setTotal] = useState(initialTotal);
  const [statusCounts, setStatusCounts] = useState(initialStatusCounts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(hasError ? "Gagal memuat data anggota." : null);
  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);
  const prevDojoIdRef = useRef(initialFilters.dojoId);

  const syncUrl = useCallback((next: FilterState) => {
    const href = buildHref(filtersToParams(next));
    const path = `${window.location.pathname}${href === "?" ? "" : href}`;
    window.history.replaceState(null, "", path);
  }, []);

  const load = useCallback(async (next: FilterState, forceCounts = false) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    const params = filtersToParams(next);
    for (const [k, v] of Object.entries(params)) {
      if (v) qs.set(k, v);
    }
    
    // counts=1 hanya jika dojoId berubah atau dipaksa (setelah tambah/edit anggota)
    const dojoChanged = next.dojoId !== prevDojoIdRef.current;
    prevDojoIdRef.current = next.dojoId;
    if (dojoChanged || forceCounts) {
      qs.set("counts", "1");
    } else {
      qs.set("counts", "0");
    }

    try {
      const res = await fetch(`/api/admin/members?${qs}`, {
        signal: ac.signal,
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        members?: AdminMemberRow[];
        total?: number;
        statusCounts?: MemberStatusCounts | null;
      };
      if (!res.ok) {
        throw new Error(data.error || "Gagal memuat anggota");
      }
      if (reqId !== reqIdRef.current) return;
      setMembers(data.members ?? []);
      setTotal(Number(data.total) || 0);
      if (data.statusCounts) {
        const nextCounts = { ...data.statusCounts };
        const listTotal = Number(data.total) || 0;
        // Samakan Total KPI dengan total daftar saat tanpa filter status/dokumen.
        if (
          !next.status &&
          !next.docs &&
          !next.nia &&
          !next.inactiveMonths &&
          nextCounts.all !== listTotal
        ) {
          nextCounts.all = listTotal;
        }
        setStatusCounts(nextCounts);
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      if (reqId !== reqIdRef.current) return;
      setError(err instanceof Error ? err.message : "Gagal memuat anggota");
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, []);

  const applyFilters = useCallback(
    (patch: Partial<FilterState>, opts?: { resetPage?: boolean; forceCounts?: boolean }) => {
      setFilters((prev) => {
        const resetPage = opts?.resetPage !== false && patch.page == null;
        const next: FilterState = {
          ...prev,
          ...patch,
          page: resetPage ? 1 : (patch.page ?? prev.page),
        };
        syncUrl(next);
        void load(next, opts?.forceCounts);
        return next;
      });
    },
    [load, syncUrl],
  );

  const handleSort = useCallback(
    (key: string) => {
      const next = toggleSortKey(filters.sort, filters.sortDir, key);
      applyFilters({
        sort: next.key as MemberSortKey,
        sortDir: next.dir,
        page: 1,
      });
    },
    [applyFilters, filters.sort, filters.sortDir],
  );

  // Popstate (back/forward)
  useEffect(() => {
    function onPopState() {
      const next = {
        ...filters,
        ...parseHrefToFilters(window.location.search, filters.pageSize),
      } as FilterState;
      setFilters(next);
      void load(next);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only bind once for history
  }, [load]);

  const kpiBase = {
    q: filters.q,
    dojoId: singleLockedDojo ? "" : filters.dojoId,
    docs: filters.docs,
    nia: filters.nia,
    account: filters.account,
    dup: filters.dup,
    pageSize: String(filters.pageSize),
  };

  const unfiltered =
    !filters.status &&
    !filters.docs &&
    !filters.nia &&
    !filters.account &&
    !filters.dup &&
    !filters.inactiveMonths;
  // Total KPI = total daftar saat tanpa filter status/dokumen (satu sumber kebenaran).
  const totalKpiValue = unfiltered ? total : statusCounts.all;
  const subtitleCount = unfiltered ? total : statusCounts.all;
  const activeDojoName =
    (filters.dojoId && dojos.find((d) => d.id === filters.dojoId)?.name) ||
    scopeHint ||
    "";

  const kpis: AnggotaKpiItem[] = [
    {
      key: "all",
      label: "Total",
      value: totalKpiValue,
      icon: "users" as AnggotaKpiIconName,
      href: buildHref({
        ...kpiBase,
        status: "",
        docs: "",
        nia: "",
        account: "",
        dup: "",
      }),
      active:
        !filters.status &&
        !filters.docs &&
        !filters.nia &&
        !filters.account &&
        !filters.dup,
    },
    {
      key: "pending",
      label: "Menunggu",
      value: statusCounts.pending,
      icon: "clock",
      href: buildHref({
        ...kpiBase,
        status: "PENDING",
        docs: "",
        nia: "",
        account: "",
        dup: "",
      }),
      active: filters.status === "PENDING",
      accent: "text-amber-600",
    },
    {
      key: "active",
      label: "Aktif",
      value: statusCounts.active,
      icon: "userCheck",
      href: buildHref({
        ...kpiBase,
        status: "Active",
        docs: "",
        nia: "",
        account: "",
        dup: "",
      }),
      active:
        filters.status === "Active" &&
        !filters.nia &&
        !filters.account &&
        !filters.dup,
      accent: "text-emerald-600",
    },
    {
      key: "inactive",
      label: "Nonaktif",
      value: statusCounts.inactive,
      icon: "userMinus",
      href: buildHref({
        ...kpiBase,
        status: "INACTIVE",
        docs: "",
        nia: "",
        account: "",
        dup: "",
      }),
      active: filters.status === "INACTIVE",
      accent: "text-slate-600",
    },
    {
      key: "rejected",
      label: "Ditolak",
      value: statusCounts.rejected,
      icon: "userX",
      href: buildHref({
        ...kpiBase,
        status: "REJECTED",
        docs: "",
        nia: "",
        account: "",
        dup: "",
      }),
      active: filters.status === "REJECTED",
      accent: "text-destructive",
    },
    {
      key: "docs",
      label: "Dok. kurang",
      value: statusCounts.docsIncomplete,
      icon: "fileWarning",
      href: buildHref({
        ...kpiBase,
        status: "",
        nia: "",
        account: "",
        dup: "",
        docs: filters.docs === "incomplete" ? "" : "incomplete",
      }),
      active: filters.docs === "incomplete",
      accent: "text-orange-600",
    },
    {
      key: "nia",
      label: "Tanpa NIA",
      value: statusCounts.missingNia,
      icon: "idCard",
      href: buildHref({
        ...kpiBase,
        status: "",
        docs: "",
        account: "",
        dup: "",
        nia: filters.nia === "missing" ? "" : "missing",
      }),
      active: filters.nia === "missing",
      accent: "text-amber-700",
    },
    {
      key: "account",
      label: "Tanpa akun",
      value: statusCounts.withoutAccount ?? 0,
      icon: "userCog",
      href: buildHref({
        ...kpiBase,
        status: "",
        docs: "",
        nia: "",
        dup: "",
        account: filters.account === "missing" ? "" : "missing",
      }),
      active: filters.account === "missing",
      accent: "text-violet-700",
    },
    {
      key: "dup",
      label: "Duplikat NIA/NIK",
      value: statusCounts.duplicateIdentity ?? 0,
      icon: "copy",
      href: buildHref({
        ...kpiBase,
        status: "",
        docs: "",
        nia: "",
        account: "",
        dup: filters.dup === "nia_nik" ? "" : "nia_nik",
      }),
      active: filters.dup === "nia_nik",
      accent: "text-rose-700",
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const safePage = Math.min(filters.page, totalPages);

  const liveLockDojoId = singleLockedDojo || (userRoles.includes("ADMIN_DOJO") && dojos.length > 1 ? filters.dojoId : lockDojoId);

  return (
    <>
      <AdminPageHeader
        title="Kelola Anggota"
        description={
          error ? (
            <span className="text-destructive">{error}</span>
          ) : undefined
        }
        actions={
          isDojoAdmin && dojos.length > 1 ? (
            <div className="col-span-2 sm:col-span-1">
              <DojoContextSwitcher
                dojos={dojos}
                value={filters.dojoId}
                label="Kelola ranting"
                onChange={(next) => applyFilters({ dojoId: next })}
              />
            </div>
          ) : undefined
        }
      />

      {roleLabel ? (
        <p className="-mt-4 mb-4 text-muted-foreground">
          {roleLabel} — {subtitleCount} anggota
          {activeDojoName ? ` · ${activeDojoName}` : ""}
        </p>
      ) : null}
    <AnggotaKpiCards
      items={kpis}
      onNavigate={(href) => {
        const patch = parseHrefToFilters(href, filters.pageSize);
        applyFilters(patch);
      }}
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <AnggotaAddButton
          dojos={dojos}
          defaultDojoId={liveLockDojoId || defaultDojoId}
          lockDojo={Boolean(singleLockedDojo || filters.dojoId)}
          onMembersChanged={() => applyFilters({}, { resetPage: false, forceCounts: true })}
        />
        {canNormalize ? <NormalizeMembersButton onSuccess={() => applyFilters({}, { resetPage: false })} /> : null}
        {canArchive ? (
          <Link
            href="/admin/anggota?view=archive"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-muted sm:h-8"
          >
            <Archive className="h-3.5 w-3.5" />
            Lihat arsip
          </Link>
        ) : null}
        <ExportCsvButton
          filename="anggota-export.csv"
          headers={[
            "NIA",
            "No. MSH",
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
        q={filters.q}
        status={filters.status}
        dojoId={singleLockedDojo ? "" : filters.dojoId}
        docs={filters.docs}
        nia={filters.nia}
        account={filters.account}
        dup={filters.dup}
        inactiveMonths={filters.inactiveMonths}
        pageSize={String(filters.pageSize)}
        dojos={dojos}
        showDojoFilter={showDojoFilter}
        lockDojoId={liveLockDojoId}
        activeUkt={activeUkt}
        activeLatber={activeLatber}
        canQuickReg={canQuickReg}
        onNavigate={(href) => {
          const patch = parseHrefToFilters(href, filters.pageSize);
          applyFilters(patch);
        }}
      />

      {filters.docs === "incomplete" ||
      filters.nia === "missing" ||
      filters.account === "missing" ||
      filters.dup === "nia_nik" ||
      filters.inactiveMonths ? (
        <p className="mb-3 text-xs text-muted-foreground">
          {filters.docs === "incomplete" ? "Filter: dokumen kurang. " : ""}
          {filters.nia === "missing" ? "Filter: tanpa NIA. " : ""}
          {filters.account === "missing"
            ? "Filter: ber-NIA tanpa akun login. "
            : ""}
          {filters.dup === "nia_nik"
            ? "Filter: duplikat NIA/NIK (ternormalisasi). "
            : ""}
          {filters.inactiveMonths
            ? `Nonaktif/ditangguhkan ≥ ${filters.inactiveMonths} bulan (filter halaman).`
            : null}
        </p>
      ) : null}

      {error ? (
        <p className="mb-3 text-sm text-destructive">{error}</p>
      ) : null}

      <div
        className={
          loading
            ? "opacity-60 transition-opacity duration-150"
            : "transition-opacity duration-150"
        }
        aria-busy={loading}
      >
        <MembersTable
          members={members}
          userRoles={userRoles}
          dojos={dojos}
          onMembersChanged={() => applyFilters({}, { resetPage: false })}
          page={safePage}
          pageSize={filters.pageSize}
          sortKey={filters.sort}
          sortDir={filters.sortDir}
          onSort={handleSort}
        />
      </div>

      <SettingsPagination
        page={safePage}
        totalPages={totalPages}
        total={total}
        pageSize={filters.pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        baseParams={{
          q: filters.q,
          status: filters.status,
          dojoId: singleLockedDojo ? "" : filters.dojoId,
          docs: filters.docs,
          nia: filters.nia,
          inactiveMonths: filters.inactiveMonths,
          sort: filters.sort !== "fullName" ? filters.sort : "",
          sortDir: filters.sortDir === "desc" ? "desc" : "",
        }}
        onNavigate={(href) => {
          const patch = parseHrefToFilters(href, filters.pageSize);
          applyFilters(patch, { resetPage: false });
        }}
      />
    </AnggotaKpiCards>
    </>
  );
}

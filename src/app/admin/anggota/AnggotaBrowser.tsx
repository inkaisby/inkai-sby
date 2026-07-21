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

const PAGE_SIZE_OPTIONS = [25, 50, 100];

type DojoOption = { id: string; name: string };

type FilterState = {
  q: string;
  status: string;
  dojoId: string;
  docs: string;
  nia: string;
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
}) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [members, setMembers] = useState(initialMembers);
  const [total, setTotal] = useState(initialTotal);
  const [statusCounts, setStatusCounts] = useState(initialStatusCounts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);

  const syncUrl = useCallback((next: FilterState) => {
    const href = buildHref(filtersToParams(next));
    const path = `${window.location.pathname}${href === "?" ? "" : href}`;
    window.history.replaceState(null, "", path);
  }, []);

  const load = useCallback(async (next: FilterState) => {
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
    qs.set("counts", "1");

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
    (patch: Partial<FilterState>, opts?: { resetPage?: boolean }) => {
      setFilters((prev) => {
        const resetPage = opts?.resetPage !== false && patch.page == null;
        const next: FilterState = {
          ...prev,
          ...patch,
          page: resetPage ? 1 : (patch.page ?? prev.page),
        };
        syncUrl(next);
        void load(next);
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
    pageSize: String(filters.pageSize),
  };

  const unfiltered =
    !filters.status && !filters.docs && !filters.nia && !filters.inactiveMonths;
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
      href: buildHref({ ...kpiBase, status: "", docs: "", nia: "" }),
      active: !filters.status && !filters.docs && !filters.nia,
    },
    {
      key: "pending",
      label: "Menunggu",
      value: statusCounts.pending,
      icon: "clock",
      href: buildHref({ ...kpiBase, status: "PENDING", docs: "", nia: "" }),
      active: filters.status === "PENDING",
      accent: "text-amber-600",
    },
    {
      key: "active",
      label: "Aktif",
      value: statusCounts.active,
      icon: "userCheck",
      href: buildHref({ ...kpiBase, status: "Active", docs: "", nia: "" }),
      active: filters.status === "Active" && !filters.nia,
      accent: "text-emerald-600",
    },
    {
      key: "inactive",
      label: "Nonaktif",
      value: statusCounts.inactive,
      icon: "userMinus",
      href: buildHref({ ...kpiBase, status: "INACTIVE", docs: "", nia: "" }),
      active: filters.status === "INACTIVE",
      accent: "text-slate-600",
    },
    {
      key: "rejected",
      label: "Ditolak",
      value: statusCounts.rejected,
      icon: "userX",
      href: buildHref({ ...kpiBase, status: "REJECTED", docs: "", nia: "" }),
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
        nia: filters.nia === "missing" ? "" : "missing",
      }),
      active: filters.nia === "missing",
      accent: "text-amber-700",
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const safePage = Math.min(filters.page, totalPages);

  return (
    <>
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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <AnggotaAddButton
          dojos={dojos}
          defaultDojoId={defaultDojoId}
          lockDojo={Boolean(singleLockedDojo)}
          onMembersChanged={() => applyFilters({}, { resetPage: false })}
        />
        {canNormalize ? <NormalizeMembersButton /> : null}
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
        q={filters.q}
        status={filters.status}
        dojoId={singleLockedDojo ? "" : filters.dojoId}
        docs={filters.docs}
        nia={filters.nia}
        inactiveMonths={filters.inactiveMonths}
        pageSize={String(filters.pageSize)}
        dojos={dojos}
        showDojoFilter={showDojoFilter}
        lockDojoId={lockDojoId}
        onNavigate={(href) => {
          const patch = parseHrefToFilters(href, filters.pageSize);
          applyFilters(patch);
        }}
      />

      {filters.docs === "incomplete" ||
      filters.nia === "missing" ||
      filters.inactiveMonths ? (
        <p className="mb-3 text-xs text-muted-foreground">
          {filters.docs === "incomplete" ? "Filter: dokumen kurang. " : ""}
          {filters.nia === "missing" ? "Filter: tanpa NIA. " : ""}
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

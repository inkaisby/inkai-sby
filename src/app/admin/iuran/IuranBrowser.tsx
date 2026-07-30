"use client";

import { useCallback, useRef, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DojoContextSwitcher } from "@/components/admin/DojoContextSwitcher";
import { Input } from "@/components/ui/input";
import type {
  IuranLedgerKpis,
  IuranLedgerMemberRow,
  WaitingQueueItem,
} from "@/lib/iuran-ledger";
import { IuranOpsBar } from "./IuranOpsBar";
import { IuranLedgerClient } from "./IuranLedgerClient";

type DojoOption = { id: string; name: string };

type FilterState = {
  q: string;
  month: string;
  dojoId: string;
  filter: string;
  sort: "name" | "arrears" | "status";
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
};

function formatRp(n: number) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

function filtersToParams(f: FilterState) {
  const p: Record<string, string> = {};
  if (f.q.trim()) p.q = f.q.trim();
  if (f.month) p.month = f.month;
  if (f.dojoId) p.dojoId = f.dojoId;
  if (f.filter && f.filter !== "all") p.filter = f.filter;
  if (f.sort !== "name") p.sort = f.sort;
  if (f.sortDir !== "asc") p.sortDir = f.sortDir;
  if (f.page > 1) p.page = String(f.page);
  if (f.pageSize !== 25) p.pageSize = String(f.pageSize);
  return p;
}

function buildHref(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return qs ? `?${qs}` : "";
}

type ExportRow = {
  fullName: string;
  nia: string;
  dojo: string;
  monthlyDues: number;
  monthStatus: string;
  arrears: number;
  aging: string;
  exemption: string;
};

export function IuranBrowser({
  canEdit,
  isDojoAdmin,
  switcherDojos,
  initialFilters,
  initialRows,
  initialTotal,
  initialKpis,
  initialWaitingQueue,
  initialDefaultDuesAmount,
  initialExportRows,
  initialMemberId,
  initialTab,
}: {
  canEdit: boolean;
  isDojoAdmin: boolean;
  switcherDojos: DojoOption[];
  initialFilters: FilterState;
  initialRows: IuranLedgerMemberRow[];
  initialTotal: number;
  initialKpis: IuranLedgerKpis;
  initialWaitingQueue: WaitingQueueItem[];
  initialDefaultDuesAmount: number;
  initialExportRows: ExportRow[];
  initialMemberId?: string;
  initialTab?: string;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [kpis, setKpis] = useState(initialKpis);
  const [waitingQueue, setWaitingQueue] =
    useState<WaitingQueueItem[]>(initialWaitingQueue);
  const [defaultDuesAmount, setDefaultDuesAmount] = useState(
    initialDefaultDuesAmount,
  );
  const [exportRows, setExportRows] = useState(initialExportRows);
  const [periodKey, setPeriodKey] = useState(initialFilters.month);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);

  const syncUrl = useCallback((next: FilterState) => {
    const href = buildHref(filtersToParams(next));
    const path = `${window.location.pathname}${href}`;
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
    try {
      const res = await fetch(`/api/admin/iuran/ledger?${qs}`, {
        signal: ac.signal,
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        rows?: IuranLedgerMemberRow[];
        total?: number;
        kpis?: IuranLedgerKpis;
        waitingQueue?: WaitingQueueItem[];
        defaultDuesAmount?: number;
        exportRows?: ExportRow[];
        periodKey?: string;
      };
      if (!res.ok) throw new Error(data.error || "Gagal memuat iuran");
      if (reqId !== reqIdRef.current) return;
      setRows(data.rows ?? []);
      setTotal(Number(data.total) || 0);
      if (data.kpis) setKpis(data.kpis);
      setWaitingQueue(data.waitingQueue ?? []);
      if (data.defaultDuesAmount != null) {
        setDefaultDuesAmount(data.defaultDuesAmount);
      }
      if (data.exportRows) setExportRows(data.exportRows);
      if (data.periodKey) setPeriodKey(data.periodKey);
    } catch (err) {
      if (ac.signal.aborted) return;
      if (reqId !== reqIdRef.current) return;
      setError(err instanceof Error ? err.message : "Gagal memuat iuran");
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, []);

  const applyFilters = useCallback(
    (patch: Partial<FilterState>, opts?: { resetPage?: boolean }) => {
      setFilters((prev) => {
        const next: FilterState = {
          ...prev,
          ...patch,
          page: opts?.resetPage !== false && patch.page == null ? 1 : (patch.page ?? prev.page),
        };
        syncUrl(next);
        void load(next);
        return next;
      });
    },
    [load, syncUrl],
  );

  const baseParams = filtersToParams(filters);

  return (
    <>
      <AdminPageHeader
        title="Iuran Anggota"
        description={
          <>
            Rekening koran iuran per anggota · Periode {periodKey}
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
              dojos={switcherDojos}
              value={filters.dojoId}
              label="Ranting"
              onChange={(next) => applyFilters({ dojoId: next })}
            />
          ) : null
        }
      />

      <form
        className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          applyFilters({
            q: String(fd.get("q") || ""),
            month: String(fd.get("month") || filters.month),
            dojoId: String(fd.get("dojoId") || ""),
            filter: String(fd.get("filter") || "all"),
            sort: (String(fd.get("sort") || "name") === "arrears"
              ? "arrears"
              : String(fd.get("sort") || "name") === "status"
                ? "status"
                : "name") as FilterState["sort"],
            sortDir: fd.get("sortDir") === "desc" ? "desc" : "asc",
            pageSize: Number(fd.get("pageSize") || filters.pageSize) || 25,
          });
        }}
      >
        <Input
          name="q"
          placeholder="Cari nama / NIA..."
          defaultValue={filters.q}
          key={`q-${filters.q}`}
          className="h-10 w-full sm:h-8 sm:max-w-xs sm:w-auto"
        />
        <Input
          name="month"
          type="month"
          defaultValue={filters.month}
          key={`month-${filters.month}`}
          className="h-10 w-full sm:h-8 sm:max-w-[160px] sm:w-auto"
          title="Periode status bulan"
        />
        {!isDojoAdmin || switcherDojos.length > 1 ? (
          <select
            name="dojoId"
            defaultValue={filters.dojoId}
            key={`dojo-${filters.dojoId}`}
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
          defaultValue={filters.filter}
          key={`filter-${filters.filter}`}
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
          defaultValue={filters.sort}
          className="h-10 w-full rounded-lg border px-2 text-sm sm:h-8 sm:w-auto"
        >
          <option value="name">Urut nama</option>
          <option value="arrears">Urut tunggakan</option>
          <option value="status">Urut status</option>
        </select>
        <select
          name="sortDir"
          defaultValue={filters.sortDir}
          className="h-10 w-full rounded-lg border px-2 text-sm sm:h-8 sm:w-auto"
        >
          <option value="asc">Naik</option>
          <option value="desc">Turun</option>
        </select>
        <input type="hidden" name="pageSize" value={String(filters.pageSize)} />
        <button
          type="submit"
          className="h-10 rounded-lg bg-inkai-red px-4 text-sm text-white sm:h-8 sm:py-1.5"
        >
          Filter
        </button>
      </form>

      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      <div
        className={
          loading
            ? "opacity-60 transition-opacity duration-150"
            : "transition-opacity duration-150"
        }
        aria-busy={loading}
      >
        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <KpiChip label="Tunggakan" value={formatRp(kpis.arrearsAmount)} />
          <KpiChip label="Belum bayar" value={String(kpis.pendingCount)} />
          <KpiChip
            label="Menunggu verifikasi"
            value={String(kpis.waitingCount)}
          />
          <KpiChip
            label={`Lunas ${periodKey}`}
            value={`${formatRp(kpis.paidMonthAmount)} (${kpis.paidMonthCount})`}
          />
          <KpiChip label="Pengecualian" value={String(kpis.exemptCount)} />
          <KpiChip label="Belum digenerate" value={String(kpis.noBillCount)} />
        </div>

        <IuranOpsBar
          canEdit={canEdit}
          defaultAmount={defaultDuesAmount}
          exportMode="members"
          memberExportRows={exportRows}
        />

        <IuranLedgerClient
          rows={rows}
          total={total}
          page={filters.page}
          pageSize={filters.pageSize}
          canEdit={canEdit}
          defaultDuesAmount={defaultDuesAmount}
          waitingQueue={waitingQueue}
          baseParams={baseParams}
          periodKey={periodKey}
          initialMemberId={initialMemberId}
          initialTab={initialTab}
          onLedgerChanged={() =>
            applyFilters({}, { resetPage: false })
          }
          onPageNavigate={(href) => {
            const q = href.startsWith("?") ? href.slice(1) : href;
            const sp = new URLSearchParams(q);
            applyFilters(
              {
                page: Number(sp.get("page") || 1),
                pageSize: Number(sp.get("pageSize") || filters.pageSize),
              },
              { resetPage: false },
            );
          }}
        />
      </div>
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

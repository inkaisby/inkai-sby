"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Printer, Search, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SortableTableHead } from "@/components/ui/SortableTableHead";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MemberAvatarRing } from "@/components/admin/ukt/MemberAvatarRing";
import { UktFloatingCountdown } from "@/components/admin/ukt/UktFloatingCountdown";
import { RantingCheckboxFilter } from "@/components/public/RantingCheckboxFilter";
import {
  STICKY_CHECK_CELL,
  STICKY_CHECK_HEAD,
  STICKY_NAME_AFTER_CHECK,
  STICKY_NAME_CELL,
  STICKY_NAME_HEAD,
} from "@/lib/admin-table-sticky";
import { formatMemberName, formatRankLabel } from "@/lib/belt";
import { formatRegisteredAtWib } from "@/lib/format-wib";
import {
  buildRantingOptions,
  matchesRantingFilter,
  matchesSearchFilter,
  pruneSelectedRanting,
  PUBLIC_STICKY_TOOLBAR_CLASS,
} from "@/lib/public-ranting-filter";
import { sortPublicUktRows } from "@/lib/ukt-public-roster-sort";
import {
  printUktRosterDocument,
  type UktRosterPrintOrientation,
  type UktRosterPrintPaper,
} from "@/lib/ukt-roster-print-html";
import { toggleSortKey, type SortDir } from "@/lib/table-sort";
import { cn } from "@/lib/utils";
import type { UktDisplayStatus } from "@/lib/ukt";
import type {
  UktPublicPeriod,
  UktPublicRegistrant,
} from "@/lib/ukt-public";

type Payload = {
  period: UktPublicPeriod;
  registrants: UktPublicRegistrant[];
  loadError?: boolean;
};

const POLL_MS = 30_000;
const TABLE_COL_SPAN = 10;

function statusBadgeClass(status: UktDisplayStatus): string {
  const map: Partial<Record<UktDisplayStatus, string>> = {
    belum_bayar: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    menunggu_verifikasi: "bg-sky-100 text-sky-800 hover:bg-sky-100",
    menunggu_ujian: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    selesai: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    lulus: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    gagal: "bg-red-100 text-red-800 hover:bg-red-100",
    mengulang: "bg-orange-100 text-orange-800 hover:bg-orange-100",
    menunggu_terima_ranting: "bg-violet-100 text-violet-800 hover:bg-violet-100",
    menunggu_konfirmasi_ranting:
      "bg-violet-100 text-violet-800 hover:bg-violet-100",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

function computeKpis(rows: UktPublicRegistrant[]) {
  let belumBayar = 0;
  let menungguVerifikasi = 0;
  let menungguUjian = 0;
  let selesai = 0;
  let lainnya = 0;
  for (const r of rows) {
    if (r.status === "belum_bayar") belumBayar += 1;
    else if (r.status === "menunggu_verifikasi") menungguVerifikasi += 1;
    else if (r.status === "menunggu_ujian") menungguUjian += 1;
    else if (r.status === "selesai" || r.status === "lulus") selesai += 1;
    else lainnya += 1;
  }
  return {
    total: rows.length,
    belumBayar,
    menungguVerifikasi,
    menungguUjian,
    selesai,
    lainnya,
  };
}

export function UktPublicRosterClient() {
  const [period, setPeriod] = useState<UktPublicPeriod | null>(null);
  const [registrants, setRegistrants] = useState<UktPublicRegistrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [selectedRanting, setSelectedRanting] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<{ key: string | null; dir: SortDir }>({
    key: null,
    dir: "asc",
  });
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printDojoIds, setPrintDojoIds] = useState<Set<string>>(() => new Set());
  const [printPaper, setPrintPaper] = useState<UktRosterPrintPaper>("A4");
  const [printOrientation, setPrintOrientation] =
    useState<UktRosterPrintOrientation>("landscape");
  const [printBusy, setPrintBusy] = useState(false);

  const summaryPanelRef = useRef<HTMLDivElement>(null);
  const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryObserverRef = useRef<IntersectionObserver | null>(null);
  const userScrolledRef = useRef(false);
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/public/ukt/registrants", {
        cache: "no-store",
      });
      if (!res.ok) {
        setFetchFailed(true);
        return;
      }
      const data = (await res.json()) as Payload;
      setPeriod(data.period);
      setRegistrants(data.registrants ?? []);
      setLoadError(Boolean(data.loadError));
      setFetchFailed(false);
    } catch {
      setFetchFailed(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") {
          void reload({ silent: true });
        }
      }, POLL_MS);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void reload({ silent: true });
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reload]);

  const rantingOptions = useMemo(
    () =>
      buildRantingOptions(
        registrants.map((r) => ({ rantingName: r.ranting })),
      ),
    [registrants],
  );

  useEffect(() => {
    setSelectedRanting((prev) => pruneSelectedRanting(prev, rantingOptions));
  }, [rantingOptions]);

  useEffect(() => {
    const valid = new Set(registrants.map((r) => r.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [registrants]);

  const closeSummary = useCallback(() => {
    setSummaryOpen(false);
    if (summaryTimerRef.current) {
      clearTimeout(summaryTimerRef.current);
      summaryTimerRef.current = null;
    }
    summaryObserverRef.current?.disconnect();
    summaryObserverRef.current = null;
    userScrolledRef.current = false;
  }, []);

  useEffect(() => {
    if (!summaryOpen) return;

    userScrolledRef.current = false;
    const onScroll = () => {
      userScrolledRef.current = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    summaryTimerRef.current = setTimeout(() => {
      const tableEl = tableWrapRef.current;
      if (!tableEl) {
        closeSummary();
        return;
      }
      summaryObserverRef.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting) && userScrolledRef.current) {
            closeSummary();
          }
        },
        { threshold: 0.15 },
      );
      summaryObserverRef.current.observe(tableEl);
    }, 4000);

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (summaryTimerRef.current) {
        clearTimeout(summaryTimerRef.current);
        summaryTimerRef.current = null;
      }
      summaryObserverRef.current?.disconnect();
      summaryObserverRef.current = null;
    };
  }, [summaryOpen, closeSummary]);

  function bumpSummaryTimer() {
    if (!summaryOpen) return;
    if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
    summaryTimerRef.current = setTimeout(() => {
      closeSummary();
    }, 4000);
  }

  function toggleRantingCard(name: string) {
    setSelectedRanting((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const handleSort = useCallback((key: string) => {
    setSort((prev) => toggleSortKey(prev.key, prev.dir, key));
  }, []);

  const filteredRows = useMemo(() => {
    return registrants.filter(
      (r) =>
        matchesSearchFilter(searchQ, {
          fullName: r.fullName,
          nia: r.nia,
          rantingName: r.ranting,
        }) && matchesRantingFilter(r.ranting, selectedRanting),
    );
  }, [registrants, searchQ, selectedRanting]);

  const displayRows = useMemo(
    () => sortPublicUktRows(filteredRows, sort.key, sort.dir),
    [filteredRows, sort.key, sort.dir],
  );

  const allRantingNames = useMemo(
    () => [...new Set(registrants.map((r) => r.ranting))].sort((a, b) =>
      a.localeCompare(b, "id"),
    ),
    [registrants],
  );

  const printCandidateRows = useMemo(() => {
    let rows = registrants.filter((r) => printDojoIds.has(r.ranting));
    if (selectedIds.size > 0) {
      rows = rows.filter((r) => selectedIds.has(r.id));
    }
    return sortPublicUktRows(rows, sort.key, sort.dir);
  }, [registrants, printDojoIds, selectedIds, sort.key, sort.dir]);

  const allDisplayChecked =
    displayRows.length > 0 &&
    displayRows.every((r) => selectedIds.has(r.id));
  const someDisplayChecked =
    displayRows.some((r) => selectedIds.has(r.id)) && !allDisplayChecked;

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = someDisplayChecked;
  }, [someDisplayChecked]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllDisplay = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allDisplayChecked) {
        displayRows.forEach((r) => next.delete(r.id));
      } else {
        displayRows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  function openPrintModal() {
    if (selectedRanting.size > 0) {
      setPrintDojoIds(new Set(selectedRanting));
    } else if (selectedIds.size > 0) {
      setPrintDojoIds(
        new Set(
          registrants
            .filter((r) => selectedIds.has(r.id))
            .map((r) => r.ranting),
        ),
      );
    } else {
      setPrintDojoIds(new Set(allRantingNames));
    }
    setPrintOpen(true);
  }

  const handlePrintOpenChange = (next: boolean) => {
    if (!next && printBusy) return;
    setPrintOpen(next);
  };

  const blockDialogDismiss = printBusy
    ? (e: Event) => {
        e.preventDefault();
      }
    : undefined;

  function handlePrint() {
    if (printCandidateRows.length === 0 || printBusy) return;
    setPrintBusy(true);
    try {
      const names = [...printDojoIds].sort((a, b) => a.localeCompare(b, "id"));
      const showRanting = names.length > 1;
      const dojoLabel =
        names.length === 1 ? names[0]! : `GABUNGAN (${names.join(", ")})`;

      printUktRosterDocument({
        periodTitle: period?.title?.trim() || "Pendaftaran UKT",
        dojoLabel,
        participantCount: printCandidateRows.length,
        showRantingColumn: showRanting,
        paper: printPaper,
        orientation: printOrientation,
        rows: printCandidateRows.map((r, i) => ({
          no: i + 1,
          nia: r.nia || "—",
          nama: formatMemberName(r.fullName),
          ranting: r.ranting,
          kyuLama: formatRankLabel(r.kyuLama) || r.kyuLama || "—",
          kyuBaru: r.kyuBaru?.trim()
            ? formatRankLabel(r.kyuBaru) || r.kyuBaru
            : "—",
          status: r.statusLabel,
          tglDaftar: formatRegisteredAtWib(r.createdAt),
        })),
        origin: window.location.origin,
        printedAt: new Date().toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      });
    } finally {
      setTimeout(() => setPrintBusy(false), 1500);
    }
  }

  const kpis = useMemo(() => computeKpis(filteredRows), [filteredRows]);

  const rantingKpis = useMemo(
    () =>
      buildRantingOptions(
        registrants.map((r) => ({ rantingName: r.ranting })),
      ),
    [registrants],
  );

  const chartSegments = useMemo(() => {
    const total = kpis.total || 1;
    return [
      {
        key: "belum",
        label: "Belum Bayar",
        count: kpis.belumBayar,
        pct: (kpis.belumBayar / total) * 100,
        className: "bg-amber-500",
      },
      {
        key: "tunggu",
        label: "Menunggu Verifikasi",
        count: kpis.menungguVerifikasi,
        pct: (kpis.menungguVerifikasi / total) * 100,
        className: "bg-sky-500",
      },
      {
        key: "ujian",
        label: "Menunggu Ujian",
        count: kpis.menungguUjian,
        pct: (kpis.menungguUjian / total) * 100,
        className: "bg-blue-500",
      },
      {
        key: "selesai",
        label: "Selesai",
        count: kpis.selesai,
        pct: (kpis.selesai / total) * 100,
        className: "bg-emerald-500",
      },
      {
        key: "lainnya",
        label: "Lainnya",
        count: kpis.lainnya,
        pct: (kpis.lainnya / total) * 100,
        className: "bg-slate-400",
      },
    ];
  }, [kpis]);

  const titleLabel = period?.title?.trim() || "Pendaftaran UKT";
  const hasSearch = searchQ.trim().length >= 2;
  const hasRantingFilter = selectedRanting.size > 0;
  const canPrint = registrants.length > 0;
  const printAllRantingSelected =
    allRantingNames.length > 0 &&
    printDojoIds.size === allRantingNames.length;

  function tableEmptyMessage(): string {
    if (!period?.periodId) return "Tidak ada data.";
    if (registrants.length === 0) return "Belum ada peserta terdaftar.";
    if (hasSearch && hasRantingFilter) {
      return "Tidak ada peserta cocok dengan cari dan filter ranting.";
    }
    if (hasRantingFilter) return "Tidak ada peserta di ranting terpilih.";
    if (hasSearch) return "Tidak ada peserta cocok.";
    return "Belum ada peserta terdaftar.";
  }

  function renderKpiSection() {
    if (!period?.periodId) return null;
    return (
      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Peserta
              {hasRantingFilter || hasSearch ? (
                <span className="text-xs">(filter)</span>
              ) : null}
            </div>
            <p className="mt-1 text-2xl font-semibold">{kpis.total}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Belum Bayar</p>
            <p className="mt-1 text-2xl font-semibold text-amber-700">
              {kpis.belumBayar}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Menunggu Verifikasi</p>
            <p className="mt-1 text-2xl font-semibold">
              {kpis.menungguVerifikasi}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Menunggu Ujian</p>
            <p className="mt-1 text-2xl font-semibold text-blue-700">
              {kpis.menungguUjian}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Selesai</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700">
              {kpis.selesai}
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Status peserta</p>
          {kpis.total === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {hasRantingFilter || hasSearch
                ? "Tidak ada peserta sesuai filter."
                : "Belum ada peserta."}
            </p>
          ) : (
            <>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
                {chartSegments.map((seg) =>
                  seg.count > 0 ? (
                    <div
                      key={seg.key}
                      className={cn("h-full transition-all", seg.className)}
                      style={{ width: `${seg.pct}%` }}
                      title={`${seg.label}: ${seg.count}`}
                    />
                  ) : null,
                )}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {chartSegments.map((seg) => (
                  <li key={seg.key} className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-block h-2.5 w-2.5 rounded-sm",
                        seg.className,
                      )}
                    />
                    {seg.label} ({seg.count})
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {rantingKpis.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              Peserta per ranting
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rantingKpis.map((r) => {
                const active = selectedRanting.has(r.name);
                return (
                  <button
                    key={r.name}
                    type="button"
                    onClick={() => toggleRantingCard(r.name)}
                    className={cn(
                      "rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/30",
                      active && "ring-2 ring-inkai-red/40",
                    )}
                  >
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {r.name}
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{r.count}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-inkai-red">
          Ujian Kenaikan Tingkat
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {loading && !period ? "Memuat…" : titleLabel}
        </h1>
        {period?.examLocation || period?.examAt ? (
          <p className="text-sm text-muted-foreground">
            {[
              period.examLocation,
              period.examAt
                ? new Date(period.examAt).toLocaleString("id-ID")
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        {!loading && (fetchFailed || loadError) ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-200">
            Gagal memuat daftar peserta. Coba refresh.
          </p>
        ) : null}
        {!loading && !fetchFailed && !loadError && !period?.periodId ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            Belum ada periode UKT aktif.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Daftar peserta terdaftar (hanya lihat). Status &amp; Kyu Baru mengikuti
          data admin.
        </p>
      </header>

      <div className="hidden space-y-6 md:block">{renderKpiSection()}</div>

      <div className={PUBLIC_STICKY_TOOLBAR_CLASS}>
        {period?.periodId && period.registrationCloseAt ? (
          <UktFloatingCountdown
            targetIso={period.registrationCloseAt}
            compact
            className="w-full md:max-w-xl"
          />
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
            <div className="relative min-w-0 w-full md:flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQ}
                disabled={!period?.periodId}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Cari nama, NIA, atau ranting…"
                className="h-10 w-full pr-8 pl-9"
                autoComplete="off"
              />
              {searchQ ? (
                <button
                  type="button"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQ("")}
                  aria-label="Hapus pencarian"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <RantingCheckboxFilter
              options={rantingOptions}
              selected={selectedRanting}
              onChange={setSelectedRanting}
              disabled={!period?.periodId}
            />
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={!canPrint}
              onClick={openPrintModal}
            >
              <Printer className="mr-1 h-4 w-4" />
              Cetak
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 md:hidden"
              aria-expanded={summaryOpen}
              aria-controls="ukt-summary-panel"
              disabled={!period?.periodId}
              onClick={() => {
                if (summaryOpen) closeSummary();
                else setSummaryOpen(true);
              }}
            >
              Ringkasan
              <ChevronDown
                className={cn(
                  "ml-1 h-4 w-4 transition-transform",
                  summaryOpen && "rotate-180",
                )}
              />
            </Button>
          </div>
          {(hasSearch || hasRantingFilter) && filteredRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {tableEmptyMessage()}
            </p>
          ) : null}
        </div>
      </div>

      {summaryOpen ? (
        <div
          id="ukt-summary-panel"
          ref={summaryPanelRef}
          className="space-y-4 md:hidden"
          onPointerDown={bumpSummaryTimer}
        >
          {renderKpiSection()}
        </div>
      ) : null}

      <div ref={tableWrapRef} className="rounded-xl border bg-card">
        <Table className="min-w-[920px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className={cn(STICKY_CHECK_HEAD, "bg-muted/50")}>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="h-4 w-4 accent-inkai-red"
                  checked={allDisplayChecked}
                  onChange={toggleSelectAllDisplay}
                  disabled={displayRows.length === 0}
                  title="Pilih semua baris tampil"
                  aria-label="Pilih semua baris tampil"
                />
              </TableHead>
              <TableHead className="w-12">No</TableHead>
              <TableHead className="w-14">Foto</TableHead>
              <SortableTableHead
                label="NIA"
                sortKey="nia"
                activeKey={sort.key}
                activeDir={sort.dir}
                onSort={handleSort}
              />
              <SortableTableHead
                label="Nama Lengkap"
                sortKey="fullName"
                activeKey={sort.key}
                activeDir={sort.dir}
                onSort={handleSort}
                className={cn(
                  STICKY_NAME_HEAD,
                  STICKY_NAME_AFTER_CHECK,
                  "bg-muted/50",
                )}
              />
              <SortableTableHead
                label="Tanggal daftar"
                sortKey="createdAt"
                activeKey={sort.key}
                activeDir={sort.dir}
                onSort={handleSort}
                className="whitespace-nowrap"
              />
              <SortableTableHead
                label="Kyu Lama"
                sortKey="kyuLama"
                activeKey={sort.key}
                activeDir={sort.dir}
                onSort={handleSort}
              />
              <SortableTableHead
                label="Kyu Baru"
                sortKey="kyuBaru"
                activeKey={sort.key}
                activeDir={sort.dir}
                onSort={handleSort}
              />
              <SortableTableHead
                label="Ranting"
                sortKey="ranting"
                activeKey={sort.key}
                activeDir={sort.dir}
                onSort={handleSort}
              />
              <SortableTableHead
                label="Status"
                sortKey="status"
                activeKey={sort.key}
                activeDir={sort.dir}
                onSort={handleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && registrants.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={TABLE_COL_SPAN}
                  className="py-10 text-center text-muted-foreground"
                >
                  Memuat peserta…
                </TableCell>
              </TableRow>
            ) : displayRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={TABLE_COL_SPAN}
                  className="py-10 text-center text-muted-foreground"
                >
                  {tableEmptyMessage()}
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map((row, idx) => (
                <TableRow key={row.id} className="group">
                  <TableCell className={cn(STICKY_CHECK_CELL)}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-inkai-red"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      aria-label={`Pilih ${formatMemberName(row.fullName)}`}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <MemberAvatarRing
                      fullName={row.fullName}
                      currentRank={row.rankForRing}
                      photoUrl={row.photoUrl}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.nia || "—"}
                  </TableCell>
                  <TableCell
                    className={cn(STICKY_NAME_CELL, STICKY_NAME_AFTER_CHECK)}
                    title={row.fullName}
                  >
                    {formatMemberName(row.fullName)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatRegisteredAtWib(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {formatRankLabel(row.kyuLama) || row.kyuLama || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.kyuBaru?.trim() ? (
                      <Badge variant="outline" className="font-normal">
                        {formatRankLabel(row.kyuBaru) || row.kyuBaru}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{row.ranting}</TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "font-normal",
                        statusBadgeClass(row.status),
                      )}
                    >
                      {row.statusLabel}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground md:hidden">
        Geser tabel ke samping untuk kolom lain.
      </p>

      <Dialog open={printOpen} onOpenChange={handlePrintOpenChange}>
        <DialogContent
          className="max-h-[90vh] max-w-md overflow-y-auto"
          onPointerDownOutside={blockDialogDismiss}
          onFocusOutside={blockDialogDismiss}
          onInteractOutside={blockDialogDismiss}
        >
          <DialogHeader>
            <DialogTitle>Cetak daftar peserta</DialogTitle>
            <DialogDescription>
              {titleLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Kosongkan centang tabel = semua peserta ranting terpilih. Pencarian
              layar tidak membatasi cetak kecuali baris sudah dicentang.
            </p>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">
                Pilih ranting
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  if (printAllRantingSelected) {
                    setPrintDojoIds(new Set());
                  } else {
                    setPrintDojoIds(new Set(allRantingNames));
                  }
                }}
              >
                {printAllRantingSelected ? "Hapus semua" : "Pilih semua"}
              </Button>
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
              {allRantingNames.map((name) => {
                const count = registrants.filter((r) => r.ranting === name).length;
                return (
                  <label
                    key={name}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-inkai-red"
                      checked={printDojoIds.has(name)}
                      onChange={() => {
                        setPrintDojoIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(name)) next.delete(name);
                          else next.add(name);
                          return next;
                        });
                      }}
                    />
                    <span className="flex-1 font-medium">{name}</span>
                    <span className="text-muted-foreground">
                      {count} peserta
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {printDojoIds.size} ranting · {printCandidateRows.length} peserta
            </p>
            {printDojoIds.size > 0 && printCandidateRows.length === 0 ? (
              <p className="text-xs text-destructive">
                Tidak ada peserta sesuai pilihan.
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">
                  Kertas
                </p>
                <div className="flex gap-1">
                  {(["A4", "F4"] as const).map((paper) => (
                    <Button
                      key={paper}
                      type="button"
                      size="sm"
                      variant={printPaper === paper ? "default" : "outline"}
                      className={
                        printPaper === paper
                          ? "h-8 flex-1 bg-inkai-red text-white hover:bg-inkai-red/90"
                          : "h-8 flex-1"
                      }
                      onClick={() => setPrintPaper(paper)}
                    >
                      {paper}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">
                  Orientasi
                </p>
                <div className="flex gap-1">
                  {(
                    [
                      ["portrait", "Portrait"],
                      ["landscape", "Landscape"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={
                        printOrientation === value ? "default" : "outline"
                      }
                      className={
                        printOrientation === value
                          ? "h-8 flex-1 bg-inkai-red text-white hover:bg-inkai-red/90"
                          : "h-8 flex-1"
                      }
                      onClick={() => setPrintOrientation(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handlePrintOpenChange(false)}
              disabled={printBusy}
            >
              Batal
            </Button>
            <Button
              type="button"
              className="bg-inkai-red text-white hover:bg-inkai-red/90"
              disabled={
                printBusy ||
                printDojoIds.size === 0 ||
                printCandidateRows.length === 0
              }
              onClick={handlePrint}
            >
              <Printer className="mr-1 h-4 w-4" />
              {printBusy ? "Mencetak…" : "Cetak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

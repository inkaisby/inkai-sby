"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MemberAvatarRing } from "@/components/admin/ukt/MemberAvatarRing";
import { formatMemberName, formatRankLabel } from "@/lib/belt";
import { cn } from "@/lib/utils";
import type { UktDisplayStatus } from "@/lib/ukt";
import type {
  UktPublicPeriod,
  UktPublicRegistrant,
} from "@/lib/ukt-public";

type Payload = {
  period: UktPublicPeriod;
  registrants: UktPublicRegistrant[];
};

const POLL_MS = 30_000;

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

export function UktPublicRosterClient() {
  const [period, setPeriod] = useState<UktPublicPeriod | null>(null);
  const [registrants, setRegistrants] = useState<UktPublicRegistrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);

  const summaryPanelRef = useRef<HTMLDivElement>(null);
  const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryObserverRef = useRef<IntersectionObserver | null>(null);
  const userScrolledRef = useRef(false);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/public/ukt/registrants", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as Payload;
      setPeriod(data.period);
      setRegistrants(data.registrants ?? []);
    } catch {
      /* poll senyap: jangan toast */
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Poll senyap ~30s + refetch saat tab fokus; jeda saat tab tersembunyi.
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

  const filteredRows = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (q.length < 2) return registrants;
    return registrants.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.nia?.toLowerCase().includes(q) ?? false) ||
        r.ranting.toLowerCase().includes(q),
    );
  }, [registrants, searchQ]);

  const kpis = useMemo(() => {
    let belumBayar = 0;
    let menungguVerifikasi = 0;
    let menungguUjian = 0;
    let selesai = 0;
    let lainnya = 0;
    for (const r of registrants) {
      if (r.status === "belum_bayar") belumBayar += 1;
      else if (r.status === "menunggu_verifikasi") menungguVerifikasi += 1;
      else if (r.status === "menunggu_ujian") menungguUjian += 1;
      else if (r.status === "selesai" || r.status === "lulus") selesai += 1;
      else lainnya += 1;
    }
    return {
      total: registrants.length,
      belumBayar,
      menungguVerifikasi,
      menungguUjian,
      selesai,
      lainnya,
    };
  }, [registrants]);

  const rantingKpis = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of registrants) {
      const name = r.ranting?.trim() || "—";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "id"));
  }, [registrants]);

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

  function renderKpiSection() {
    if (!period?.periodId) return null;
    return (
      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Peserta
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
              Belum ada peserta.
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
              {rantingKpis.map((r) => (
                <div key={r.name} className="rounded-xl border bg-card p-4">
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {r.name}
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{r.count}</p>
                </div>
              ))}
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
        {!loading && !period?.periodId ? (
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

      <div className="space-y-2">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
          <div className="relative w-full md:min-w-0 md:flex-1">
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
        {searchQ.trim().length >= 2 && filteredRows.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Tidak ada peserta cocok.
          </p>
        ) : null}
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

      <div ref={tableWrapRef} className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">No</TableHead>
              <TableHead className="w-14">Foto</TableHead>
              <TableHead>NIA</TableHead>
              <TableHead>Nama Lengkap</TableHead>
              <TableHead>Kyu Lama</TableHead>
              <TableHead>Kyu Baru</TableHead>
              <TableHead>Ranting</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && registrants.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  Memuat peserta…
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  {period?.periodId
                    ? searchQ.trim().length >= 2
                      ? "Tidak ada peserta cocok."
                      : "Belum ada peserta terdaftar."
                    : "Tidak ada data."}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row, idx) => (
                <TableRow key={row.id}>
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
                  <TableCell className="font-medium">
                    {formatMemberName(row.fullName)}
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
    </div>
  );
}

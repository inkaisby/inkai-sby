"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
  Zap,
  ChevronDown,
  Filter,
  CheckSquare,
  Square,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from "lucide-react";
import { formatRp } from "@/lib/terbilang";
import type { KasLedgerRow } from "@/lib/kas";

export type KasSwotItem = {
  title: string;
  description: string;
  impact?: "high" | "medium" | "low";
};

export type KasSwotAnalysisResult = {
  strengths: KasSwotItem[];
  weaknesses: KasSwotItem[];
  opportunities: KasSwotItem[];
  threats: KasSwotItem[];
  recommendations: string[];
  metricsSummary: {
    totalIn: number;
    totalOut: number;
    netCashFlow: number;
    saldoAkhir: number;
    unmatchedCount: number;
    topIncomeKegiatan: string;
    topIncomeAmount: number;
    topExpenseKegiatan: string;
    topExpenseAmount: number;
    incomeExpenseRatio: number;
    selectedKegiatanCount: number;
  };
};

export type KasChartSwotPanelProps = {
  rows: KasLedgerRow[];
  kpis: {
    totalIn: number;
    totalOut: number;
    saldoAkhir: number;
    opening: number;
    unmatched: number;
  };
  periodCaption: string;
  scopeLabel: string;
  onSwotCalculated?: (swot: KasSwotAnalysisResult, selectedKegiatanList: string[]) => void;
};

export function computeKasSwotAnalysis(
  rows: KasLedgerRow[],
  kpis: { totalIn: number; totalOut: number; saldoAkhir: number; opening: number; unmatched: number },
  selectedKegiatan: string[],
): KasSwotAnalysisResult {
  const filtered = rows.filter((r) => {
    if (selectedKegiatan.length === 0) return true;
    const k = (r.kegiatan || "Tanpa Kegiatan").trim();
    return selectedKegiatan.includes(k);
  });

  const totalIn = filtered.reduce((acc, r) => acc + r.amountIn, 0);
  const totalOut = filtered.reduce((acc, r) => acc + r.amountOut, 0);
  const netCashFlow = totalIn - totalOut;
  const saldoAkhir = kpis.saldoAkhir;
  const unmatchedCount = kpis.unmatched;

  // Breakdown by kegiatan
  const kegiatanMap = new Map<string, { in: number; out: number; count: number }>();
  for (const r of filtered) {
    const kName = (r.kegiatan || "Tanpa Kegiatan").trim() || "Tanpa Kegiatan";
    const current = kegiatanMap.get(kName) || { in: 0, out: 0, count: 0 };
    current.in += r.amountIn;
    current.out += r.amountOut;
    current.count += 1;
    kegiatanMap.set(kName, current);
  }

  let topIncomeKegiatan = "Belum Ada";
  let topIncomeAmount = 0;
  let topExpenseKegiatan = "Belum Ada";
  let topExpenseAmount = 0;

  kegiatanMap.forEach((val, key) => {
    if (val.in > topIncomeAmount) {
      topIncomeAmount = val.in;
      topIncomeKegiatan = key;
    }
    if (val.out > topExpenseAmount) {
      topExpenseAmount = val.out;
      topExpenseKegiatan = key;
    }
  });

  const incomeExpenseRatio = totalOut > 0 ? totalIn / totalOut : totalIn > 0 ? 10 : 1;

  // --- STRENGTHS ---
  const strengths: KasSwotItem[] = [];
  if (netCashFlow >= 0) {
    strengths.push({
      title: "Surplus Arus Kas Positif",
      description: `Periode ini mencatatkan surplus kas bersih sebesar ${formatRp(netCashFlow)}, menunjukkan fleksibilitas likuiditas yang sehat.`,
      impact: "high",
    });
  }
  if (topIncomeAmount > 0) {
    const pct = totalIn > 0 ? Math.round((topIncomeAmount / totalIn) * 100) : 0;
    strengths.push({
      title: `Sumber Pendapatan Utama: ${topIncomeKegiatan}`,
      description: `Kegiatan ${topIncomeKegiatan} menjadi penyumbang kas terbesar (${pct}% dari total masuk atau ${formatRp(topIncomeAmount)}).`,
      impact: "high",
    });
  }
  if (unmatchedCount === 0 && rows.length > 0) {
    strengths.push({
      title: "100% Rekonsiliasi Tertib",
      description: "Seluruh entri transaksi kas pada periode ini telah terekonsiliasi penuh dengan rekening kas.",
      impact: "medium",
    });
  } else if (unmatchedCount <= 3 && unmatchedCount > 0) {
    strengths.push({
      title: "Tingkat Rekonsiliasi Sangat Baik",
      description: `Hanya tersisa ${unmatchedCount} mutasi belum direkon, menandakan pencatatan pembukuan berjalan akurat.`,
      impact: "medium",
    });
  }
  if (incomeExpenseRatio >= 1.25) {
    strengths.push({
      title: "Rasio Pemasukan Pengeluaran Sangat Kuat",
      description: `Total pemasukan mencapai ${incomeExpenseRatio.toFixed(2)}x dari total pengeluaran, memberikan margin aman organisasi.`,
      impact: "high",
    });
  }

  // --- WEAKNESSES ---
  const weaknesses: KasSwotItem[] = [];
  if (netCashFlow < 0) {
    weaknesses.push({
      title: "Defisit Arus Kas Periode Ini",
      description: `Total pengeluaran melebihi pemasukan dengan defisit sebesar ${formatRp(Math.abs(netCashFlow))}. Membutuhkan evaluasi prioritas anggaran.`,
      impact: "high",
    });
  }
  if (unmatchedCount > 3) {
    weaknesses.push({
      title: `Tunggakan Rekonsiliasi (${unmatchedCount} Transaksi)`,
      description: `Terdapat ${unmatchedCount} transaksi kas berstatus 'Belum rekon' yang memerlukan verifikasi mutasi bank/fisik.`,
      impact: "medium",
    });
  }
  if (topIncomeAmount > 0 && totalIn > 0 && topIncomeAmount / totalIn > 0.65) {
    const pct = Math.round((topIncomeAmount / totalIn) * 100);
    weaknesses.push({
      title: "Ketergantungan Sumber Pemasukan Tunggal",
      description: `${pct}% pemasukan sangat terpusat pada '${topIncomeKegiatan}'. Kerentanan finansial jika kegiatan ini tertunda.`,
      impact: "high",
    });
  }
  if (topExpenseAmount > 0 && totalOut > 0 && topExpenseAmount / totalOut > 0.5) {
    const pct = Math.round((topExpenseAmount / totalOut) * 100);
    weaknesses.push({
      title: "Beban Pengeluaran Terpusat pada " + topExpenseKegiatan,
      description: `Pengeluaran ${topExpenseKegiatan} menyedot ${pct}% (${formatRp(topExpenseAmount)}) dari seluruh beban pengeluaran.`,
      impact: "medium",
    });
  }

  // --- OPPORTUNITIES ---
  const opportunities: KasSwotItem[] = [];
  const iuranEntry = kegiatanMap.get("Bayar Iuran") || kegiatanMap.get("Iuran");
  if (!iuranEntry || (totalIn > 0 && (iuranEntry.in / totalIn) < 0.2)) {
    opportunities.push({
      title: "Optimalisasi Penagihan Iuran Rutin Anggota",
      description: "Porsi iuran bulanan rutin masih dapat ditingkatkan untuk membangun basis penerimaan kas terprediksi (recurring income).",
      impact: "high",
    });
  }
  if (kegiatanMap.has("UKT") || kegiatanMap.has("Bayar UKT") || kegiatanMap.has("Latber")) {
    opportunities.push({
      title: "Efisiensi Setoran Event & Cashback Ranting",
      description: "Skema cashback UKT/Latber memberikan insentif partisipasi dojo sekaligus mengamankan margin pembinaan cabang.",
      impact: "medium",
    });
  }
  if (netCashFlow > 5000000) {
    opportunities.push({
      title: "Alokasi Dana Cadangan & Operasional Dojo",
      description: "Surplus kas yang terkumpul dapat dialokasikan untuk pembaruan sarana kejuaraan atau subsidi kegiatan ranting.",
      impact: "medium",
    });
  }
  opportunities.push({
    title: "Digitalisasi Pencatatan Kwitansi & Auto-Sync",
    description: "Memanfatkan fitur Kwitansi Otomatis dan Impor Massal Excel untuk mempercepat pembukuan harian.",
    impact: "low",
  });

  // --- THREATS ---
  const threats: KasSwotItem[] = [];
  if (saldoAkhir < 1000000) {
    threats.push({
      title: "Batas Minimum Saldo Kas Terancam",
      description: `Saldo akhir tersisa ${formatRp(saldoAkhir)}. Risiko ketidakmampuan menutupi pengeluaran tak terduga jangka pendek.`,
      impact: "high",
    });
  }
  if (totalOut > totalIn && saldoAkhir < totalOut * 0.5) {
    threats.push({
      title: "Risiko Likuiditas Jangka Pendek",
      description: "Laju pengeluaran yang lebih tinggi dibanding saldo kas dapat mengganggu operasional rutin organisasi.",
      impact: "high",
    });
  }
  threats.push({
    title: "Risiko Keterlambatan Setoran Dana Ranting",
    description: "Tunggakan atau penundaan penyetoran kas dari ranting/event dapat menghambat siklus pelaporan keuangan cabang.",
    impact: "medium",
  });
  threats.push({
    title: "Fluctuating Operational Costs",
    description: "Kenaikan harga perlengkapan karate atau sewa venue dapat menekan margin kegiatan UKT/Latber.",
    impact: "medium",
  });

  // --- RECOMMENDATIONS ---
  const recommendations: string[] = [];
  if (netCashFlow < 0) {
    recommendations.push("Prioritaskan pengetatan anggaran operasional dan tunda pengeluaran non-urgent hingga kas mencapai surplus.");
  } else {
    recommendations.push("Pertahankan tren surplus kas saat ini dan alokasikan sebagian dana untuk cadangan operasional darurat.");
  }
  if (unmatchedCount > 0) {
    recommendations.push(`Segera selesaikan rekonsiliasi ${unmatchedCount} transaksi 'Belum rekon' untuk memastikan saldo kas fisik cocok 100%.`);
  }
  if (topIncomeKegiatan !== "Belum Ada") {
    recommendations.push(`Diversifikasi program penerimaan agar organisasi tidak terlalu bergantung penuh pada sektor ${topIncomeKegiatan}.`);
  }
  recommendations.push("Lakukan tinjauan kas rutin tiap akhir bulan bersama pengurus cabang dan ranting.");

  return {
    strengths,
    weaknesses,
    opportunities,
    threats,
    recommendations,
    metricsSummary: {
      totalIn,
      totalOut,
      netCashFlow,
      saldoAkhir,
      unmatchedCount,
      topIncomeKegiatan,
      topIncomeAmount,
      topExpenseKegiatan,
      topExpenseAmount,
      incomeExpenseRatio,
      selectedKegiatanCount: selectedKegiatan.length,
    },
  };
}

export function KasChartSwotPanel({
  rows,
  kpis,
  periodCaption,
  scopeLabel,
  onSwotCalculated,
}: KasChartSwotPanelProps) {
  const [activeTab, setActiveTab] = useState<"grafik" | "swot">("grafik");
  const [chartMode, setChartMode] = useState<"trend" | "kegiatan" | "net">("trend");
  const [directionFilter, setDirectionFilter] = useState<"all" | "in" | "out">("all");
  const [isKegiatanMenuOpen, setIsKegiatanMenuOpen] = useState(false);

  // Extract all unique kegiatan
  const uniqueKegiatanList = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const k = (r.kegiatan || "Tanpa Kegiatan").trim();
      if (k) set.add(k);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // Selected kegiatan state (empty array = show all)
  const [selectedKegiatan, setSelectedKegiatan] = useState<string[]>([]);

  const isAllSelected = selectedKegiatan.length === 0 || selectedKegiatan.length === uniqueKegiatanList.length;

  function toggleKegiatan(name: string) {
    if (selectedKegiatan.length === 0) {
      setSelectedKegiatan([name]);
    } else if (selectedKegiatan.includes(name)) {
      const next = selectedKegiatan.filter((k) => k !== name);
      setSelectedKegiatan(next.length === 0 ? [] : next);
    } else {
      const next = [...selectedKegiatan, name];
      if (next.length === uniqueKegiatanList.length) {
        setSelectedKegiatan([]);
      } else {
        setSelectedKegiatan(next);
      }
    }
  }

  function selectAllKegiatan() {
    setSelectedKegiatan([]);
  }

  // Filtered rows based on selected kegiatan
  const activeRows = useMemo(() => {
    if (selectedKegiatan.length === 0) return rows;
    const set = new Set(selectedKegiatan);
    return rows.filter((r) => set.has((r.kegiatan || "Tanpa Kegiatan").trim()));
  }, [rows, selectedKegiatan]);

  // Compute SWOT Analysis
  const swotResult = useMemo(() => {
    return computeKasSwotAnalysis(rows, kpis, selectedKegiatan);
  }, [rows, kpis, selectedKegiatan]);

  // Pass SWOT to parent whenever updated
  useEffect(() => {
    if (onSwotCalculated) {
      onSwotCalculated(swotResult, selectedKegiatan);
    }
  }, [swotResult, selectedKegiatan, onSwotCalculated]);

  // --- CHART DATA PREPARATION ---

  // 1. Monthly / Periodic Trend Data
  const trendData = useMemo(() => {
    const monthlyMap = new Map<string, { label: string; in: number; out: number; count: number }>();

    for (const r of activeRows) {
      const ym = r.txnDate.slice(0, 7);
      let label = ym;
      const parts = ym.split("-");
      if (parts.length === 2) {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        const mIdx = parseInt(parts[1], 10) - 1;
        if (mIdx >= 0 && mIdx < 12) {
          label = `${monthNames[mIdx]} ${parts[0]}`;
        }
      }

      const curr = monthlyMap.get(ym) || { label, in: 0, out: 0, count: 0 };
      curr.in += r.amountIn;
      curr.out += r.amountOut;
      curr.count += 1;
      monthlyMap.set(ym, curr);
    }

    const keys = Array.from(monthlyMap.keys()).sort();
    return keys.map((key) => ({ key, ...monthlyMap.get(key)! }));
  }, [activeRows]);

  const maxTrendVal = useMemo(() => {
    let max = 1;
    for (const d of trendData) {
      if (d.in > max) max = d.in;
      if (d.out > max) max = d.out;
    }
    return max;
  }, [trendData]);

  // 2. Kegiatan Breakdown Data
  const kegiatanBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; in: number; out: number; total: number; count: number }>();

    for (const r of activeRows) {
      const name = (r.kegiatan || "Tanpa Kegiatan").trim() || "Tanpa Kegiatan";
      const curr = map.get(name) || { name, in: 0, out: 0, total: 0, count: 0 };
      curr.in += r.amountIn;
      curr.out += r.amountOut;
      curr.total += r.amountIn + r.amountOut;
      curr.count += 1;
      map.set(name, curr);
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [activeRows]);

  const maxKegiatanVal = useMemo(() => {
    let max = 1;
    for (const item of kegiatanBreakdown) {
      if (item.in > max) max = item.in;
      if (item.out > max) max = item.out;
    }
    return max;
  }, [kegiatanBreakdown]);

  // Filtered Kegiatan items by direction
  const displayKegiatanBreakdown = useMemo(() => {
    if (directionFilter === "in") return kegiatanBreakdown.filter((k) => k.in > 0);
    if (directionFilter === "out") return kegiatanBreakdown.filter((k) => k.out > 0);
    return kegiatanBreakdown;
  }, [kegiatanBreakdown, directionFilter]);

  // Totals for selected rows
  const activeTotalIn = useMemo(() => activeRows.reduce((a, r) => a + r.amountIn, 0), [activeRows]);
  const activeTotalOut = useMemo(() => activeRows.reduce((a, r) => a + r.amountOut, 0), [activeRows]);
  const activeNet = activeTotalIn - activeTotalOut;

  return (
    <div className="rounded-xl border bg-card/95 p-3 sm:p-4 text-card-foreground shadow-sm transition-all dark:border-zinc-800 dark:bg-zinc-950/80">
      {/* Top Bar Navigation & Controls */}
      <div className="flex flex-col gap-3 pb-3 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
        {/* Title & Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm leading-tight">Analisis & Visualisasi Kas</h3>
            <p className="text-[11px] text-muted-foreground">{scopeLabel} · {periodCaption}</p>
          </div>
        </div>

        {/* Tab Switcher & Quick Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-lg border bg-muted/50 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("grafik")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors ${
                activeTab === "grafik"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Grafik Interaktif
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("swot")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors ${
                activeTab === "swot"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Analisis SWOT
              {swotResult.weaknesses.length > 0 && (
                <span className="ml-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  {swotResult.weaknesses.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Select Kegiatan Filter & Sub-Header */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 bg-muted/30 p-2 rounded-lg border border-border/40">
        <div className="relative inline-block text-left">
          <button
            type="button"
            onClick={() => setIsKegiatanMenuOpen((o) => !o)}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors shadow-2xs"
          >
            <Filter className="h-3.5 w-3.5 text-red-600" />
            <span>
              Kegiatan:{" "}
              <strong className="text-foreground font-semibold">
                {isAllSelected
                  ? `Semua (${uniqueKegiatanList.length})`
                  : `${selectedKegiatan.length} terpilih`}
              </strong>
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </button>

          {/* Dropdown Menu for Multi-Kegiatan */}
          {isKegiatanMenuOpen && (
            <div
              className="absolute left-0 z-30 mt-1.5 w-72 max-h-80 overflow-y-auto rounded-lg border bg-popover p-2 text-popover-foreground shadow-xl animate-in fade-in-50 zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b text-[11px] font-medium text-muted-foreground">
                <span>Pilih Kegiatan ({uniqueKegiatanList.length})</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllKegiatan}
                    className="text-red-600 hover:underline font-semibold"
                  >
                    Pilih Semua
                  </button>
                  {selectedKegiatan.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedKegiatan([])}
                      className="text-muted-foreground hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-0.5">
                {uniqueKegiatanList.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground text-center">
                    Tidak ada kegiatan terdaftar
                  </div>
                ) : (
                  uniqueKegiatanList.map((name) => {
                    const checked = isAllSelected || selectedKegiatan.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleKegiatan(name)}
                        className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors ${
                          checked
                            ? "bg-red-50 text-red-900 font-medium dark:bg-red-950/40 dark:text-red-200"
                            : "hover:bg-muted/70 text-foreground"
                        }`}
                      >
                        <span className="truncate pr-2">{name}</span>
                        {checked ? (
                          <CheckSquare className="h-4 w-4 shrink-0 text-red-600" />
                        ) : (
                          <Square className="h-4 w-4 shrink-0 opacity-40" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Selected Quick Summary Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex items-center gap-1 rounded bg-emerald-100/70 dark:bg-emerald-950/50 px-2 py-0.5 font-medium text-emerald-800 dark:text-emerald-300">
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Masuk: {formatRp(activeTotalIn)}</span>
          </div>
          <div className="inline-flex items-center gap-1 rounded bg-rose-100/70 dark:bg-rose-950/50 px-2 py-0.5 font-medium text-rose-800 dark:text-rose-300">
            <ArrowDownRight className="h-3.5 w-3.5" />
            <span>Keluar: {formatRp(activeTotalOut)}</span>
          </div>
          <div
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold ${
              activeNet >= 0
                ? "bg-blue-100/70 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300"
                : "bg-red-100/80 dark:bg-red-950/60 text-red-800 dark:text-red-300"
            }`}
          >
            <span>Net: {formatRp(activeNet)}</span>
          </div>
        </div>
      </div>

      {/* Close dropdown backdrop */}
      {isKegiatanMenuOpen && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setIsKegiatanMenuOpen(false)}
        />
      )}

      {/* TAB 1: VISUAL GRAFIK INTERAKTIF */}
      {activeTab === "grafik" && (
        <div className="mt-4 space-y-4">
          {/* Chart Sub-Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setChartMode("trend")}
                className={`rounded px-2.5 py-1 transition-colors ${
                  chartMode === "trend"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Tren Per Bulan
              </button>
              <button
                type="button"
                onClick={() => setChartMode("kegiatan")}
                className={`rounded px-2.5 py-1 transition-colors ${
                  chartMode === "kegiatan"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Distribusi Kegiatan
              </button>
              <button
                type="button"
                onClick={() => setChartMode("net")}
                className={`rounded px-2.5 py-1 transition-colors ${
                  chartMode === "net"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Arus Kas Bersih
              </button>
            </div>

            {/* Direction Filter */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground font-medium mr-1">Tampilkan:</span>
              <button
                type="button"
                onClick={() => setDirectionFilter("all")}
                className={`rounded px-2 py-0.5 font-medium transition-colors ${
                  directionFilter === "all"
                    ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter("in")}
                className={`rounded px-2 py-0.5 font-medium transition-colors ${
                  directionFilter === "in"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100"
                }`}
              >
                Pemasukan
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter("out")}
                className={`rounded px-2 py-0.5 font-medium transition-colors ${
                  directionFilter === "out"
                    ? "bg-rose-600 text-white"
                    : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 hover:bg-rose-100"
                }`}
              >
                Pengeluaran
              </button>
            </div>
          </div>

          {/* VIEW 1: TREN PER BULAN */}
          {chartMode === "trend" && (
            <div className="space-y-3">
              {trendData.length === 0 ? (
                <div className="flex h-44 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                  Tidak ada data transaksi kas pada filter ini.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-1">
                  <div className="rounded-lg border bg-card p-3 shadow-2xs">
                    <div className="mb-3 flex items-center justify-between text-xs font-semibold">
                      <span>Perbandingan Pemasukan vs Pengeluaran per Bulan</span>
                      <div className="flex items-center gap-3">
                        {(directionFilter === "all" || directionFilter === "in") && (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" />
                            Pemasukan
                          </span>
                        )}
                        {(directionFilter === "all" || directionFilter === "out") && (
                          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                            <span className="h-2.5 w-2.5 rounded-xs bg-rose-500" />
                            Pengeluaran
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bar Chart */}
                    <div className="space-y-3">
                      {trendData.map((d) => {
                        const inPct = Math.round((d.in / maxTrendVal) * 100);
                        const outPct = Math.round((d.out / maxTrendVal) * 100);
                        return (
                          <div key={d.key} className="space-y-1">
                            <div className="flex justify-between text-[11px] font-medium">
                              <span className="font-semibold text-foreground">{d.label}</span>
                              <span className="text-muted-foreground">
                                {d.count} transaksi · Net: {formatRp(d.in - d.out)}
                              </span>
                            </div>

                            <div className="space-y-1">
                              {(directionFilter === "all" || directionFilter === "in") && (
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="h-4 flex-1 overflow-hidden rounded-r bg-muted/40">
                                    <div
                                      className="h-full bg-emerald-500 transition-all duration-500 ease-out hover:bg-emerald-400"
                                      style={{ width: `${Math.max(inPct, 2)}%` }}
                                      title={`Pemasukan ${d.label}: ${formatRp(d.in)}`}
                                    />
                                  </div>
                                  <span className="w-24 text-right font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    {formatRp(d.in)}
                                  </span>
                                </div>
                              )}

                              {(directionFilter === "all" || directionFilter === "out") && (
                                <div className="flex items-center gap-2 text-xs">
                                  <div className="h-4 flex-1 overflow-hidden rounded-r bg-muted/40">
                                    <div
                                      className="h-full bg-rose-500 transition-all duration-500 ease-out hover:bg-rose-400"
                                      style={{ width: `${Math.max(outPct, 2)}%` }}
                                      title={`Pengeluaran ${d.label}: ${formatRp(d.out)}`}
                                    />
                                  </div>
                                  <span className="w-24 text-right font-mono text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                    {formatRp(d.out)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: DISTRIBUSI KEGIATAN */}
          {chartMode === "kegiatan" && (
            <div className="space-y-3">
              {displayKegiatanBreakdown.length === 0 ? (
                <div className="flex h-44 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                  Tidak ada data kegiatan yang cocok.
                </div>
              ) : (
                <div className="rounded-lg border bg-card p-3 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>Porsi Arus Kas Berdasarkan Kegiatan ({displayKegiatanBreakdown.length} Kegiatan)</span>
                    <span className="text-[11px] text-muted-foreground font-normal">Diurutkan nominal terbesar</span>
                  </div>

                  <div className="space-y-2.5">
                    {displayKegiatanBreakdown.map((item) => {
                      const shareInPct = activeTotalIn > 0 ? Math.round((item.in / activeTotalIn) * 100) : 0;
                      const shareOutPct = activeTotalOut > 0 ? Math.round((item.out / activeTotalOut) * 100) : 0;
                      const barInPct = Math.round((item.in / maxKegiatanVal) * 100);
                      const barOutPct = Math.round((item.out / maxKegiatanVal) * 100);

                      return (
                        <div
                          key={item.name}
                          className="rounded-md border border-border/50 bg-background/60 p-2 space-y-1 hover:border-red-500/40 transition-colors"
                        >
                          <div className="flex flex-wrap items-center justify-between text-xs gap-1">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-red-600" />
                              {item.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {item.count} transaksi · Net:{" "}
                              <strong className={item.in >= item.out ? "text-emerald-600" : "text-rose-600"}>
                                {formatRp(item.in - item.out)}
                              </strong>
                            </span>
                          </div>

                          {/* Bars */}
                          <div className="space-y-1 pt-0.5">
                            {(directionFilter === "all" || directionFilter === "in") && item.in > 0 && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="w-16 shrink-0 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                                  Masuk ({shareInPct}%)
                                </span>
                                <div className="h-3.5 flex-1 overflow-hidden rounded bg-emerald-100/50 dark:bg-emerald-950/40">
                                  <div
                                    className="h-full bg-emerald-500 transition-all duration-500"
                                    style={{ width: `${Math.max(barInPct, 2)}%` }}
                                  />
                                </div>
                                <span className="w-24 text-right font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  {formatRp(item.in)}
                                </span>
                              </div>
                            )}

                            {(directionFilter === "all" || directionFilter === "out") && item.out > 0 && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="w-16 shrink-0 text-[10px] text-rose-700 dark:text-rose-400 font-medium">
                                  Keluar ({shareOutPct}%)
                                </span>
                                <div className="h-3.5 flex-1 overflow-hidden rounded bg-rose-100/50 dark:bg-rose-950/40">
                                  <div
                                    className="h-full bg-rose-500 transition-all duration-500"
                                    style={{ width: `${Math.max(barOutPct, 2)}%` }}
                                  />
                                </div>
                                <span className="w-24 text-right font-mono text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                  {formatRp(item.out)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: ARUS KAS BERSIH (NET CASH FLOW) */}
          {chartMode === "net" && (
            <div className="rounded-lg border bg-card p-3 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Perkembangan Net Surplus / Defisit per Bulan</span>
                <span className="text-[11px] text-muted-foreground">Pemasukan dikurangi Pengeluaran</span>
              </div>

              {trendData.length === 0 ? (
                <div className="flex h-36 items-center justify-center text-xs text-muted-foreground">
                  Tidak ada data.
                </div>
              ) : (
                <div className="space-y-2">
                  {trendData.map((d) => {
                    const net = d.in - d.out;
                    const isPositive = net >= 0;
                    const absNet = Math.abs(net);
                    const maxAbs = Math.max(...trendData.map((td) => Math.abs(td.in - td.out)), 1);
                    const pct = Math.round((absNet / maxAbs) * 100);

                    return (
                      <div key={d.key} className="flex items-center gap-3 text-xs">
                        <span className="w-20 font-medium text-foreground text-[11px]">{d.label}</span>
                        <div className="h-4 flex-1 overflow-hidden rounded bg-muted/40 relative">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isPositive ? "bg-blue-600 dark:bg-blue-500" : "bg-red-600 dark:bg-red-500"
                            }`}
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                        </div>
                        <span
                          className={`w-28 text-right font-mono text-[11px] font-bold ${
                            isPositive ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {isPositive ? `+${formatRp(net)}` : formatRp(net)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ANALISIS SWOT KEUANGAN */}
      {activeTab === "swot" && (
        <div className="mt-4 space-y-4 animate-in fade-in-50">
          <div className="rounded-lg border bg-gradient-to-r from-red-500/5 via-amber-500/5 to-emerald-500/5 p-3 text-xs">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Analisis Keuangan Strategis & Matriks SWOT</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Dihitung secara otomatis dari data mutasi kas aktif ({activeRows.length} transaksi), rasio pemasukan/pengeluaran, dan tingkat rekonsiliasi.
            </p>
          </div>

          {/* 4 Quadrants Matrix */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* STRENGTHS (KEKUATAN) */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-950/60 dark:bg-emerald-950/20 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300 text-xs border-b border-emerald-200 dark:border-emerald-900/40 pb-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>KEKUATAN (STRENGTHS)</span>
                <span className="ml-auto rounded-full bg-emerald-200/70 dark:bg-emerald-900/60 px-1.5 text-[10px] font-bold text-emerald-900 dark:text-emerald-200">
                  {swotResult.strengths.length}
                </span>
              </div>
              <ul className="space-y-2 text-xs">
                {swotResult.strengths.map((item, idx) => (
                  <li key={idx} className="space-y-0.5">
                    <div className="font-semibold text-emerald-950 dark:text-emerald-200 flex items-start gap-1">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>{item.title}</span>
                    </div>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 pl-2.5">
                      {item.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* WEAKNESSES (KELEMAHAN) */}
            <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-3 dark:border-rose-950/60 dark:bg-rose-950/20 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-rose-800 dark:text-rose-300 text-xs border-b border-rose-200 dark:border-rose-900/40 pb-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>KELEMAHAN (WEAKNESSES)</span>
                <span className="ml-auto rounded-full bg-rose-200/70 dark:bg-rose-900/60 px-1.5 text-[10px] font-bold text-rose-900 dark:text-rose-200">
                  {swotResult.weaknesses.length}
                </span>
              </div>
              <ul className="space-y-2 text-xs">
                {swotResult.weaknesses.length === 0 ? (
                  <li className="text-[11px] text-rose-700/80 dark:text-rose-300/80 italic">
                    Tidak terdeteksi kelemahan krusial pada data periode ini.
                  </li>
                ) : (
                  swotResult.weaknesses.map((item, idx) => (
                    <li key={idx} className="space-y-0.5">
                      <div className="font-semibold text-rose-950 dark:text-rose-200 flex items-start gap-1">
                        <span className="text-rose-600 font-bold">•</span>
                        <span>{item.title}</span>
                      </div>
                      <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80 pl-2.5">
                        {item.description}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* OPPORTUNITIES (PELUANG) */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-950/60 dark:bg-blue-950/20 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-blue-800 dark:text-blue-300 text-xs border-b border-blue-200 dark:border-blue-900/40 pb-1.5">
                <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>PELUANG (OPPORTUNITIES)</span>
                <span className="ml-auto rounded-full bg-blue-200/70 dark:bg-blue-900/60 px-1.5 text-[10px] font-bold text-blue-900 dark:text-blue-200">
                  {swotResult.opportunities.length}
                </span>
              </div>
              <ul className="space-y-2 text-xs">
                {swotResult.opportunities.map((item, idx) => (
                  <li key={idx} className="space-y-0.5">
                    <div className="font-semibold text-blue-950 dark:text-blue-200 flex items-start gap-1">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>{item.title}</span>
                    </div>
                    <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 pl-2.5">
                      {item.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* THREATS (ANCAMAN) */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-950/60 dark:bg-amber-950/20 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300 text-xs border-b border-amber-200 dark:border-amber-900/40 pb-1.5">
                <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>ANCAMAN (THREATS)</span>
                <span className="ml-auto rounded-full bg-amber-200/70 dark:bg-amber-900/60 px-1.5 text-[10px] font-bold text-amber-900 dark:text-amber-200">
                  {swotResult.threats.length}
                </span>
              </div>
              <ul className="space-y-2 text-xs">
                {swotResult.threats.map((item, idx) => (
                  <li key={idx} className="space-y-0.5">
                    <div className="font-semibold text-amber-950 dark:text-amber-200 flex items-start gap-1">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{item.title}</span>
                    </div>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 pl-2.5">
                      {item.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Strategic Recommendations */}
          <div className="rounded-lg border bg-card p-3 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
              <Layers className="h-4 w-4 text-red-600" />
              <span>Rekomendasi Strategis Keuangan Organisasi</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
              {swotResult.recommendations.map((rec, i) => (
                <li key={i} className="leading-relaxed">
                  <span className="text-foreground font-medium">{rec}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

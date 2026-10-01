"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Search,
  Printer,
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ShieldCheck,
  RefreshCw,
  Users,
  Trophy,
  Award,
  Building2,
  BookmarkCheck,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type DynamicAiInsightData = {
  title: string;
  domainBadge: string;
  periodLabel: string;
  query: string;
  domain: "kas" | "anggota" | "pertandingan" | "ukt" | "organisasi";
  aiSummary: string;
  healthScore: number;
  healthStatus: "Sangat Sehat" | "Sehat" | "Perhatian" | "Kritis";
  keyInsights: string[];
  recommendations: string[];
  kpiCards: Array<{
    label: string;
    value: string;
    subtitle: string;
    color: "emerald" | "red" | "blue" | "purple" | "amber";
  }>;
  categoryBreakdown: Array<{
    name: string;
    value: number;
    valueFormatted: string;
    percentOfTotal: number;
  }>;
  tableHeaders: string[];
  tableRows: Array<Record<string, string>>;
};

const DYNAMIC_SUGGESTION_TAGS = [
  "Infografis pendapatan dan pengeluaran bulan september 2026",
  "Demografi dan distribusi atlet per sabuk kyu",
  "Rekapitulasi medali kejuaraan dan ranting teratas",
  "Statistik pendaftaran UKT semester ini",
  "Analisis sebaran dojo & keaktifan anggota",
];

export function AdminAiInsightSection() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<DynamicAiInsightData | null>(null);

  const handleGenerate = async (customQuery?: string) => {
    const q = (customQuery || prompt).trim();
    if (!q) return;

    setPrompt(q);
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/ai-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal meng-generate AI insight.");
      }

      setData(json);
    } catch (err: any) {
      console.error("[AdminAiInsight] error:", err);
      setErrorMsg(err.message || "Terjadi kesalahan saat memproses data.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getKpiIcon = (color: string, label: string) => {
    if (label.toLowerCase().includes("atlet") || label.toLowerCase().includes("anggota")) return Users;
    if (label.toLowerCase().includes("medali") || label.toLowerCase().includes("juara")) return Trophy;
    if (label.toLowerCase().includes("dojo") || label.toLowerCase().includes("ranting")) return Building2;
    if (label.toLowerCase().includes("ukt") || label.toLowerCase().includes("lunas")) return BookmarkCheck;
    if (color === "emerald") return TrendingUp;
    if (color === "red") return TrendingDown;
    if (color === "purple") return PieChart;
    return Wallet;
  };

  return (
    <div className="mb-8 space-y-6 print:mb-0 print:space-y-4">
      {/* Search Bar Container */}
      <Card className="border-inkai-red/20 bg-gradient-to-br from-inkai-red/5 via-background to-amber-500/5 shadow-md transition-all print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-inkai-red text-white shadow-xs">
              <Sparkles className="h-4 w-4 animate-pulse" />
            </div>
            Universal AI Insight & Analytics Generator
            <Badge variant="outline" className="ml-auto border-inkai-red/40 bg-inkai-red/10 text-[11px] font-semibold text-inkai-red">
              ⚡ Tanya INKAI AI Engine
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cari data apa saja di sistem (Keuangan, Atlet, Sabuk, Dojo, Kejuaraan, UKT, dsb.), misalnya: <span className="font-semibold text-foreground italic">"Demografi dan distribusi atlet per sabuk kyu"</span> atau <span className="font-semibold text-foreground italic">"Infografis pendapatan dan pengeluaran bulan september 2026"</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerate();
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ketik kueri data apa saja: atlet, keuangan kas, kejuaraan, ukt, dojo, sabuk..."
                className="w-full rounded-xl border border-input bg-background/80 py-2.5 pl-10 pr-10 text-sm font-medium transition placeholder:text-muted-foreground focus:border-inkai-red focus:outline-hidden focus:ring-2 focus:ring-inkai-red/20 dark:bg-zinc-900/90 shadow-xs"
              />
              {prompt && (
                <button
                  type="button"
                  onClick={() => setPrompt("")}
                  className="absolute right-3 top-3 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="bg-inkai-red hover:bg-inkai-red/90 text-white font-semibold rounded-xl px-5 shadow-xs cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating AI...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate AI Insight
                </>
              )}
            </Button>
          </form>

          {/* Quick Suggestions Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Lightbulb className="h-3 w-3 text-amber-500" /> Contoh Kueri:
            </span>
            {DYNAMIC_SUGGESTION_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleGenerate(tag)}
                className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-foreground/80 hover:border-inkai-red/40 hover:bg-inkai-red/5 hover:text-inkai-red transition cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <Card className="border-inkai-red/20 bg-background/50 p-6 animate-pulse">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="h-6 w-1/3 bg-muted rounded-md" />
            <div className="h-6 w-20 bg-muted rounded-md" />
          </div>
          <div className="grid gap-4 mt-6 sm:grid-cols-4">
            <div className="h-20 bg-muted rounded-xl" />
            <div className="h-20 bg-muted rounded-xl" />
            <div className="h-20 bg-muted rounded-xl" />
            <div className="h-20 bg-muted rounded-xl" />
          </div>
          <div className="h-40 bg-muted rounded-xl mt-6" />
        </Card>
      )}

      {/* AI Insight Result Container */}
      {data && !loading && (
        <div className="space-y-6 print:space-y-4">
          {/* Header Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm print:border-none print:p-0">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-inkai-red text-white hover:bg-inkai-red text-[10px]">
                  {data.domainBadge}
                </Badge>
                <h2 className="text-lg font-bold text-foreground">{data.title}</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Kueri: <span className="italic font-medium text-foreground">"{data.query}"</span> · Periode: <span className="font-semibold text-inkai-red">{data.periodLabel}</span>
              </p>
            </div>
            <Button
              type="button"
              onClick={handlePrint}
              variant="outline"
              size="sm"
              className="border-border hover:bg-muted font-semibold text-xs rounded-xl print:hidden flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5 text-inkai-red" />
              Cetak / Export Infografis
            </Button>
          </div>

          {/* AI Executive Summary & Health Card */}
          <Card className="border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 via-background to-cyan-500/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Ringkasan Eksekutif & AI Key Findings
                </CardTitle>
                <Badge variant="outline" className="border-emerald-600/40 font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  Status Sistem: {data.healthStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <p className="text-sm leading-relaxed text-foreground/90 font-normal">
                {data.aiSummary}
              </p>

              <div className="grid gap-3 md:grid-cols-2 pt-2">
                {/* Key Insights */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 space-y-2">
                  <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Poin Utama Analisis (Key Insights):
                  </p>
                  <ul className="space-y-1.5 text-muted-foreground pl-1">
                    {data.keyInsights.map((insight, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommendations */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 space-y-2">
                  <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 text-xs">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
                    Rekomendasi Strategis AI:
                  </p>
                  <ul className="space-y-1.5 text-muted-foreground pl-1">
                    {data.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-600 font-bold">→</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Cards Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.kpiCards.map((card, idx) => {
              const IconComp = getKpiIcon(card.color, card.label);
              return (
                <Card key={idx} className={`border-${card.color}-500/30 bg-${card.color}-500/5`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">{card.label}</p>
                      <p className="text-xl font-extrabold text-foreground mt-1">
                        {card.value}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{card.subtitle}</p>
                    </div>
                    <div className={`rounded-xl bg-${card.color}-500/10 p-2.5 text-${card.color}-600`}>
                      <IconComp className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Breakdown Categories Horizontal Bars */}
          {data.categoryBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-inkai-red" />
                  Infografis Breakdown & Proporsi Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{cat.name}</span>
                      <span className="font-mono text-[11px] font-bold text-inkai-red">
                        {cat.valueFormatted} ({cat.percentOfTotal}%)
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        style={{ width: `${Math.max(4, cat.percentOfTotal)}%` }}
                        className="h-full bg-inkai-red rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Rincian Data Table */}
          {data.tableRows.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Rincian Data Sampel ({data.tableRows.length} Baris Data)</span>
                  <Badge variant="outline" className="text-[11px]">
                    Database Live Record
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/50 text-muted-foreground font-bold">
                        {data.tableHeaders.map((head, idx) => (
                          <th key={idx} className="p-2.5">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-medium">
                      {data.tableRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-muted/40 transition">
                          <td className="p-2.5 font-bold text-foreground">{row.c1}</td>
                          <td className="p-2.5 text-muted-foreground">{row.c2}</td>
                          <td className="p-2.5">{row.c3}</td>
                          <td className="p-2.5">{row.c4}</td>
                          <td className="p-2.5">
                            <Badge variant="secondary" className="text-[10px]">
                              {row.c5}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import React from "react";
import { PresentationScene } from "../presentation-data";
import { Wallet, FileText, Sparkles, ShieldAlert, TrendingUp } from "lucide-react";

interface SceneProps {
  scene: PresentationScene;
  progress: number;
  isLight?: boolean;
}

export function SceneKasSekretariat({ scene: _scene, progress: _progress, isLight = true }: SceneProps) {
  return (
    <div className={`w-full h-full flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-y-auto overflow-x-hidden select-none transition-colors duration-300 ${
      isLight ? "bg-slate-50 text-slate-900" : "bg-zinc-950 text-white"
    }`}>
      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-4 border-b pb-4 ${
        isLight ? "border-slate-200" : "border-zinc-800"
      }`}>
        <div>
          <span className={`text-xs sm:text-sm uppercase tracking-wider font-extrabold px-3 py-1 rounded-lg border ${
            isLight ? "bg-red-50 text-red-700 border-red-200" : "bg-red-950/50 text-red-400 border-red-800/40"
          }`}>
            Transparansi & Kecerdasan Organisasi
          </span>
          <h2 className="text-2xl sm:text-4xl font-black mt-2 tracking-tight">
            Buku Kas, Persuratan Digital & Universal AI Insight
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs sm:text-sm border px-3.5 py-1.5 rounded-xl font-mono font-bold shadow-sm ${
            isLight ? "bg-white border-slate-200 text-slate-800" : "bg-zinc-900 border-zinc-800 text-zinc-300"
          }`}>
            Keuangan & Sekretariat
          </span>
        </div>
      </div>

      {/* Main Grid: Kas on Left, Sekretariat & AI on Right */}
      <div className="my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Buku Kas & Pos Alokasi */}
        <div className="lg:col-span-6 space-y-4">
          <div className={`border rounded-2xl p-6 shadow-xl ${
            isLight ? "bg-white border-slate-200" : "bg-zinc-900/90 border-zinc-800"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-xs sm:text-sm font-black text-emerald-700 tracking-wider">
                <Wallet className="w-5 h-5 text-emerald-600" />
                BUKU KAS & POS JATAH ANGGARAN
              </span>
              <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                isLight ? "bg-slate-100 text-slate-700 border-slate-300" : "bg-zinc-800 text-zinc-300 border-zinc-700"
              }`}>
                Laporan Detail & Buku
              </span>
            </div>
            <p className={`text-xs sm:text-sm leading-relaxed mb-4 ${isLight ? "text-slate-600" : "text-zinc-300"}`}>
              Pelacakan mutasi kas real-time dengan edit inline tanpa reload halaman, floating action bar cocok rekening bank, dan pembagian jatah pos anggaran otomatis:
            </p>

            {/* Pos Budget Bar */}
            <div className={`space-y-2 p-4 rounded-2xl border ${
              isLight ? "bg-slate-50 border-slate-200" : "bg-zinc-950 border-zinc-800"
            }`}>
              <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-800">
                <span>🎯 Alur Pagu Usulan Standar Cabang:</span>
                <span className="text-emerald-700 font-black">100% Terukur</span>
              </div>
              <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                <div style={{ width: "35%" }} className="bg-red-600" title="Pembinaan (35%)" />
                <div style={{ width: "20%" }} className="bg-amber-500" title="Sosial & Duka (20%)" />
                <div style={{ width: "15%" }} className="bg-blue-600" title="Insidentil (15%)" />
                <div style={{ width: "15%" }} className="bg-purple-600" title="Investasi (15%)" />
                <div style={{ width: "10%" }} className="bg-emerald-600" title="Sarpras (10%)" />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-slate-600 pt-1 font-semibold">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600" /> 35% Pembinaan</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 20% Duka</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> 15% Insidentil</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-600" /> 15% Investasi</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> 10% Sarpras</span>
              </div>
            </div>

            <div className="mt-3.5 flex items-center justify-between text-xs sm:text-sm font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Grafik Donut SVG & Analisis SWOT Otomatis
              </span>
              <span className="font-mono font-bold text-slate-700">PDF A4/F4 Cetak</span>
            </div>
          </div>
        </div>

        {/* Right: Sekretariat & AI Insight */}
        <div className="lg:col-span-6 space-y-4">
          {/* Feature 1: Sekretariat Digital */}
          <div className={`border rounded-2xl p-6 shadow-xl ${
            isLight ? "bg-white border-slate-200" : "bg-zinc-900/90 border-zinc-800"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-xs sm:text-sm font-black text-red-700 tracking-wider">
                <FileText className="w-5 h-5 text-red-600" />
                SEKRETARIAT & GENERATOR SURAT RESMI
              </span>
              <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                isLight ? "bg-slate-100 text-slate-700 border-slate-300" : "bg-zinc-800 text-zinc-300 border-zinc-700"
              }`}>
                Kop FORKI & INKAI
              </span>
            </div>
            <p className={`text-xs sm:text-sm leading-relaxed ${isLight ? "text-slate-600" : "text-zinc-300"}`}>
              Penomoran surat otomatis, editor visual WYSIWYG, TTD Digital Canvas luas untuk Ketua & Sekretaris, stempel resmi INKAI Surabaya, dan QR Code keabsahan publik di <code>/v/surat/[id]</code>.
            </p>
          </div>

          {/* Feature 2: Universal AI Insight & Keamanan */}
          <div className={`border-2 rounded-2xl p-6 shadow-xl ${
            isLight
              ? "bg-gradient-to-br from-white to-red-50/40 border-red-500/70"
              : "bg-gradient-to-br from-red-950/30 to-zinc-900 border-red-900/40"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-xs sm:text-sm font-black text-red-700 tracking-wider">
                <Sparkles className="w-5 h-5 text-amber-500" />
                UNIVERSAL AI INSIGHT & AUDIT KEAMANAN
              </span>
              <span className="text-xs text-emerald-800 font-black bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-300">
                Live Data
              </span>
            </div>
            <p className={`text-xs sm:text-sm leading-relaxed mb-3 ${isLight ? "text-slate-700" : "text-zinc-300"}`}>
              Ajukan kueri analitik bahasa alami (contoh: <em>&quot;Berapa total karateka per sabuk?&quot;</em> atau <em>&quot;Analisis efisiensi kas&quot;</em>) untuk menghasilkan narasi AI, 4 kartu KPI, grafik infografis, dan tabel live.
            </p>
            <div className={`flex items-center justify-between text-xs sm:text-sm pt-2 border-t font-medium ${
              isLight ? "border-slate-200 text-slate-600" : "border-zinc-800 text-zinc-400"
            }`}>
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                Pantau Sesi Aktif (/admin/online)
              </span>
              <span className="font-mono font-bold text-slate-700">1-Klik Cabut Sesi / Kunci Akun</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sub-notes */}
      <div className={`w-full pt-4 border-t flex items-center justify-between text-xs sm:text-sm ${
        isLight ? "border-slate-200 text-slate-500" : "border-zinc-800 text-zinc-500"
      }`}>
        <span>Seluruh data aman terlindungi dengan Row-Level Security PostgreSQL & Audit Log komprehensif</span>
        <span className="font-bold text-slate-600">inkai-sby.vercel.app © 2026</span>
      </div>
    </div>
  );
}

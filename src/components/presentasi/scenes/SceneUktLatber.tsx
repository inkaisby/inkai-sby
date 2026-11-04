"use client";

import React from "react";
import { PresentationScene } from "../presentation-data";
import { sfx } from "../audio-effects";
import { Printer, Users, Volume2, CheckCircle2, ChevronRight, Zap } from "lucide-react";

interface SceneProps {
  scene: PresentationScene;
  progress: number;
  isLight?: boolean;
}

export function SceneUktLatber({ scene: _scene, progress: _progress, isLight = true }: SceneProps) {
  const triggerScanAudio = () => {
    sfx.playScannerBeep();
  };

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
            Siklus Ujian & Latihan Bersama
          </span>
          <h2 className="text-2xl sm:text-4xl font-black mt-2 tracking-tight">
            Digitalisasi UKT Cabang & Rekapitulasi Matrix 1 Halaman
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs sm:text-sm border px-3.5 py-1.5 rounded-xl font-mono font-bold shadow-sm ${
            isLight ? "bg-white border-slate-200 text-slate-800" : "bg-zinc-900 border-zinc-800 text-zinc-300"
          }`}>
            Periode: UKT Semester II-2026
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: UKT Matrix 1-Page Recap & Workflow */}
        <div className="lg:col-span-7 space-y-4">
          {/* Status Pipeline Ribbon */}
          <div className={`border rounded-2xl p-4 shadow-md ${
            isLight ? "bg-white border-slate-200" : "bg-zinc-900/90 border-zinc-800"
          }`}>
            <div className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
              Alur Status Pendaftaran & Ujian Terintegrasi:
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold">
              <span className={`px-3 py-1.5 rounded-xl border ${
                isLight ? "bg-slate-100 text-slate-700 border-slate-300" : "bg-zinc-800 text-zinc-300 border-zinc-700"
              }`}>Belum Bayar</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <span className="bg-amber-50 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-xl">Menunggu Verifikasi</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <span className="bg-blue-50 text-blue-800 border border-blue-300 px-3 py-1.5 rounded-xl">Menunggu Ujian</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Lulus & Selesai
              </span>
            </div>
          </div>

          {/* Matrix Recap Preview Card */}
          <div className={`border rounded-2xl p-6 shadow-xl ${
            isLight ? "bg-white border-slate-200" : "bg-zinc-900/90 border-zinc-800"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-red-700 tracking-wider">
                <Printer className="w-5 h-5 text-red-600" />
                REKAPITULASI MATRIX RANTING × TINGKAT SABUK
              </div>
              <span className="text-xs font-bold bg-red-600 text-white px-3 py-1 rounded-lg shadow-sm">
                1 Lembar A4/F4 Utuh
              </span>
            </div>
            <p className={`text-xs sm:text-sm mb-4 leading-relaxed ${isLight ? "text-slate-600" : "text-zinc-300"}`}>
              Tabel rekapitulasi 28+ ranting melawan distribusi sabuk (Putih, Kuning, Hijau, Biru, Cokelat, DAN) didesain muat sempurna dalam satu lembar kertas tanpa terpotong, siap ditandatangani Ketua & Bidang Ujian.
            </p>

            <div className="grid grid-cols-4 gap-3 text-center">
              <div className={`p-3 rounded-xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-zinc-950 border-zinc-800"}`}>
                <div className="text-slate-500 text-xs font-medium">Total Peserta</div>
                <div className="font-black text-slate-900 text-lg sm:text-2xl mt-0.5">342</div>
              </div>
              <div className={`p-3 rounded-xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-zinc-950 border-zinc-800"}`}>
                <div className="text-slate-500 text-xs font-medium">Ranting Ikut</div>
                <div className="font-black text-amber-600 text-lg sm:text-2xl mt-0.5">24 Dojo</div>
              </div>
              <div className={`p-3 rounded-xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-zinc-950 border-zinc-800"}`}>
                <div className="text-slate-500 text-xs font-medium">Verifikasi Kas</div>
                <div className="font-black text-emerald-600 text-lg sm:text-2xl mt-0.5">100% Lunas</div>
              </div>
              <div className={`p-3 rounded-xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-zinc-950 border-zinc-800"}`}>
                <div className="text-slate-500 text-xs font-medium">Format Pengda</div>
                <div className="font-black text-blue-600 text-lg sm:text-2xl mt-0.5">2 Sheet Excel</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Scan Express Kyu Baru & Latber Walk-in */}
        <div className="lg:col-span-5 space-y-4">
          {/* Feature: Scan Express Kyu Baru Barcode Audio */}
          <div className={`border-2 rounded-2xl p-6 shadow-xl relative ${
            isLight
              ? "bg-gradient-to-br from-white to-red-50/40 border-red-500/70"
              : "bg-gradient-to-br from-zinc-900 to-zinc-950 border-red-600/40"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-red-700 tracking-wider">
                <Zap className="w-5 h-5 text-amber-500" />
                ⚡ SCAN EXPRESS KYU BARU
              </div>
              <button
                onClick={triggerScanAudio}
                className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                title="Klik untuk uji audio beep"
              >
                <Volume2 className="w-4 h-4" /> Tes Beep
              </button>
            </div>
            <p className={`text-xs sm:text-sm leading-relaxed mb-4 ${isLight ? "text-slate-700" : "text-zinc-300"}`}>
              Petugas ujian cukup menggunakan alat pemindai barcode USB atau kamera HP live untuk menembak barcode kartu anggota. Kyu Baru langsung tersimpan dengan konfirmasi audio *beep* instan.
            </p>

            <div className={`p-3.5 rounded-xl border text-xs sm:text-sm font-mono flex items-center justify-between ${
              isLight ? "bg-white border-slate-300 text-slate-700" : "bg-zinc-950 border-zinc-800 text-zinc-400"
            }`}>
              <span className="font-semibold">Scan: 35.78.01.2024.089</span>
              <span className="text-emerald-700 font-black text-sm sm:text-base">➔ Kyu 3 (Cokelat)</span>
            </div>
          </div>

          {/* Feature: Latihan Bersama (Latber) */}
          <div className={`border rounded-2xl p-5 shadow-md ${
            isLight ? "bg-white border-slate-200" : "bg-zinc-900/90 border-zinc-800"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-extrabold text-amber-700 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                LATIHAN BERSAMA (LATBER)
              </span>
              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                Biaya Net Rp 40rb
              </span>
            </div>
            <p className={`text-xs sm:text-sm leading-relaxed ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
              Mendukung walk-in publik di <code>/latber</code> tanpa login, cashback ranting otomatis Rp 5.000/peserta, pemberian kredit absensi 1 hari otomatis, serta tombol <em>Promote Tamu</em> menjadi anggota resmi.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Sub-notes */}
      <div className={`w-full pt-4 border-t flex items-center justify-between text-xs sm:text-sm ${
        isLight ? "border-slate-200 text-slate-500" : "border-zinc-800 text-zinc-500"
      }`}>
        <span>Prasyarat UKT: ambang batas minimal 75% absensi semester & pelunasan iuran diatur di Pengaturan Cabang</span>
        <span className="font-bold text-slate-600">Sinkron otomatis ke profil keanggotaan</span>
      </div>
    </div>
  );
}

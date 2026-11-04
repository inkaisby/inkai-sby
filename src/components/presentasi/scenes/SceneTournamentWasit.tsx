"use client";

import React from "react";
import { PresentationScene } from "../presentation-data";
import { Trophy, Scale, Medal } from "lucide-react";

interface SceneProps {
  scene: PresentationScene;
  progress: number;
  isLight?: boolean;
}

export function SceneTournamentWasit({ scene: _scene, progress: _progress, isLight = true }: SceneProps) {
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
            Pentas Prestasi & Lisensi Wasit Juri
          </span>
          <h2 className="text-2xl sm:text-4xl font-black mt-2 tracking-tight">
            Manajemen Kejuaraan Pertandingan & Sertifikasi Perwasitan
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs sm:text-sm border px-3.5 py-1.5 rounded-xl font-mono font-bold shadow-sm ${
            isLight ? "bg-white border-slate-200 text-slate-800" : "bg-zinc-900 border-zinc-800 text-zinc-300"
          }`}>
            Modul Atlet & Wasit Juri
          </span>
        </div>
      </div>

      {/* Main Grid: Tournament on Left & Wasit Juri on Right */}
      <div className="my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Kejuaraan Pertandingan */}
        <div className="lg:col-span-6 space-y-4">
          <div className={`border rounded-2xl p-6 shadow-xl ${
            isLight ? "bg-white border-slate-200" : "bg-zinc-900/90 border-zinc-800"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-xs sm:text-sm font-black text-amber-700 tracking-wider">
                <Trophy className="w-5 h-5 text-amber-600" />
                KEJUARAAN & ROSTER PERTANDINGAN
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                isLight ? "bg-slate-100 text-slate-700 border-slate-300" : "bg-zinc-800 text-zinc-300 border-zinc-700"
              }`}>
                ~85 Kelas Standar
              </span>
            </div>
            <p className={`text-xs sm:text-sm leading-relaxed mb-4 ${isLight ? "text-slate-600" : "text-zinc-300"}`}>
              Mendukung kompetisi Kata dan Kumite mulai dari Pra Usia Dini, Kadet, Junior, U-21, Senior, Pelajar, hingga Veteran dan Eksebisi Disabilitas dengan pemetaan kelompok usia otomatis dari tanggal lahir.
            </p>

            <div className="space-y-2.5 text-xs sm:text-sm">
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                isLight ? "bg-slate-50 border-slate-200" : "bg-zinc-950 border-zinc-800"
              }`}>
                <div className="font-bold text-slate-800">Timbang Badan (BB) Inline</div>
                <div className="text-emerald-700 font-mono font-bold text-xs sm:text-sm">Real-time Sync</div>
              </div>
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                isLight ? "bg-slate-50 border-slate-200" : "bg-zinc-950 border-zinc-800"
              }`}>
                <div className="font-bold text-slate-800">Cetak ID Card Atlet & Roster A4/F4</div>
                <div className="text-blue-700 font-mono font-bold text-xs sm:text-sm">Kop Resmi INKAI</div>
              </div>
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                isLight ? "bg-slate-50 border-slate-200" : "bg-zinc-950 border-zinc-800"
              }`}>
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Medal className="w-4 h-4 text-amber-500" />
                  Klasemen Medali & Juara Umum Dojo
                </div>
                <div className="text-amber-700 font-mono font-bold text-xs sm:text-sm">🥇 🥈 🥉 Poin Otomatis</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Sertifikasi Wasit & Juri */}
        <div className="lg:col-span-6 space-y-4">
          <div className={`border-2 rounded-2xl p-6 shadow-xl ${
            isLight
              ? "bg-gradient-to-br from-white to-red-50/40 border-red-500/70"
              : "bg-gradient-to-br from-zinc-900 to-zinc-950 border-red-600/40"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-xs sm:text-sm font-black text-red-700 tracking-wider">
                <Scale className="w-5 h-5 text-red-600" />
                SERTIFIKASI WASIT & JURI CABANG
              </span>
              <span className="text-xs bg-red-600 text-white font-bold px-2.5 py-1 rounded-lg shadow-sm font-mono">
                Kata & Kumite
              </span>
            </div>
            <p className={`text-xs sm:text-sm leading-relaxed mb-4 ${isLight ? "text-slate-700" : "text-zinc-300"}`}>
              Mewadahi penataran lisensi baru, kenaikan tingkat, dan *refreshing* lisensi: <strong>Juri B, Juri A, Wasit B, dan Wasit A</strong> dengan validasi syarat minimal Sabuk Coklat Kyu 1 / Hitam DAN.
            </p>

            <div className="space-y-2.5 text-xs sm:text-sm">
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                isLight ? "bg-white border-slate-200" : "bg-zinc-950 border-zinc-800"
              }`}>
                <span className="text-slate-500 font-medium">Autofill Riwayat Lisensi:</span>
                <span className="font-bold text-slate-800">Tarik otomatis masa berlaku & ijazah DAN</span>
              </div>
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                isLight ? "bg-white border-slate-200" : "bg-zinc-950 border-zinc-800"
              }`}>
                <span className="text-slate-500 font-medium">Sinkronisasi Buku Kas:</span>
                <span className="text-emerald-700 font-black">Auto-posting saat LUNAS ke Kas Cabang</span>
              </div>
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                isLight ? "bg-white border-slate-200" : "bg-zinc-950 border-zinc-800"
              }`}>
                <span className="text-slate-500 font-medium">Cetak Rekap Resmi:</span>
                <span className="font-bold text-slate-800">Format PDF A4/F4 Kop INKAI Surabaya</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sub-notes */}
      <div className={`w-full pt-4 border-t flex items-center justify-between text-xs sm:text-sm ${
        isLight ? "border-slate-200 text-slate-500" : "border-zinc-800 text-zinc-500"
      }`}>
        <span>Unggah berkas terkompresi otomatis ≤ 150 KB untuk efisiensi penyimpanan & kecepatan loading server</span>
        <span className="font-mono font-bold text-slate-700">Prisma ORM + PostgreSQL RLS Guard</span>
      </div>
    </div>
  );
}

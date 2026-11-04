"use client";

import React from "react";
import { PresentationScene } from "../presentation-data";
import { QrCode, MapPin, CheckCircle2, ShieldCheck, Trophy, CreditCard, Sparkles, Smartphone } from "lucide-react";

interface SceneProps {
  scene: PresentationScene;
  progress: number;
  isLight?: boolean;
}

export function SceneMemberPortal({ scene: _scene, progress: _progress, isLight = true }: SceneProps) {
  return (
    <div className={`w-full h-full flex flex-col justify-between p-4 sm:p-6 lg:p-7 relative overflow-hidden select-none transition-colors duration-300 ${
      isLight ? "bg-slate-50 text-slate-900" : "bg-zinc-950 text-white"
    }`}>
      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b pb-3 ${
        isLight ? "border-slate-200" : "border-zinc-800"
      }`}>
        <div>
          <span className={`text-xs uppercase tracking-wider font-extrabold px-3 py-1 rounded-lg border ${
            isLight ? "bg-red-50 text-red-700 border-red-200" : "bg-red-950/50 text-red-400 border-red-800/40"
          }`}>
            PENGALAMAN ANGGOTA MANDIRI
          </span>
          <h2 className="text-xl sm:text-3xl font-black mt-1 tracking-tight">
            Portal Anggota Terpadu & Absensi Pintar GPS / Barcode
          </h2>
        </div>
        <div className={`flex items-center gap-2 text-xs sm:text-sm font-semibold ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
          <Smartphone className="w-4 h-4 text-red-600" />
          <span>Mobile-First Responsive Shell (<code className="text-red-600 font-mono font-bold">/dashboard</code>)</span>
        </div>
      </div>

      {/* Main Grid: Member Digital Card on Left & Attendance/Features on Right */}
      <div className="my-auto py-2 sm:py-3 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center">
        {/* Left: Digital Member Card (KTA Digital) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2 self-start">
            <ShieldCheck className="w-4 h-4 text-red-600" /> KARTU TANDA ANGGOTA DIGITAL (KTA)
          </div>

          <div className={`w-full max-w-sm sm:max-w-md border-2 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden ${
            isLight
              ? "bg-gradient-to-br from-white via-slate-50 to-red-50/30 border-red-500/80 shadow-red-100"
              : "bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border-red-600/50 shadow-2xl"
          }`}>
            <div className="flex items-start justify-between mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-red-200 p-1 flex items-center justify-center shadow-sm">
                  <img src="/logo-inkai.png" alt="INKAI" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLElement).style.display = "none"; }} />
                  <span className="text-[10px] font-black text-red-600">INKAI</span>
                </div>
                <div>
                  <div className="text-xs font-black tracking-wider text-red-700">INKAI CABANG SURABAYA</div>
                  <div className="text-[10px] text-slate-500 font-sans tracking-wide">KARTU TANDA ANGGOTA RESMI</div>
                </div>
              </div>
              <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm">
                AKTIF
              </span>
            </div>

            <div className="flex gap-4 items-center mb-3.5">
              <div className={`w-20 h-24 rounded-xl border-2 overflow-hidden shrink-0 flex items-center justify-center ${
                isLight ? "bg-slate-100 border-slate-300" : "bg-zinc-800 border-zinc-700"
              }`}>
                <div className="text-center text-[10px] text-slate-400 p-1 font-bold">
                  FOTO ATLET
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm sm:text-base font-black leading-tight text-slate-900">AHMAD FAUZI PRATAMA</div>
                <div className="font-mono text-xs font-bold text-slate-600">NIA: 35.78.01.2024.089</div>
                <div className="text-xs text-slate-600">Ranting: <span className="font-bold text-slate-800">FORTRESS</span></div>
                <div className="inline-block text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-md">
                  Sabuk Biru (Kyu 4)
                </div>
              </div>
            </div>

            {/* QR Code Section */}
            <div className={`pt-3 border-t flex items-center justify-between ${
              isLight ? "border-slate-200" : "border-zinc-800"
            }`}>
              <div className="text-[11px] text-slate-500">
                <div className="font-semibold">Scan verifikasi publik:</div>
                <div className="font-mono text-[11px] text-slate-700 font-bold">inkai-sby.vercel.app/v/357801...</div>
              </div>
              <div className="p-1.5 bg-white rounded-lg shadow border border-slate-200 shrink-0">
                <QrCode className="w-8 h-8 text-slate-950" />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Smart Attendance & Dashboard Capabilities */}
        <div className="lg:col-span-7 space-y-3.5">
          {/* Card: Absensi Pintar */}
          <div className={`border rounded-2xl p-4 sm:p-5 shadow-lg ${
            isLight ? "bg-white border-slate-200" : "bg-zinc-900/90 border-zinc-800"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-emerald-700">
                <MapPin className="w-4 h-4 text-emerald-600" />
                ABSENSI LATIHAN CERDAS (GPS & SCAN QR)
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                isLight ? "bg-slate-100 text-slate-700 border-slate-300" : "bg-zinc-800 text-zinc-300 border-zinc-700"
              }`}>
                Maks 1x per Hari
              </span>
            </div>
            <p className={`text-xs sm:text-sm mb-3 leading-relaxed ${isLight ? "text-slate-600" : "text-zinc-300"}`}>
              Mendukung check-in GPS otomatis dengan validasi radius geofence dojo (150 meter), live camera barcode scanner untuk latihan lintas ranting, serta autentikasi biometrik WebAuthn.
            </p>

            {/* Attendance Progress Bar */}
            <div className={`p-3 rounded-xl border ${
              isLight ? "bg-slate-50 border-slate-200" : "bg-zinc-950 border-zinc-800"
            }`}>
              <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5">
                <span className="font-semibold text-slate-700">Kelayakan Ujian Kenaikan Tingkat (UKT):</span>
                <span className="font-black text-emerald-700">41 / 48 Sesi (85% · LAYAK UKT)</span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: "85%" }} />
              </div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-500 mt-1.5">
                <span>Mulai Latihan</span>
                <span className="text-amber-600 font-bold">Syarat Min: 75%</span>
                <span>Layak Ujian (100%)</span>
              </div>
            </div>
          </div>

          {/* 3 Interactive Feature Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Tile 1: Iuran */}
            <div className={`border p-3.5 rounded-xl flex flex-col justify-between shadow-sm ${
              isLight ? "bg-white border-slate-200" : "bg-zinc-900/80 border-zinc-800"
            }`}>
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-bold">
                <span className="text-xs sm:text-sm font-bold text-slate-800">Iuran Bulanan</span>
                <CreditCard className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-xs text-slate-600">Lapor setor mandiri & riwayat mutasi</div>
              <div className="text-xs font-bold text-emerald-700 mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Lunas Terverifikasi
              </div>
            </div>

            {/* Tile 2: Kejuaraan */}
            <div className={`border p-3.5 rounded-xl flex flex-col justify-between shadow-sm ${
              isLight ? "bg-white border-slate-200" : "bg-zinc-900/80 border-zinc-800"
            }`}>
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-bold">
                <span className="text-xs sm:text-sm font-bold text-slate-800">Daftar Kejuaraan</span>
                <Trophy className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xs text-slate-600">Pilih kelas Kata & Kumite sesuai usia</div>
              <div className="text-xs font-bold text-amber-700 mt-2">
                🏆 Roster Aktif
              </div>
            </div>

            {/* Tile 3: Layanan Mandiri */}
            <div className={`border p-3.5 rounded-xl flex flex-col justify-between shadow-sm ${
              isLight ? "bg-white border-slate-200" : "bg-zinc-900/80 border-zinc-800"
            }`}>
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-bold">
                <span className="text-xs sm:text-sm font-bold text-slate-800">Layanan Lengkap</span>
                <Sparkles className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xs text-slate-600">Materi digital, piagam & pindah dojo</div>
              <div className="text-xs font-mono font-bold text-slate-600 mt-2">
                100% Terintegrasi
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sub-info */}
      <div className={`w-full pt-3 border-t flex items-center justify-between text-xs sm:text-sm ${
        isLight ? "border-slate-200 text-slate-500" : "border-zinc-800 text-zinc-500"
      }`}>
        <span>Dual snapshot melindungi sabuk lama dan sabuk baru agar riwayat kenaikan tingkat tercatat abadi</span>
        <span className="font-bold text-slate-600">Mendukung PWA & Notifikasi Internal</span>
      </div>
    </div>
  );
}

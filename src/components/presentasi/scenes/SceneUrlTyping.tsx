"use client";

import React from "react";
import { PresentationScene } from "../presentation-data";
import { Globe, Search, Sparkles, MapPin, Calendar, MessageSquare, ArrowRight, ShieldCheck } from "lucide-react";

interface SceneProps {
  scene: PresentationScene;
  progress: number;
  isLight?: boolean;
}

export function SceneUrlTyping({ scene: _scene, progress, isLight = true }: SceneProps) {
  const targetUrl = "https://inkai-sby.vercel.app";
  const charCount = progress < 0.25 ? Math.floor((progress / 0.25) * targetUrl.length) : targetUrl.length;
  const typedUrl = targetUrl.slice(0, charCount);
  const isEntered = progress >= 0.25;

  return (
    <div className={`w-full h-full flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-y-auto overflow-x-hidden select-none transition-colors duration-300 ${
      isLight ? "bg-slate-50 text-slate-900" : "bg-zinc-950 text-white"
    }`}>
      {/* Background Decorative Grid */}
      <div className={`absolute inset-0 [background-size:28px_28px] pointer-events-none ${
        isLight
          ? "bg-[radial-gradient(#dc2626_1px,transparent_1px)] opacity-10"
          : "bg-[radial-gradient(#b91c1c_1px,transparent_1px)] opacity-15"
      }`} />
      <div className={`absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
        isLight ? "bg-red-200/40" : "bg-red-900/20"
      }`} />

      {/* Top Browser Bar Mockup */}
      <div className={`w-full rounded-2xl p-3 sm:p-4 shadow-xl border backdrop-blur-md z-10 transition-all duration-300 ${
        isLight
          ? "bg-white/95 border-slate-200 shadow-slate-200/50"
          : "bg-zinc-900/90 border-zinc-700/60 shadow-2xl"
      }`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-1">
            <div className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-sm" />
            <div className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-sm" />
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm" />
          </div>

          <div className={`flex-1 flex items-center gap-3 border rounded-xl px-4 py-2 sm:py-2.5 text-sm sm:text-base font-mono font-medium ${
            isLight
              ? "bg-slate-100/90 border-slate-300 text-slate-800"
              : "bg-zinc-950/80 border-zinc-700/50 text-zinc-300"
          }`}>
            <Globe className="w-5 h-5 text-red-600 shrink-0 animate-pulse" />
            <span className="font-semibold select-all">{typedUrl}</span>
            <span className={`inline-block w-2 h-5 bg-red-600 ${isEntered ? "hidden" : "animate-ping"}`} />
          </div>

          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold px-2">
            <span className={`hidden sm:inline px-3 py-1 rounded-lg border text-xs font-bold ${
              isLight ? "bg-slate-100 text-slate-700 border-slate-300" : "bg-zinc-800 text-zinc-300 border-zinc-700"
            }`}>
              HTTPS 256-BIT RESMI
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Main Showcase Stage */}
      <div className="my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        {/* Left Column: 3D Logo & Branding */}
        <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left space-y-4">
          <div className="relative group">
            <div className={`absolute -inset-1.5 rounded-3xl blur-lg transition duration-1000 animate-pulse ${
              isLight ? "bg-gradient-to-r from-red-400 to-amber-300 opacity-40" : "bg-gradient-to-r from-red-600 to-amber-600 opacity-30"
            }`} />
            <div className={`relative w-32 h-32 sm:w-44 sm:h-44 rounded-3xl border p-4 shadow-2xl flex items-center justify-center ${
              isLight ? "bg-white border-red-200" : "bg-gradient-to-b from-zinc-800 to-zinc-950 border-red-500/40"
            }`}>
              <img
                src="/logo-inkai.png"
                alt="Logo INKAI"
                className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(185,28,28,0.3)] transform hover:scale-105 transition-transform"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <div className="text-center font-black tracking-widest text-red-600 text-2xl">
                INKAI
                <div className="text-xs text-slate-500 font-sans tracking-wider mt-0.5">SURABAYA</div>
              </div>
            </div>
          </div>

          <div>
            <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold mb-3 border ${
              isLight
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}>
              <Sparkles className="w-4 h-4 text-amber-500" /> Portal Resmi Terpadu
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Institut Karate-Do Indonesia
            </h2>
            <p className={`text-base sm:text-xl font-medium mt-2 ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
              Pengurus Cabang Kota Surabaya — Jawa Timur
            </p>
          </div>
        </div>

        {/* Right Column: Portal Showcase Mockup Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {/* Card 1: Floating Chip Kegiatan Aktif */}
          <div className={`border rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all ${
            isLight
              ? "bg-white border-slate-200/90 hover:border-red-400 hover:shadow-xl"
              : "bg-zinc-900/80 border-zinc-800 hover:border-red-500/40"
          }`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-red-600 tracking-wider">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                KEGIATAN TERBUKA
              </span>
              <Calendar className="w-5 h-5 text-slate-400" />
            </div>
            <div className="my-3">
              <div className="text-base sm:text-lg font-bold">UKT & Latber Semester II-2026</div>
              <div className={`text-xs sm:text-sm mt-1 ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
                Pendaftaran online aktif untuk 28+ Ranting se-Surabaya
              </div>
            </div>
            <div className="text-xs sm:text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-lg w-fit">
              ✓ Buka Pendaftaran
            </div>
          </div>

          {/* Card 2: Direktori Dojo */}
          <div className={`border rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all ${
            isLight
              ? "bg-white border-slate-200/90 hover:border-amber-400 hover:shadow-xl"
              : "bg-zinc-900/80 border-zinc-800 hover:border-amber-500/40"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-extrabold text-amber-600 tracking-wider">DIREKTORI DOJO</span>
              <MapPin className="w-5 h-5 text-slate-400" />
            </div>
            <div className="my-3">
              <div className="text-base sm:text-lg font-bold">28+ Ranting Resmi</div>
              <div className={`text-xs sm:text-sm mt-1 ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
                Jadwal latihan terupdate, peta lokasi GPS presisi, & kontak PIC
              </div>
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-600 flex items-center gap-1.5">
              <span>Buka menu `/dojo`</span>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </div>
          </div>

          {/* Card 3: Roster Publik Tanpa Login */}
          <div className={`border rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all ${
            isLight
              ? "bg-white border-slate-200/90 hover:border-blue-400 hover:shadow-xl"
              : "bg-zinc-900/80 border-zinc-800 hover:border-blue-500/40"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-extrabold text-blue-600 tracking-wider">PORTAL TERBUKA</span>
              <Search className="w-5 h-5 text-slate-400" />
            </div>
            <div className="my-3">
              <div className="text-base sm:text-lg font-bold">Roster UKT & Latber Walk-In</div>
              <div className={`text-xs sm:text-sm mt-1 ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
                Cek status peserta publik, cetak daftar, & bayar QRIS instan
              </div>
            </div>
            <div className="text-xs sm:text-sm font-mono text-slate-600">
              Akses cepat di `/ukt` & `/latber`
            </div>
          </div>

          {/* Card 4: Asisten AI Tanya INKAI */}
          <div className={`border rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all ${
            isLight
              ? "bg-red-50/60 border-red-200 hover:border-red-400 hover:shadow-xl"
              : "bg-gradient-to-br from-red-950/40 to-zinc-900/90 border-red-900/40"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-extrabold text-red-700 flex items-center gap-1.5 tracking-wider">
                <Sparkles className="w-4 h-4 text-amber-500" />
                TANYA INKAI
              </span>
              <MessageSquare className="w-5 h-5 text-red-600" />
            </div>
            <div className="my-3">
              <div className="text-base sm:text-lg font-bold">Asisten AI Organisasi</div>
              <div className={`text-xs sm:text-sm mt-1 ${isLight ? "text-slate-600" : "text-zinc-300"}`}>
                Tanya jadwal, tata tertib ujian, hingga sejarah INKAI 24/7
              </div>
            </div>
            <div className="text-xs sm:text-sm font-bold text-red-700 bg-red-100/80 px-3 py-1 rounded-lg border border-red-200 w-fit">
              Floating Widget Aktif di Layar
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sub-Features Pills */}
      <div className={`w-full pt-4 border-t flex flex-wrap items-center justify-between text-xs sm:text-sm gap-3 z-10 ${
        isLight ? "border-slate-200 text-slate-600" : "border-zinc-800 text-zinc-400"
      }`}>
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span>Keamanan Terenkripsi HTTPS & Proteksi Vercel Edge</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-400">Fitur Publik:</span>
          <span className={`px-2.5 py-1 rounded-lg border font-semibold ${
            isLight ? "bg-white border-slate-300 text-slate-700" : "bg-zinc-800 border-zinc-700 text-zinc-200"
          }`}>
            Berita & Artikel
          </span>
          <span className={`px-2.5 py-1 rounded-lg border font-semibold ${
            isLight ? "bg-white border-slate-300 text-slate-700" : "bg-zinc-800 border-zinc-700 text-zinc-200"
          }`}>
            Apresiasi Prestasi
          </span>
          <span className={`px-2.5 py-1 rounded-lg border font-semibold ${
            isLight ? "bg-white border-slate-300 text-slate-700" : "bg-zinc-800 border-zinc-700 text-zinc-200"
          }`}>
            Verifikasi KTA (/v/[id])
          </span>
        </div>
      </div>
    </div>
  );
}

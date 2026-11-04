"use client";

import React, { useState } from "react";
import { PresentationScene } from "../presentation-data";
import { Landmark, Building2, Shield, Users, User, Zap, ArrowRight, ShieldCheck, Check } from "lucide-react";

interface SceneProps {
  scene: PresentationScene;
  progress: number;
  isLight?: boolean;
}

export function SceneRbacHierarchy({ scene: _scene, progress: _progress, isLight = true }: SceneProps) {
  const [selectedRole, setSelectedRole] = useState(2); // default to Cabang

  const roles = [
    {
      level: "Pusat / Nasional",
      code: "ADMINISTRATOR / ADMIN_PUSAT",
      icon: Landmark,
      color: isLight ? "border-purple-300 bg-purple-50 text-purple-900" : "border-purple-500/60 bg-purple-950/20 text-purple-400",
      scope: "Seluruh Indonesia",
      powers: ["Akses penuh lintas wilayah", "Manajemen semua buku kas", "Pantauan sesi aktif & audit log", "⚡ Pindah peran ke siapapun"]
    },
    {
      level: "Pengprov Jawa Timur",
      code: "ADMIN_PROVINCE",
      icon: Building2,
      color: isLight ? "border-blue-300 bg-blue-50 text-blue-900" : "border-blue-500/60 bg-blue-950/20 text-blue-400",
      scope: "Provinsi Jawa Timur",
      powers: ["Penetapan & koreksi NIA anggota", "Lihat rekap UKT tingkat daerah", "Laporan administrasi Pengda", "Monitoring cabang-cabang"]
    },
    {
      level: "Pengurus Cabang Surabaya",
      code: "ADMIN_BRANCH",
      icon: Shield,
      color: isLight ? "border-red-400 bg-red-50 text-red-950" : "border-red-500/60 bg-red-950/20 text-red-400",
      scope: "Kota Surabaya (28+ Ranting)",
      powers: ["Kelola & verifikasi UKT/Latber", "Buku Kas Cabang & Jatah Pos Alokasi", "Kenaikan sabuk & assign NIA", "Sekretariat & Generator Surat"]
    },
    {
      level: "Pengurus Ranting / Dojo",
      code: "ADMIN_DOJO",
      icon: Users,
      color: isLight ? "border-amber-300 bg-amber-50 text-amber-950" : "border-amber-500/60 bg-amber-950/20 text-amber-400",
      scope: "Dojo masing-masing (Locked Scope)",
      powers: ["Kelola anggota dojo", "Daftarkan & terima peserta ujian", "Verifikasi iuran bulanan ranting", "Cetak nota ranting & kas dojo"]
    },
    {
      level: "Anggota / Karateka & Ortu",
      code: "MEMBER / PARENT",
      icon: User,
      color: isLight ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-emerald-500/60 bg-emerald-950/20 text-emerald-400",
      scope: "Akun Pribadi & Keluarga",
      powers: ["Kartu Anggota Digital QR", "Absensi latihan GPS & Barcode", "Lapor setor iuran mandiri", "Daftar UKT & kejuaraan Kata/Kumite"]
    }
  ];

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
            Hierarki Organisasi & RBAC
          </span>
          <h2 className="text-2xl sm:text-4xl font-black mt-2 tracking-tight">
            Kontrol Akses Wilayah 5 Tingkat & Ambil Alih Sesi Cepat
          </h2>
        </div>
        <div className={`flex items-center gap-2 border px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow-sm ${
          isLight ? "bg-white border-slate-200 text-slate-700" : "bg-zinc-900 border-zinc-800 text-zinc-300"
        }`}>
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="font-bold">⚡ QuickRoleSwitcher</span>
          <span className="text-slate-400">· 1-Klik Pindah Peran</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Role Selection Cards */}
        <div className="lg:col-span-6 space-y-3">
          <div className="text-xs sm:text-sm font-bold uppercase tracking-wider mb-2 text-slate-500">
            Pilih Tingkatan Organisasi:
          </div>
          {roles.map((r, idx) => {
            const Icon = r.icon;
            const isSelected = selectedRole === idx;
            return (
              <div
                key={r.level}
                onClick={() => setSelectedRole(idx)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-center justify-between shadow-sm ${
                  isSelected
                    ? `${r.color} shadow-lg scale-[1.02] border-l-4 ring-2 ring-red-100`
                    : isLight
                      ? "bg-white border-slate-200 hover:bg-slate-100 text-slate-700"
                      : "bg-zinc-900/60 border-zinc-800 hover:bg-zinc-900 text-zinc-300"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl ${
                    isSelected
                      ? isLight ? "bg-white shadow" : "bg-zinc-950"
                      : isLight ? "bg-slate-100" : "bg-zinc-800"
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-bold flex items-center gap-2">
                      {r.level}
                      {idx === 2 && (
                        <span className="text-xs bg-red-600 text-white font-bold px-2 py-0.5 rounded-md">
                          Inti Cabang
                        </span>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm font-mono text-slate-500">{r.code}</div>
                  </div>
                </div>
                <ArrowRight className={`w-5 h-5 ${isSelected ? "opacity-100 text-red-600" : "opacity-30"}`} />
              </div>
            );
          })}
        </div>

        {/* Right: Selected Role Powers */}
        <div className="lg:col-span-6 space-y-4">
          <div className={`border rounded-2xl p-6 shadow-xl relative ${
            isLight ? "bg-white border-slate-200" : "bg-zinc-900/90 border-zinc-800"
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 mb-4 ${
              isLight ? "border-slate-200" : "border-zinc-800"
            }`}>
              <div>
                <div className="text-xs sm:text-sm text-slate-500 font-medium">Cakupan Wilayah:</div>
                <div className="text-lg sm:text-xl font-black">{roles[selectedRole].scope}</div>
              </div>
              <div className="text-right">
                <div className="text-xs sm:text-sm text-slate-500 font-medium">Hak Akses:</div>
                <div className="text-xs sm:text-sm font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  Terotentikasi & Scoped
                </div>
              </div>
            </div>

            <div className="text-xs sm:text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider">
              Wewenang & Fitur Utama:
            </div>
            <div className="space-y-2.5">
              {roles[selectedRole].powers.map((pow, i) => (
                <div key={i} className={`flex items-start gap-3 text-sm sm:text-base p-3 rounded-xl border ${
                  isLight ? "bg-slate-50/80 border-slate-200/80 text-slate-800" : "bg-zinc-950/60 border-zinc-800 text-zinc-200"
                }`}>
                  <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{pow}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Role Switcher Simulation Card */}
          <div className={`border rounded-2xl p-5 shadow-lg ${
            isLight ? "bg-red-50/60 border-red-200" : "bg-gradient-to-r from-red-950/30 via-zinc-900 to-zinc-900 border-red-900/40"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-red-700 tracking-wider">
                <Zap className="w-4 h-4 text-amber-500" /> FITUR AMBIL ALIH SESI (IMPERSONASI RESMI)
              </span>
              <span className="text-xs text-slate-500 font-mono font-bold">Topbar Admin</span>
            </div>
            <p className={`text-xs sm:text-sm leading-relaxed ${isLight ? "text-slate-700" : "text-zinc-300"}`}>
              Superadmin dan Admin Cabang dapat berpindah sudut pandang ke akun ranting mana saja secara instan 1-klik untuk membantu operasional atau verifikasi tanpa perlu logout dan tanpa perlu tahu password target, disertai pita merah penanda sesi ambil alih.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Notes */}
      <div className={`w-full pt-4 border-t flex items-center justify-between text-xs sm:text-sm ${
        isLight ? "border-slate-200 text-slate-500" : "border-zinc-800 text-zinc-500"
      }`}>
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span>Dual-Role terintegrasi: Akun pengurus otomatis terhubung dengan profil keanggotaannya</span>
        </div>
        <span className="font-bold text-slate-600">Token JWT ter-refresh otomatis ~30 detik</span>
      </div>
    </div>
  );
}

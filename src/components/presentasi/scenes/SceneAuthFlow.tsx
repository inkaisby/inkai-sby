"use client";

import React from "react";
import { PresentationScene } from "../presentation-data";
import { UserCheck, ShieldAlert, KeyRound, Mail, IdCard, CheckCircle2, RefreshCw } from "lucide-react";

interface SceneProps {
  scene: PresentationScene;
  progress: number;
  isLight?: boolean;
}

export function SceneAuthFlow({ scene: _scene, progress, isLight = true }: SceneProps) {
  const activeStep = Math.min(4, Math.floor(progress * 4) + 1);

  return (
    <div className={`w-full h-full flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-y-auto overflow-x-hidden select-none transition-colors duration-300 ${
      isLight ? "bg-slate-50 text-slate-900" : "bg-zinc-950 text-white"
    }`}>
      {/* Header Info */}
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b pb-3 shrink-0 ${
        isLight ? "border-slate-200" : "border-zinc-800"
      }`}>
        <div>
          <span className={`text-xs uppercase tracking-wider font-extrabold px-3 py-1 rounded-lg border ${
            isLight ? "bg-red-50 text-red-700 border-red-200" : "bg-red-950/50 text-red-400 border-red-800/40"
          }`}>
            SIKLUS AKUN & KEAMANAN
          </span>
          <h2 className="text-xl sm:text-3xl font-black mt-1 tracking-tight">
            Pendaftaran Karateka 4 Tahap & Autentikasi Mandiri
          </h2>
        </div>
        <div className={`text-right text-xs sm:text-sm ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
          <div>Rute Akses: <code className="text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded font-bold font-mono">/login?tab=daftar</code></div>
          <div className="text-emerald-700 font-bold mt-0.5">Dual-Role: Anggota & Pengurus</div>
        </div>
      </div>

      {/* Main Grid: 4-Step Visual on Left & Security on Right */}
      <div className="my-auto py-3 sm:py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left: 4-Step Registration Workflow */}
        <div className="lg:col-span-6 space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center justify-between text-slate-500">
            <span>Tahapan Pendaftaran Anggota Baru</span>
            <span className="text-red-600 font-mono font-extrabold text-xs sm:text-sm">Tahap {activeStep} dari 4</span>
          </div>

          {/* Step 1 */}
          <div className={`p-3 sm:p-3.5 rounded-xl border transition-all duration-300 ${
            activeStep >= 1
              ? isLight
                ? "bg-white border-red-500 shadow-sm ring-1 ring-red-200"
                : "bg-zinc-900 border-red-600/60 shadow-lg"
              : isLight
                ? "bg-slate-100/60 border-slate-200 opacity-60"
                : "bg-zinc-900/40 border-zinc-800 opacity-60"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shadow-sm ${
                  activeStep >= 1 ? "bg-red-600 text-white" : "bg-slate-300 text-slate-600"
                }`}>1</span>
                <div>
                  <div className="text-sm sm:text-base font-bold">Pilih Ranting / Dojo Latihan</div>
                  <div className={`text-xs ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
                    Pilih dojo resmi di Cabang Surabaya (Fortress, Benshi, Manyar, dll)
                  </div>
                </div>
              </div>
              {activeStep > 1 && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            </div>
          </div>

          {/* Step 2 */}
          <div className={`p-3 sm:p-3.5 rounded-xl border transition-all duration-300 ${
            activeStep >= 2
              ? isLight
                ? "bg-white border-red-500 shadow-sm ring-1 ring-red-200"
                : "bg-zinc-900 border-red-600/60 shadow-lg"
              : isLight
                ? "bg-slate-100/60 border-slate-200 opacity-60"
                : "bg-zinc-900/40 border-zinc-800 opacity-60"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shadow-sm ${
                  activeStep >= 2 ? "bg-red-600 text-white" : "bg-slate-300 text-slate-600"
                }`}>2</span>
                <div>
                  <div className="text-sm sm:text-base font-bold">Identitas Lengkap & NIK 16 Digit</div>
                  <div className={`text-xs ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
                    Nama kapital otomatis, tempat tanggal lahir, jenis kelamin, alamat & WA
                  </div>
                </div>
              </div>
              {activeStep > 2 ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  Anti-Duplikat
                </span>
              )}
            </div>
          </div>

          {/* Step 3 */}
          <div className={`p-3 sm:p-3.5 rounded-xl border transition-all duration-300 ${
            activeStep >= 3
              ? isLight
                ? "bg-white border-red-500 shadow-sm ring-1 ring-red-200"
                : "bg-zinc-900 border-red-600/60 shadow-lg"
              : isLight
                ? "bg-slate-100/60 border-slate-200 opacity-60"
                : "bg-zinc-900/40 border-zinc-800 opacity-60"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shadow-sm ${
                  activeStep >= 3 ? "bg-red-600 text-white" : "bg-slate-300 text-slate-600"
                }`}>3</span>
                <div>
                  <div className="text-sm sm:text-base font-bold">Tingkatan Sabuk & Nomor MSH</div>
                  <div className={`text-xs ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
                    Pilihan Kyu 10 s/d Kyu 1; kolom khusus No. MSH bagi Sabuk Hitam (DAN)
                  </div>
                </div>
              </div>
              {activeStep > 3 && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            </div>
          </div>

          {/* Step 4 */}
          <div className={`p-3 sm:p-3.5 rounded-xl border transition-all duration-300 ${
            activeStep >= 4
              ? isLight
                ? "bg-white border-red-500 shadow-sm ring-1 ring-red-200"
                : "bg-zinc-900 border-red-600/60 shadow-lg"
              : isLight
                ? "bg-slate-100/60 border-slate-200 opacity-60"
                : "bg-zinc-900/40 border-zinc-800 opacity-60"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shadow-sm ${
                  activeStep >= 4 ? "bg-red-600 text-white" : "bg-slate-300 text-slate-600"
                }`}>4</span>
                <div>
                  <div className="text-sm sm:text-base font-bold">Kredensial Akun (Email & Password)</div>
                  <div className={`text-xs ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
                    Verifikasi otomatis langsung `Active` & notifikasi dikirim ke admin ranting
                  </div>
                </div>
              </div>
              {activeStep >= 4 && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            </div>
          </div>
        </div>

        {/* Right: Security & Authentication Capabilities (Compact 2-Row Layout: Tidak Akan Terpotong) */}
        <div className="lg:col-span-6 space-y-3">
          {/* Card 1: Deteksi Duplikat */}
          <div className={`border rounded-xl p-3.5 sm:p-4 shadow-sm ${
            isLight ? "bg-white border-slate-200" : "bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800"
          }`}>
            <div className="flex items-center gap-2 text-amber-600 text-xs sm:text-sm font-extrabold mb-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              SISTEM ANTI-DUPLIKAT ANGGOTA
            </div>
            <p className={`text-xs leading-relaxed ${isLight ? "text-slate-700" : "text-zinc-300"}`}>
              Mencegah entri data ganda di seluruh wilayah Cabang Surabaya:
            </p>
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
              <div className="flex items-start gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1 shrink-0" />
                <span><strong>Duplikat Keras:</strong> Blok NIK sama, NIA sama, atau Nama+TTL identik.</span>
              </div>
              <div className="flex items-start gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0" />
                <span><strong>Duplikat Lunak:</strong> Peringatan kesamaan nama karateka.</span>
              </div>
            </div>
          </div>

          {/* Card 2 & 3: Login Multi-Identifier & Reset Password (Berdampingan sehingga 100% Terlihat!) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card 2: Login Fleksibel */}
            <div className={`border rounded-xl p-3.5 shadow-sm flex flex-col justify-between ${
              isLight ? "bg-white border-slate-200" : "bg-zinc-900/90 border-zinc-800"
            }`}>
              <div>
                <div className="flex items-center gap-1.5 text-blue-600 text-xs font-extrabold mb-2">
                  <IdCard className="w-4 h-4 text-blue-600" />
                  LOGIN FLEKSIBEL
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className={`p-2 rounded-lg border ${isLight ? "bg-slate-50 border-slate-200" : "bg-zinc-950 border-zinc-800"}`}>
                    <div className="text-slate-500 flex items-center gap-1 font-semibold text-[11px]">
                      <Mail className="w-3 h-3 text-red-600" /> Email:
                    </div>
                    <div className="font-mono font-bold text-slate-800 truncate">atlet@inkai.id</div>
                  </div>
                  <div className={`p-2 rounded-lg border ${isLight ? "bg-slate-50 border-slate-200" : "bg-zinc-950 border-zinc-800"}`}>
                    <div className="text-slate-500 flex items-center gap-1 font-semibold text-[11px]">
                      <UserCheck className="w-3 h-3 text-emerald-600" /> NIA:
                    </div>
                    <div className="font-mono font-bold text-slate-800">35.78.01.2024.089</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Reset Password (Jelas terlihat, tidak terpotong!) */}
            <div className={`border rounded-xl p-3.5 shadow-sm flex flex-col justify-between ${
              isLight ? "bg-white border-red-200 ring-1 ring-red-100" : "bg-zinc-900/90 border-zinc-800"
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-emerald-700 text-xs font-extrabold">
                    <KeyRound className="w-4 h-4 text-emerald-600" />
                    RESET PASSWORD
                  </span>
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className={`text-xs space-y-1.5 leading-relaxed ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <strong>1. Mandiri:</strong> Tautan token dikirim via <code>/lupa-password</code> ke email.
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <strong>2. Bantuan Admin:</strong> Tombol reset instan password sementara oleh ranting/cabang.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Note */}
      <div className={`w-full pt-3 border-t flex items-center justify-between text-xs shrink-0 ${
        isLight ? "border-slate-200 text-slate-500" : "border-zinc-800 text-zinc-500"
      }`}>
        <span>Pengaturan pendaftaran: sakelar `autoVerifyNewMember` & `publicRegistrationOpen` diatur cabang di Pengaturan</span>
        <span className="font-mono font-bold text-slate-600">NextAuth JWT + bcrypt</span>
      </div>
    </div>
  );
}

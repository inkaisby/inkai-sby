"use client";

import React from "react";
import { PresentationScene } from "../presentation-data";
import {
  ShieldCheck,
  Phone,
  Globe,
  MapPin,
  Award,
  ExternalLink,
  QrCode,
  Sparkles,
  Users
} from "lucide-react";

interface SceneProps {
  scene: PresentationScene;
  progress: number;
  isLight?: boolean;
}

export function SceneOutroContact({ scene: _scene, progress: _progress, isLight = true }: SceneProps) {
  const sumpahKarate = [
    { no: "1", title: "Sanggup Memelihara Kepribadian", desc: "Membentuk integritas moral dan budi pekerti luhur karateka." },
    { no: "2", title: "Sanggup Patuh Pada Kejujuran", desc: "Transparansi data, kejujuran sportivitas, dan akuntabilitas sistem." },
    { no: "3", title: "Sanggup Mempertinggi Prestasi", desc: "Pentas kompetisi terarah dari dojo ranting hingga panggung dunia." },
    { no: "4", title: "Sanggup Menjaga Sopan Santun", desc: "Menghormati sesama, menjunjung tinggi etika perguruan dan dewan guru." },
    { no: "5", title: "Sanggup Menguasai Diri", desc: "Pengendalian emosi, kerendahan hati, dan keteguhan mental ksatria." }
  ];

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
            PENUTUP & KONTAK RESMI SEKRETARIAT
          </span>
          <h2 className="text-xl sm:text-3xl font-black mt-1 tracking-tight">
            Sinergi Menuju Generasi Emas INKAI Surabaya
          </h2>
        </div>
        <div className={`text-right text-xs sm:text-sm ${isLight ? "text-slate-500" : "text-zinc-400"}`}>
          <div>Hotline WA: <strong className="text-red-600 font-mono">+62 857-3124-1840</strong></div>
          <div className="text-emerald-700 font-bold mt-0.5">Portal Aktif & Siap Digunakan</div>
        </div>
      </div>

      {/* Main Grid: Sumpah Karate (Kiri) & Kontak Sekretariat Resmi (Kanan) */}
      <div className="my-auto py-3 sm:py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Kolom Kiri: 5 Sumpah Karate & Transformasi */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" /> Nilai Luhur & Sumpah Karate INKAI
            </span>
            <span className="text-xs font-mono font-bold text-red-600">5 Komitmen Dasar</span>
          </div>

          <div className="space-y-2">
            {sumpahKarate.map((item) => (
              <div
                key={item.no}
                className={`p-2.5 sm:p-3 rounded-xl border flex items-start gap-3 transition-all ${
                  isLight
                    ? "bg-white border-slate-200 shadow-sm hover:border-red-300"
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="w-6 h-6 rounded-lg bg-red-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {item.no}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-800">{item.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className={`p-3 rounded-xl border flex items-center gap-3 ${
            isLight ? "bg-amber-50/70 border-amber-200 text-amber-900" : "bg-amber-950/30 border-amber-800/40 text-amber-200"
          }`}>
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-xs font-semibold leading-relaxed">
              Ekosistem digital ini dibangun demi memudahkan pelayanan bagi ranting, pelatih, wasit, dan wali atlet se-Surabaya secara transparan dan berkelanjutan.
            </p>
          </div>
        </div>

        {/* Kolom Kanan: Kontak Resmi Sekretariat & Akses Cepat */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Kontak Resmi Pengcab INKAI Surabaya
            </span>
            <span className="text-xs font-mono font-bold text-emerald-700">Terverifikasi</span>
          </div>

          <div className={`p-4 sm:p-5 rounded-2xl border shadow-sm space-y-4 ${
            isLight ? "bg-white border-slate-200" : "bg-zinc-900 border-zinc-800"
          }`}>
            {/* Alamat */}
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${isLight ? "bg-red-50 text-red-600" : "bg-zinc-800 text-red-400"}`}>
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Sekretariat Cabang</div>
                <div className="text-sm font-bold text-slate-800 mt-0.5">Pengurus Cabang INKAI Kota Surabaya</div>
                <div className="text-xs text-slate-500 mt-0.5">Surabaya, Jawa Timur - Indonesia</div>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${isLight ? "bg-emerald-50 text-emerald-600" : "bg-zinc-800 text-emerald-400"}`}>
                <Phone className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Hotline / WhatsApp Resmi</div>
                <a
                  href="https://wa.me/6285731241840"
                  target="_blank"
                  rel="noreferrer"
                  className="text-base font-extrabold text-emerald-700 hover:underline flex items-center gap-1.5 mt-0.5"
                >
                  +62 857-3124-1840 <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <div className="text-xs text-slate-500">Layanan pengurus ranting, pendaftaran UKT, dan konsultasi keanggotaan.</div>
              </div>
            </div>

            {/* Portal Web & QR */}
            <div className="flex items-start gap-3 pt-1 border-t border-slate-100">
              <div className={`p-2.5 rounded-xl shrink-0 ${isLight ? "bg-blue-50 text-blue-600" : "bg-zinc-800 text-blue-400"}`}>
                <Globe className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Portal Aplikasi Resmi</div>
                <a
                  href="https://inkai-sby.vercel.app"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-bold text-blue-700 hover:underline flex items-center gap-1 mt-0.5"
                >
                  https://inkai-sby.vercel.app <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <div className="text-xs text-slate-500">Akses mobile-first responsif untuk smartphone, tablet, & desktop.</div>
              </div>
              <div className="hidden sm:flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200 bg-slate-50">
                <QrCode className="w-12 h-12 text-slate-800" />
                <span className="text-[10px] font-mono font-bold text-slate-500 mt-1">Scan URL</span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="p-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs sm:text-sm text-center shadow-md shadow-red-200 transition flex items-center justify-center gap-1.5"
            >
              <Users className="w-4 h-4" /> Buka Beranda Utama
            </a>
            <a
              href="/login?tab=daftar"
              target="_blank"
              rel="noreferrer"
              className={`p-3 rounded-xl border font-extrabold text-xs sm:text-sm text-center transition flex items-center justify-center gap-1.5 ${
                isLight
                  ? "bg-white hover:bg-slate-100 border-slate-300 text-slate-800 shadow-sm"
                  : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-white"
              }`}
            >
              <ExternalLink className="w-4 h-4 text-red-600" /> Registrasi Anggota
            </a>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className={`flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs font-medium shrink-0 ${
        isLight ? "border-slate-200 text-slate-500" : "border-zinc-800 text-zinc-400"
      }`}>
        <span>Pengurus Cabang Institut Karate-Do Indonesia (INKAI) Kota Surabaya</span>
        <span className="font-mono text-red-600 font-bold">Integritas · Disiplin · Tangguh · Berprestasi</span>
      </div>
    </div>
  );
}


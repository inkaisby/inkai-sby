"use client";

import React from "react";
import { PresentationScene } from "../presentation-data";
import { Search, Table, FileSpreadsheet, Printer, Zap, Layers } from "lucide-react";

interface SceneProps {
  scene: PresentationScene;
  progress: number;
  isLight?: boolean;
}

export function SceneAdminMembers({ scene: _scene, progress: _progress, isLight = true }: SceneProps) {
  const members = [
    { no: 1, nia: "35.78.01.2024.089", name: "AHMAD FAUZI PRATAMA", belt: "Kyu 4 (Biru)", dojo: "FORTRESS", status: "AKTIF" },
    { no: 2, nia: "35.78.01.2023.014", name: "BUDI SANTOSO", belt: "Kyu 1 (Cokelat)", dojo: "GADING", status: "AKTIF" },
    { no: 3, nia: "35.78.01.2025.102", name: "CHELSEA NATHANIA", belt: "Kyu 8 (Kuning)", dojo: "BENSHI", status: "AKTIF" },
    { no: 4, nia: "35.78.01.2026.003", name: "DIMAS WAHYU PRASETYO", belt: "Kyu 10 (Putih)", dojo: "DOJO JWON", status: "PENDING" },
    { no: 5, nia: "35.78.01.2022.001", name: "EKO HENDRO WIJAYA", belt: "DAN 1 (Hitam)", dojo: "UNESA", status: "AKTIF" }
  ];

  return (
    <div className={`w-full h-full flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-y-auto overflow-x-hidden select-none transition-colors duration-300 ${
      isLight ? "bg-slate-50 text-slate-900" : "bg-zinc-950 text-white"
    }`}>
      {/* Header Info */}
      <div className={`flex flex-wrap items-center justify-between gap-4 border-b pb-4 ${
        isLight ? "border-slate-200" : "border-zinc-800"
      }`}>
        <div>
          <span className={`text-xs sm:text-sm uppercase tracking-wider font-extrabold px-3 py-1 rounded-lg border ${
            isLight ? "bg-red-50 text-red-700 border-red-200" : "bg-red-950/50 text-red-400 border-red-800/40"
          }`}>
            Administrasi Keanggotaan
          </span>
          <h2 className="text-2xl sm:text-4xl font-black mt-2 tracking-tight">
            Modul Kelola Anggota & Kepadatan Spreadsheet 14 Inci
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs sm:text-sm px-3.5 py-1.5 rounded-xl border flex items-center gap-2 font-bold font-mono shadow-sm ${
            isLight ? "bg-white border-slate-200 text-slate-700" : "bg-zinc-900 border-zinc-800 text-zinc-300"
          }`}>
            <Table className="w-4 h-4 text-red-600" />
            12-15+ Baris / Layar Laptop
          </span>
        </div>
      </div>

      {/* Main Grid: Spreadsheet Table on Left & Power Features on Right */}
      <div className="my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Spreadsheet Table Mockup */}
        <div className={`lg:col-span-8 border rounded-2xl p-5 shadow-xl space-y-4 ${
          isLight ? "bg-white border-slate-200" : "bg-zinc-900/90 border-zinc-800"
        }`}>
          {/* Toolbar */}
          <div className={`flex flex-wrap items-center justify-between gap-3 border-b pb-3 ${
            isLight ? "border-slate-200" : "border-zinc-800/80"
          }`}>
            <div className={`flex items-center gap-2 border rounded-xl px-3.5 py-2 text-xs sm:text-sm w-full sm:w-80 shadow-sm ${
              isLight ? "bg-slate-50 border-slate-300 text-slate-800" : "bg-zinc-950 border-zinc-800 text-zinc-300"
            }`}>
              <Search className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500 font-medium">Cari nama, NIA, ranting...</span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
              <span className="bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-lg">
                1.248 Karateka
              </span>
              <span className="bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 rounded-lg">
                28 Ranting
              </span>
            </div>
          </div>

          {/* Table Mockup with bigger readable font */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm font-sans">
              <thead>
                <tr className={`border-b text-xs uppercase tracking-wider font-extrabold ${
                  isLight ? "border-slate-200 text-slate-500 bg-slate-50/70" : "border-zinc-800 text-zinc-400"
                }`}>
                  <th className="py-2.5 px-3">No</th>
                  <th className="py-2.5 px-3">NIA / No. MSH</th>
                  <th className="py-2.5 px-3">Nama Karateka</th>
                  <th className="py-2.5 px-3">Sabuk</th>
                  <th className="py-2.5 px-3">Ranting</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody className={`divide-y font-mono ${isLight ? "divide-slate-200 text-slate-800" : "divide-zinc-800 text-zinc-200"}`}>
                {members.map((m) => (
                  <tr key={m.no} className={isLight ? "hover:bg-slate-50 transition-colors" : "hover:bg-zinc-800/50"}>
                    <td className="py-3 px-3 text-slate-400 font-sans font-bold">{m.no}</td>
                    <td className="py-3 px-3 font-semibold">{m.nia}</td>
                    <td className="py-3 px-3 font-black font-sans">{m.name}</td>
                    <td className="py-3 px-3 font-semibold">{m.belt}</td>
                    <td className="py-3 px-3 text-slate-600 font-medium">{m.dojo}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                        m.status === "AKTIF"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                          : "bg-amber-50 text-amber-700 border border-amber-300"
                      }`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        <button className="bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm">
                          <Zap className="w-3 h-3 text-amber-300" /> UKT
                        </button>
                        <button className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                          isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
                        }`}>
                          Latber
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Power Features */}
        <div className="lg:col-span-4 space-y-4">
          {/* Feature 1: Input Massal Excel */}
          <div className={`border rounded-2xl p-5 shadow-md ${
            isLight ? "bg-white border-slate-200" : "bg-zinc-900/90 border-zinc-800"
          }`}>
            <div className="flex items-center gap-2 text-emerald-700 text-xs sm:text-sm font-extrabold mb-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              INPUT MASSAL COPY-PASTE EXCEL
            </div>
            <p className={`text-xs sm:text-sm leading-relaxed ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
              Cukup salin kolom Excel (Nama, TTL, JK, Alamat, Kyu, Ranting) lalu tempel sekaligus hingga 50 karateka per batch dengan auto-generate akun login ber-NIA.
            </p>
          </div>

          {/* Feature 2: Cetak Kartu KTP CR80 PVC */}
          <div className={`border rounded-2xl p-5 shadow-md ${
            isLight ? "bg-white border-slate-200" : "bg-zinc-900/90 border-zinc-800"
          }`}>
            <div className="flex items-center gap-2 text-red-700 text-xs sm:text-sm font-extrabold mb-2">
              <Printer className="w-5 h-5 text-red-600" />
              CETAK KTA STANDAR PVC / KTP CR80
            </div>
            <p className={`text-xs sm:text-sm leading-relaxed ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
              Format cetak presisi 85.6 × 54 mm (10 kartu per lembar A4/Folio F4 atau printer kartu tunggal) lengkap dengan barcode dan kop resmi INKAI Surabaya.
            </p>
          </div>

          {/* Feature 3: Penggabungan Duplikat */}
          <div className={`border rounded-2xl p-5 shadow-md ${
            isLight ? "bg-white border-slate-200" : "bg-zinc-900/90 border-zinc-800"
          }`}>
            <div className="flex items-center gap-2 text-amber-700 text-xs sm:text-sm font-extrabold mb-2">
              <Layers className="w-5 h-5 text-amber-600" />
              GABUNGKAN (MERGE) DATA DUPLIKAT
            </div>
            <p className={`text-xs sm:text-sm leading-relaxed ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
              Satukan akun hasil pendaftaran mandiri dengan data yang sudah diinput ranting tanpa menghilangkan riwayat iuran, absensi, atau registrasi UKT.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Sub-notes */}
      <div className={`w-full pt-4 border-t flex items-center justify-between text-xs sm:text-sm ${
        isLight ? "border-slate-200 text-slate-500" : "border-zinc-800 text-zinc-500"
      }`}>
        <span>Admin Cabang & Pengprov dapat mengubah NIA dan identitas langsung dari tabel maupun sheet detail</span>
        <span className="font-mono font-bold text-slate-700">Ekspor CSV · Excel (.xlsx) · Salin WhatsApp</span>
      </div>
    </div>
  );
}

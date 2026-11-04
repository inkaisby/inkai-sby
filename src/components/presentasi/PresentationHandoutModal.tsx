"use client";

import React from "react";
import { PresentationScene } from "./presentation-data";
import { X, Printer, FileText, CheckCircle2 } from "lucide-react";

interface HandoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: PresentationScene[];
}

export function PresentationHandoutModal({ isOpen, onClose, scenes }: HandoutModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden print:m-0 print:p-0 print:border-none print:shadow-none print:max-h-none print:w-full">
        {/* Modal Header (Hidden on Print) */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-50 text-red-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Dokumen Handout & Ringkasan Presentasi Eksekutif
              </h3>
              <p className="text-xs text-slate-500">
                Format siap cetak kertas A4 / Ekspor PDF untuk materi rapat pengurus cabang dan dewan guru
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-red-200 flex items-center gap-2 transition"
            >
              <Printer className="w-4 h-4" /> Cetak / Ekspor PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Content Area */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-8 print:p-0 print:space-y-6">
          {/* Kop Surat INKAI Surabaya */}
          <div className="border-b-2 border-red-600 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-600 text-white flex items-center justify-center font-black text-xl shadow-md">
                IK
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  INSTITUT KARATE-DO INDONESIA (INKAI)
                </h1>
                <h2 className="text-sm font-extrabold text-red-600 tracking-wider">
                  PENGURUS CABANG KOTA SURABAYA
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Portal Resmi: https://inkai-sby.vercel.app · Hotline WA: +62 857-3124-1840
                </p>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <span className="text-xs font-mono font-bold px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-700">
                DOKUMEN PRESENTASI v2.0
              </span>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
          </div>

          {/* Sumpah Karate Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-1.5">
            <div className="font-black text-red-700 uppercase tracking-wider">Sumpah Karate INKAI:</div>
            <ol className="list-decimal pl-5 space-y-0.5 font-medium text-slate-700">
              <li>Sanggup memelihara kepribadian.</li>
              <li>Sanggup patuh pada kejujuran.</li>
              <li>Sanggup mempertinggi prestasi.</li>
              <li>Sanggup menjaga sopan santun.</li>
              <li>Sanggup menguasai diri.</li>
            </ol>
          </div>

          {/* Rangkaian 9 Adegan Presentasi */}
          <div className="space-y-6">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2">
              Daftar Adegan & Alur Kerja Ekosistem Sistem ({scenes.length} Topik Pembahasan)
            </h4>

            {scenes.map((sc, i) => (
              <div
                key={sc.id}
                className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white space-y-3 break-inside-avoid shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-red-50 text-red-600 border border-red-200 font-mono font-black text-sm flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div>
                      <h5 className="text-base font-black text-slate-900">{sc.title}</h5>
                      <p className="text-xs text-slate-500 font-medium">{sc.subtitle}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      ⏱ {sc.durationSeconds} detik
                    </span>
                  </div>
                </div>

                {/* Narasi Pembicara */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs sm:text-sm text-slate-700 italic leading-relaxed">
                  &ldquo;{sc.narration}&rdquo;
                </div>

                {/* Poin-poin Fitur */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-slate-600">
                  {sc.points.map((pt, pIdx) => (
                    <div key={pIdx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Lembar Tanda Tangan Pengurus */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs break-inside-avoid">
            <div>
              <div className="text-slate-500">Mengetahui,</div>
              <div className="font-bold text-slate-800 mt-1">Ketua Pengcab INKAI Surabaya</div>
              <div className="h-16" />
              <div className="font-bold text-slate-900 underline">( ............................................ )</div>
            </div>
            <div>
              <div className="text-slate-500">Penyusun Sistem,</div>
              <div className="font-bold text-slate-800 mt-1">Tim IT & Sekretariat INKAI Surabaya</div>
              <div className="h-16" />
              <div className="font-bold text-slate-900 underline">( ............................................ )</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


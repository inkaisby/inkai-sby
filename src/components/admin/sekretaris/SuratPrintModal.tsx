"use client";

import React, { useState, useEffect } from "react";
import { X, Printer, Copy, Check, FileText, Settings, Layers } from "lucide-react";
import { buildSuratPrintHtml, PrintSuratOptions } from "@/lib/surat-print-html";
import { toast } from "sonner";

export interface SuratPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: PrintSuratOptions;
}

export function SuratPrintModal({ isOpen, onClose, options }: SuratPrintModalProps) {
  const [paperSize, setPaperSize] = useState<"A4" | "F4">(options.paperSize || "A4");
  const [signatureMode, setSignatureMode] = useState<"SYSTEM" | "MANUAL" | "DRAW">(options.signatureMode || "SYSTEM");
  const [copiedWa, setCopiedWa] = useState(false);

  useEffect(() => {
    if (options.paperSize) setPaperSize(options.paperSize);
    if (options.signatureMode) setSignatureMode(options.signatureMode);
  }, [options]);

  if (!isOpen) return null;

  const currentOpts: PrintSuratOptions = {
    ...options,
    paperSize,
    signatureMode,
  };

  const htmlContent = buildSuratPrintHtml(currentOpts);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=900,height=1000");
    if (!printWindow) {
      toast.error("Gagal membuka jendela cetak. Periksa popup blocker browser.");
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const handleCopyWaText = () => {
    const tgl = options.tanggalSurat
      ? new Date(options.tanggalSurat).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "-";

    const waText = `*PENGURUS KOTA INKAI SURABAYA*
*${options.kategori === "SK" ? "SURAT KEPUTUSAN" : "SURAT RESMI / UNDANGAN"}*
----------------------------------------
📌 *Nomor:* ${options.nomorSurat}
📌 *Perihal:* ${options.perihal}
📅 *Tanggal:* ${tgl}
${options.tujuan ? `👤 *Tujuan:* ${options.tujuan}\n` : ""}
Demikian surat resmi ini disampaikan untuk dapat dilaksanakan sebagaimana mestinya. Terima kasih.
_OSS! INKAI Cabang Surabaya_`;

    navigator.clipboard.writeText(waText);
    setCopiedWa(true);
    toast.success("Teks Ringkasan WA berhasil disalin ke clipboard!");
    setTimeout(() => setCopiedWa(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Toolbar */}
        <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Pratinjau & Cetak Surat A4 / F4
              </h2>
              <p className="text-xs text-slate-400">
                No: {options.nomorSurat} &bull; {options.perihal}
              </p>
            </div>
          </div>

          {/* Settings & Actions */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Paper Size Switcher */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setPaperSize("A4")}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  paperSize === "A4" ? "bg-red-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                A4 (210×297)
              </button>
              <button
                type="button"
                onClick={() => setPaperSize("F4")}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  paperSize === "F4" ? "bg-red-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                F4 / Folio
              </button>
            </div>

            {/* Signature Mode Switcher */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setSignatureMode("SYSTEM")}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  signatureMode === "SYSTEM" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                TTD Digital
              </button>
              <button
                type="button"
                onClick={() => setSignatureMode("MANUAL")}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  signatureMode === "MANUAL" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                Kosong (Basah)
              </button>
            </div>

            {/* WA Copy */}
            <button
              type="button"
              onClick={handleCopyWaText}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-semibold transition"
            >
              {copiedWa ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copiedWa ? "Tersalin!" : "Salin Format WA"}
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition"
            >
              <Printer className="w-4 h-4" /> Cetak / Export PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Preview Area */}
        <div className="flex-1 p-6 bg-slate-950 overflow-y-auto flex justify-center">
          <div className="bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-700 transition-all duration-300 transform origin-top scale-[0.9] sm:scale-100">
            <iframe
              title="Surat Live Preview"
              srcDoc={htmlContent}
              className="w-[210mm] min-h-[297mm] border-none"
              style={{
                height: paperSize === "F4" ? "330mm" : "297mm",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

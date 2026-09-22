"use client";

import React, { useState, useEffect } from "react";
import { X, Printer, Copy, Check, FileText, Send, Download } from "lucide-react";
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

  const generateWaText = () => {
    const tgl = options.tanggalSurat
      ? new Date(options.tanggalSurat).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "-";

    const getKategoriLabel = (kat: string) => {
      switch (kat?.toUpperCase()) {
        case "TUGAS":
        case "SURAT_TUGAS":
          return "SURAT TUGAS";
        case "UNDANGAN":
        case "SURAT_UNDANGAN":
          return "SURAT UNDANGAN";
        case "KETERANGAN":
        case "SURAT_KETERANGAN":
          return "SURAT KETERANGAN";
        case "REKOMENDASI":
          return "SURAT REKOMENDASI";
        case "SK":
        case "SK_PENGURUS":
          return "SURAT KEPUTUSAN";
        case "RAPAT":
        case "RESUME_RAPAT":
          return "RESUME & NOTULENSI RAPAT";
        case "PERMOHONAN":
          return "SURAT PERMOHONAN";
        default:
          return kat ? `SURAT ${kat}` : "SURAT RESMI / UNDANGAN";
      }
    };

    let bodyText = "";
    if (options.contentHtml) {
      bodyText = options.contentHtml
        .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n\n*$1*\n")
        .replace(/<li[^>]*>(.*?)<\/li>/gi, "\n• $1")
        .replace(/<(b|strong)[^>]*>(.*?)<\/(b|strong)>/gi, "*$2*")
        .replace(/<(i|em)[^>]*>(.*?)<\/(i|em)>/gi, "_$2_")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/tr>/gi, "\n")
        .replace(/<\/(td|th)>/gi, "  ")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");

      bodyText = bodyText
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    let tableText = "";
    if (options.tableRows && options.tableRows.length > 0) {
      const headers = (options.tableHeaders || ["NO", "NAMA", "JABATAN"]).filter((h) => h !== "NO");
      tableText = options.tableRows
        .map((row, idx) => {
          const details = headers.map((h) => row[h]).filter(Boolean).join(" - ");
          return `${idx + 1}. ${details}`;
        })
        .join("\n");
    }

    const kategoriHeader = getKategoriLabel(options.kategori);

    let waText = `*PENGURUS KOTA INKAI SURABAYA*
*${kategoriHeader}*
----------------------------------------
📌 *Nomor:* ${options.nomorSurat}
📌 *Perihal:* ${options.perihal}
📅 *Tanggal:* ${tgl}`;

    if (options.tujuan) {
      waText += `\n👤 *Tujuan:* ${options.tujuan}`;
    }

    if (bodyText) {
      waText += `\n----------------------------------------\n${bodyText}`;
    }

    if (tableText) {
      waText += `\n----------------------------------------\n📋 *DAFTAR TABEL / PERSONEL:*\n${tableText}`;
    }

    waText += `\n----------------------------------------
Demikian surat resmi ini disampaikan untuk dapat dilaksanakan sebagaimana mestinya. Terima kasih.

_OSS! INKAI Cabang Surabaya_`;

    return waText;
  };

  const handleCopyWaText = () => {
    const waText = generateWaText();
    navigator.clipboard.writeText(waText);
    setCopiedWa(true);
    toast.success("Teks Format WA berisi isi surat berhasil disalin!");
    setTimeout(() => setCopiedWa(false), 3000);
  };

  const handleOpenWaDirect = () => {
    const waText = generateWaText();
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
    window.open(url, "_blank");
    toast.success("Membuka WhatsApp...");
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Surat-${options.nomorSurat.replace(/[\/\\:]/g, "_")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("File Dokumen HTML berhasil diunduh!");
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

            {/* WA Direct Share */}
            <button
              type="button"
              onClick={handleOpenWaDirect}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-semibold transition shadow-xs"
              title="Buka Langsung di WhatsApp Web / App"
            >
              <Send className="w-3.5 h-3.5" /> Kirim ke WA
            </button>

            {/* WA Copy */}
            <button
              type="button"
              onClick={handleCopyWaText}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-semibold transition"
              title="Salin Teks WA"
            >
              {copiedWa ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copiedWa ? "Tersalin!" : "Salin WA"}
            </button>

            {/* Download HTML */}
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl transition"
              title="Unduh Dokumen HTML"
            >
              <Download className="w-4 h-4" />
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

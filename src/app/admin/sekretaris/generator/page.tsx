"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileSpreadsheet,
  Printer,
  Save,
  Plus,
  Trash2,
  Copy,
  Check,
  Search,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Palette,
  Highlighter,
  Eraser,
  Code,
  Eye,
  Sparkles,
  Share2,
  CalendarDays,
  FileText,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import { buildSuratPrintHtml } from "@/lib/surat-print-html";
import { SuratPrintModal } from "@/components/admin/sekretaris/SuratPrintModal";

export default function SuratGeneratorPage() {
  const [templateKey, setTemplateKey] = useState<
    "SURAT_TUGAS" | "SURAT_UNDANGAN" | "SURAT_KETERANGAN" | "REKOMENDASI" | "SK_PENGURUS" | "RESUME_RAPAT"
  >("SURAT_TUGAS");

  // Form parameter state
  const [kategori, setKategori] = useState("TUGAS");
  const [nomorSurat, setNomorSurat] = useState("AUTO");
  const [tanggalSurat, setTanggalSurat] = useState(new Date().toISOString().split("T")[0]);
  const [perihal, setPerihal] = useState("Surat Tugas Panitia UKT Semester II Tahun 2026");
  const [tujuan, setTujuan] = useState("Panitia UKT INKAI Surabaya");
  const [ditetapkanDi, setDitetapkanDi] = useState("Surabaya");
  const [ketuaName, setKetuaName] = useState("Jonathan Christian Bernard Kandou, S.Pd.");
  const [ketuaJabatan, setKetuaJabatan] = useState("Ketua");
  const [sekretarisName, setSekretarisName] = useState("Miftachul Au’lidhina");
  const [sekretarisJabatan, setSekretarisJabatan] = useState("Sekretaris");
  const [paperSize, setPaperSize] = useState<"A4" | "F4">("A4");
  const [signatureMode, setSignatureMode] = useState<"SYSTEM" | "MANUAL">("SYSTEM");
  const [previewZoom, setPreviewZoom] = useState<number>(0.7);

  // Rich text styling
  const [fontFamily, setFontFamily] = useState("'Times New Roman', Times, serif");
  const [fontSize, setFontSize] = useState("12pt");

  // Table rows
  const [tableHeaders, setTableHeaders] = useState(["NO", "NAMA", "JABATAN"]);
  const [tableRows, setTableRows] = useState<Array<Record<string, string>>>([
    { NAMA: "Jonathan Christian Bernard Kandou", JABATAN: "Ketua INKAI Surabaya dan Penanggung Jawab" },
    { NAMA: "Tonny Siswanto", JABATAN: "Wakil INKAI Surabaya" },
    { NAMA: "Indiantoko", JABATAN: "Koordinator Lapangan" },
    { NAMA: "Yuandika Hindiari", JABATAN: "Sekretaris UKT INKAI Surabaya" },
    { NAMA: "Habibur Rahman", JABATAN: "Bendahara UKT INKAI Surabaya" },
  ]);

  // Content body html
  const [contentHtml, setContentHtml] = useState(
    `<p style="margin-bottom:8px;">I. Berkenaan dengan kegiatan Ujian Kenaikan Tingkat Kyu Semester II Tahun 2026 INKAI Surabaya tanggal 06 September 2026 di Gedung Prasarana Olahraga Dispora Jatim, maka Pengurus Kota INKAI Surabaya perlu menunjuk dan/atau menugaskan PANITIA UKT dengan susunan di bawah ini:</p>`
  );

  // Visual WYSIWYG Editor State & Ref
  const visualEditorRef = useRef<HTMLDivElement>(null);
  const [editorMode, setEditorMode] = useState<"VISUAL" | "CODE">("VISUAL");
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);

  // Sync contentHtml to visual editor div when contentHtml changes externally
  useEffect(() => {
    if (visualEditorRef.current && visualEditorRef.current.innerHTML !== contentHtml) {
      visualEditorRef.current.innerHTML = contentHtml;
    }
  }, [contentHtml, editorMode]);

  // Execute formatting commands on selection directly in place
  const execCmd = (command: string, value: string | undefined = undefined) => {
    if (visualEditorRef.current) {
      visualEditorRef.current.focus();
    }
    try {
      document.execCommand(command, false, value);
    } catch (err) {}
    if (visualEditorRef.current) {
      setContentHtml(visualEditorRef.current.innerHTML);
    }
  };

  const handleVisualInput = () => {
    if (visualEditorRef.current) {
      setContentHtml(visualEditorRef.current.innerHTML);
    }
  };

  // Next number preview
  const [nextNumberPreview, setNextNumberPreview] = useState("");
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Saved rapat import state
  const [rapatList, setRapatList] = useState<any[]>([]);
  const [loadingRapat, setLoadingRapat] = useState(false);
  const [selectedRapatId, setSelectedRapatId] = useState<string>("");

  // Member suggest autocomplete
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSuggestions, setMemberSuggestions] = useState<any[]>([]);

  const fetchRapatList = async () => {
    setLoadingRapat(true);
    try {
      const res = await fetch("/api/admin/sekretaris/rapat");
      const data = await res.json();
      if (data.success) {
        setRapatList(data.items || []);
      }
    } catch (err) {
    } finally {
      setLoadingRapat(false);
    }
  };

  useEffect(() => {
    fetchRapatList();
  }, []);

  const fetchNextNumber = async (kat: string, date: string) => {
    try {
      const res = await fetch(`/api/admin/sekretaris/surat/next-number?kategori=${kat}&date=${date}`);
      const data = await res.json();
      if (data.success) {
        setNextNumberPreview(data.nextNumber);
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (nomorSurat === "AUTO") {
      fetchNextNumber(kategori, tanggalSurat);
    }
  }, [kategori, tanggalSurat, nomorSurat]);

  // Handle template selection preset
  const handleSelectTemplate = (key: typeof templateKey) => {
    setTemplateKey(key);
    if (key === "SURAT_TUGAS") {
      setKategori("TUGAS");
      setPerihal("Surat Tugas Panitia UKT Semester II Tahun 2026");
      setTableHeaders(["NO", "NAMA", "JABATAN"]);
      setTableRows([
        { NAMA: "Jonathan Christian Bernard Kandou", JABATAN: "Ketua INKAI Surabaya dan Penanggung Jawab" },
        { NAMA: "Tonny Siswanto", JABATAN: "Wakil INKAI Surabaya" },
        { NAMA: "Indiantoko", JABATAN: "Koordinator Lapangan" },
        { NAMA: "Yuandika Hindiari", JABATAN: "Sekretaris UKT INKAI Surabaya" },
        { NAMA: "Habibur Rahman", JABATAN: "Bendahara UKT INKAI Surabaya" },
      ]);
      setContentHtml(
        `<p style="margin-bottom:8px;">I. Berkenaan dengan kegiatan Ujian Kenaikan Tingkat Kyu Semester II Tahun 2026 INKAI Surabaya tanggal 06 September 2026 di Gedung Prasarana Olahraga Dispora Jatim, maka Pengurus Kota INKAI Surabaya perlu menunjuk dan/atau menugaskan PANITIA UKT dengan susunan di bawah ini:</p>`
      );
    } else if (key === "SURAT_UNDANGAN") {
      setKategori("UNDANGAN");
      setPerihal("Undangan Resmi Latihan Bersama (Latber) INKAI Surabaya");
    } else if (key === "SURAT_KETERANGAN") {
      setKategori("KETERANGAN");
      setPerihal("Surat Keterangan Anggota Aktif & Kenaikan Sabuk");
    } else if (key === "REKOMENDASI") {
      setKategori("REKOMENDASI");
      setPerihal("Surat Rekomendasi Keikutsertaan Kejuaraan Karate");
    } else if (key === "SK_PENGURUS") {
      setKategori("SK");
      setPerihal("Surat Keputusan Pengangkatan Pengurus Dojo");
    } else if (key === "RESUME_RAPAT") {
      setKategori("RAPAT");
      setPerihal("Resume & Notulensi Rapat Pengurus INKAI Surabaya");
      setTujuan("Pengurus & Anggota INKAI Surabaya");
      setTableHeaders(["NO", "ACTION ITEM / TUGAS", "PENANGGUNG JAWAB"]);
      setTableRows([
        { "ACTION ITEM / TUGAS": "Penyiapan Berkas & Tempat UKT", "PENANGGUNG JAWAB": "Sekretaris" },
        { "ACTION ITEM / TUGAS": "Koordinasi Perlengkapan Tatami & Sound System", "PENANGGUNG JAWAB": "Koordinator Lapangan" },
        { "ACTION ITEM / TUGAS": "Verifikasi Rekapitulasi Iuran & Biaya UKT", "PENANGGUNG JAWAB": "Bendahara" },
      ]);
      setContentHtml(
        `<p style="margin-bottom:8px;"><b>I. AGENDA RAPAT:</b> Evaluasi Program Kerja & Persiapan Ujian Kenaikan Tingkat (UKT) Semester II Tahun 2026</p>
<p style="margin-bottom:8px;"><b>II. WAKTU & TEMPAT:</b> Sabtu, 19 September 2026 | Sekretariat Cabang INKAI Surabaya</p>
<p style="margin-bottom:8px;"><b>III. PIMPINAN RAPAT:</b> Jonathan Christian Bernard Kandou, S.Pd.</p>
<p style="margin-bottom:8px;"><b>IV. RISALAH KEPUTUSAN & PEMBAHASAN:</b></p>
<ol style="margin-bottom:8px; padding-left:20px;">
  <li>Pelaksanaan UKT disepakati bertempat di Gedung Prasarana Olahraga Dispora Jatim.</li>
  <li>Pendaftaran dibuka secara terintegrasi via portal resmi INKAI Surabaya.</li>
  <li>Seluruh pengurus dan panitia pelaksana wajib mengawal kelancaran teknis kegiatan.</li>
</ol>
<p style="margin-bottom:8px;"><b>V. DAFTAR ACTION ITEMS / TUGAS PELAKSANAAN:</b></p>`
      );
    }
  };

  const handleImportRapatData = (rapatId: string) => {
    setSelectedRapatId(rapatId);
    if (!rapatId) return;
    const rapat = rapatList.find((r) => r.id === rapatId);
    if (!rapat) return;

    setKategori("RAPAT");
    setPerihal(`Resume & Notulensi: ${rapat.judulRapat}`);
    if (rapat.tanggalRapat) {
      setTanggalSurat(new Date(rapat.tanggalRapat).toISOString().split("T")[0]);
    }
    if (rapat.lokasi) {
      setDitetapkanDi(rapat.lokasi);
    }
    if (rapat.pimpinanRapat) {
      setKetuaName(rapat.pimpinanRapat);
    }

    if (Array.isArray(rapat.actionItems) && rapat.actionItems.length > 0) {
      setTableHeaders(["NO", "ACTION ITEM / TUGAS", "PENANGGUNG JAWAB"]);
      setTableRows(
        rapat.actionItems.map((a: any) => ({
          "ACTION ITEM / TUGAS": a.task || "",
          "PENANGGUNG JAWAB": a.assignee || "-",
        }))
      );
    }

    const pesertaStr = Array.isArray(rapat.pesertaHadir) && rapat.pesertaHadir.length > 0
      ? rapat.pesertaHadir.join(", ")
      : "-";

    const tglFormatted = new Date(rapat.tanggalRapat).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    setContentHtml(
      `<p style="margin-bottom:8px;"><b>I. JUDUL RAPAT:</b> ${rapat.judulRapat}</p>
<p style="margin-bottom:8px;"><b>II. HARI / TANGGAL:</b> ${tglFormatted}</p>
<p style="margin-bottom:8px;"><b>III. LOKASI:</b> ${rapat.lokasi || "-"}</p>
<p style="margin-bottom:8px;"><b>IV. PIMPINAN RAPAT:</b> ${rapat.pimpinanRapat || "-"}</p>
<p style="margin-bottom:8px;"><b>V. PESERTA HADIR:</b> ${pesertaStr}</p>
<p style="margin-bottom:8px;"><b>VI. AGENDA RAPAT:</b><br/>${rapat.agenda || "-"}</p>
<p style="margin-bottom:8px;"><b>VII. PEMBAHASAN & RISALAH KEPUTUSAN:</b><br/>${rapat.keputusan || rapat.pembahasan || "-"}</p>
<p style="margin-bottom:8px;"><b>VIII. DAFTAR TUGAS & ACTION ITEMS:</b></p>`
    );

    toast.success(`Data notulensi "${rapat.judulRapat}" berhasil diimpor!`);
  };

  // Search members for autocomplete
  const searchMembers = async (q: string) => {
    setMemberSearch(q);
    if (!q || q.length < 2) {
      setMemberSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/members?q=${encodeURIComponent(q)}&take=5`);
      const data = await res.json();
      if (data.members) {
        setMemberSuggestions(data.members);
      }
    } catch (err) {}
  };

  const addTableRow = (nama: string = "", jabatan: string = "") => {
    const dataHeaders = tableHeaders.filter((h) => h !== "NO");
    const newRow: Record<string, string> = {};
    dataHeaders.forEach((h, idx) => {
      if (idx === 0 && nama) newRow[h] = nama;
      else if (idx === 1 && jabatan) newRow[h] = jabatan;
      else newRow[h] = "";
    });
    setTableRows([...tableRows, newRow]);
  };

  const removeTableRow = (index: number) => {
    setTableRows(tableRows.filter((_, i) => i !== index));
  };

  const updateTableRowField = (index: number, field: string, val: string) => {
    const updated = [...tableRows];
    updated[index] = { ...updated[index], [field]: val };
    setTableRows(updated);
  };

  const currentOpts = {
    nomorSurat: nomorSurat === "AUTO" ? nextNumberPreview : nomorSurat,
    tanggalSurat,
    perihal,
    kategori,
    type: "KELUAR",
    paperSize,
    signatureMode,
    ketuaName,
    ketuaJabatan,
    sekretarisName,
    sekretarisJabatan,
    ditetapkanDi,
    fontFamily,
    fontSize,
    tableHeaders,
    tableRows,
    contentHtml,
  };

  const liveHtmlContent = buildSuratPrintHtml(currentOpts);

  const handleSaveToSuratKeluar = async () => {
    setSaving(true);
    try {
      const finalNomor = nomorSurat === "AUTO" ? nextNumberPreview : nomorSurat;
      const res = await fetch("/api/admin/sekretaris/surat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "KELUAR",
          nomorSurat: finalNomor,
          tanggalSurat,
          perihal,
          tujuan,
          kategori,
          status: "ISSUED",
          paperSize,
          signatureMode,
          templateKey,
          templateData: {
            contentHtml,
            tableHeaders,
            tableRows,
            ketuaName,
            sekretarisName,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Surat resmi No. ${finalNomor} berhasil diterbitkan dan tersimpan di Buku Surat Keluar!`);
      } else {
        toast.error(data.error || "Gagal menyimpan surat");
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm transition-colors">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-red-600 dark:text-red-400" /> Generator & Template Surat PDF
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Buat surat resmi A4/F4 dengan Kop INKAI Surabaya, WYSIWYG editor, & TTD/Stempel otomatis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveToSuratKeluar}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95"
          >
            <Save className="w-4 h-4" /> {saving ? "Simpan..." : "Simpan Surat Keluar"}
          </button>
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition active:scale-95"
          >
            <Printer className="w-4 h-4" /> Cetak / Export PDF
          </button>
        </div>
      </div>

      {/* Preset Template Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm space-y-3">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Pilihan Templat Surat & Dokumen Organisasi:
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "SURAT_TUGAS", label: "Surat Tugas Panitia/Petugas" },
            { key: "SURAT_UNDANGAN", label: "Surat Undangan Resmi" },
            { key: "SURAT_KETERANGAN", label: "Surat Keterangan Anggota" },
            { key: "REKOMENDASI", label: "Surat Rekomendasi Event" },
            { key: "SK_PENGURUS", label: "Surat Keputusan (SK)" },
            { key: "RESUME_RAPAT", label: "Resume Rapat / Notulensi" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleSelectTemplate(t.key as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
                templateKey === t.key
                  ? "bg-red-600 border-red-500 text-white shadow-md shadow-red-600/20"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Split Grid: Editor (Left) vs Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor Form Parameters (6 Cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5 text-xs">
          <h2 className="font-bold text-slate-900 dark:text-white text-base border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <span>📝 Parameter & Editor Isi Surat</span>
            <span className="text-xs text-red-600 dark:text-red-400 font-mono font-bold">Format: {kategori}</span>
          </h2>

          {/* Impor Rapat Box */}
          <div className="p-3.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-900 dark:text-purple-300 text-xs flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Impor Notulensi Rapat Tersimpan
              </span>
              {loadingRapat && <span className="text-[11px] text-purple-600 dark:text-purple-400 animate-pulse">Memuat...</span>}
            </div>
            <select
              value={selectedRapatId}
              onChange={(e) => handleImportRapatData(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700/60 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-purple-500"
            >
              <option value="">-- Impor Otomatis dari Database Notulensi Rapat --</option>
              {rapatList.map((r) => (
                <option key={r.id} value={r.id}>
                  {new Date(r.tanggalRapat).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} - {r.judulRapat} ({r.pimpinanRapat || "Tanpa pimpinan"})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Nomor Surat</label>
              <input
                type="text"
                value={nomorSurat}
                onChange={(e) => setNomorSurat(e.target.value)}
                placeholder="AUTO / Nomor manual"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-900 focus:border-red-500"
              />
              {nomorSurat === "AUTO" && (
                <div className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-bold">Preview: {nextNumberPreview}</div>
              )}
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Tanggal Surat</label>
              <input
                type="date"
                value={tanggalSurat}
                onChange={(e) => setTanggalSurat(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Perihal Surat</label>
            <input
              type="text"
              value={perihal}
              onChange={(e) => setPerihal(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold focus:bg-white dark:focus:bg-slate-900 focus:border-red-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Tujuan / Kepada</label>
              <input
                type="text"
                value={tujuan}
                onChange={(e) => setTujuan(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Tempat Ditetapkan</label>
              <input
                type="text"
                value={ditetapkanDi}
                onChange={(e) => setDitetapkanDi(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-red-500"
              />
            </div>
          </div>

          {/* Paper & TTD Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-bold">Ukuran Kertas Print</label>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as any)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
              >
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="F4">F4 / Folio (215 × 330 mm)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-bold">Mode Tanda Tangan</label>
              <select
                value={signatureMode}
                onChange={(e) => setSignatureMode(e.target.value as any)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
              >
                <option value="SYSTEM">TTD & Stempel Digital</option>
                <option value="MANUAL">Kosong (TTD Basah Manual)</option>
              </select>
            </div>
          </div>

          {/* Rich Text Editor Toolbar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-red-600 dark:text-red-400" /> WYSIWYG Visual Editor & Style Toolbar
              </label>

              {/* Editor Mode Switcher */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setEditorMode("VISUAL")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                    editorMode === "VISUAL"
                      ? "bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <Eye className="w-3 h-3" /> Visual Editor
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode("CODE")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                    editorMode === "CODE"
                      ? "bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <Code className="w-3 h-3" /> Kode HTML Raw
                </button>
              </div>
            </div>

            {/* Comprehensive Toolbar */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl relative">
              {/* Font Family Selector */}
              <select
                value={fontFamily}
                onChange={(e) => {
                  setFontFamily(e.target.value);
                  execCmd("fontName", e.target.value);
                }}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:border-red-500"
                title="Pilih Jenis Font"
              >
                <option value="'Times New Roman', Times, serif">Times New Roman</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="Calibri, sans-serif">Calibri</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Courier New', Courier, monospace">Courier New</option>
                <option value="Verdana, sans-serif">Verdana</option>
              </select>

              {/* Font Size Selector */}
              <select
                value={fontSize}
                onChange={(e) => {
                  setFontSize(e.target.value);
                  const sizeMap: Record<string, string> = {
                    "10pt": "1",
                    "11pt": "2",
                    "12pt": "3",
                    "14pt": "4",
                    "16pt": "5",
                    "18pt": "6",
                    "24pt": "7",
                  };
                  execCmd("fontSize", sizeMap[e.target.value] || "3");
                }}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:border-red-500"
                title="Ukuran Font"
              >
                <option value="10pt">10 pt</option>
                <option value="11pt">11 pt</option>
                <option value="12pt">12 pt (Standar)</option>
                <option value="14pt">14 pt</option>
                <option value="16pt">16 pt</option>
                <option value="18pt">18 pt</option>
                <option value="24pt">24 pt</option>
              </select>

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-800 mx-0.5" />

              {/* Basic Formatting */}
              <button
                type="button"
                onClick={() => execCmd("bold")}
                className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg font-bold shadow-xs transition"
                title="Tebal (Bold)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("italic")}
                className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg italic shadow-xs transition"
                title="Miring (Italic)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("underline")}
                className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg underline shadow-xs transition"
                title="Garis Bawah (Underline)"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("strikeThrough")}
                className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg line-through shadow-xs transition"
                title="Coret (Strikethrough)"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-800 mx-0.5" />

              {/* Alignment Buttons */}
              <button
                type="button"
                onClick={() => execCmd("justifyLeft")}
                className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs transition"
                title="Rata Kiri (Align Left)"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("justifyCenter")}
                className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs transition"
                title="Rata Tengah (Align Center)"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("justifyRight")}
                className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs transition"
                title="Rata Kanan (Align Right)"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("justifyFull")}
                className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs transition"
                title="Rata Kanan Kiri (Justify)"
              >
                <AlignJustify className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-800 mx-0.5" />

              {/* List Buttons */}
              <button
                type="button"
                onClick={() => execCmd("insertUnorderedList")}
                className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs transition"
                title="Daftar Berbutir (Bullet List)"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("insertOrderedList")}
                className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs transition"
                title="Daftar Berpenomoran (Numbered List)"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("indent")}
                className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs transition"
                title="Tambah Indentasi"
              >
                <Indent className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("outdent")}
                className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs transition"
                title="Kurangi Indentasi"
              >
                <Outdent className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-800 mx-0.5" />

              {/* Color Controls */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowTextColorPicker(!showTextColorPicker);
                    setShowBgColorPicker(false);
                  }}
                  className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs transition flex items-center gap-1"
                  title="Warna Teks"
                >
                  <Palette className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                </button>
                {showTextColorPicker && (
                  <div className="absolute top-full left-0 mt-1 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-2xl flex flex-wrap gap-1.5 w-36">
                    {[
                      "#000000", "#dc2626", "#2563eb", "#16a34a",
                      "#9333ea", "#78350f", "#d97706", "#4b5563"
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          execCmd("foreColor", c);
                          setShowTextColorPicker(false);
                        }}
                        className="w-6 h-6 rounded-md border border-slate-300 dark:border-slate-700 transition hover:scale-110"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowBgColorPicker(!showBgColorPicker);
                    setShowTextColorPicker(false);
                  }}
                  className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs transition flex items-center gap-1"
                  title="Warna Latar / Highlight Teks"
                >
                  <Highlighter className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                </button>
                {showBgColorPicker && (
                  <div className="absolute top-full left-0 mt-1 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-2xl flex flex-wrap gap-1.5 w-36">
                    {[
                      "transparent", "#fef08a", "#bbf7d0", "#bfdbfe",
                      "#fecaca", "#fed7aa", "#e9d5ff"
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          execCmd("hiliteColor", c);
                          setShowBgColorPicker(false);
                        }}
                        className="w-6 h-6 rounded-md border border-slate-300 dark:border-slate-700 transition hover:scale-110 flex items-center justify-center font-bold text-[9px]"
                        style={{ backgroundColor: c === "transparent" ? "#ffffff" : c }}
                        title={c === "transparent" ? "Tanpa Highlight" : c}
                      >
                        {c === "transparent" ? "X" : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Eraser / Remove Format */}
              <button
                type="button"
                onClick={() => execCmd("removeFormat")}
                className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs transition"
                title="Hapus Format (Clear Formatting)"
              >
                <Eraser className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>

            {/* Visual Editor ContentEditable Div vs Code Textarea */}
            {editorMode === "VISUAL" ? (
              <div
                ref={visualEditorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleVisualInput}
                onBlur={handleVisualInput}
                style={{
                  fontFamily: fontFamily,
                  fontSize: fontSize,
                  minHeight: "180px",
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-red-500 rounded-2xl p-4 text-slate-900 dark:text-white outline-none leading-relaxed overflow-y-auto"
              />
            ) : (
              <textarea
                rows={6}
                value={contentHtml}
                onChange={(e) => setContentHtml(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-2xl p-3 text-emerald-400 font-mono text-xs leading-relaxed"
                placeholder="Ketik narasi pembuka / poin-poin surat..."
              />
            )}
          </div>

          {/* Interactive Table Personel Editor */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" /> Interactive Table Panitia / Personel ({tableRows.length})
              </h3>

              <button
                type="button"
                onClick={() => addTableRow()}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800/50 text-xs font-bold transition"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Baris
              </button>
            </div>

            {/* Autocomplete Member Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="⚡ Cari Nama Anggota System untuk mengisi tabel otomatis..."
                value={memberSearch}
                onChange={(e) => searchMembers(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-amber-300 dark:border-amber-700/50 rounded-xl pl-8 pr-3 py-1.5 text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-amber-500"
              />
              {memberSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                  {memberSuggestions.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        addTableRow(m.fullName, `Karateka - ${m.currentRank}`);
                        setMemberSearch("");
                        setMemberSuggestions([]);
                        toast.success(`Ditambahkan: ${m.fullName}`);
                      }}
                      className="w-full p-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-slate-900 dark:text-white">{m.fullName}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">{m.currentRank} ({m.dojo?.name})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Table Rows Inputs */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {tableRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 dark:text-slate-500 font-mono w-5 text-center">{i + 1}</span>
                  {tableHeaders
                    .filter((h) => h !== "NO")
                    .map((headerKey) => (
                      <input
                        key={headerKey}
                        type="text"
                        value={row[headerKey] || ""}
                        placeholder={headerKey}
                        onChange={(e) => updateTableRowField(i, headerKey, e.target.value)}
                        className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-slate-900 dark:text-white font-semibold focus:border-red-500"
                      />
                    ))}
                  <button
                    type="button"
                    onClick={() => removeTableRow(i)}
                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pejabat TTD inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Nama Ketua TTD</label>
              <input
                type="text"
                value={ketuaName}
                onChange={(e) => setKetuaName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Nama Sekretaris TTD</label>
              <input
                type="text"
                value={sekretarisName}
                onChange={(e) => setSekretarisName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Live Preview Panel (6 Cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-between min-h-[720px]">
          <div className="w-full flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4 gap-2">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Printer className="w-4 h-4 text-red-600 dark:text-red-400" /> Pratinjau Kertas Utuh ({paperSize})
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Dokumen utuh tanpa terpotong &bull; Presisi {paperSize === "F4" ? "215×330 mm" : "210×297 mm"}
              </p>
            </div>

            {/* Zoom Controls & Modal Launcher */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setPreviewZoom(Math.max(0.4, Number((previewZoom - 0.1).toFixed(2))))}
                className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 shadow-xs transition"
                title="Perkecil Zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] font-bold px-1 text-slate-700 dark:text-slate-300 w-10 text-center">
                {Math.round(previewZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setPreviewZoom(Math.min(1.2, Number((previewZoom + 0.1).toFixed(2))))}
                className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 shadow-xs transition"
                title="Perbesar Zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold text-[11px] hover:bg-red-700 transition shadow-xs"
                title="Layar Penuh"
              >
                <Maximize2 className="w-3 h-3" /> Full
              </button>
            </div>
          </div>

          <div className="w-full flex-1 bg-slate-100 dark:bg-slate-950 rounded-2xl p-4 overflow-auto flex flex-col items-center justify-start border border-slate-200 dark:border-slate-800 min-h-[640px]">
            {/* Seamless Paper Frame: Container matches exact scaled dimensions */}
            <div
              className="bg-white rounded-md shadow-2xl transition-all duration-200 relative overflow-hidden my-auto border border-slate-300 dark:border-slate-700"
              style={{
                width: `${(paperSize === "F4" ? 215 : 210) * previewZoom}mm`,
                height: `${(paperSize === "F4" ? 330 : 297) * previewZoom}mm`,
              }}
            >
              <iframe
                title="Live Generator Preview"
                srcDoc={liveHtmlContent}
                style={{
                  width: paperSize === "F4" ? "215mm" : "210mm",
                  height: paperSize === "F4" ? "330mm" : "297mm",
                  transform: `scale(${previewZoom})`,
                  transformOrigin: "top left",
                  border: "none",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Print Modal */}
      {isPrintModalOpen && (
        <SuratPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          options={currentOpts as any}
        />
      )}
    </div>
  );
}

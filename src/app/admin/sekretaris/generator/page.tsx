"use client";

import React, { useState, useEffect } from "react";
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
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  List,
  Sparkles,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { buildSuratPrintHtml } from "@/lib/surat-print-html";
import { SuratPrintModal } from "@/components/admin/sekretaris/SuratPrintModal";

export default function SuratGeneratorPage() {
  const [templateKey, setTemplateKey] = useState<
    "SURAT_TUGAS" | "SURAT_UNDANGAN" | "SURAT_KETERANGAN" | "REKOMENDASI" | "SK_PENGURUS"
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

  // Rich text styling
  const [fontFamily, setFontFamily] = useState("'Times New Roman', Times, serif");
  const [fontSize, setFontSize] = useState("12pt");

  // Table rows
  const [tableHeaders, setTableHeaders] = useState(["NO", "NAMA", "JABATAN"]);
  const [tableRows, setTableRows] = useState<Array<{ NAMA: string; JABATAN: string }>>([
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

  // Next number preview
  const [nextNumberPreview, setNextNumberPreview] = useState("");
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Member suggest autocomplete
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSuggestions, setMemberSuggestions] = useState<any[]>([]);

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
    }
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
    setTableRows([...tableRows, { NAMA: nama, JABATAN: jabatan }]);
  };

  const removeTableRow = (index: number) => {
    setTableRows(tableRows.filter((_, i) => i !== index));
  };

  const updateTableRow = (index: number, field: "NAMA" | "JABATAN", val: string) => {
    const updated = [...tableRows];
    updated[index][field] = val;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-red-600" /> Generator & Template Surat PDF
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
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
      <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-sm space-y-3">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Pilihan Templat Surat Organisasi:
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "SURAT_TUGAS", label: "Surat Tugas Panitia/Petugas" },
            { key: "SURAT_UNDANGAN", label: "Surat Undangan Resmi" },
            { key: "SURAT_KETERANGAN", label: "Surat Keterangan Anggota" },
            { key: "REKOMENDASI", label: "Surat Rekomendasi Event" },
            { key: "SK_PENGURUS", label: "Surat Keputusan (SK)" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleSelectTemplate(t.key as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
                templateKey === t.key
                  ? "bg-red-600 border-red-500 text-white shadow-md shadow-red-600/20"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
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
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5 text-xs">
          <h2 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3 flex items-center justify-between">
            <span>📝 Parameter & Editor Isi Surat</span>
            <span className="text-xs text-red-600 font-mono font-bold">Format: {kategori}</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Nomor Surat</label>
              <input
                type="text"
                value={nomorSurat}
                onChange={(e) => setNomorSurat(e.target.value)}
                placeholder="AUTO / Nomor manual"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:bg-white focus:border-red-500"
              />
              {nomorSurat === "AUTO" && (
                <div className="text-[11px] text-red-600 mt-1 font-bold">Preview: {nextNumberPreview}</div>
              )}
            </div>

            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Tanggal Surat</label>
              <input
                type="date"
                value={tanggalSurat}
                onChange={(e) => setTanggalSurat(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 mb-1 font-semibold">Perihal Surat</label>
            <input
              type="text"
              value={perihal}
              onChange={(e) => setPerihal(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:bg-white focus:border-red-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Tujuan / Kepada</label>
              <input
                type="text"
                value={tujuan}
                onChange={(e) => setTujuan(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Tempat Ditetapkan</label>
              <input
                type="text"
                value={ditetapkanDi}
                onChange={(e) => setDitetapkanDi(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-red-500"
              />
            </div>
          </div>

          {/* Paper & TTD Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-slate-700 mb-1 font-bold">Ukuran Kertas Print</label>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
              >
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="F4">F4 / Folio (215 × 330 mm)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 mb-1 font-bold">Mode Tanda Tangan</label>
              <select
                value={signatureMode}
                onChange={(e) => setSignatureMode(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
              >
                <option value="SYSTEM">TTD & Stempel Digital</option>
                <option value="MANUAL">Kosong (TTD Basah Manual)</option>
              </select>
            </div>
          </div>

          {/* Rich Text Editor Toolbar */}
          <div className="space-y-2">
            <label className="block text-slate-700 font-bold">WYSIWYG Format & Style Toolbar</label>
            <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
              {/* Font Family Selector */}
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="bg-white border border-slate-300 text-slate-800 rounded-lg px-2 py-1 text-xs font-semibold"
              >
                <option value="'Times New Roman', Times, serif">Times New Roman</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="Calibri, sans-serif">Calibri</option>
                <option value="Georgia, serif">Georgia</option>
              </select>

              {/* Font Size Selector */}
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                className="bg-white border border-slate-300 text-slate-800 rounded-lg px-2 py-1 text-xs font-semibold"
              >
                <option value="10pt">10 pt</option>
                <option value="11pt">11 pt</option>
                <option value="12pt">12 pt (Standar)</option>
                <option value="14pt">14 pt</option>
              </select>

              <div className="h-4 w-px bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={() => {
                  setContentHtml(contentHtml + "<b>Teks Tebal</b> ");
                }}
                className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg shadow-xs font-bold"
                title="Tebal (Bold)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setContentHtml(contentHtml + "<i>Teks Miring</i> ");
                }}
                className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg shadow-xs italic"
                title="Miring (Italic)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setContentHtml(contentHtml + "<u>Garis Bawah</u> ");
                }}
                className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg shadow-xs underline"
                title="Garis Bawah (Underline)"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
            </div>

            <textarea
              rows={4}
              value={contentHtml}
              onChange={(e) => setContentHtml(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-red-500 rounded-2xl p-3 text-slate-900 font-sans"
              placeholder="Ketik narasi pembuka / poin-poin surat..."
            />
          </div>

          {/* Interactive Table Personel Editor */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" /> Interactive Table Panitia / Personel ({tableRows.length})
              </h3>

              <button
                type="button"
                onClick={() => addTableRow()}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs font-bold transition"
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
                className="w-full bg-slate-50 border border-amber-300 rounded-xl pl-8 pr-3 py-1.5 text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-500"
              />
              {memberSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl divide-y divide-slate-100 overflow-hidden">
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
                      className="w-full p-2.5 text-left hover:bg-slate-50 transition flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-slate-900">{m.fullName}</span>
                      <span className="text-[10px] text-slate-500">{m.currentRank} ({m.dojo?.name})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Table Rows Inputs */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {tableRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-mono w-5 text-center">{i + 1}</span>
                  <input
                    type="text"
                    value={row.NAMA}
                    placeholder="Nama Lengkap"
                    onChange={(e) => updateTableRow(i, "NAMA", e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-900 font-bold focus:border-red-500"
                  />
                  <input
                    type="text"
                    value={row.JABATAN}
                    placeholder="Jabatan / Tugas"
                    onChange={(e) => updateTableRow(i, "JABATAN", e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:border-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeTableRow(i)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pejabat TTD inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Nama Ketua TTD</label>
              <input
                type="text"
                value={ketuaName}
                onChange={(e) => setKetuaName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 font-bold focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Nama Sekretaris TTD</label>
              <input
                type="text"
                value={sekretarisName}
                onChange={(e) => setSekretarisName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 font-bold focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Live Preview Panel (6 Cols) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Printer className="w-4 h-4 text-red-600" /> Pratinjau Live PDF Cetak ({paperSize})
            </h2>
            <span className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              Presisi 1 Halaman
            </span>
          </div>

          <div className="w-full flex-1 bg-slate-100 rounded-2xl p-4 overflow-auto flex justify-center border border-slate-200">
            <div className="bg-white rounded-lg shadow-2xl overflow-hidden transform scale-[0.75] origin-top sm:scale-[0.85]">
              <iframe
                title="Live Generator Preview"
                srcDoc={liveHtmlContent}
                className="w-[210mm] border-none"
                style={{
                  height: paperSize === "F4" ? "330mm" : "297mm",
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

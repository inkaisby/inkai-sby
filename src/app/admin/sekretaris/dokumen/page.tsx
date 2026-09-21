"use client";

import React, { useState, useEffect } from "react";
import {
  FolderKanban,
  Plus,
  Search,
  FileText,
  AlertTriangle,
  Download,
  Trash2,
  Edit,
  ExternalLink,
  Calendar,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export default function DokumenManagementPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKategori, setFilterKategori] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    judul: "",
    nomorDokumen: "",
    kategori: "SK_PENGURUS",
    fileUrl: "",
    keterangan: "",
    tanggalBerlaku: "",
    tanggalKadaluarsa: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filterKategori) queryParams.set("kategori", filterKategori);
      if (searchQuery) queryParams.set("q", searchQuery);

      const res = await fetch(`/api/admin/sekretaris/dokumen?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
      } else {
        toast.error(data.error || "Gagal memuat arsip dokumen");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [filterKategori, searchQuery]);

  const handleSaveDokumen = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/sekretaris/dokumen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Dokumen SK / berkas resmi berhasil diarsipkan!");
        setIsFormOpen(false);
        setFormData({
          judul: "",
          nomorDokumen: "",
          kategori: "SK_PENGURUS",
          fileUrl: "",
          keterangan: "",
          tanggalBerlaku: "",
          tanggalKadaluarsa: "",
        });
        fetchItems();
      } else {
        toast.error(data.error || "Gagal menyimpan dokumen");
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, judul: string) => {
    if (!confirm(`Hapus arsip dokumen "${judul}"?`)) return;
    try {
      const res = await fetch(`/api/admin/sekretaris/dokumen/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Dokumen berhasil dihapus dari arsip");
        fetchItems();
      } else {
        toast.error(data.error || "Gagal menghapus dokumen");
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-emerald-600" /> Kearsipan Dokumen & SK Organisasi
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Repository digital SK Pengurus, AD/ART, LPJ Kegiatan, & Sertifikat INKAI Surabaya.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95"
        >
          <Plus className="w-4 h-4" /> Unggah / Arsipkan Dokumen
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 p-4 rounded-3xl space-y-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari Judul / Nomor Dokumen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 transition"
            />
          </div>

          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-emerald-500 transition"
          >
            <option value="">Semua Kategori Dokumen</option>
            <option value="SK_PENGURUS">SK Kepengurusan</option>
            <option value="AD_ART">AD/ART & Juklak</option>
            <option value="PROPOSAL">Proposal Kegiatan</option>
            <option value="LPJ">Laporan Pertanggungjawaban (LPJ)</option>
            <option value="SERTIFIKAT">Sertifikat & Lisensi</option>
            <option value="BERITA_ACARA">Berita Acara</option>
            <option value="DOKUMEN_RESMI">Dokumen Resmi Lainnya</option>
          </select>

          <button
            type="button"
            onClick={fetchItems}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition border border-slate-200"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Repository
          </button>
        </div>
      </div>

      {/* Grid Cards Dokumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-slate-500 text-xs">
            Memuat arsip dokumen...
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-slate-500 text-xs border border-dashed border-slate-200 rounded-3xl bg-white">
            Belum ada berkas terarsip. Klik <strong>Unggah / Arsipkan Dokumen</strong> untuk menambahkan.
          </div>
        ) : (
          items.map((doc) => {
            const isExpiring =
              doc.tanggalKadaluarsa &&
              new Date(doc.tanggalKadaluarsa).getTime() - new Date().getTime() < 45 * 24 * 60 * 60 * 1000;

            return (
              <div
                key={doc.id}
                className="bg-white border border-slate-200 hover:border-slate-300 p-5 rounded-3xl shadow-sm hover:shadow-md flex flex-col justify-between space-y-4 transition group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {doc.kategori}
                    </span>
                    {isExpiring && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Mendekati Kadaluarsa
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-600 transition leading-snug">
                    {doc.judul}
                  </h3>

                  {doc.nomorDokumen && (
                    <div className="text-xs font-mono text-slate-500 font-semibold">
                      No: {doc.nomorDokumen}
                    </div>
                  )}

                  {doc.keterangan && (
                    <p className="text-xs text-slate-600 line-clamp-2">{doc.keterangan}</p>
                  )}

                  {doc.tanggalKadaluarsa && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-2 border-t border-slate-100 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Berlaku s/d: {new Date(doc.tanggalKadaluarsa).toLocaleDateString("id-ID")}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Buka Dokumen
                  </a>

                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id, doc.judul)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition"
                    title="Hapus Dokumen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Form Upload Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-3">
              <span>Arsipkan Dokumen / SK Organisasi</span>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </h2>

            <form onSubmit={handleSaveDokumen} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Judul Dokumen / SK *</label>
                <input
                  type="text"
                  required
                  placeholder="Mis. SK Pengurus Dojo Airlangga Periode 2026-2028"
                  value={formData.judul}
                  onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Nomor Dokumen</label>
                  <input
                    type="text"
                    placeholder="Mis. 012/SK/INKAI/2026"
                    value={formData.nomorDokumen}
                    onChange={(e) => setFormData({ ...formData, nomorDokumen: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:bg-white focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Kategori Dokumen</label>
                  <select
                    value={formData.kategori}
                    onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-emerald-500"
                  >
                    <option value="SK_PENGURUS">SK Kepengurusan</option>
                    <option value="AD_ART">AD/ART & Juklak</option>
                    <option value="PROPOSAL">Proposal Kegiatan</option>
                    <option value="LPJ">Laporan Pertanggungjawaban (LPJ)</option>
                    <option value="SERTIFIKAT">Sertifikat & Lisensi</option>
                    <option value="BERITA_ACARA">Berita Acara</option>
                    <option value="DOKUMEN_RESMI">Dokumen Resmi Lainnya</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">URL File Dokumen (Vercel Blob / PDF) *</label>
                <input
                  type="text"
                  required
                  placeholder="https://... file PDF/image"
                  value={formData.fileUrl}
                  onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Tanggal Mulai Berlaku</label>
                  <input
                    type="date"
                    value={formData.tanggalBerlaku}
                    onChange={(e) => setFormData({ ...formData, tanggalBerlaku: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Tanggal Kadaluarsa (Jika Ada)</label>
                  <input
                    type="date"
                    value={formData.tanggalKadaluarsa}
                    onChange={(e) => setFormData({ ...formData, tanggalKadaluarsa: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Keterangan / Catatan Arsip</label>
                <textarea
                  rows={2}
                  placeholder="Catatan tambahan mengenai isi dokumen..."
                  value={formData.keterangan}
                  onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20"
                >
                  {saving ? "Simpan..." : "Arsipkan Dokumen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  Mail,
  Plus,
  Search,
  Filter,
  Printer,
  Send,
  Inbox,
  CheckCircle2,
  Trash2,
  Edit,
  Eye,
  Copy,
  Check,
  RefreshCw,
  FileText,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { SuratPrintModal } from "@/components/admin/sekretaris/SuratPrintModal";

export default function SuratManagementPage() {
  const [activeTab, setActiveTab] = useState<"KELUAR" | "MASUK">("KELUAR");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKategori, setFilterKategori] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Print modal state
  const [selectedSuratForPrint, setSelectedSuratForPrint] = useState<any | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "KELUAR",
    nomorSurat: "AUTO",
    tanggalSurat: new Date().toISOString().split("T")[0],
    pengirim: "",
    tujuan: "",
    perihal: "",
    kategori: "UNDANGAN",
    status: "DRAFT",
    disposisi: "",
    paperSize: "A4",
    signatureMode: "SYSTEM",
  });
  const [saving, setSaving] = useState(false);

  // Next number preview
  const [nextNumberPreview, setNextNumberPreview] = useState("");

  const fetchItems = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set("type", activeTab);
      if (filterKategori) queryParams.set("kategori", filterKategori);
      if (filterStatus) queryParams.set("status", filterStatus);
      if (searchQuery) queryParams.set("q", searchQuery);

      const res = await fetch(`/api/admin/sekretaris/surat?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
      } else {
        toast.error(data.error || "Gagal memuat daftar surat");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  };

  const fetchNextNumber = async (kategori: string, date: string) => {
    try {
      const res = await fetch(`/api/admin/sekretaris/surat/next-number?kategori=${kategori}&date=${date}`);
      const data = await res.json();
      if (data.success) {
        setNextNumberPreview(data.nextNumber);
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchItems();
  }, [activeTab, filterKategori, filterStatus, searchQuery]);

  useEffect(() => {
    if (isFormOpen && formData.nomorSurat === "AUTO") {
      fetchNextNumber(formData.kategori, formData.tanggalSurat);
    }
  }, [isFormOpen, formData.kategori, formData.tanggalSurat, formData.nomorSurat]);

  const handleCreateSurat = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/sekretaris/surat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          type: activeTab,
          nomorSurat: formData.nomorSurat === "AUTO" ? nextNumberPreview : formData.nomorSurat,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Surat berhasil dicatat ke buku persuratan!");
        setIsFormOpen(false);
        setFormData({
          type: activeTab,
          nomorSurat: "AUTO",
          tanggalSurat: new Date().toISOString().split("T")[0],
          pengirim: "",
          tujuan: "",
          perihal: "",
          kategori: "UNDANGAN",
          status: "DRAFT",
          disposisi: "",
          paperSize: "A4",
          signatureMode: "SYSTEM",
        });
        fetchItems();
      } else {
        toast.error(data.error || "Gagal menyimpan surat");
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, nomor: string) => {
    if (!confirm(`Hapus surat nomor ${nomor}?`)) return;
    try {
      const res = await fetch(`/api/admin/sekretaris/surat/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Surat berhasil dihapus");
        fetchItems();
      } else {
        toast.error(data.error || "Gagal menghapus surat");
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server");
    }
  };

  const handleDeliverToMembers = async (id: string, perihal: string) => {
    if (!confirm(`Kirimkan surat resmi "${perihal}" ke portal & notifikasi akun anggota?`)) return;
    try {
      const res = await fetch(`/api/admin/sekretaris/surat/${id}/deliver`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Surat berhasil disampaikan ke ${data.deliveredCount} anggota (${data.notifiedUserCount} notifikasi push akun)!`);
        fetchItems();
      } else {
        toast.error(data.error || "Gagal menyampaikan surat ke anggota");
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server");
    }
  };

  const openPrintModal = (surat: any) => {
    setSelectedSuratForPrint({
      nomorSurat: surat.nomorSurat,
      tanggalSurat: surat.tanggalSurat,
      perihal: surat.perihal,
      kategori: surat.kategori,
      type: surat.type,
      scopeType: surat.scopeType,
      paperSize: surat.paperSize || "A4",
      signatureMode: surat.signatureMode || "SYSTEM",
      signedKetuaUrl: surat.signedKetuaUrl,
      signedSekretarisUrl: surat.signedSekretarisUrl,
      stampUrl: surat.stampUrl,
      verificationUrl: typeof window !== "undefined" ? `${window.location.origin}/v/surat/${surat.id}` : null,
      tableHeaders: surat.templateData?.tableHeaders,
      tableRows: surat.templateData?.tableRows,
      contentHtml: surat.templateData?.contentHtml,
    });
    setIsPrintModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm transition-colors">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Mail className="w-6 h-6 text-red-600 dark:text-red-400" /> Kelola Persuratan Resmi
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Buku Surat Masuk & Surat Keluar dengan penomoran otomatis & delivery ke portal anggota.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFormData({ ...formData, type: activeTab });
              setIsFormOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" /> Tambah {activeTab === "KELUAR" ? "Surat Keluar" : "Surat Masuk"}
          </button>
        </div>
      </div>

      {/* Tabs & Search Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab("KELUAR")}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "KELUAR"
                  ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Send className="w-4 h-4" /> Surat Keluar
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("MASUK")}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "MASUK"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Inbox className="w-4 h-4" /> Surat Masuk
            </button>
          </div>

          <button
            type="button"
            onClick={fetchItems}
            className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition border border-slate-200 dark:border-slate-700"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari Nomor / Perihal / Pengirim / Tujuan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-red-500 transition"
            />
          </div>

          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-red-500 transition"
          >
            <option value="">Semua Kategori</option>
            <option value="UNDANGAN">Surat Undangan</option>
            <option value="TUGAS">Surat Tugas</option>
            <option value="SK">Surat Keputusan (SK)</option>
            <option value="KETERANGAN">Surat Keterangan</option>
            <option value="PERMOHONAN">Surat Permohonan</option>
            <option value="PEMBERITAHUAN">Surat Pemberitahuan</option>
            <option value="REKOMENDASI">Surat Rekomendasi</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-red-500 transition"
          >
            <option value="">Semua Status</option>
            <option value="DRAFT">DRAFT</option>
            <option value="WAITING_APPROVAL">WAITING_APPROVAL</option>
            <option value="APPROVED">APPROVED</option>
            <option value="ISSUED">ISSUED (Terbit)</option>
          </select>
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">No</th>
                <th className="py-3.5 px-4">Nomor Surat</th>
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">Perihal</th>
                <th className="py-3.5 px-4">{activeTab === "KELUAR" ? "Tujuan" : "Pengirim"}</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    Memuat data persuratan...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    Tidak ada surat ditemukan.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400 dark:text-slate-500">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-red-600 dark:text-red-400">{item.nomorSurat}</td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      {new Date(item.tanggalSurat).toLocaleDateString("id-ID")}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white max-w-xs truncate">{item.perihal}</td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {activeTab === "KELUAR" ? item.tujuan || "-" : item.pengirim || "-"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        {item.kategori}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          item.status === "ISSUED" || item.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50"
                            : item.status === "WAITING_APPROVAL"
                            ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50"
                            : "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Print / Preview */}
                        <button
                          type="button"
                          onClick={() => openPrintModal(item)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white rounded-lg transition"
                          title="Pratinjau & Cetak A4/F4"
                        >
                          <Printer className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        </button>

                        {/* Deliver to member */}
                        <button
                          type="button"
                          onClick={() => handleDeliverToMembers(item.id, item.perihal)}
                          className={`p-1.5 rounded-lg transition ${
                            item.deliveredToMembers
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white"
                          }`}
                          title={item.deliveredToMembers ? "Sudah Tersampaikan ke Anggota" : "Kirim ke Portal Anggota"}
                        >
                          <Share2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.nomorSurat)}
                          className="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/40 dark:text-slate-400 dark:hover:text-red-300 rounded-lg transition"
                          title="Hapus Surat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Surat Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span>Tambah {activeTab === "KELUAR" ? "Surat Keluar" : "Surat Masuk"}</span>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </h2>

            <form onSubmit={handleCreateSurat} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Nomor Surat</label>
                  <input
                    type="text"
                    value={formData.nomorSurat}
                    onChange={(e) => setFormData({ ...formData, nomorSurat: e.target.value })}
                    placeholder="Ketik 'AUTO' atau nomor manual"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:bg-white dark:focus:bg-slate-900 focus:border-red-500"
                  />
                  {formData.nomorSurat === "AUTO" && nextNumberPreview && (
                    <div className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-bold">Auto: {nextNumberPreview}</div>
                  )}
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Tanggal Surat</label>
                  <input
                    type="date"
                    value={formData.tanggalSurat}
                    onChange={(e) => setFormData({ ...formData, tanggalSurat: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Perihal Surat *</label>
                <input
                  type="text"
                  required
                  placeholder="Mis. Undangan Latber / Surat Tugas UKT"
                  value={formData.perihal}
                  onChange={(e) => setFormData({ ...formData, perihal: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold focus:bg-white dark:focus:bg-slate-900 focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeTab === "KELUAR" ? (
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Tujuan / Kepada</label>
                    <input
                      type="text"
                      placeholder="Mis. Seluruh Ketua Dojo / Ranting"
                      value={formData.tujuan}
                      onChange={(e) => setFormData({ ...formData, tujuan: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-red-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Pengirim Surat</label>
                    <input
                      type="text"
                      placeholder="Mis. Dispora Jatim / Pengprov INKAI"
                      value={formData.pengirim}
                      onChange={(e) => setFormData({ ...formData, pengirim: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-red-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Kategori Surat</label>
                  <select
                    value={formData.kategori}
                    onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-red-500"
                  >
                    <option value="UNDANGAN">Surat Undangan</option>
                    <option value="TUGAS">Surat Tugas</option>
                    <option value="SK">Surat Keputusan (SK)</option>
                    <option value="KETERANGAN">Surat Keterangan</option>
                    <option value="PERMOHONAN">Surat Permohonan</option>
                    <option value="PEMBERITAHUAN">Surat Pemberitahuan</option>
                    <option value="REKOMENDASI">Surat Rekomendasi</option>
                  </select>
                </div>
              </div>

              {activeTab === "MASUK" && (
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Ringkasan Disposisi</label>
                  <textarea
                    rows={2}
                    placeholder="Disposisi pimpinan / catatan arahan..."
                    value={formData.disposisi}
                    onChange={(e) => setFormData({ ...formData, disposisi: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-red-500"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-600/20"
                >
                  {saving ? "Simpan..." : "Simpan Surat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {selectedSuratForPrint && (
        <SuratPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          options={selectedSuratForPrint}
        />
      )}
    </div>
  );
}

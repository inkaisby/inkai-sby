"use client";

import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  Plus,
  Search,
  CheckSquare,
  Square,
  Copy,
  Check,
  Trash2,
  User,
  MapPin,
  Clock,
  Sparkles,
  Share2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export default function RapatManagementPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    judulRapat: "",
    tanggalRapat: new Date().toISOString().split("T")[0],
    lokasi: "Sekretariat Cabang INKAI Surabaya",
    pimpinanRapat: "",
    pesertaHadirStr: "",
    agenda: "",
    pembahasan: "",
    keputusan: "",
  });

  const [actionItems, setActionItems] = useState<
    Array<{ task: string; assignee: string; dueDate: string; completed: boolean }>
  >([
    { task: "Penyiapan berkas pendaftaran UKT", assignee: "Sekretaris", dueDate: "", completed: false },
  ]);

  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.set("q", searchQuery);

      const res = await fetch(`/api/admin/sekretaris/rapat?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
      } else {
        toast.error(data.error || "Gagal memuat notulensi rapat");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [searchQuery]);

  const handleAddActionItem = () => {
    setActionItems([...actionItems, { task: "", assignee: "", dueDate: "", completed: false }]);
  };

  const handleRemoveActionItem = (index: number) => {
    setActionItems(actionItems.filter((_, i) => i !== index));
  };

  const handleUpdateActionItem = (index: number, field: string, val: any) => {
    const updated = [...actionItems];
    (updated[index] as any)[field] = val;
    setActionItems(updated);
  };

  const handleSaveRapat = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const pesertaHadir = formData.pesertaHadirStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/admin/sekretaris/rapat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          pesertaHadir,
          actionItems,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Notulensi rapat & risalah keputusan berhasil dicatat!");
        setIsFormOpen(false);
        setFormData({
          judulRapat: "",
          tanggalRapat: new Date().toISOString().split("T")[0],
          lokasi: "Sekretariat Cabang INKAI Surabaya",
          pimpinanRapat: "",
          pesertaHadirStr: "",
          agenda: "",
          pembahasan: "",
          keputusan: "",
        });
        setActionItems([]);
        fetchItems();
      } else {
        toast.error(data.error || "Gagal menyimpan notulensi rapat");
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, judul: string) => {
    if (!confirm(`Hapus notulensi rapat "${judul}"?`)) return;
    try {
      const res = await fetch(`/api/admin/sekretaris/rapat/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Notulensi rapat berhasil dihapus");
        fetchItems();
      } else {
        toast.error(data.error || "Gagal menghapus notulensi");
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server");
    }
  };

  const handleCopyWaNotulen = (rapat: any) => {
    const tgl = new Date(rapat.tanggalRapat).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const tasksText = rapat.actionItems && rapat.actionItems.length > 0
      ? rapat.actionItems.map((a: any, i: number) => `• [${a.completed ? "✓" : " "}] ${a.task} (PJ: ${a.assignee || "-"})`).join("\n")
      : "-";

    const waText = `*NOTULENSI & RISALAH RAPAT INKAI SURABAYA*
----------------------------------------
🗓️ *Judul:* ${rapat.judulRapat}
📅 *Hari/Tanggal:* ${tgl}
📍 *Lokasi:* ${rapat.lokasi || "-"}
👤 *Pimpinan Rapat:* ${rapat.pimpinanRapat || "-"}

📌 *Agenda:*
${rapat.agenda}

💡 *Pembahasan & Keputusan:*
${rapat.keputusan || rapat.pembahasan}

🎯 *Action Items / Tugas:*
${tasksText}

----------------------------------------
_OSS! Sekretariat INKAI Surabaya_`;

    navigator.clipboard.writeText(waText);
    setCopiedId(rapat.id);
    toast.success("Teks Notulensi Format WA berhasil disalin ke clipboard!");
    setTimeout(() => setCopiedId(null), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-purple-600" /> Agenda & Notulensi Rapat
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Risalah rapat pengurus, poin pembahasan, action items, & export format WhatsApp.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition active:scale-95"
        >
          <Plus className="w-4 h-4" /> Catat Notulen Rapat Baru
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white border border-slate-200 p-4 rounded-3xl space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari Judul Rapat / Pimpinan / Agenda / Decision..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-purple-500 transition"
            />
          </div>

          <button
            type="button"
            onClick={fetchItems}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition border border-slate-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Feed List Notulen */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 text-xs shadow-sm">
            Memuat notulensi rapat...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 text-xs shadow-sm">
            Belum ada notulen rapat tercatat. Klik <strong>Catat Notulen Rapat Baru</strong> untuk menambahkan.
          </div>
        ) : (
          items.map((rapat) => (
            <div
              key={rapat.id}
              className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 hover:border-slate-300 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 text-xs text-purple-700 font-bold mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {new Date(rapat.tanggalRapat).toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    {rapat.lokasi && <span className="text-slate-500">&bull; {rapat.lokasi}</span>}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">{rapat.judulRapat}</h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyWaNotulen(rapat)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition"
                  >
                    {copiedId === rapat.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-emerald-600" />}
                    {copiedId === rapat.id ? "Tersalin!" : "Salin Format WA"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(rapat.id, rapat.judulRapat)}
                    className="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl transition"
                    title="Hapus Notulen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="font-bold text-xs uppercase tracking-wider mb-1 text-purple-700">
                    📌 Agenda & Pembahasan
                  </div>
                  <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{rapat.pembahasan || rapat.agenda}</p>
                </div>

                <div className="space-y-1.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="font-bold text-xs uppercase tracking-wider mb-1 text-emerald-700">
                    💡 Keputusan Rapat
                  </div>
                  <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{rapat.keputusan || "Belum ada poin keputusan khusus."}</p>
                </div>
              </div>

              {/* Action items list if any */}
              {rapat.actionItems && rapat.actionItems.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Action Items & Penugasan:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {rapat.actionItems.map((a: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                        {a.completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className={`flex-1 text-slate-800 font-medium ${a.completed ? "line-through text-slate-400" : ""}`}>
                          {a.task}
                        </span>
                        {a.assignee && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200/80 text-slate-700">
                            PJ: {a.assignee}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-3">
              <span>Catat Risalah & Notulensi Rapat</span>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </h2>

            <form onSubmit={handleSaveRapat} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Judul Rapat *</label>
                <input
                  type="text"
                  required
                  placeholder="Mis. Rapat Koordinasi UKT Semester II Tahun 2026"
                  value={formData.judulRapat}
                  onChange={(e) => setFormData({ ...formData, judulRapat: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:bg-white focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Tanggal Rapat</label>
                  <input
                    type="date"
                    value={formData.tanggalRapat}
                    onChange={(e) => setFormData({ ...formData, tanggalRapat: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Lokasi Rapat</label>
                  <input
                    type="text"
                    placeholder="Mis. GOR Dispora Jatim / Zoom"
                    value={formData.lokasi}
                    onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Pimpinan Rapat</label>
                  <input
                    type="text"
                    placeholder="Mis. Sensei Bambang (Ketua Harian)"
                    value={formData.pimpinanRapat}
                    onChange={(e) => setFormData({ ...formData, pimpinanRapat: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Peserta Hadir (Pisahkan koma)</label>
                  <input
                    type="text"
                    placeholder="Mis. Ahmad, Budi, Dewi, Sensei Tonny"
                    value={formData.pesertaHadirStr}
                    onChange={(e) => setFormData({ ...formData, pesertaHadirStr: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Agenda Rapat *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Poin-poin topik bahasan rapat..."
                  value={formData.agenda}
                  onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Isi Pembahasan & Keputusan Rapat *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Detail jalannya pembahasan & kesepakatan poin rapat..."
                  value={formData.pembahasan}
                  onChange={(e) => setFormData({ ...formData, pembahasan: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-purple-500"
                />
              </div>

              {/* Action Items List Editor */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-700 font-bold">Action Items (Tugas Tambahan)</label>
                  <button
                    type="button"
                    onClick={handleAddActionItem}
                    className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold hover:bg-purple-100"
                  >
                    + Tambah Tugas
                  </button>
                </div>

                {actionItems.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <input
                      type="text"
                      placeholder="Uraian Tugas"
                      value={a.task}
                      onChange={(e) => handleUpdateActionItem(i, "task", e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-900 font-medium"
                    />
                    <input
                      type="text"
                      placeholder="Penanggung Jawab"
                      value={a.assignee}
                      onChange={(e) => handleUpdateActionItem(i, "assignee", e.target.value)}
                      className="w-36 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveActionItem(i)}
                      className="p-1.5 text-slate-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
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
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-600/20"
                >
                  {saving ? "Simpan..." : "Simpan Notulen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

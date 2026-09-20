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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-purple-500" /> Agenda & Notulensi Rapat
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Risalah rapat pengurus, poin pembahasan, action items, & export format WhatsApp.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition"
        >
          <Plus className="w-4 h-4" /> Catat Notulen Rapat Baru
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari Judul Rapat / Pimpinan / Agenda / Decision..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <button
            type="button"
            onClick={fetchItems}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Feed List Notulen */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 text-xs shadow-xl">
            Memuat notulensi rapat...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 text-xs shadow-xl">
            Belum ada notulen rapat tercatat. Klik <strong>Catat Notulen Rapat Baru</strong> untuk menambahkan.
          </div>
        ) : (
          items.map((rapat) => (
            <div
              key={rapat.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 hover:border-slate-700 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs text-purple-400 font-semibold mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {new Date(rapat.tanggalRapat).toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    {rapat.lokasi && <span>&bull; {rapat.lokasi}</span>}
                  </div>
                  <h2 className="text-lg font-bold text-white">{rapat.judulRapat}</h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyWaNotulen(rapat)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-bold transition"
                  >
                    {copiedId === rapat.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === rapat.id ? "Tersalin!" : "Salin Format WA"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(rapat.id, rapat.judulRapat)}
                    className="p-1.5 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-300 rounded-xl transition"
                    title="Hapus Notulen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="font-bold text-slate-300 text-xs uppercase tracking-wider mb-1 text-purple-400">
                    📌 Agenda & Pembahasan
                  </div>
                  <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{rapat.pembahasan || rapat.agenda}</p>
                </div>

                <div className="space-y-1.5 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="font-bold text-slate-300 text-xs uppercase tracking-wider mb-1 text-emerald-400">
                    💡 Keputusan Rapat
                  </div>
                  <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{rapat.keputusan || "Belum ada poin keputusan khusus."}</p>
                </div>
              </div>

              {/* Action items list if any */}
              {rapat.actionItems && rapat.actionItems.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Action Items & Penugasan:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {rapat.actionItems.map((a: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800">
                        {a.completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <span className={`flex-1 text-slate-200 ${a.completed ? "line-through text-slate-500" : ""}`}>
                          {a.task}
                        </span>
                        {a.assignee && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white flex items-center justify-between border-b border-slate-800 pb-3">
              <span>Catat Risalah & Notulensi Rapat</span>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </h2>

            <form onSubmit={handleSaveRapat} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Judul Rapat *</label>
                <input
                  type="text"
                  required
                  placeholder="Mis. Rapat Koordinasi UKT Semester II Tahun 2026"
                  value={formData.judulRapat}
                  onChange={(e) => setFormData({ ...formData, judulRapat: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Tanggal Rapat</label>
                  <input
                    type="date"
                    value={formData.tanggalRapat}
                    onChange={(e) => setFormData({ ...formData, tanggalRapat: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Lokasi Rapat</label>
                  <input
                    type="text"
                    placeholder="Mis. GOR Dispora Jatim / Zoom"
                    value={formData.lokasi}
                    onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Pimpinan Rapat</label>
                  <input
                    type="text"
                    placeholder="Mis. Sensei Bambang (Ketua Harian)"
                    value={formData.pimpinanRapat}
                    onChange={(e) => setFormData({ ...formData, pimpinanRapat: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Peserta Hadir (Pisahkan koma)</label>
                  <input
                    type="text"
                    placeholder="Mis. Ahmad, Budi, Dewi, Sensei Tonny"
                    value={formData.pesertaHadirStr}
                    onChange={(e) => setFormData({ ...formData, pesertaHadirStr: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Agenda Rapat *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Poin-poin topik bahasan rapat..."
                  value={formData.agenda}
                  onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Isi Pembahasan & Keputusan Rapat *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Detail jalannya pembahasan & kesepakatan poin rapat..."
                  value={formData.pembahasan}
                  onChange={(e) => setFormData({ ...formData, pembahasan: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {/* Action Items List Editor */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-400 font-medium">Action Items (Tugas Tambahan)</label>
                  <button
                    type="button"
                    onClick={handleAddActionItem}
                    className="px-2.5 py-1 rounded-lg bg-purple-600/20 text-purple-300 text-[11px] font-bold"
                  >
                    + Tambah Tugas
                  </button>
                </div>

                {actionItems.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <input
                      type="text"
                      placeholder="Uraian Tugas"
                      value={a.task}
                      onChange={(e) => handleUpdateActionItem(i, "task", e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white"
                    />
                    <input
                      type="text"
                      placeholder="Penanggung Jawab"
                      value={a.assignee}
                      onChange={(e) => handleUpdateActionItem(i, "assignee", e.target.value)}
                      className="w-36 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveActionItem(i)}
                      className="p-1.5 text-slate-500 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg shadow-purple-600/30"
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

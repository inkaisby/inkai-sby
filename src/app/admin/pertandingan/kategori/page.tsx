"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  ArrowLeft,
  Plus,
  Trash2,
  Settings,
  Scale,
  DollarSign,
  Users,
  Swords,
  Shield,
  Calendar,
} from "lucide-react";
import { InkaiConfirmDialog } from "@/components/ui/InkaiConfirmDialog";
import { showError, showSuccess } from "@/lib/client-toast";

interface EventItem {
  id: string;
  title: string;
}

interface CategoryItem {
  id: string;
  eventId: string;
  name: string;
  categoryType: string;
  gender: string;
  minAge?: number | null;
  maxAge?: number | null;
  minBirthDate?: string | null;
  maxBirthDate?: string | null;
  minWeight?: number | null;
  maxWeight?: number | null;
  fee: number;
  _count?: { registrations: number };
}

export default function AdminPertandinganKategoriPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // INKAI Custom Confirmation Modal State
  const [deleteCatState, setDeleteCatState] = useState<{ open: boolean; id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form New Category
  const [newCat, setNewCat] = useState({
    name: "",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
    minAge: "",
    maxAge: "",
    minBirthDate: "",
    maxBirthDate: "",
    minWeight: "",
    maxWeight: "",
    fee: "150000",
  });

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/admin/pertandingan/events");
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
        if (data.events.length > 0 && !selectedEventId) {
          setSelectedEventId(data.events[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    if (!selectedEventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pertandingan/categories?eventId=${selectedEventId}`);
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) fetchCategories();
  }, [selectedEventId]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;

    try {
      const res = await fetch("/api/admin/pertandingan/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          ...newCat,
        }),
      });

      if (res.ok) {
        showSuccess("Kategori kelas pertandingan berhasil ditambahkan");
        setNewCat({
          name: "",
          categoryType: "KATA_INDIVIDUAL",
          gender: "MALE",
          minAge: "",
          maxAge: "",
          minBirthDate: "",
          maxBirthDate: "",
          minWeight: "",
          maxWeight: "",
          fee: "150000",
        });
        fetchCategories();
      } else {
        const data = await res.json();
        showError(data.error || "Gagal menambah kategori");
      }
    } catch (err) {
      console.error(err);
      showError("Terjadi kesalahan saat menambah kategori");
    }
  };

  const triggerDeleteCategory = (cat: CategoryItem) => {
    setDeleteCatState({ open: true, id: cat.id, name: cat.name });
  };

  const executeDeleteCategory = async () => {
    if (!deleteCatState) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/pertandingan/categories?id=${deleteCatState.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showSuccess("Kategori kelas pertandingan berhasil dihapus");
        fetchCategories();
        setDeleteCatState(null);
      } else {
        const data = await res.json();
        showError(data.error || "Gagal menghapus kategori");
      }
    } catch (err) {
      console.error(err);
      showError("Terjadi kesalahan saat menghapus kategori");
    } finally {
      setIsDeleting(false);
    }
  };


  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/pertandingan"
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition text-zinc-600 dark:text-zinc-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Settings className="w-6 h-6 text-red-600" />
              Kelola Kelas Pertandingan & Biaya
            </h1>
            <p className="text-xs text-zinc-500">
              Penetapan Kelas Kata/Kumite Berdasarkan Rentang Tanggal Lahir, Usia, Berat Badan, & Tarif Biaya Pertandingan
            </p>
          </div>
        </div>

        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-semibold"
        >
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.title}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Tambah Kategori */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-red-600" />
            Tambah Kelas Baru
          </h2>

          <form onSubmit={handleCreateCategory} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nama Kelas Pertandingan *</label>
              <input
                type="text"
                required
                placeholder="mis. Kumite Putra -55kg Pemula"
                value={newCat.name}
                onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Jenis Kategori *</label>
                <select
                  value={newCat.categoryType}
                  onChange={(e) => setNewCat({ ...newCat, categoryType: e.target.value })}
                  className="w-full mt-1 px-2.5 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-medium"
                >
                  <option value="KATA_INDIVIDUAL">Kata Perorangan</option>
                  <option value="KATA_TEAM">Kata Beregu</option>
                  <option value="KUMITE_INDIVIDUAL">Kumite Perorangan</option>
                  <option value="KUMITE_TEAM">Kumite Beregu</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Gender *</label>
                <select
                  value={newCat.gender}
                  onChange={(e) => setNewCat({ ...newCat, gender: e.target.value })}
                  className="w-full mt-1 px-2.5 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-medium"
                >
                  <option value="MALE">Putra (Male)</option>
                  <option value="FEMALE">Putri (Female)</option>
                  <option value="MIXED">Campuran (Mixed)</option>
                </select>
              </div>
            </div>

            {/* Rentang Tanggal Lahir (Kriteria Kelayakan) */}
            <div className="p-3 bg-red-50/50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/40 space-y-2">
              <span className="text-xs font-bold text-red-900 dark:text-red-200 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-red-600" />
                Kriteria Rentang Tanggal Lahir
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-500 dark:text-zinc-400">Paling Awal (Min Tgl)</label>
                  <input
                    type="date"
                    value={newCat.minBirthDate}
                    onChange={(e) => setNewCat({ ...newCat, minBirthDate: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 dark:text-zinc-400">Paling Akhir (Max Tgl)</label>
                  <input
                    type="date"
                    value={newCat.maxBirthDate}
                    onChange={(e) => setNewCat({ ...newCat, maxBirthDate: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Batas Min BB (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="0"
                  value={newCat.minWeight}
                  onChange={(e) => setNewCat({ ...newCat, minWeight: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Batas Max BB (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="30"
                  value={newCat.maxWeight}
                  onChange={(e) => setNewCat({ ...newCat, maxWeight: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Biaya Pertandingan ditentukan Cabang (Rp) *</label>
              <input
                type="number"
                required
                placeholder="150000"
                value={newCat.fee}
                onChange={(e) => setNewCat({ ...newCat, fee: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-bold text-emerald-600 dark:text-emerald-400"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Simpan Kategori Kelas
            </button>
          </form>
        </div>

        {/* Tabel Daftar Kategori */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Swords className="w-5 h-5 text-red-600" />
              Daftar Kategori Kelas Terdaftar ({categories.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Nama Kelas</th>
                  <th className="py-3 px-4">Jenis</th>
                  <th className="py-3 px-4">Kriteria Tgl Lahir / BB</th>
                  <th className="py-3 px-4">Biaya Cabang</th>
                  <th className="py-3 px-4 text-center">Atlet</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      Memuat kategori...
                    </td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      Belum ada kategori kelas pada event ini.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition">
                      <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                        {cat.name}
                        <div className="text-xs font-normal text-zinc-500">Gender: {cat.gender}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          cat.categoryType.startsWith("KATA")
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
                        }`}>
                          {cat.categoryType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-zinc-600 dark:text-zinc-400">
                        {cat.minBirthDate || cat.maxBirthDate ? (
                          <div className="font-mono text-[11px] text-red-600 dark:text-red-400">
                            🎂 {cat.minBirthDate ? new Date(cat.minBirthDate).toLocaleDateString("id-ID") : "*"} s/d {cat.maxBirthDate ? new Date(cat.maxBirthDate).toLocaleDateString("id-ID") : "*"}
                          </div>
                        ) : cat.minAge || cat.maxAge ? (
                          <div>{cat.minAge || 0}-{cat.maxAge || "∞"} thn</div>
                        ) : (
                          <div>Semua Usia / Bebas</div>
                        )}
                        <div className="text-[11px] text-zinc-500">
                          {cat.maxWeight ? `Max ${cat.maxWeight} kg` : "Bebas BB"}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                        Rp {cat.fee.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-zinc-700 dark:text-zinc-300">
                        {cat._count?.registrations || 0}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => triggerDeleteCategory(cat)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 rounded-lg transition"
                          title="Hapus Kategori Kelas Ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* INKAI Custom Confirmation Modal */}
      {deleteCatState && (
        <InkaiConfirmDialog
          open={deleteCatState.open}
          onOpenChange={(open) => {
            if (!open) setDeleteCatState(null);
          }}
          title="Hapus Kategori Kelas"
          description={`Apakah Anda yakin ingin menghapus kategori kelas "${deleteCatState.name}" dari kejuaraan ini?`}
          confirmLabel="Ya, Hapus Kategori"
          cancelLabel="Batal"
          variant="danger"
          loading={isDeleting}
          onConfirm={executeDeleteCategory}
        />
      )}
    </div>
  );
}

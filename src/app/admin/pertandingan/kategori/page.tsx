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
  Pencil,
  Eye,
  EyeOff,
  X,
  Zap,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
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
  isFeeVisible?: boolean;
  _count?: { registrations: number };
}

interface EditCategoryForm {
  id: string;
  name: string;
  categoryType: string;
  gender: string;
  minAge: string;
  maxAge: string;
  minBirthDate: string;
  maxBirthDate: string;
  minWeight: string;
  maxWeight: string;
  fee: string;
  isFeeVisible: boolean;
}

export default function AdminPertandinganKategoriPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  // INKAI Custom Confirmation Modal State
  const [deleteCatState, setDeleteCatState] = useState<{ open: boolean; id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Category Modal State
  const [editCatState, setEditCatState] = useState<EditCategoryForm | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Preset Generator State
  const [isGeneratingPreset, setIsGeneratingPreset] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [selectedDivisionGroup, setSelectedDivisionGroup] = useState<string>("ALL");
  const [presetFee, setPresetFee] = useState<string>("150000");

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
    isFeeVisible: true,
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
          isFeeVisible: true,
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

  const handleGeneratePreset = async (group: string) => {
    if (!selectedEventId) return;
    setIsGeneratingPreset(true);
    try {
      const res = await fetch("/api/admin/pertandingan/categories/preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          divisionGroup: group,
          feeOverride: presetFee ? parseFloat(presetFee) : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess(data.message || "Templat kategori berhasil ditambahkan");
        setPresetModalOpen(false);
        fetchCategories();
      } else {
        showError(data.error || "Gagal menerapkan templat kategori");
      }
    } catch (err) {
      console.error(err);
      showError("Terjadi kesalahan saat membuat templat kategori");
    } finally {
      setIsGeneratingPreset(false);
    }
  };

  const openEditCategory = (cat: CategoryItem) => {
    let minB = "";
    let maxB = "";
    if (cat.minBirthDate) {
      minB = new Date(cat.minBirthDate).toISOString().substring(0, 10);
    }
    if (cat.maxBirthDate) {
      maxB = new Date(cat.maxBirthDate).toISOString().substring(0, 10);
    }
    setEditCatState({
      id: cat.id,
      name: cat.name,
      categoryType: cat.categoryType,
      gender: cat.gender,
      minAge: cat.minAge !== null && cat.minAge !== undefined ? String(cat.minAge) : "",
      maxAge: cat.maxAge !== null && cat.maxAge !== undefined ? String(cat.maxAge) : "",
      minBirthDate: minB,
      maxBirthDate: maxB,
      minWeight: cat.minWeight !== null && cat.minWeight !== undefined ? String(cat.minWeight) : "",
      maxWeight: cat.maxWeight !== null && cat.maxWeight !== undefined ? String(cat.maxWeight) : "",
      fee: String(cat.fee),
      isFeeVisible: cat.isFeeVisible !== false,
    });
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCatState) return;

    setIsUpdating(true);
    try {
      const res = await fetch("/api/admin/pertandingan/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editCatState.id,
          name: editCatState.name,
          categoryType: editCatState.categoryType,
          gender: editCatState.gender,
          minAge: editCatState.minAge,
          maxAge: editCatState.maxAge,
          minBirthDate: editCatState.minBirthDate || null,
          maxBirthDate: editCatState.maxBirthDate || null,
          minWeight: editCatState.minWeight,
          maxWeight: editCatState.maxWeight,
          fee: editCatState.fee,
          isFeeVisible: editCatState.isFeeVisible,
        }),
      });

      if (res.ok) {
        showSuccess("Kategori kelas pertandingan berhasil diperbarui");
        setEditCatState(null);
        fetchCategories();
      } else {
        const data = await res.json();
        showError(data.error || "Gagal memperbarui kategori");
      }
    } catch (err) {
      console.error(err);
      showError("Terjadi kesalahan saat memperbarui kategori");
    } finally {
      setIsUpdating(false);
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

  // Filter Categories
  const filteredCategories = categories.filter((cat) => {
    const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterType === "ALL") return true;
    if (filterType === "KATA") return cat.categoryType.startsWith("KATA");
    if (filterType === "KUMITE") return cat.categoryType.startsWith("KUMITE");
    return true;
  });

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
              Penetapan Kelas Kata/Kumite, Rentang Usia/Tanggal Lahir, Kategori Open/Pelajar/Veteran/Disabilitas/BOB & Tarif Biaya
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPresetModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-white font-bold text-xs rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            Templat Kategori Standard (85+ Kelas)
          </button>

          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-semibold text-zinc-900 dark:text-white"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Tambah Kategori Manual */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-red-600" />
              Tambah Kelas Baru
            </h2>
            <button
              onClick={() => setPresetModalOpen(true)}
              className="text-[11px] text-red-600 dark:text-red-400 font-bold hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> Batch Preset
            </button>
          </div>

          <form onSubmit={handleCreateCategory} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nama Kelas Pertandingan *</label>
              <input
                type="text"
                required
                placeholder="mis. Pra Usia Dini - Kata Perorangan Putra"
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
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Biaya Pertandingan (Rp) *</label>
              <input
                type="number"
                required
                placeholder="150000"
                value={newCat.fee}
                onChange={(e) => setNewCat({ ...newCat, fee: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-bold text-emerald-600 dark:text-emerald-400"
              />
            </div>

            {/* Checkbox Option Tampilkan Biaya */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="newIsFeeVisible"
                  checked={newCat.isFeeVisible}
                  onChange={(e) => setNewCat({ ...newCat, isFeeVisible: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="newIsFeeVisible" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer flex items-center gap-1.5">
                  {newCat.isFeeVisible ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-amber-600" />}
                  Tampilkan Biaya Pertandingan
                </label>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${newCat.isFeeVisible ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"}`}>
                {newCat.isFeeVisible ? "Ditampilkan" : "Disembunyikan"}
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-xl transition shadow flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Simpan Kategori Kelas
            </button>
          </form>
        </div>

        {/* Tabel Daftar Kategori */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm space-y-0">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Swords className="w-5 h-5 text-red-600" />
              Daftar Kategori Kelas ({filteredCategories.length} dari {categories.length})
            </h2>

            {/* Controls Search & Filter */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Cari kelas (mis. Pemula)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs w-44 sm:w-56"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-semibold"
              >
                <option value="ALL">Semua Jenis</option>
                <option value="KATA">Kata</option>
                <option value="KUMITE">Kumite</option>
              </select>
            </div>
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
                ) : filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      {categories.length === 0
                        ? "Belum ada kategori kelas pada event ini. Klik 'Templat Kategori Standard' untuk menambahkan 85+ kelas otomatis."
                        : "Tidak ada kategori yang cocok dengan pencarian."}
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((cat) => (
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
                          {cat.minWeight || cat.maxWeight
                            ? `${cat.minWeight ? `Min ${cat.minWeight}kg ` : ""}${cat.maxWeight ? `Max ${cat.maxWeight}kg` : ""}`
                            : "Bebas BB"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          Rp {cat.fee.toLocaleString("id-ID")}
                        </div>
                        <div className="mt-0.5">
                          {cat.isFeeVisible !== false ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/50">
                              <Eye className="w-3 h-3" /> Ditampilkan
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/50">
                              <EyeOff className="w-3 h-3" /> Disembunyikan
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-zinc-700 dark:text-zinc-300">
                        {cat._count?.registrations || 0}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditCategory(cat)}
                            className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg transition cursor-pointer"
                            title="Edit Kategori Kelas Ini"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => triggerDeleteCategory(cat)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 rounded-lg transition cursor-pointer"
                            title="Hapus Kategori Kelas Ini"
                          >
                            <Trash2 className="w-4 h-4" />
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
      </div>

      {/* Modal Templat Preset Kategori Standard INKAI / FORKI */}
      {presetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-2xl w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Tambah Templat Kategori Standard INKAI / FORKI
                </h3>
                <p className="text-xs text-zinc-500">
                  Pilih divisi dan tarif biaya awal. Kategori yang sudah ada tidak akan diduplikat.
                </p>
              </div>
              <button
                onClick={() => setPresetModalOpen(false)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Default Biaya Pendaftaran per Kategori (Rp)
                </label>
                <input
                  type="number"
                  value={presetFee}
                  onChange={(e) => setPresetFee(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-emerald-600 dark:text-emerald-400"
                  placeholder="150000"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Biaya dapat disesuaikan kembali per-kategori setelah templat berhasil ditambahkan.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Pilih Paket Divisi Kategori yang Ingin Ditambahkan:
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleGeneratePreset("ALL")}
                    disabled={isGeneratingPreset}
                    className="p-3.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-left font-bold text-xs transition shadow flex flex-col justify-between space-y-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> SEMUA KATEGORI LENGKAP</span>
                      <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">~85 Kelas</span>
                    </span>
                    <span className="font-normal text-[11px] opacity-90">
                      Termasuk Open, Pelajar, Veteran, Disabilitas, & BOB.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGeneratePreset("OPEN")}
                    disabled={isGeneratingPreset}
                    className="p-3.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/40 border border-zinc-300 dark:border-zinc-700 hover:border-red-400 text-zinc-900 dark:text-white rounded-xl text-left font-bold text-xs transition flex flex-col justify-between space-y-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between">
                      <span>1. KATEGORI TERBUKA / OPEN</span>
                      <span className="bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-[10px]">~45 Kelas</span>
                    </span>
                    <span className="font-normal text-[11px] text-zinc-500 dark:text-zinc-400">
                      Pra Usia Dini, Usia Dini, Pra Pemula, Pemula, Kadet, Junior, U-21, Senior & Kumite Beregu
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGeneratePreset("PELAJAR")}
                    disabled={isGeneratingPreset}
                    className="p-3.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-zinc-300 dark:border-zinc-700 hover:border-blue-400 text-zinc-900 dark:text-white rounded-xl text-left font-bold text-xs transition flex flex-col justify-between space-y-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between">
                      <span>2. KATEGORI PELAJAR</span>
                      <span className="bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-[10px]">~24 Kelas</span>
                    </span>
                    <span className="font-normal text-[11px] text-zinc-500 dark:text-zinc-400">
                      TK, SD 1-3, SD 4-6, SMP/MTs, SMA/SMK/MA, Mahasiswa/Umum
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGeneratePreset("DISABILITAS")}
                    disabled={isGeneratingPreset}
                    className="p-3.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-zinc-300 dark:border-zinc-700 hover:border-emerald-400 text-zinc-900 dark:text-white rounded-xl text-left font-bold text-xs transition flex flex-col justify-between space-y-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between">
                      <span>3. EKSEBISI DISABILITAS</span>
                      <span className="bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-[10px]">6 Kelas</span>
                    </span>
                    <span className="font-normal text-[11px] text-zinc-500 dark:text-zinc-400">
                      Kata Perorangan Rungu/Wicara, Daksa, & Grahita (Putra/Putri)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGeneratePreset("VETERAN")}
                    disabled={isGeneratingPreset}
                    className="p-3.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-zinc-300 dark:border-zinc-700 hover:border-purple-400 text-zinc-900 dark:text-white rounded-xl text-left font-bold text-xs transition flex flex-col justify-between space-y-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between">
                      <span>4. KATEGORI VETERAN</span>
                      <span className="bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-[10px]">10 Kelas</span>
                    </span>
                    <span className="font-normal text-[11px] text-zinc-500 dark:text-zinc-400">
                      Kata/Kumite 30-40 th, 40-50 th, & +50 th
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGeneratePreset("BOB")}
                    disabled={isGeneratingPreset}
                    className="p-3.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-yellow-50 dark:hover:bg-yellow-950/40 border border-zinc-300 dark:border-zinc-700 hover:border-yellow-400 text-zinc-900 dark:text-white rounded-xl text-left font-bold text-xs transition flex flex-col justify-between space-y-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between">
                      <span>5. BEST OF THE BEST (BOB)</span>
                      <span className="bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-[10px]">6 Kelas</span>
                    </span>
                    <span className="font-normal text-[11px] text-zinc-500 dark:text-zinc-400">
                      Kata & Kumite BOB Kadet-Junior / U21-Senior
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setPresetModalOpen(false)}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Kategori Kelas */}
      {editCatState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 max-w-lg w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-600" />
                Edit Kelas Pertandingan & Biaya
              </h3>
              <button
                onClick={() => setEditCatState(null)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCategory} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nama Kelas Pertandingan *</label>
                <input
                  type="text"
                  required
                  value={editCatState.name}
                  onChange={(e) => setEditCatState({ ...editCatState, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Jenis Kategori *</label>
                  <select
                    value={editCatState.categoryType}
                    onChange={(e) => setEditCatState({ ...editCatState, categoryType: e.target.value })}
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
                    value={editCatState.gender}
                    onChange={(e) => setEditCatState({ ...editCatState, gender: e.target.value })}
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
                      value={editCatState.minBirthDate}
                      onChange={(e) => setEditCatState({ ...editCatState, minBirthDate: e.target.value })}
                      className="w-full mt-0.5 px-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 dark:text-zinc-400">Paling Akhir (Max Tgl)</label>
                    <input
                      type="date"
                      value={editCatState.maxBirthDate}
                      onChange={(e) => setEditCatState({ ...editCatState, maxBirthDate: e.target.value })}
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
                    value={editCatState.minWeight}
                    onChange={(e) => setEditCatState({ ...editCatState, minWeight: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Batas Max BB (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editCatState.maxWeight}
                    onChange={(e) => setEditCatState({ ...editCatState, maxWeight: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Biaya Pertandingan (Rp) *</label>
                <input
                  type="number"
                  required
                  value={editCatState.fee}
                  onChange={(e) => setEditCatState({ ...editCatState, fee: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-bold text-emerald-600 dark:text-emerald-400"
                />
              </div>

              {/* Checkbox Option Tampilkan Biaya */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="editIsFeeVisible"
                    checked={editCatState.isFeeVisible}
                    onChange={(e) => setEditCatState({ ...editCatState, isFeeVisible: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="editIsFeeVisible" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer flex items-center gap-1.5">
                    {editCatState.isFeeVisible ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-amber-600" />}
                    Tampilkan Biaya Pertandingan
                  </label>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${editCatState.isFeeVisible ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"}`}>
                  {editCatState.isFeeVisible ? "Ditampilkan" : "Disembunyikan"}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditCatState(null)}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

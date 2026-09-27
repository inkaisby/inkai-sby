"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Users,
  Building2,
  DollarSign,
  Plus,
  Search,
  Filter,
  Printer,
  CreditCard,
  Settings,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  MapPin,
  Scale,
  UserCheck,
  FileText,
  Eye,
  Edit,
  Trash2,
  ShieldCheck,
  FileSpreadsheet,
  AlertCircle,
  BookOpen,
  Save,
  Download,
} from "lucide-react";
import { generateTournamentIdCardsHtml, generateTournamentRosterHtml } from "@/lib/tournament-print-html";

interface EventItem {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location?: string;
  rulesContent?: string | null;
  _count?: {
    tournamentCategories: number;
    tournamentRegistrations: number;
  };
}

interface CategoryItem {
  id: string;
  name: string;
  categoryType: string;
  gender: string;
  fee: number;
}

interface DojoItem {
  id: string;
  name: string;
}

interface MemberItem {
  id: string;
  fullName: string;
  nia?: string;
  currentRank?: string;
  gender?: string;
  birthDate?: string;
  photoUrl?: string;
  birthCertificateUrl?: string;
  bpjsCardUrl?: string;
}

interface RegistrationItem {
  id: string;
  eventId: string;
  dojoId: string;
  memberId: string;
  categoryId: string;
  status: string;
  actualWeight?: number | null;
  officialName?: string | null;
  officialPhone?: string | null;
  notes?: string | null;
  member: MemberItem;
  dojo: DojoItem;
  category: CategoryItem;
}

const DEFAULT_TOURNAMENT_RULES_TEMPLATE = `
<h3>I. KETENTUAN UMUM PERTANDINGAN</h3>
<p>1. Pertandingan dilaksanakan berdasar Peraturan Pertandingan WKF / FORKI / INKAI yang berlaku.</p>
<p>2. Seluruh peserta, official, dan manajer tim wajib menjunjung tinggi nilai-nilai kejujuran, disiplin, dan Karatedo.</p>

<h3>II. PERSYARATAN PESERTA</h3>
<p>1. Anggota resmi INKAI Cabang Surabaya berstatus aktif dengan Bukti Keanggotaan / NIA valid.</p>
<p>2. Menyerahkan Berkas Pas Foto, Akte Kelahiran, dan BPJS Kesehatan / Surat Keterangan Sehat.</p>
<p>3. Peserta wajib mendaftar sesuai dengan rentang tanggal lahir dan batasan berat badan kelas yang diikuti.</p>

<h3>III. PERATURAN TIMBANG BADAN & PERALATAN</h3>
<p>1. Timbang Badan dilaksanakan pada hari H sebelum pertandingan dimulai dengan toleransi 0.5 kg.</p>
<p>2. Peralatan tanding (Handprotector, Shin Guard, Gumshield, Sabuk Merah/Biru) wajib memenuhi standar safety INKAI.</p>

<h3>IV. PROTES DAN PROSEDUR BANDING</h3>
<p>1. Protes teknis keputusan wasit hanya dapat diajukan oleh Manajer Tim secara tertulis maksimal 15 menit setelah partai tanding berakhir.</p>
<p>2. Pengajuan protes disertai dengan deposit biaya protes sebesar Rp 500.000,- (Lima Ratus Ribu Rupiah).</p>
`;

export default function AdminPertandinganPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [dojos, setDojos] = useState<DojoItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedDojoId, setSelectedDojoId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");

  // Modals
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState<EventItem | null>(null);
  const [showRulesEditorModal, setShowRulesEditorModal] = useState(false);
  const [showBatchRegModal, setShowBatchRegModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState<RegistrationItem | null>(null);
  const [previewDocModal, setPreviewDocModal] = useState<{ title: string; url: string } | null>(null);

  // Form states
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    location: "",
  });

  const [rulesInput, setRulesInput] = useState("");

  const [batchReg, setBatchReg] = useState({
    dojoId: "",
    officialName: "",
    officialPhone: "",
    entries: [{ memberId: "", categoryId: "" }],
  });

  const [actualWeightInput, setActualWeightInput] = useState("");
  const [weightStatusInput, setWeightStatusInput] = useState("VERIFIED");
  const [paymentMethodInput, setPaymentMethodInput] = useState<"TRANSFER" | "CASH">("TRANSFER");

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
      console.error("Failed to fetch events", err);
    }
  };

  const fetchCategories = async (eventId: string) => {
    try {
      const res = await fetch(`/api/admin/pertandingan/categories?eventId=${eventId}`);
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch (err) {
      console.error("Failed to fetch categories", err);
    }
  };

  const fetchDojosAndMembers = async () => {
    try {
      const [resDojos, resMembers] = await Promise.all([
        fetch("/api/dojos"),
        fetch("/api/admin/members?limit=1000"),
      ]);
      const dataDojos = await resDojos.json();
      const dataMembers = await resMembers.json();

      if (Array.isArray(dataDojos)) setDojos(dataDojos);
      else if (dataDojos.dojos) setDojos(dataDojos.dojos);

      if (dataMembers.members) setMembers(dataMembers.members);
    } catch (err) {
      console.error("Failed to fetch dojos/members", err);
    }
  };

  const fetchRegistrations = async () => {
    if (!selectedEventId) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        eventId: selectedEventId,
        ...(search ? { search } : {}),
        ...(selectedDojoId ? { dojoId: selectedDojoId } : {}),
        ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {}),
        ...(selectedStatus ? { status: selectedStatus } : {}),
      });

      const res = await fetch(`/api/admin/pertandingan/registrations?${queryParams}`);
      const data = await res.json();
      if (data.registrations) setRegistrations(data.registrations);
      if (data.summary) setSummary(data.summary);
    } catch (err) {
      console.error("Failed to fetch registrations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchDojosAndMembers();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchCategories(selectedEventId);
      fetchRegistrations();
      const active = events.find(e => e.id === selectedEventId);
      if (active) setRulesInput(active.rulesContent || DEFAULT_TOURNAMENT_RULES_TEMPLATE);
    }
  }, [selectedEventId, search, selectedDojoId, selectedCategoryId, selectedStatus]);

  // Event CRUD
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/pertandingan/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventForm),
      });
      const data = await res.json();
      if (res.ok) {
        setShowNewEventModal(false);
        setEventForm({ title: "", description: "", startDate: "", endDate: "", location: "" });
        await fetchEvents();
        if (data.event) setSelectedEventId(data.event.id);
      } else {
        alert(data.error || "Gagal membuat event");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan");
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditEventModal) return;
    try {
      const res = await fetch("/api/admin/pertandingan/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: showEditEventModal.id,
          ...eventForm,
        }),
      });
      if (res.ok) {
        setShowEditEventModal(null);
        fetchEvents();
      } else {
        const data = await res.json();
        alert(data.error || "Gagal memperbarui event");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRules = async () => {
    if (!selectedEventId) return;
    try {
      const res = await fetch("/api/admin/pertandingan/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedEventId,
          rulesContent: rulesInput,
        }),
      });
      if (res.ok) {
        alert("Ketentuan Pertandingan berhasil disimpan!");
        setShowRulesEditorModal(false);
        fetchEvents();
      } else {
        alert("Gagal menyimpan ketentuan pertandingan");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Hapus event kejuaraan ini beserta kategorinya?")) return;
    try {
      const res = await fetch(`/api/admin/pertandingan/events?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSelectedEventId("");
        fetchEvents();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBatchRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;

    try {
      const validEntries = batchReg.entries.filter(e => e.memberId && e.categoryId);
      if (validEntries.length === 0) {
        alert("Pilih minimal 1 atlet dan 1 kategori");
        return;
      }

      const res = await fetch("/api/admin/pertandingan/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          dojoId: batchReg.dojoId,
          officialName: batchReg.officialName,
          officialPhone: batchReg.officialPhone,
          entries: validEntries,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Berhasil meregistrasikan ${data.createdCount} atlet/kategori!`);
        setShowBatchRegModal(false);
        setBatchReg({
          dojoId: "",
          officialName: "",
          officialPhone: "",
          entries: [{ memberId: "", categoryId: "" }],
        });
        fetchRegistrations();
      } else {
        alert(data.error || "Gagal pendaftaran");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan");
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/admin/pertandingan/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        fetchRegistrations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showWeightModal) return;
    try {
      const cleanNotes = (showWeightModal.notes || "").replace(/\[(CASH|TRANSFER)\]|METODE:\s*(CASH|TRANSFER)/gi, "").trim();
      const updatedNotes = cleanNotes ? `${cleanNotes} [${paymentMethodInput}]` : `[${paymentMethodInput}]`;

      const res = await fetch("/api/admin/pertandingan/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: showWeightModal.id,
          actualWeight: actualWeightInput,
          status: weightStatusInput,
          notes: updatedNotes,
        }),
      });
      if (res.ok) {
        setShowWeightModal(null);
        fetchRegistrations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRegistration = async (id: string) => {
    if (!confirm("Hapus pendaftaran atlet ini dari kejuaraan?")) return;
    try {
      const res = await fetch(`/api/admin/pertandingan/registrations?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchRegistrations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const displayedRegistrations = registrations.filter((reg) => {
    if (!selectedPaymentMethod) return true;
    if (selectedPaymentMethod === "CASH") return reg.notes?.includes("CASH");
    if (selectedPaymentMethod === "TRANSFER") return !reg.notes?.includes("CASH");
    return true;
  });

  const exportToExcel = () => {
    const activeEvent = events.find((e) => e.id === selectedEventId);
    const eventName = activeEvent?.title || "Kejuaraan Karate INKAI Surabaya";

    const rows = displayedRegistrations.map((r, idx) => {
      const payMethod = r.notes?.includes("CASH") ? "TUNAI" : "TRANSFER / QRIS";
      return [
        idx + 1,
        `"${(r.member.fullName || "").replace(/"/g, '""')}"`,
        `"${r.member.nia || "-"}"`,
        `"${(r.dojo?.name || "").replace(/"/g, '""')}"`,
        `"${r.member.currentRank || "Putih"}"`,
        `"${(r.category?.name || "").replace(/"/g, '""')}"`,
        r.category?.fee || 0,
        `"${r.status}"`,
        `"${payMethod}"`,
        r.actualWeight ? `${r.actualWeight} kg` : "Belum timbang",
        `"${r.officialName || "-"}"`,
        `"${r.officialPhone || "-"}"`,
      ].join(",");
    });

    const headers = [
      "No",
      "Nama Atlet",
      "NIA",
      "Dojo / Kontingen",
      "Sabuk",
      "Kelas Pertandingan",
      "Biaya (Rp)",
      "Status Pendaftaran",
      "Metode Pembayaran",
      "Hasil Berat Badan",
      "Nama Official",
      "Kontak Official",
    ].join(",");

    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Roster_${eventName.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printIdCards = () => {
    const activeEvent = events.find((e) => e.id === selectedEventId);
    const html = generateTournamentIdCardsHtml(activeEvent?.title || "Kejuaraan Karate", displayedRegistrations);
    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => printWin.print(), 500);
    }
  };

  const printRoster = () => {
    const activeEvent = events.find((e) => e.id === selectedEventId);
    const html = generateTournamentRosterHtml(activeEvent?.title || "Kejuaraan Karate", displayedRegistrations);
    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => printWin.print(), 500);
    }
  };

  const activeEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-red-900 via-red-800 to-red-950 text-white p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-400 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight">Pendaftaran & Roster Kejuaraan</h1>
          </div>
          <p className="text-sm text-red-200">
            CRUD Event Pertandingan, Editor Ketentuan, Berkas Profil (Foto/Akte/BPJS), Timbang Badan, & ID Card
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setEventForm({ title: "", description: "", startDate: "", endDate: "", location: "" });
              setShowNewEventModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-xs md:text-sm rounded-xl transition shadow-lg"
          >
            <Plus className="w-4 h-4" />
            + Kejuaraan Baru
          </button>

          <button
            onClick={() => setShowRulesEditorModal(true)}
            disabled={!selectedEventId}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 text-white font-semibold text-xs md:text-sm rounded-xl backdrop-blur transition disabled:opacity-50"
          >
            <BookOpen className="w-4 h-4 text-yellow-300" />
            📜 Editor Ketentuan
          </button>

          <Link
            href="/admin/pertandingan/kategori"
            className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-medium text-xs md:text-sm rounded-xl backdrop-blur transition"
          >
            <Settings className="w-4 h-4" />
            Kelola Kelas & Biaya
          </Link>
        </div>
      </div>

      {/* Selector & CRUD Event Pertandingan */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Kejuaraan:</span>
          </div>
          
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full md:w-80 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-red-500"
          >
            {events.length === 0 && <option value="">Belum ada event kejuaraan</option>}
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} ({new Date(ev.startDate).toLocaleDateString("id-ID")})
              </option>
            ))}
          </select>

          {activeEvent && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setEventForm({
                    title: activeEvent.title,
                    description: activeEvent.description || "",
                    startDate: activeEvent.startDate ? activeEvent.startDate.split("T")[0] : "",
                    endDate: activeEvent.endDate ? activeEvent.endDate.split("T")[0] : "",
                    location: activeEvent.location || "",
                  });
                  setShowEditEventModal(activeEvent);
                }}
                className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                title="Edit Event Kejuaraan Ini"
              >
                <Edit className="w-4 h-4 text-blue-500" />
              </button>

              <button
                onClick={() => handleDeleteEvent(activeEvent.id)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                title="Hapus Event Kejuaraan Ini"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {activeEvent && (
          <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-red-500" />
              {new Date(activeEvent.startDate).toLocaleDateString("id-ID")} - {new Date(activeEvent.endDate).toLocaleDateString("id-ID")}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-red-500" />
              {activeEvent.location || "Surabaya"}
            </span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-950/50 rounded-xl text-red-600 dark:text-red-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{summary.totalCount || 0}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Total Pendaftaran Kelas</div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-yellow-100 dark:bg-yellow-950/50 rounded-xl text-yellow-600 dark:text-yellow-400">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{summary.uniqueAthletes || 0}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Total Atlet Unik</div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{summary.uniqueDojos || 0}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Kontingen / Dojo</div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              Rp {(summary.totalFee || 0).toLocaleString("id-ID")}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Total Biaya Pendaftaran</div>
          </div>
        </div>
      </div>

      {/* Toolbar Controls */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full md:w-60">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Cari atlet, NIA, dojo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Filter Dojo */}
            <select
              value={selectedDojoId}
              onChange={(e) => setSelectedDojoId(e.target.value)}
              className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
            >
              <option value="">Semua Dojo / Kontingen</option>
              {dojos.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {/* Filter Kategori */}
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
            >
              <option value="">Semua Kategori Kelas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Filter Status */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
            >
              <option value="">Semua Status</option>
              <option value="REGISTERED">Tercatat</option>
              <option value="PAID">Lunas</option>
              <option value="VERIFIED">Terverifikasi (Timbang OK)</option>
              <option value="REJECTED">Ditolak</option>
            </select>

            {/* Filter Metode Pembayaran */}
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-semibold text-blue-700 dark:text-blue-400"
            >
              <option value="">Semua Metode Bayar</option>
              <option value="TRANSFER">🏦 Transfer / QRIS</option>
              <option value="CASH">💵 Tunai / Cash</option>
            </select>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => setShowBatchRegModal(true)}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-xs md:text-sm rounded-lg flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              Daftar Kontingen
            </button>

            <button
              onClick={printIdCards}
              disabled={registrations.length === 0}
              className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium text-xs md:text-sm rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4 text-red-500" />
              Cetak ID Card
            </button>

            <button
              onClick={exportToExcel}
              disabled={displayedRegistrations.length === 0}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-semibold text-xs md:text-sm rounded-lg flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800 transition disabled:opacity-50"
              title="Ekspor Roster Terfilter ke Excel (.csv)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Export Excel
            </button>

            <button
              onClick={printRoster}
              disabled={displayedRegistrations.length === 0}
              className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium text-xs md:text-sm rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-emerald-500" />
              Cetak Roster
            </button>

            <button
              onClick={fetchRegistrations}
              className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabel Roster Pendaftar & Berkas Profil */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">Atlet / Foto</th>
                <th className="py-3 px-4">Dojo / Kontingen</th>
                <th className="py-3 px-4">Berkas Profil (Akte / BPJS)</th>
                <th className="py-3 px-4">Kelas Pertandingan</th>
                <th className="py-3 px-4">Biaya Cabang</th>
                <th className="py-3 px-4">Status & Berat Badan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Memuat data roster pertandingan...
                  </td>
                </tr>
              ) : displayedRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Tidak ada pendaftaran atlet yang sesuai dengan filter terpilih.
                  </td>
                </tr>
              ) : (
                displayedRegistrations.map((reg, idx) => (
                  <tr key={reg.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition">
                    <td className="py-3 px-4 font-mono text-xs text-zinc-500">{idx + 1}</td>
                    
                    {/* Atlet & Foto Profil */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-100 border border-zinc-300 dark:border-zinc-700 flex-shrink-0">
                          {reg.member.photoUrl ? (
                            <img src={reg.member.photoUrl} alt={reg.member.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-xs bg-red-800 text-white">
                              {reg.member.fullName.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-900 dark:text-white">{reg.member.fullName}</div>
                          <div className="text-xs text-zinc-500">NIA: {reg.member.nia || "-"} • {reg.member.currentRank || "Putih"}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-medium text-zinc-800 dark:text-zinc-200">
                      {reg.dojo.name}
                    </td>

                    {/* Berkas Profile Integration (Akte & BPJS) */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {reg.member.birthCertificateUrl ? (
                          <button
                            onClick={() => setPreviewDocModal({ title: `Akte Kelahiran - ${reg.member.fullName}`, url: reg.member.birthCertificateUrl! })}
                            className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 hover:underline"
                          >
                            <FileText className="w-3 h-3 text-emerald-600" />
                            Akte OK
                          </button>
                        ) : (
                          <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-[11px] text-zinc-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Tanpa Akte
                          </span>
                        )}

                        {reg.member.bpjsCardUrl ? (
                          <button
                            onClick={() => setPreviewDocModal({ title: `Kartu BPJS - ${reg.member.fullName}`, url: reg.member.bpjsCardUrl! })}
                            className="px-2 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded text-[11px] font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1 hover:underline"
                          >
                            <ShieldCheck className="w-3 h-3 text-blue-600" />
                            BPJS OK
                          </button>
                        ) : (
                          <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-[11px] text-zinc-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Tanpa BPJS
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
                        {reg.category.name}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                      Rp {reg.category.fee.toLocaleString("id-ID")}
                    </td>

                    {/* Status & Berat Badan & Metode Pembayaran */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                            reg.status === "VERIFIED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" :
                            reg.status === "PAID" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" :
                            reg.status === "REJECTED" ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" :
                            "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                          }`}>
                            {reg.status === "VERIFIED" && <CheckCircle className="w-3 h-3" />}
                            {reg.status === "PAID" && <CheckCircle className="w-3 h-3" />}
                            {reg.status === "REGISTERED" && <Clock className="w-3 h-3" />}
                            {reg.status === "VERIFIED" ? "SAH" : reg.status === "PAID" ? "LUNAS" : reg.status === "REJECTED" ? "REJECT" : "TERCATAT"}
                          </span>

                          {reg.notes?.includes("CASH") ? (
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded text-[10px] font-bold" title="Pembayaran Tunai / Cash">
                              💵 TUNAI
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded text-[10px] font-bold" title="Pembayaran Transfer Bank / QRIS">
                              🏦 TRANSFER
                            </span>
                          )}
                        </div>

                        <span className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Scale className="w-3.5 h-3.5 text-red-500" />
                          {reg.actualWeight ? (
                            <strong className="text-zinc-800 dark:text-zinc-200">{reg.actualWeight} kg</strong>
                          ) : (
                            <span className="italic text-zinc-400">Belum timbang</span>
                          )}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setShowWeightModal(reg);
                            setActualWeightInput(reg.actualWeight ? reg.actualWeight.toString() : "");
                            setWeightStatusInput(reg.status || "VERIFIED");
                            setPaymentMethodInput(reg.notes?.includes("CASH") ? "CASH" : "TRANSFER");
                          }}
                          title="Timbang Badan & Verifikasi Berkas"
                          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-blue-600 dark:text-blue-400 flex items-center gap-1 text-xs font-semibold"
                        >
                          <Scale className="w-4 h-4" /> Verifikasi
                        </button>

                        {reg.status !== "PAID" && reg.status !== "VERIFIED" && (
                          <button
                            onClick={() => handleUpdateStatus(reg.id, "PAID")}
                            title="Tandai Lunas"
                            className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md text-emerald-600"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteRegistration(reg.id)}
                          title="Hapus"
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md text-red-600"
                        >
                          <XCircle className="w-4 h-4" />
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

      {/* Modal Editor Ketentuan Pertandingan */}
      {showRulesEditorModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-yellow-500" />
                Editor Ketentuan & Peraturan Pertandingan
              </h2>
              <button
                type="button"
                onClick={() => setRulesInput(DEFAULT_TOURNAMENT_RULES_TEMPLATE)}
                className="text-xs text-red-600 dark:text-red-400 font-semibold hover:underline flex items-center gap-1"
              >
                ⚡ Reset Templat Standar INKAI
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Tuliskan bab ketentuan pertandingan, peraturan Kumite/Kata, persyaratan berkas, serta sistem protes. Format HTML didukung.
              </p>
              <textarea
                rows={14}
                value={rulesInput}
                onChange={(e) => setRulesInput(e.target.value)}
                placeholder="Tuliskan ketentuan pertandingan di sini..."
                className="w-full p-3 font-mono text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500">Dapat dibaca oleh seluruh kontingen dan anggota</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRulesEditorModal(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveRules}
                  className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Simpan Ketentuan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Event Baru (Create / Edit) */}
      {(showNewEventModal || showEditEventModal) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-red-600" />
              {showEditEventModal ? "Edit Event Kejuaraan" : "Buat Kejuaraan Pertandingan Baru"}
            </h2>
            <form onSubmit={showEditEventModal ? handleUpdateEvent : handleCreateEvent} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nama Kejuaraan / Event *</label>
                <input
                  type="text"
                  required
                  placeholder="mis. Kejuaraan Karate INKAI Surabaya Cup 2026"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Lokasi / Gelanggang *</label>
                <input
                  type="text"
                  required
                  placeholder="mis. GOR Pancasila Surabaya"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Tanggal Mulai *</label>
                  <input
                    type="date"
                    required
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Tanggal Selesai *</label>
                  <input
                    type="date"
                    required
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewEventModal(false);
                    setShowEditEventModal(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg"
                >
                  {showEditEventModal ? "Simpan Perubahan" : "Simpan & Buat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview Berkas / Dokumen */}
      {previewDocModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">{previewDocModal.title}</h3>
              <button onClick={() => setPreviewDocModal(null)} className="text-zinc-500 hover:text-zinc-800">
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 p-2 rounded-xl">
              <img src={previewDocModal.url} alt="Pratinjau Berkas" className="max-w-full max-h-[60vh] object-contain rounded" />
            </div>
          </div>
        </div>
      )}

      {/* Modal Pendaftaran Kontingen (Batch) */}
      {showBatchRegModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-red-600" />
              Pendaftaran Kontingen / Dojo
            </h2>
            <form onSubmit={handleBatchRegister} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Pilih Dojo / Ranting *</label>
                  <select
                    required
                    value={batchReg.dojoId}
                    onChange={(e) => setBatchReg({ ...batchReg, dojoId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                  >
                    <option value="">-- Pilih Dojo --</option>
                    {dojos.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nama Official / Manager</label>
                  <input
                    type="text"
                    placeholder="mis. Sensei Ahmad"
                    value={batchReg.officialName}
                    onChange={(e) => setBatchReg({ ...batchReg, officialName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No. WA Official</label>
                  <input
                    type="text"
                    placeholder="08123456789"
                    value={batchReg.officialPhone}
                    onChange={(e) => setBatchReg({ ...batchReg, officialPhone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Entries list */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Daftar Atlet & Kategori Kelas</span>
                  <button
                    type="button"
                    onClick={() => setBatchReg({
                      ...batchReg,
                      entries: [...batchReg.entries, { memberId: "", categoryId: "" }],
                    })}
                    className="text-xs text-red-600 dark:text-red-400 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Baris Baru
                  </button>
                </div>

                {batchReg.entries.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <span className="text-xs font-mono text-zinc-400 pl-1">{idx + 1}.</span>
                    
                    <select
                      required
                      value={entry.memberId}
                      onChange={(e) => {
                        const next = [...batchReg.entries];
                        next[idx].memberId = e.target.value;
                        setBatchReg({ ...batchReg, entries: next });
                      }}
                      className="flex-1 px-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs"
                    >
                      <option value="">-- Pilih Atlet / Anggota --</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.fullName} ({m.currentRank})</option>
                      ))}
                    </select>

                    <select
                      required
                      value={entry.categoryId}
                      onChange={(e) => {
                        const next = [...batchReg.entries];
                        next[idx].categoryId = e.target.value;
                        setBatchReg({ ...batchReg, entries: next });
                      }}
                      className="flex-1 px-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs"
                    >
                      <option value="">-- Pilih Kelas Pertandingan --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} (Rp {c.fee.toLocaleString("id-ID")})</option>
                      ))}
                    </select>

                    {batchReg.entries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = batchReg.entries.filter((_, i) => i !== idx);
                          setBatchReg({ ...batchReg, entries: next });
                        }}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBatchRegModal(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg"
                >
                  Submit Registrasi Kontingen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Timbang Badan & Verifikasi Dokumen */}
      {showWeightModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-600" />
                Timbang Badan & Verifikasi Berkas
              </h2>
              <button onClick={() => setShowWeightModal(null)} className="text-zinc-500 hover:text-zinc-800">
                ✕
              </button>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs space-y-1">
              <div><strong>Nama Atlet:</strong> {showWeightModal.member.fullName} (NIA: {showWeightModal.member.nia || "-"})</div>
              <div><strong>Dojo / Kontingen:</strong> {showWeightModal.dojo.name}</div>
              <div><strong>Kelas Pertandingan:</strong> {showWeightModal.category.name}</div>
            </div>

            {/* Inspeksi Berkas Dokumen */}
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 text-xs space-y-2">
              <span className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-blue-600" /> Berkas Dokumen Terlampir (Panitia Admin Only):
              </span>
              <div className="flex items-center gap-2 pt-1">
                {showWeightModal.member.birthCertificateUrl ? (
                  <button
                    type="button"
                    onClick={() => setPreviewDocModal({ title: `Akte Kelahiran - ${showWeightModal.member.fullName}`, url: showWeightModal.member.birthCertificateUrl! })}
                    className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-blue-300 dark:border-blue-700 rounded-lg font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1 shadow-xs hover:bg-blue-50"
                  >
                    <FileText className="w-3.5 h-3.5" /> Lihat Akte Kelahiran 🔍
                  </button>
                ) : (
                  <span className="text-zinc-400 italic">Tanpa Akte</span>
                )}

                {showWeightModal.member.bpjsCardUrl ? (
                  <button
                    type="button"
                    onClick={() => setPreviewDocModal({ title: `Kartu BPJS - ${showWeightModal.member.fullName}`, url: showWeightModal.member.bpjsCardUrl! })}
                    className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 rounded-lg font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1 shadow-xs hover:bg-amber-50"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Lihat Kartu BPJS 🔍
                  </button>
                ) : (
                  <span className="text-zinc-400 italic">Tanpa BPJS</span>
                )}
              </div>
            </div>

            <form onSubmit={handleUpdateWeight} className="space-y-4 text-xs md:text-sm">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Hasil Berat Badan Aktual (kg) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="misal: 54.5"
                  value={actualWeightInput}
                  onChange={(e) => setActualWeightInput(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Status Verifikasi Panitia *
                </label>
                <select
                  value={weightStatusInput}
                  onChange={(e) => setWeightStatusInput(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold"
                >
                  <option value="VERIFIED">✅ TERVERIFIKASI SAH (Lolos Timbang & Berkas Valid)</option>
                  <option value="PAID">💵 LUNAS (Sudah Bayar, Belum Timbang Badan)</option>
                  <option value="REGISTERED">⏳ TERCATAT (Belum Bayar / Verifikasi Pending)</option>
                  <option value="REJECTED">❌ DISKUALIFIKASI / REJECTED (Berat/Berkas Bermasalah)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Metode Pembayaran *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethodInput("TRANSFER")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      paymentMethodInput === "TRANSFER"
                        ? "bg-blue-100 text-blue-900 border-blue-500 dark:bg-blue-950 dark:text-blue-200"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    🏦 Transfer Bank / QRIS
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethodInput("CASH")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      paymentMethodInput === "CASH"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-200"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    💵 Tunai / Cash
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowWeightModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Simpan Verifikasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { showError, showSuccess } from "@/lib/client-toast";
import {
  Trophy,
  Calendar,
  MapPin,
  Search,
  Filter,
  Users,
  Building2,
  BookOpen,
  CheckCircle,
  Clock,
  Swords,
  ChevronRight,
  ShieldAlert,
  LogIn,
  UserPlus,
  AlertCircle,
  X,
  FileText,
  Upload,
  Lock,
  Mail,
  Image as ImageIcon,
  User as UserIcon,
  Eye,
  ExternalLink,
  MessageSquare,
  Edit3,
  Trash2,
  Send,
  QrCode,
  CreditCard,
  Scale,
  Printer,
  Download,
  ChevronLeft,
} from "lucide-react";
import { compressUploadFile } from "@/lib/compress-image";
import { generateTournamentRosterHtml } from "@/lib/tournament-print-html";
import { deriveAgeCategoryLabel } from "@/lib/tournament-category-presets";
import { DEFAULT_ADMIN_WA, getAdminWaPhone } from "@/lib/site";
import { exportTournamentRosterToExcel } from "@/lib/tournament-excel-export";

interface CategoryDetail {
  id: string;
  name: string;
  categoryType: string;
  gender: string;
  minAge?: number | null;
  maxAge?: number | null;
  minBirthDate?: string | null;
  maxBirthDate?: string | null;
  fee: number;
  isFeeVisible?: boolean;
}

interface EventItem {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  eventTime?: string;
  registrationCloseAt?: string | null;
  location?: string;
  rulesContent?: string | null;
  tournamentCategories?: CategoryDetail[];
  _count?: {
    tournamentCategories: number;
    tournamentRegistrations: number;
  };
}

interface RegistrationItem {
  id: string;
  status: string;
  paymentMethod?: string | null;
  proofUrl?: string | null;
  certificateUrl?: string | null;
  createdAt: string;
  actualWeight?: number | null;
  categoryId: string;
  member: {
    id?: string;
    fullName: string;
    nia?: string;
    birthDate?: string | null;
    currentRank?: string;
    photoUrl?: string;
    birthCertificateUrl?: string;
    bpjsCardUrl?: string;
  };
  dojo: { name: string };
  category: {
    id?: string;
    name: string;
    categoryType: string;
    gender: string;
    minAge?: number | null;
    maxAge?: number | null;
    fee: number;
    isFeeVisible?: boolean;
  };
}


export default function PublicPertandinganPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Filters & Modals
  const [search, setSearch] = useState("");
  const [selectedDojoName, setSelectedDojoName] = useState("");
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showFullOverview, setShowFullOverview] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    title: string;
    regId?: string;
    memberId?: string;
    docType?: "birthCertificateUrl" | "bpjsCardUrl" | "photoUrl" | "proofUrl" | "certificateUrl";
  } | null>(null);

  // Pagination & Print modal state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printPaperSize, setPrintPaperSize] = useState<"A4" | "F4">("A4");
  const [printOrientation, setPrintOrientation] = useState<"landscape" | "portrait">("landscape");
  const [printDojoFilter, setPrintDojoFilter] = useState("");

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedDojoName, selectedCategoryName, selectedEventId]);

  // Member suggestions search state
  const [memberSuggestions, setMemberSuggestions] = useState<any[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSuggestDropdown, setShowSuggestDropdown] = useState(false);

  useEffect(() => {
    if (search.trim().length < 2) {
      setMemberSuggestions([]);
      setShowSuggestDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res = await fetch(`/api/public/pertandingan/suggest?q=${encodeURIComponent(search)}&eventId=${selectedEventId}`);
        const data = await res.json();
        setMemberSuggestions(data.suggestions || []);
        setShowSuggestDropdown(true);
      } catch {
        setMemberSuggestions([]);
      } finally {
        setSuggestLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, selectedEventId]);

  // Correction / Deletion WA Modal state
  const [correctionTarget, setCorrectionTarget] = useState<RegistrationItem | null>(null);
  const [correctionType, setCorrectionType] = useState<"KOREKSI" | "HAPUS">("KOREKSI");
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [adminWaState, setAdminWaState] = useState<{ phone: string; waNumber: string }>(DEFAULT_ADMIN_WA);

  useEffect(() => {
    setAdminWaState(getAdminWaPhone());
  }, []);

  // Guest Registration Modal state
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [systemDojos, setSystemDojos] = useState<{ id: string; name: string }[]>([]);
  const [isCustomDojo, setIsCustomDojo] = useState(false);
  const [guestForm, setGuestForm] = useState({
    fullName: "",
    gender: "MALE",
    birthDate: "",
    dojoName: "",
    currentRank: "Putih (Kyu 10)",
    phone: "",
    weight: "",
    categoryId: "",
    agreedTerms: false,
    email: "",
    password: "",
    photoUrl: "",
    birthCertificateUrl: "",
    bpjsCardUrl: "",
  });

  const [uploadingState, setUploadingState] = useState<{ [key: string]: boolean }>({});
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestSuccess, setGuestSuccess] = useState<string | null>(null);

  // Payment Success Receipt Modal state
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    registrationId: string;
    athleteName: string;
    categoryName: string;
    dojoName: string;
    fee: number;
  } | null>(null);

  const dojoOptionsList = useMemo(() => {
    const defaults = [
      "Dojo Airlangga",
      "Dojo Gubeng",
      "Dojo ITS",
      "Dojo Unair",
      "Dojo Smala",
      "Dojo Smada",
      "Dojo Tambaksari",
      "Dojo Rungkut",
      "Dojo Wonokromo",
    ];
    const set = new Set<string>();
    systemDojos.forEach((d) => {
      if (d.name) set.add(d.name.trim());
    });
    defaults.forEach((name) => set.add(name));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [systemDojos]);

  const fetchPublicData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        ...(selectedEventId ? { eventId: selectedEventId } : {}),
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/public/pertandingan?${queryParams}`);
      const data = await res.json();

      if (data.events) {
        setEvents(data.events);
        if (data.activeEventId && !selectedEventId) {
          setSelectedEventId(data.activeEventId);
        }
      }
      if (data.registrations) setRegistrations(data.registrations);
      if (data.summary) setSummary(data.summary);
      if (data.dojos) setSystemDojos(data.dojos);
    } catch (err) {
      console.error("Failed to fetch public tournament data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicData();
  }, [selectedEventId, search]);

  const activeEvent = events.find((e) => e.id === selectedEventId);

  // Filter categories by birth date and gender for Guest Modal
  const availableCategories = (activeEvent?.tournamentCategories || []).filter((cat) => {
    if (guestForm.gender && cat.gender !== "MIXED" && cat.gender !== guestForm.gender) {
      return false;
    }
    if (guestForm.birthDate && (cat.minBirthDate || cat.maxBirthDate)) {
      const bDate = new Date(guestForm.birthDate).getTime();
      if (cat.minBirthDate && bDate < new Date(cat.minBirthDate).getTime()) return false;
      if (cat.maxBirthDate && bDate > new Date(cat.maxBirthDate).getTime()) return false;
    }
    return true;
  });

  const handleFileUpload = async (file: File, folder: string, fieldKey: string) => {
    setGuestError(null);
    setUploadingState((prev) => ({ ...prev, [fieldKey]: true }));
    try {
      const compressedFile = await compressUploadFile(file, 150 * 1024);
      const formData = new FormData();
      formData.append("file", compressedFile);
      formData.append("folder", folder);

      const res = await fetch("/api/public/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengunggah berkas");

      setGuestForm((prev) => ({ ...prev, [fieldKey]: data.url }));
    } catch (err: any) {
      setGuestError(`Gagal upload ${folder}: ${err.message}`);
    } finally {
      setUploadingState((prev) => ({ ...prev, [fieldKey]: false }));
    }
  };

  const handleUpdateCategory = async (regId: string, newCategoryId: string) => {
    try {
      const res = await fetch("/api/public/pertandingan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: regId, categoryId: newCategoryId }),
      });
      if (res.ok) {
        fetchPublicData();
      } else {
        const data = await res.json();
        alert(data.error || "Gagal mengubah kelas pertandingan");
      }
    } catch (err) {
      console.error("Failed to update category", err);
    }
  };

  const handleUpdateWeight = async (regId: string, actualWeight: number | null) => {
    setRegistrations((prev) => prev.map((r) => (r.id === regId ? { ...r, actualWeight } : r)));
    try {
      const res = await fetch("/api/public/pertandingan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: regId, actualWeight }),
      });
      if (res.ok) {
        showSuccess("Berat badan berhasil diperbarui");
        fetchPublicData();
      } else {
        const data = await res.json();
        showError(data.error || "Gagal memperbarui berat badan");
        fetchPublicData();
      }
    } catch (err) {
      console.error("Failed to update weight", err);
      fetchPublicData();
    }
  };

  const handleUpdatePaymentMethod = async (regId: string, paymentMethod: "TRANSFER" | "CASH") => {
    try {
      const res = await fetch("/api/public/pertandingan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: regId, paymentMethod }),
      });
      if (res.ok) {
        fetchPublicData();
      }
    } catch (err) {
      console.error("Failed to update payment method", err);
    }
  };

  const handleRowDocUpload = async (
    regId: string,
    memberId: string | undefined,
    file: File,
    docType: "birthCertificateUrl" | "bpjsCardUrl" | "photoUrl" | "proofUrl" | "certificateUrl"
  ) => {
    try {
      const compressed = await compressUploadFile(file, 150 * 1024);
      const formData = new FormData();
      formData.append("file", compressed);
      formData.append(
        "folder",
        docType === "proofUrl"
          ? "bukti-tf"
          : docType === "certificateUrl"
          ? "piagam-pertandingan"
          : "dokumen-pertandingan"
      );

      const resUpload = await fetch("/api/public/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await resUpload.json();
      if (!resUpload.ok) throw new Error(uploadData.error || "Gagal mengunggah berkas");

      const fileUrl = uploadData.url;

      if (docType === "proofUrl") {
        await fetch("/api/public/pertandingan", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: regId, proofUrl: fileUrl, paymentMethod: "TRANSFER" }),
        });
      } else {
        await fetch("/api/public/pertandingan", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: regId, [docType]: fileUrl }),
        });
      }

      showSuccess("Berkas berhasil diunggah");
      fetchPublicData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuestError(null);
    setGuestSuccess(null);

    if (!selectedEventId) {
      setGuestError("Pilih event kejuaraan terlebih dahulu.");
      return;
    }
    if (!guestForm.fullName || !guestForm.birthDate || !guestForm.categoryId) {
      setGuestError("Mohon lengkapi Nama Lengkap, Tanggal Lahir, dan Pilih Kategori Pertandingan.");
      return;
    }
    if (guestForm.email && !guestForm.password) {
      setGuestError("Jika mengisi Email, Password akun wajib diisi (minimal 6 karakter).");
      return;
    }
    if (!guestForm.agreedTerms) {
      setGuestError("Anda harus menyetujui Ketentuan & Peraturan Pertandingan.");
      return;
    }

    setGuestSubmitting(true);
    try {
      const res = await fetch("/api/public/pertandingan/guest-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          ...guestForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal melakukan pendaftaran.");
      }

      const matchedCategory = (activeEvent?.tournamentCategories || []).find((c) => c.id === guestForm.categoryId);
      const feeAmount = matchedCategory?.fee || 150000;
      const regId = data.registration?.id || `REG-${Date.now().toString().slice(-6).toUpperCase()}`;

      setPaymentSuccessData({
        registrationId: regId,
        athleteName: guestForm.fullName,
        categoryName: matchedCategory?.name || "Kelas Pertandingan Karate",
        dojoName: guestForm.dojoName || "Dojo Mandiri / Tamu",
        fee: feeAmount,
      });

      setGuestForm({
        fullName: "",
        gender: "MALE",
        birthDate: "",
        dojoName: "",
        currentRank: "Putih (Kyu 10)",
        phone: "",
        weight: "",
        categoryId: "",
        agreedTerms: false,
        email: "",
        password: "",
        photoUrl: "",
        birthCertificateUrl: "",
        bpjsCardUrl: "",
      });

      // Refresh daftar peserta publik
      fetchPublicData();
      setShowGuestModal(false);
      setGuestSuccess(null);
    } catch (err: any) {
      setGuestError(err.message);
    } finally {
      setGuestSubmitting(false);
    }
  };

  // WhatsApp Correction / Deletion Dispatcher to Admin WA
  const handleSendWaCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionTarget) return;

    const adminPhone = adminWaState.waNumber;
    const typeLabel = correctionType === "HAPUS" ? "PEMBATALAN / HAPUS PENDAFTARAN" : "KOREKSI DATA PENDAFTARAN";

    const textMessage =
      `*PERMOHONAN ${typeLabel} KEJUARAAN*\n` +
      `-------------------------------------------\n` +
      `🏆 *Event:* ${activeEvent?.title || "Kejuaraan Karate INKAI Surabaya"}\n` +
      `👤 *Nama Atlet:* ${correctionTarget.member.fullName}\n` +
      `🆔 *NIA / ID:* ${correctionTarget.member.nia || "Peserta Tamu"}\n` +
      `🏛️ *Dojo / Kontingen:* ${correctionTarget.dojo.name}\n` +
      `🥋 *Sabuk:* ${correctionTarget.member.currentRank || "Putih"}\n` +
      `🏅 *Kategori Kelas:* ${correctionTarget.category.name}\n` +
      `📌 *Status Saat Ini:* ${correctionTarget.status}\n\n` +
      `📝 *Jenis Pengajuan:* ${typeLabel}\n` +
      `💬 *Catatan / Rincian Perubahan:* ${correctionNotes.trim() || "Mohon diproses."}\n` +
      `-------------------------------------------\n` +
      `_Mohon bantuannya Panitia INKAI Surabaya (${adminWaState.phone}) untuk memproses pengajuan ini. Terima kasih._`;

    const targetUrl = `https://api.whatsapp.com/send?phone=${adminPhone}&text=${encodeURIComponent(textMessage)}`;
    window.open(targetUrl, "_blank");

    setCorrectionTarget(null);
    setCorrectionNotes("");
  };

  // Unique dojos & categories for filtering
  const uniqueDojos = useMemo(
    () => Array.from(new Set(registrations.map((r) => r.dojo.name))).sort(),
    [registrations]
  );
  const uniqueCategories = useMemo(
    () => Array.from(new Set(registrations.map((r) => r.category.name))).sort(),
    [registrations]
  );

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      if (selectedDojoName && r.dojo.name !== selectedDojoName) return false;
      if (selectedCategoryName && r.category.name !== selectedCategoryName) return false;
      return true;
    });
  }, [registrations, selectedDojoName, selectedCategoryName]);

  const totalPages = Math.ceil(filteredRegistrations.length / pageSize) || 1;

  const paginatedRegistrations = useMemo(() => {
    if (pageSize >= 999999) return filteredRegistrations;
    const start = (currentPage - 1) * pageSize;
    return filteredRegistrations.slice(start, start + pageSize);
  }, [filteredRegistrations, currentPage, pageSize]);

  const handleExportExcel = () => {
    if (filteredRegistrations.length === 0) {
      showError("Tidak ada data pendaftaran untuk diekspor");
      return;
    }
    const eventName = activeEvent?.title || "Kejuaraan Karate INKAI Surabaya";
    exportTournamentRosterToExcel(eventName, filteredRegistrations);
    showSuccess("Berhasil mengekspor daftar peserta dengan format Excel rapi (.xls)");
  };

  const handlePrintPdf = () => {
    const listToPrint = printDojoFilter
      ? filteredRegistrations.filter((r) => r.dojo.name === printDojoFilter)
      : filteredRegistrations;

    if (listToPrint.length === 0) {
      showError("Tidak ada data peserta untuk dicetak");
      return;
    }

    const printData = listToPrint.map((r) => ({
      id: r.id,
      member: {
        fullName: r.member.fullName,
        nia: r.member.nia,
        currentRank: r.member.currentRank,
        photoUrl: r.member.photoUrl,
      },
      dojo: { name: r.dojo.name },
      category: {
        name: r.category.name,
        categoryType: r.category.categoryType || "KATA",
        gender: r.category.gender || "MIXED",
        fee: r.category.fee || 0,
      },
      status: r.status,
      notes: r.paymentMethod,
      actualWeight: r.actualWeight,
    }));

    const eventTitle = activeEvent?.title || "Kejuaraan Karate INKAI Surabaya";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const htmlContent = generateTournamentRosterHtml(
      eventTitle,
      printData,
      printPaperSize,
      printOrientation,
      origin
    );

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      showError("Gagal membuka jendela cetak. Izinkan pop-up browser Anda.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Hero Header Banner */}
      <div className="bg-gradient-to-r from-red-950 via-red-900 to-red-950 text-white border-b border-red-900/50">
        <div className="max-w-7xl mx-auto px-4 py-10 md:py-14 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-xs font-semibold uppercase tracking-wider">
            <Trophy className="w-3.5 h-3.5" /> Portal Resmi INKAI Surabaya
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Portal Informasi Pertandingan Karate
          </h1>
          <p className="max-w-2xl text-sm md:text-base text-red-200">
            Informasi Kejuaraan Resmi, Jadwal Match Kata & Kumite, Proposal Ketentuan Pertandingan, dan  Atlet Terdaftar Cabang Surabaya.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/login"
              className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm rounded-xl transition shadow-lg flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Daftar Atlet Mandiri / Kontingen
            </Link>

            <button
              onClick={() => {
                setGuestError(null);
                setGuestSuccess(null);
                setShowGuestModal(true);
              }}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-lg flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Daftar Peserta Tamu / Eksternal
            </button>

            {activeEvent?.rulesContent && (
              <button
                onClick={() => setShowRulesModal(true)}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl backdrop-blur transition border border-white/20 flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4 text-yellow-300" />
                Baca Ketentuan Pertandingan
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Selector Event Kejuaraan */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Trophy className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Pilih Event:</span>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full md:w-80 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold"
            >
              {events.length === 0 && <option value="">Belum ada event kejuaraan</option>}
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>

          {activeEvent && (
            <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${
                  !activeEvent.registrationCloseAt ||
                  new Date().getTime() <= new Date(activeEvent.registrationCloseAt).getTime()
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    !activeEvent.registrationCloseAt ||
                    new Date().getTime() <= new Date(activeEvent.registrationCloseAt).getTime()
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-red-500"
                  }`}
                />
                {!activeEvent.registrationCloseAt ||
                new Date().getTime() <= new Date(activeEvent.registrationCloseAt).getTime()
                  ? "Pendaftaran Terbuka"
                  : "Pendaftaran Ditutup"}
              </span>

              <span className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <Calendar className="w-4 h-4 text-red-500" />
                {new Date(activeEvent.startDate).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              </span>
              <span className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <Clock className="w-4 h-4 text-amber-500" />
                {activeEvent.eventTime || "08.00 – 12.00 WIB"}
              </span>
              <span className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <MapPin className="w-4 h-4 text-emerald-500" />
                {activeEvent.location || "Gedung Olahraga Kodam V/Brawijaya Jl. Kesatriyan No.38 A, Gn. Sari, Kec. Dukuhpakis, Surabaya"}
              </span>
            </div>
          )}
        </div>

        {/* Card Sekilas Keterangan & Ketentuan Pertandingan */}
        {activeEvent && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-red-200 dark:border-red-900/40 shadow-sm overflow-hidden transition">
            <div className="bg-gradient-to-r from-red-900 via-red-800 to-red-950 p-4 md:p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 text-yellow-300 rounded-xl border border-yellow-500/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base md:text-lg flex items-center gap-2">
                    📌 Sekilas Keterangan & Ketentuan Pertandingan
                  </h2>
                  <p className="text-xs text-red-200">
                    Informasi jadwal, tempat pelaksanaan, proposal ketentuan, dan syarat pendaftaran event.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowFullOverview(!showFullOverview)}
                className="self-start md:self-auto px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold border border-white/20 transition flex items-center gap-1.5"
              >
                {showFullOverview ? "Sembunyikan Sekilas Details" : "Tampilkan Sekilas Details"}
              </button>
            </div>

            {showFullOverview && (
              <div className="p-4 md:p-6 space-y-6">
                {/* Grid Info Pelaksanaan */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-red-50/50 dark:bg-red-950/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30 flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-zinc-500 font-medium">Hari & Tanggal</div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-white">
                        {new Date(activeEvent.startDate).toLocaleDateString("id-ID", {
                          weekday: "long",
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-zinc-500 font-medium">Waktu / Pukul</div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-white">
                        {activeEvent.eventTime || "08.00 – 12.00 WIB"}
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-zinc-500 font-medium">Tempat Pelaksanaan</div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-white">
                        {activeEvent.location || "Gedung Olahraga Kodam V/Brawijaya Jl. Kesatriyan No.38 A, Gn. Sari, Kec. Dukuhpakis, Surabaya"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deskripsi & Ketentuan Editor */}
                {activeEvent.description && (
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Keterangan Singkat</div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{activeEvent.description}</p>
                  </div>
                )}

                {/* Content Ketentuan Pertandingan */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                    <h3 className="font-bold text-sm md:text-base flex items-center gap-2 text-zinc-900 dark:text-white">
                      <BookOpen className="w-4 h-4 text-red-600 dark:text-red-400" />
                      Ketentuan & Syarat Pertandingan
                    </h3>
                    <button
                      onClick={() => setShowRulesModal(true)}
                      className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                    >
                      Buka Modal Ketentuan Lengkap <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {activeEvent.rulesContent ? (
                    <div
                      className="prose dark:prose-invert max-w-none text-sm bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 max-h-60 overflow-y-auto leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: activeEvent.rulesContent }}
                    />
                  ) : (
                    <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs md:text-sm text-zinc-700 dark:text-zinc-300 space-y-2">
                      <p className="font-semibold text-red-600 dark:text-red-400">Ringkasan Ketentuan Resmi:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Peserta adalah Karateka anggota resmi INKAI Cabang Surabaya & Dojo Terdaftar.</li>
                        <li>Wajib menyertakan fotokopi / berkas Akte Kelahiran & Kartu BPJS Kesehatan / Surat Sehat.</li>
                        <li>Menggunakan Karate-Gi standar INKAI dan perlengkapan sabuk / protector sesuai ketentuan jenis kelas (Kata / Kumite).</li>
                        <li>Penimbangan badan atlet dilakukan sebelum jalannya pertandingan sesuai kelas berat yang didaftarkan.</li>
                      </ul>
                    </div>
                  )}
                </div>


              </div>
            )}
          </div>
        )}

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-red-100 dark:bg-red-950/50 rounded-xl text-red-600 dark:text-red-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-white">{summary.totalRegistrations || 0}</div>
              <div className="text-xs text-zinc-500">Total Pendaftaran Atlet</div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-950/50 rounded-xl text-yellow-600 dark:text-yellow-400">
              <Swords className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-white">{summary.uniqueAthletes || 0}</div>
              <div className="text-xs text-zinc-500">Total Atlet Berpartisipasi</div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-white">{summary.uniqueDojos || 0}</div>
              <div className="text-xs text-zinc-500">Kontingen / Dojo</div>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Cari nama atlet, NIA, keanggotaan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => {
                  if (memberSuggestions.length > 0) setShowSuggestDropdown(true);
                }}
                className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-red-500"
              />

              {/* Suggestions Dropdown */}
              {showSuggestDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto">
                  <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    <span>💡 Keanggotaan INKAI (DB)</span>
                    <button
                      onClick={() => setShowSuggestDropdown(false)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {suggestLoading && (
                    <div className="p-3 text-center text-xs text-zinc-500">Mencari keanggotaan INKAI...</div>
                  )}

                  {!suggestLoading && memberSuggestions.length === 0 && (
                    <div className="p-3 text-center text-xs text-zinc-500">Tidak ada anggota yang cocok dengan kata kunci.</div>
                  )}

                  {!suggestLoading &&
                    memberSuggestions.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800/60 last:border-b-0 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                            {m.fullName}
                            {m.nia && <span className="text-[10px] text-zinc-400 font-mono">({m.nia})</span>}
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            {m.dojoName} · <span className="text-red-600 dark:text-red-400">{m.currentRank}</span>
                          </div>
                        </div>

                        {m.isRegistered ? (
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-md font-semibold text-[10px]">
                            ✅ Terdaftar
                          </span>
                        ) : (
                          <button
                            onClick={async () => {
                              if (!selectedEventId) {
                                alert("Pilih event kejuaraan terlebih dahulu.");
                                return;
                              }
                              const firstCat = activeEvent?.tournamentCategories?.[0];
                              if (!firstCat) {
                                alert("Belum ada kategori kelas pertandingan pada event ini.");
                                return;
                              }
                              try {
                                const res = await fetch("/api/public/pertandingan/guest-register", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    eventId: selectedEventId,
                                    memberId: m.id,
                                    categoryId: firstCat.id,
                                    agreedTerms: true,
                                  }),
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  setShowSuggestDropdown(false);
                                  await fetchPublicData();
                                } else {
                                  alert(data.error || "Gagal melakukan pendaftaran.");
                                }
                              } catch (err) {
                                console.error(err);
                                alert("Terjadi kesalahan saat pendaftaran.");
                              }
                            }}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[11px] transition shadow-sm shrink-0 flex items-center gap-1"
                          >
                            🏆 Daftarkan
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Filter Dojo */}
            <select
              value={selectedDojoName}
              onChange={(e) => setSelectedDojoName(e.target.value)}
              className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm"
            >
              <option value="">Semua Kontingen / Dojo</option>
              {uniqueDojos.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Filter Category */}
            <select
              value={selectedCategoryName}
              onChange={(e) => setSelectedCategoryName(e.target.value)}
              className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm"
            >
              <option value="">Semua Kategori Kelas</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Tombol Cetak PDF & Ekspor Excel */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition shadow flex items-center gap-1.5 whitespace-nowrap"
                title="Cetak PDF Daftar Peserta A4/F4 dengan Logo INKAI"
              >
                <Printer className="w-4 h-4" />
                Cetak PDF
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow flex items-center gap-1.5 whitespace-nowrap"
                title="Ekspor Data Peserta Terfilter ke Excel / CSV"
              >
                <Download className="w-4 h-4" />
                Ekspor Excel
              </button>
            </div>
          </div>

          <div className="text-xs text-zinc-500 font-medium">
            Menampilkan <strong>{filteredRegistrations.length}</strong> pendaftaran peserta
          </div>
        </div>

        {/* Guest Registration Banner when search has no results */}
        {search && filteredRegistrations.length === 0 && !loading && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                  Nama &quot;{search}&quot; tidak ditemukan dalam  pendaftar?
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Anda bisa mendaftarkan diri atau atlet sebagai **Peserta Tamu / Eksternal** secara langsung.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setGuestForm((prev) => ({ ...prev, fullName: search }));
                setGuestError(null);
                setGuestSuccess(null);
                setShowGuestModal(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow flex items-center gap-2 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              Daftar Tamu Sekarang
            </button>
          </div>
        )}

        {/* Tabel Daftar Peserta Atlet */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="py-3.5 px-3">No</th>
                  <th className="py-3.5 px-3 text-center">Foto Profil</th>
                  <th className="py-3.5 px-4">Nama Atlet</th>
                  <th className="py-3.5 px-4">Dojo / Kontingen</th>
                  <th className="py-3.5 px-4">Sabuk</th>
                  <th className="py-3.5 px-3 text-center min-w-[150px]">Kategori Usia</th>
                  <th className="py-3.5 px-4 min-w-[200px]">Kelas Pertandingan</th>
                  <th className="py-3.5 px-3 text-center min-w-[110px]">BB (Berat Badan)</th>
                  <th className="py-3.5 px-3 text-center min-w-[200px]">Berkas Dokumen</th>
                  <th className="py-3.5 px-4 text-center min-w-[220px]">Status Pendaftaran</th>
                  <th className="py-3.5 px-3 text-center">Aksi / Koreksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-zinc-500">
                      Memuat daftar pendaftar kejuaraan...
                    </td>
                  </tr>
                ) : filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-zinc-500 space-y-3">
                      <div>Belum ada pendaftaran atlet pada kriteria ini.</div>
                      <button
                        onClick={() => {
                          setGuestError(null);
                          setGuestSuccess(null);
                          setShowGuestModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow"
                      >
                        <UserPlus className="w-4 h-4" />
                        Daftar Peserta Tamu / Eksternal
                      </button>
                    </td>
                  </tr>
                ) : (
                  paginatedRegistrations.map((reg, idx) => {
                    const itemIndex = (currentPage - 1) * pageSize + idx + 1;
                    const ageGroupLabel = deriveAgeCategoryLabel(
                      reg.category?.name,
                      reg.category?.minAge,
                      reg.category?.maxAge,
                      reg.member?.birthDate
                    );
                    return (
                      <tr key={reg.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition">
                        <td className="py-3.5 px-3 font-mono text-xs text-zinc-400">{itemIndex}</td>
                      <td className="py-3.5 px-3 text-center">
                        {reg.member.photoUrl ? (
                          <button
                            onClick={() => setPreviewDoc({ url: reg.member.photoUrl!, title: `Foto Profil: ${reg.member.fullName}` })}
                            className="inline-block relative group"
                          >
                            <img
                              src={reg.member.photoUrl}
                              alt={reg.member.fullName}
                              className="w-10 h-10 rounded-full object-cover border-2 border-red-500/50 group-hover:scale-105 transition shadow-sm"
                            />
                          </button>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto border border-zinc-300 dark:border-zinc-700">
                            <UserIcon className="w-5 h-5" />
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-white">
                        {reg.member.fullName}
                        {reg.member.nia && (
                          <div className="text-xs font-normal text-zinc-500">NIA: {reg.member.nia}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-zinc-800 dark:text-zinc-200">
                        {reg.dojo.name}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {reg.member.currentRank || "Putih"}
                      </td>

                      {/* Kolom Kategori Usia */}
                      <td className="py-3.5 px-3 text-center min-w-[150px]">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 whitespace-nowrap shadow-xs">
                          {ageGroupLabel}
                        </span>
                      </td>

                      {/* Kelas Pertandingan (Inline Dropdown Select) */}
                      <td className="py-3.5 px-4 min-w-[200px]">

                        <select
                          value={reg.categoryId || reg.category?.id}
                          onChange={(e) => handleUpdateCategory(reg.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-red-50/70 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs font-bold text-red-700 dark:text-red-300 focus:ring-2 focus:ring-red-500 cursor-pointer shadow-xs truncate"
                        >
                          {(activeEvent?.tournamentCategories || []).map((c) => (
                            <option key={c.id} value={c.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-normal">
                              {c.name} {c.isFeeVisible !== false ? `(Rp ${c.fee.toLocaleString("id-ID")})` : ""}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Kolom BB (Berat Badan) di sebelah kanan Kelas Pertandingan */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-2 py-1">
                          <Scale className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          <input
                            key={`${reg.id}-${reg.actualWeight ?? "empty"}`}
                            type="number"
                            step="0.1"
                            placeholder="kg"
                            defaultValue={reg.actualWeight !== null && reg.actualWeight !== undefined ? reg.actualWeight : ""}
                            onBlur={(e) => {
                              const val = e.target.value ? parseFloat(e.target.value) : null;
                              if (val !== reg.actualWeight) {
                                handleUpdateWeight(reg.id, val);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = (e.target as HTMLInputElement).value ? parseFloat((e.target as HTMLInputElement).value) : null;
                                if (val !== reg.actualWeight) {
                                  handleUpdateWeight(reg.id, val);
                                }
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-16 px-1.5 py-0.5 bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 rounded text-xs font-bold text-amber-900 dark:text-amber-200 text-center focus:ring-2 focus:ring-amber-500 focus:outline-none"
                          />
                          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">kg</span>
                        </div>
                      </td>

                      {/* Berkas Dokumen Status & Upload (Auto Compress 150KB) */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Foto */}
                          {reg.member.photoUrl ? (
                            <button
                              onClick={() =>
                                setPreviewDoc({
                                  url: reg.member.photoUrl!,
                                  title: `Foto Profil: ${reg.member.fullName}`,
                                  regId: reg.id,
                                  memberId: reg.member.id,
                                  docType: "photoUrl",
                                })
                              }
                              className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded text-[11px] font-bold hover:underline flex items-center gap-1"
                              title="Lihat Foto Profil"
                            >
                              <ImageIcon className="w-3 h-3" /> Foto
                            </button>
                          ) : (
                            <label className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 rounded text-[11px] cursor-pointer flex items-center gap-1 font-medium">
                              <Upload className="w-3 h-3 text-zinc-400" /> Foto
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleRowDocUpload(reg.id, reg.member.id, f, "photoUrl");
                                }}
                              />
                            </label>
                          )}

                          {/* Akte Kelahiran */}
                          {reg.member.birthCertificateUrl ? (
                            <button
                              onClick={() =>
                                setPreviewDoc({
                                  url: reg.member.birthCertificateUrl!,
                                  title: `Akte Kelahiran: ${reg.member.fullName}`,
                                  regId: reg.id,
                                  memberId: reg.member.id,
                                  docType: "birthCertificateUrl",
                                })
                              }
                              className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 rounded text-[11px] font-bold hover:underline flex items-center gap-1"
                              title="Lihat Akte Kelahiran"
                            >
                              <FileText className="w-3 h-3" /> Akte ✓
                            </button>
                          ) : (
                            <label className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 rounded text-[11px] cursor-pointer flex items-center gap-1 font-medium border border-zinc-200 dark:border-zinc-700">
                              <Upload className="w-3 h-3 text-blue-500" /> + Akte (150KB)
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleRowDocUpload(reg.id, reg.member.id, f, "birthCertificateUrl");
                                }}
                              />
                            </label>
                          )}

                          {/* BPJS */}
                          {reg.member.bpjsCardUrl ? (
                            <button
                              onClick={() =>
                                setPreviewDoc({
                                  url: reg.member.bpjsCardUrl!,
                                  title: `Kartu BPJS: ${reg.member.fullName}`,
                                  regId: reg.id,
                                  memberId: reg.member.id,
                                  docType: "bpjsCardUrl",
                                })
                              }
                              className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded text-[11px] font-bold hover:underline flex items-center gap-1"
                              title="Lihat BPJS"
                            >
                              <ShieldAlert className="w-3 h-3" /> BPJS ✓
                            </button>
                          ) : (
                            <label className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 rounded text-[11px] cursor-pointer flex items-center gap-1 font-medium border border-zinc-200 dark:border-zinc-700">
                              <Upload className="w-3 h-3 text-amber-500" /> + BPJS (150KB)
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleRowDocUpload(reg.id, reg.member.id, f, "bpjsCardUrl");
                                }}
                              />
                            </label>
                          )}

                          {/* Piagam Kejuaraan */}
                          {reg.certificateUrl ? (
                            <button
                              onClick={() =>
                                setPreviewDoc({
                                  url: reg.certificateUrl!,
                                  title: `Piagam Kejuaraan: ${reg.member.fullName}`,
                                  regId: reg.id,
                                  memberId: reg.member.id,
                                  docType: "certificateUrl",
                                })
                              }
                              className="px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 rounded text-[11px] font-bold hover:underline flex items-center gap-1"
                              title="Lihat Piagam Kejuaraan"
                            >
                              <Trophy className="w-3 h-3 text-purple-600 dark:text-purple-400" /> Piagam ✓
                            </button>
                          ) : (
                            <label className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 rounded text-[11px] cursor-pointer flex items-center gap-1 font-medium border border-zinc-200 dark:border-zinc-700">
                              <Upload className="w-3 h-3 text-purple-500" /> + Piagam (150KB)
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleRowDocUpload(reg.id, reg.member.id, f, "certificateUrl");
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </td>

                      {/* Status Pendaftaran & Pilihan TF / Tunai + Upload Bukti TF & Lihat */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            reg.status === "VERIFIED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" :
                            reg.status === "PAID" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" :
                            "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                          }`}>
                            {reg.status === "VERIFIED" ? "TERVERIFIKASI SAH" : reg.status === "PAID" ? "LUNAS" : "TERCATAT"}
                          </span>

                          {/* Toggle TF vs Tunai */}
                          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <button
                              onClick={() => handleUpdatePaymentMethod(reg.id, "TRANSFER")}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${
                                (reg.paymentMethod || "TRANSFER") === "TRANSFER"
                                  ? "bg-blue-600 text-white shadow-xs"
                                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                              }`}
                            >
                              🏦 TF
                            </button>
                            <button
                              onClick={() => handleUpdatePaymentMethod(reg.id, "CASH")}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${
                                reg.paymentMethod === "CASH"
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                              }`}
                            >
                              💵 Tunai
                            </button>
                          </div>

                          {/* Bukti TF Upload & View (Kompres 150KB) */}
                          {(reg.paymentMethod || "TRANSFER") === "TRANSFER" && (
                            <div className="flex items-center gap-1 pt-0.5">
                              {reg.proofUrl ? (
                                <button
                                  onClick={() =>
                                    setPreviewDoc({
                                      url: reg.proofUrl!,
                                      title: `Bukti Transfer (TF): ${reg.member.fullName}`,
                                      regId: reg.id,
                                      memberId: reg.member.id,
                                      docType: "proofUrl",
                                    })
                                  }
                                  className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded text-[11px] font-bold hover:underline flex items-center gap-1"
                                  title="Lihat Bukti Transfer"
                                >
                                  <Eye className="w-3 h-3 text-emerald-600" /> Lihat Bukti TF
                                </button>
                              ) : (
                                <label className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded text-[11px] font-bold hover:bg-blue-100 cursor-pointer flex items-center gap-1">
                                  <Upload className="w-3 h-3 text-blue-600" /> Upload Bukti TF (150KB)
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleRowDocUpload(reg.id, reg.member.id, f, "proofUrl");
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Kolom Aksi / Permohonan Koreksi / Hapus via WA (085731241840) */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => {
                            setCorrectionTarget(reg);
                            setCorrectionType("KOREKSI");
                            setCorrectionNotes("");
                          }}
                          className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition shadow-xs"
                          title="Permohonan Koreksi / Pembatalan ke WA 085731241840"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          Koreksi / WA
                        </button>
                      </td>
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="bg-zinc-50/80 dark:bg-zinc-800/60 border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="flex flex-wrap items-center gap-2">
              <span>Tampilkan:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-semibold"
              >
                <option value={10}>10 per halaman</option>
                <option value={25}>25 per halaman</option>
                <option value={50}>50 per halaman</option>
                <option value={100}>100 per halaman</option>
                <option value={999999}>Semua ({filteredRegistrations.length})</option>
              </select>
              <span className="text-zinc-500">
                (Menampilkan {filteredRegistrations.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredRegistrations.length)} dari <strong>{filteredRegistrations.length}</strong> peserta)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center gap-1 font-semibold"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
              </button>
              <span className="px-2 font-semibold text-zinc-900 dark:text-white">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center gap-1 font-semibold"
              >
                Selanjutnya <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-1">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span>Dokumen Akte Kelahiran & BPJS dilindungi (UU PDP) dan hanya dapat diverifikasi oleh Panitia Kejuaraan.</span>
            </span>
          </div>
        </div>
      </div>

      {/* Modal Permohonan Koreksi / Hapus ke WA Admin */}
      {correctionTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                Permohonan Koreksi / Pembatalan (WA Admin)
              </h3>
              <button onClick={() => setCorrectionTarget(null)} className="text-zinc-500 hover:text-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs space-y-1">
              <div><strong>Nama Atlet:</strong> {correctionTarget.member.fullName}</div>
              <div><strong>Dojo / Kontingen:</strong> {correctionTarget.dojo.name}</div>
              <div><strong>Kategori:</strong> {correctionTarget.category.name}</div>
              <div><strong>Tujuan WA Admin:</strong> <span className="font-mono text-emerald-600 font-bold">{adminWaState.phone}</span></div>
            </div>

            <form onSubmit={handleSendWaCorrection} className="space-y-4 text-xs md:text-sm">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Pilih Jenis Pengajuan *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrectionType("KOREKSI")}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                      correctionType === "KOREKSI"
                        ? "bg-amber-100 text-amber-900 border-amber-500 dark:bg-amber-950 dark:text-amber-200"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    <Edit3 className="w-4 h-4" /> Koreksi Data Atlet
                  </button>

                  <button
                    type="button"
                    onClick={() => setCorrectionType("HAPUS")}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                      correctionType === "HAPUS"
                        ? "bg-red-100 text-red-900 border-red-500 dark:bg-red-950 dark:text-red-200"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    <Trash2 className="w-4 h-4" /> Pembatalan / Hapus
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Catatan / Rincian Koreksi *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder={
                    correctionType === "HAPUS"
                      ? "Jelaskan alasan pembatalan pendaftaran..."
                      : "Jelaskan bagian data yang ingin dikoreksi (misal: Koreksi Sabuk, Tgl Lahir, Nama)..."
                  }
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCorrectionTarget(null)}
                  className="px-4 py-2 text-xs font-semibold bg-zinc-100 text-zinc-700 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" /> Kirim ke WA Admin ({adminWaState.phone})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Modal Pendaftaran Peserta Tamu / Eksternal */}
      {showGuestModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                Pendaftaran Peserta Tamu / Eksternal
              </h3>
              <button
                onClick={() => setShowGuestModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {guestError && (
              <div className="p-3 bg-red-100 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {guestError}
              </div>
            )}

            {guestSuccess && (
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                {guestSuccess}
              </div>
            )}

            <form onSubmit={handleGuestSubmit} className="space-y-4 text-xs md:text-sm">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <div className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Event Kejuaraan: <span className="text-red-600 font-bold">{activeEvent?.title || "Kejuaraan Karate"}</span>
                </div>
              </div>

              {/* Data Utama Atlet */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Nama Lengkap */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Nama Lengkap Atlet *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ahmad Rizky"
                    value={guestForm.fullName}
                    onChange={(e) => setGuestForm({ ...guestForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm"
                  />
                </div>

                {/* Jenis Kelamin */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Jenis Kelamin *
                  </label>
                  <select
                    value={guestForm.gender}
                    onChange={(e) => setGuestForm({ ...guestForm, gender: e.target.value, categoryId: "" })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm"
                  >
                    <option value="MALE">Laki-laki</option>
                    <option value="FEMALE">Perempuan</option>
                  </select>
                </div>

                {/* Tanggal Lahir (Format Indonesia DD/MM/YYYY) */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Tanggal Lahir Atlet * (Format Indonesia DD/MM/YYYY)
                  </label>
                  <input
                    type="date"
                    required
                    value={guestForm.birthDate}
                    onChange={(e) => setGuestForm({ ...guestForm, birthDate: e.target.value, categoryId: "" })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm"
                  />
                  {guestForm.birthDate && (
                    <div className="text-[11px] text-zinc-500 mt-1 font-mono">
                      Format Indonesia: {new Date(guestForm.birthDate).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })} ({new Date(guestForm.birthDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })})
                    </div>
                  )}
                </div>

                {/* Sabuk / Rank */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Tingkat Sabuk / Kyu
                  </label>
                  <select
                    value={guestForm.currentRank}
                    onChange={(e) => setGuestForm({ ...guestForm, currentRank: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm"
                  >
                    <option value="Putih (Kyu 10)">Putih (Kyu 10)</option>
                    <option value="Kuning (Kyu 9-8)">Kuning (Kyu 9-8)</option>
                    <option value="Hijau (Kyu 7-6)">Hijau (Kyu 7-6)</option>
                    <option value="Biru (Kyu 5-4)">Biru (Kyu 5-4)</option>
                    <option value="Cokelat (Kyu 3-1)">Cokelat (Kyu 3-1)</option>
                    <option value="Hitam (DAN 1+)">Hitam (DAN 1+)</option>
                  </select>
                </div>

                {/* Dojo Asal Dropdown / Custom Input */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Dojo / Kontingen Asal *
                  </label>
                  <select
                    value={
                      isCustomDojo
                        ? "CUSTOM"
                        : dojoOptionsList.includes(guestForm.dojoName)
                        ? guestForm.dojoName
                        : guestForm.dojoName
                        ? "CUSTOM"
                        : ""
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "CUSTOM") {
                        setIsCustomDojo(true);
                        setGuestForm({ ...guestForm, dojoName: "" });
                      } else {
                        setIsCustomDojo(false);
                        setGuestForm({ ...guestForm, dojoName: val });
                      }
                    }}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm"
                  >
                    <option value="">-- Pilih Ranting / Dojo Kontingen --</option>
                    {dojoOptionsList.map((dojoName: string) => (
                      <option key={dojoName} value={dojoName}>
                        🏛️ {dojoName}
                      </option>
                    ))}
                    <option value="CUSTOM">➕ Lainnya / Kontingen Luar (Ketik Manual)</option>
                  </select>

                  {(isCustomDojo ||
                    (!dojoOptionsList.includes(guestForm.dojoName) && guestForm.dojoName !== "")) && (
                    <input
                      type="text"
                      required
                      placeholder="Tuliskan nama Dojo / Kontingen luar..."
                      value={guestForm.dojoName}
                      onChange={(e) => setGuestForm({ ...guestForm, dojoName: e.target.value })}
                      className="w-full mt-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm animate-fadeIn"
                    />
                  )}
                </div>

                {/* No. WhatsApp / HP */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    No. WhatsApp Kontak
                  </label>
                  <input
                    type="tel"
                    placeholder="081234567890"
                    value={guestForm.phone}
                    onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Akun Login (Email & Password) */}
              <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900 space-y-3">
                <div className="flex items-center gap-2 font-bold text-xs text-blue-900 dark:text-blue-300">
                  <Mail className="w-4 h-4 text-blue-600" />
                  Buat Akun Login Dashboard (Opsional)
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  Isi email & password jika ingin membuat akun login agar dapat memantau status pendaftaran di Dashboard Anggota.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Email Akun
                    </label>
                    <input
                      type="email"
                      placeholder="nama@email.com"
                      value={guestForm.email}
                      onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Password Akun (Min. 6 Karakter)
                    </label>
                    <input
                      type="password"
                      placeholder="******"
                      value={guestForm.password}
                      onChange={(e) => setGuestForm({ ...guestForm, password: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Upload Berkas Dokumen (Foto, Akte, BPJS) */}
              <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900 space-y-3">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-900 dark:text-amber-300">
                  <Upload className="w-4 h-4 text-amber-600" />
                  Unggah Berkas Persyaratan Atlet (Foto Profil, Akte, BPJS)
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Foto Profil */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Foto Profil Atlet
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "photo", "photoUrl");
                      }}
                      className="w-full text-xs text-zinc-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 dark:file:bg-emerald-950 dark:file:text-emerald-300 cursor-pointer"
                    />
                    {uploadingState.photoUrl && <span className="text-xs text-amber-600">Mengunggah foto...</span>}
                    {guestForm.photoUrl && (
                      <div className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Foto terunggah
                      </div>
                    )}
                  </div>

                  {/* Akte Kelahiran */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Akte Kelahiran (Gambar/PDF)
                    </label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "akte", "birthCertificateUrl");
                      }}
                      className="w-full text-xs text-zinc-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 dark:file:bg-emerald-950 dark:file:text-emerald-300 cursor-pointer"
                    />
                    {uploadingState.birthCertificateUrl && <span className="text-xs text-amber-600">Mengunggah Akte...</span>}
                    {guestForm.birthCertificateUrl && (
                      <div className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Akte terunggah
                      </div>
                    )}
                  </div>

                  {/* Kartu BPJS */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Kartu BPJS Kesehatan
                    </label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "bpjs", "bpjsCardUrl");
                      }}
                      className="w-full text-xs text-zinc-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 dark:file:bg-emerald-950 dark:file:text-emerald-300 cursor-pointer"
                    />
                    {uploadingState.bpjsCardUrl && <span className="text-xs text-amber-600">Mengunggah BPJS...</span>}
                    {guestForm.bpjsCardUrl && (
                      <div className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> BPJS terunggah
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Berat badan (kg) */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Berat Badan (kg) - Opsional untuk Kumite
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Contoh: 34.5"
                  value={guestForm.weight}
                  onChange={(e) => setGuestForm({ ...guestForm, weight: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm"
                />
              </div>

              {/* Kategori Pertandingan */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Pilih Kategori Kelas Pertandingan *
                </label>
                <select
                  required
                  value={guestForm.categoryId}
                  onChange={(e) => setGuestForm({ ...guestForm, categoryId: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400"
                >
                  <option value="">-- Pilih Kategori Pertandingan --</option>
                  {availableCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.gender === "MALE" ? "Putra" : cat.gender === "FEMALE" ? "Putri" : "Campuran"}) {cat.isFeeVisible !== false ? `- Rp ${cat.fee.toLocaleString("id-ID")}` : ""}
                    </option>
                  ))}
                </select>
                {availableCategories.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    * Belum ada kategori yang sesuai dengan Tanggal Lahir / Gender di atas.
                  </p>
                )}
              </div>

              {/* Checkbox Ketentuan */}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={guestForm.agreedTerms}
                    onChange={(e) => setGuestForm({ ...guestForm, agreedTerms: e.target.checked })}
                    className="mt-1 rounded text-red-600 focus:ring-red-500"
                  />
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    Saya menyatakan bahwa data yang saya masukkan adalah benar dan **menyetujui seluruh Ketentuan & Peraturan Pertandingan** yang ditetapkan panitia.
                  </span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowGuestModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={guestSubmitting || Object.values(uploadingState).some(Boolean)}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow flex items-center gap-2"
                >
                  {guestSubmitting ? "Mendaftarkan..." : "Kirim Pendaftaran Tamu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ketentuan Pertandingan Publik */}
      {showRulesModal && activeEvent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-red-600" />
                Ketentuan & Proposal Pertandingan: {activeEvent.title}
              </h3>
              <button onClick={() => setShowRulesModal(false)} className="text-zinc-500 hover:text-zinc-800">
                ✕
              </button>
            </div>
            
            <div
              className="flex-1 overflow-y-auto prose dark:prose-invert prose-sm max-w-none text-zinc-700 dark:text-zinc-300 p-4 border rounded-xl bg-zinc-50 dark:bg-zinc-800/50"
              dangerouslySetInnerHTML={{ __html: activeEvent.rulesContent || "<p>Ketentuan pertandingan belum diterbitkan.</p>" }}
            />

            <div className="flex justify-between items-center pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500">Institut Karate-Do Indonesia Cabang Surabaya</span>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Rincian Pembayaran & Bukti Pendaftaran Tamu */}
      {paymentSuccessData && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Pendaftaran Berhasil Disimpan!
              </h3>
              <button onClick={() => setPaymentSuccessData(null)} className="text-zinc-500 hover:text-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
              Selamat! Data pendaftaran atlet Anda telah tercatat. Silakan selesaikan pembayaran untuk verifikasi resmi panitia.
            </div>

            {/* Rincian Pendaftaran */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-zinc-500">Nomor Registrasi:</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white">{paymentSuccessData.registrationId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Nama Atlet:</span>
                <span className="font-bold text-zinc-900 dark:text-white">{paymentSuccessData.athleteName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Dojo / Kontingen:</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{paymentSuccessData.dojoName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Kelas Pertandingan:</span>
                <span className="font-semibold text-red-700 dark:text-red-400">{paymentSuccessData.categoryName}</span>
              </div>
              <div className="border-t pt-1.5 flex justify-between items-center font-bold text-sm">
                <span>Total Biaya Pendaftaran:</span>
                <span className="text-emerald-600 dark:text-emerald-400">Rp {paymentSuccessData.fee.toLocaleString("id-ID")}</span>
              </div>
            </div>

            {/* Metode Pembayaran */}
            <div className="space-y-3 pt-1">
              <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-red-600" /> Pilih Metode Pembayaran
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* QRIS */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1">
                  <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1">
                    <QrCode className="w-4 h-4 text-red-600" /> QRIS INKAI Surabaya
                  </div>
                  <p className="text-[11px] text-zinc-500">Scan via GoPay, OVO, Dana, ShopeePay, BCA, Mandiri</p>
                  <div className="pt-2 text-center">
                    <div className="inline-block bg-white p-2 rounded-lg border border-zinc-300">
                      <QrCode className="w-16 h-16 text-zinc-800 mx-auto" />
                      <span className="block text-[9px] font-mono text-zinc-500 mt-1">NMID: ID1029384756</span>
                    </div>
                  </div>
                </div>

                {/* Transfer Bank */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white">Transfer Bank Mandiri</div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">No. Rekening Resmi Cabang:</p>
                    <div className="mt-2 p-2 bg-white dark:bg-zinc-900 rounded-lg border font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                      141-00-1928374-1
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">a.n. INKAI CABANG SURABAYA</div>
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium pt-2">
                    *Harap simpan bukti transfer untuk dikirim ke WhatsApp Admin.
                  </div>
                </div>
              </div>
            </div>

            {/* CTA WhatsApp Confirmation */}
            <div className="pt-2 space-y-2">
              <a
                href={`https://api.whatsapp.com/send?phone=${adminWaState.waNumber}&text=${encodeURIComponent(
                  `*KONFIRMASI PEMBAYARAN KEJUARAAN*\n` +
                  `----------------------------------\n` +
                  `📌 *No. Registrasi:* ${paymentSuccessData.registrationId}\n` +
                  `👤 *Nama Atlet:* ${paymentSuccessData.athleteName}\n` +
                  `🏛️ *Dojo:* ${paymentSuccessData.dojoName}\n` +
                  `🏅 *Kelas:* ${paymentSuccessData.categoryName}\n` +
                  `💰 *Total Biaya:* Rp ${paymentSuccessData.fee.toLocaleString("id-ID")}\n\n` +
                  `Saya telah melakukan pendaftaran & pembayaran pendaftaran kejuaraan. Mohon verifikasi data & berkas saya. Terima kasih.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
              >
                <Send className="w-4 h-4" /> Konfirmasi WhatsApp Admin ({adminWaState.phone})
              </a>

              <button
                type="button"
                onClick={() => setPaymentSuccessData(null)}
                className="w-full py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
              >
                Tutup & Kembali ke Daftar Peserta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview Dokumen */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-600" />
                {previewDoc.title}
              </h3>
              <div className="flex items-center gap-2">
                {/* Tombol Upload Ulang / Ganti Berkas di Header Modal */}
                {previewDoc.regId && previewDoc.docType && (
                  <label className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow transition">
                    <Upload className="w-3.5 h-3.5" /> Upload Ulang / Ganti
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f && previewDoc.regId && previewDoc.docType) {
                          await handleRowDocUpload(previewDoc.regId, previewDoc.memberId, f, previewDoc.docType);
                          setPreviewDoc(null);
                        }
                      }}
                    />
                  </label>
                )}

                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Buka Tab Baru
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto rounded-xl bg-zinc-950/5 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center min-h-[350px] p-2 relative">
              {(() => {
                const cleanUrl = previewDoc.url.split("?")[0].toLowerCase();
                const isPdf = cleanUrl.endsWith(".pdf") || previewDoc.url.toLowerCase().includes(".pdf");
                if (isPdf) {
                  const embedUrl = previewDoc.url.startsWith("http")
                    ? `https://docs.google.com/gview?url=${encodeURIComponent(previewDoc.url)}&embedded=true`
                    : previewDoc.url;
                  return (
                    <div className="w-full h-full flex flex-col space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-1">
                        <span>💡 Dokumen PDF (Viewer Aman INKAI)</span>
                        <a
                          href={previewDoc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Unduh / Tab Baru
                        </a>
                      </div>
                      <iframe
                        src={embedUrl}
                        className="w-full h-[550px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white"
                        title={previewDoc.title}
                      />
                    </div>
                  );
                }
                return (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.title}
                    className="max-h-[600px] w-auto object-contain rounded-lg shadow-md"
                    onError={(e) => {
                      const imgEl = e.currentTarget;
                      imgEl.style.display = "none";
                      const parent = imgEl.parentElement;
                      if (parent && !parent.querySelector(".fallback-preview")) {
                        const div = document.createElement("div");
                        div.className = "fallback-preview p-6 text-center space-y-3";
                        div.innerHTML = `
                          <div class="text-red-500 font-bold text-sm">Pratinjau Gambar Tidak Dapat Ditampilkan</div>
                          <p class="text-xs text-zinc-500 max-w-md mx-auto">Berkas ini mungkin berformat PDF atau link gambar rusak. Anda dapat membukanya di tab baru atau mengunggah ulang berkas baru di bawah.</p>
                        `;
                        parent.appendChild(div);
                      }
                    }}
                  />
                );
              })()}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500">
                {previewDoc.regId ? "Berkas salah atau buram? Klik tombol di kanan untuk mengunggah ulang." : "Buka di tab baru jika pratinjau terkendala."}
              </span>

              <div className="flex items-center gap-2">
                {previewDoc.regId && previewDoc.docType && (
                  <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5 transition">
                    <Upload className="w-3.5 h-3.5" /> Upload Ulang / Ganti Berkas
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f && previewDoc.regId && previewDoc.docType) {
                          await handleRowDocUpload(previewDoc.regId, previewDoc.memberId, f, previewDoc.docType);
                          setPreviewDoc(null);
                        }
                      }}
                    />
                  </label>
                )}

                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="px-5 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-xl"
                >
                  Tutup Pratinjau
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog Cetak PDF (A4/F4, Portrait/Landscape, Logo INKAI) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <Printer className="w-5 h-5 text-red-600 dark:text-red-400" />
                Cetak Daftar Peserta Kejuaraan
              </h3>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1.5 text-zinc-700 dark:text-zinc-300">
                  📄 Ukuran Kertas Cetak
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintPaperSize("A4")}
                    className={`p-3 rounded-xl border text-center font-bold transition ${
                      printPaperSize === "A4"
                        ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 shadow-xs"
                        : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    A4 (Standard)
                    <span className="block text-[10px] font-normal text-zinc-500">210 × 297 mm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintPaperSize("F4")}
                    className={`p-3 rounded-xl border text-center font-bold transition ${
                      printPaperSize === "F4"
                        ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 shadow-xs"
                        : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    F4 (Folio/HVS)
                    <span className="block text-[10px] font-normal text-zinc-500">215 × 330 mm</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1.5 text-zinc-700 dark:text-zinc-300">
                  📐 Orientasi Halaman
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintOrientation("landscape")}
                    className={`p-3 rounded-xl border text-center font-bold transition ${
                      printOrientation === "landscape"
                        ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 shadow-xs"
                        : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    Landscape (Mendatar)
                    <span className="block text-[10px] font-normal text-zinc-500">Direkomendasikan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintOrientation("portrait")}
                    className={`p-3 rounded-xl border text-center font-bold transition ${
                      printOrientation === "portrait"
                        ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 shadow-xs"
                        : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    Portrait (Tegak)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1 text-zinc-700 dark:text-zinc-300">
                  🏛️ Filter Dojo / Kontingen Khusus (Opsional)
                </label>
                <select
                  value={printDojoFilter}
                  onChange={(e) => setPrintDojoFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-semibold"
                >
                  <option value="">Semua Filter Terpilih ({filteredRegistrations.length} peserta)</option>
                  {uniqueDojos.map((d) => (
                    <option key={d} value={d}>
                      {d} ({registrations.filter((r) => r.dojo.name === d).length} peserta)
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>Dokumen cetak PDF menyertakan **Kop Resmi Logo INKAI Cabang Surabaya**, ringkasan statistik, dan kolom penandatanganan panitia perwasitan.</div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="w-1/2 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPrintModal(false);
                  handlePrintPdf();
                }}
                className="w-1/2 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" /> Buka Cetak PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useRef, useMemo } from "react";
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
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  RotateCcw,
  Code,
  X,
  Upload,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import { generateTournamentIdCardsHtml, generateTournamentRosterHtml, generateTournamentMedalTallyHtml } from "@/lib/tournament-print-html";
import { compressUploadFile } from "@/lib/compress-image";
import { InkaiConfirmDialog } from "@/components/ui/InkaiConfirmDialog";
import { showError, showSuccess } from "@/lib/client-toast";
import { deriveAgeCategoryLabel } from "@/lib/tournament-category-presets";
import { DEFAULT_ADMIN_WA, getAdminWaPhone, setAdminWaPhone } from "@/lib/site";
import { exportTournamentRosterToExcel } from "@/lib/tournament-excel-export";
import { isBlackBeltRank } from "@/lib/belt";

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
  minAge?: number | null;
  maxAge?: number | null;
  fee: number;
  isFeeVisible?: boolean;
}


interface DojoItem {
  id: string;
  name: string;
}

interface MemberItem {
  id: string;
  fullName: string;
  nia?: string;
  mshNumber?: string | null;
  currentRank?: string;
  gender?: string;
  birthDate?: string;
  birthPlace?: string | null;
  dojoId?: string;
  dojo?: { id: string; name: string };
  photoUrl?: string;
  birthCertificateUrl?: string;
  bpjsCardUrl?: string;
}

function formatTTL(birthPlace?: string | null, birthDate?: string | null): string {
  const place = (birthPlace || "").trim();
  let dateStr = "";
  if (birthDate) {
    const d = new Date(birthDate);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    } else {
      dateStr = String(birthDate).trim();
    }
  }
  if (place && dateStr) return `${place}, ${dateStr}`;
  return place || dateStr || "-";
}

interface RegistrationItem {
  id: string;
  eventId: string;
  dojoId: string;
  memberId: string;
  categoryId: string;
  status: string;
  paymentMethod?: string | null;
  proofUrl?: string | null;
  certificateUrl?: string | null;
  medal?: string | null;
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

  // Editable Admin WhatsApp State
  const [adminWaState, setAdminWaState] = useState<{ phone: string; waNumber: string }>(DEFAULT_ADMIN_WA);
  const [showEditWaModal, setShowEditWaModal] = useState(false);
  const [editWaInput, setEditWaInput] = useState("085731241840");

  // Filters
  const [search, setSearch] = useState("");
  const [selectedDojoId, setSelectedDojoId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");

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
        const res = await fetch(`/api/admin/pertandingan/suggest?q=${encodeURIComponent(search)}&eventId=${selectedEventId}`);
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

  // Modals
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState<EventItem | null>(null);
  const [showRulesEditorModal, setShowRulesEditorModal] = useState(false);
  const [showBatchRegModal, setShowBatchRegModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState<RegistrationItem | null>(null);
  const [showMedalTallyModal, setShowMedalTallyModal] = useState(false);
  const [previewDocModal, setPreviewDocModal] = useState<{
    title: string;
    url: string;
    regId?: string;
    memberId?: string;
    docType?: "birthCertificateUrl" | "bpjsCardUrl" | "photoUrl" | "proofUrl" | "certificateUrl";
  } | null>(null);

  // INKAI Custom Confirmation Modal States
  const [confirmDeleteReg, setConfirmDeleteReg] = useState<{
    open: boolean;
    id: string;
    athleteName: string;
    categoryName: string;
    dojoName: string;
  } | null>(null);

  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<{
    open: boolean;
    id: string;
    title: string;
  } | null>(null);

  const [confirmResetRulesOpen, setConfirmResetRulesOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    eventTime: "",
    location: "",
  });

  const [rulesInput, setRulesInput] = useState("");
  const [rulesMode, setRulesMode] = useState<"VISUAL" | "HTML">("VISUAL");
  const rulesEditorRef = useRef<HTMLDivElement>(null);

  const execRulesCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (rulesEditorRef.current) {
      setRulesInput(rulesEditorRef.current.innerHTML);
    }
  };

  useEffect(() => {
    if (showRulesEditorModal && rulesEditorRef.current) {
      rulesEditorRef.current.innerHTML = rulesInput || DEFAULT_TOURNAMENT_RULES_TEMPLATE;
    }
  }, [showRulesEditorModal]);

  const [batchReg, setBatchReg] = useState({
    dojoId: "",
    officialName: "",
    officialPhone: "",
    entries: [{ memberId: "", categoryId: "" }],
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const regMemberId = params.get("registerMemberId");
      if (regMemberId) {
        setBatchReg((prev) => ({
          ...prev,
          entries: [{ memberId: regMemberId, categoryId: "" }],
        }));
        setShowBatchRegModal(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!showBatchRegModal) return;
    const firstMemberId = batchReg.entries.find((e) => e.memberId)?.memberId;
    if (firstMemberId && members.length > 0) {
      const targetMember = members.find((m) => m.id === firstMemberId);
      const detectedDojoId = targetMember?.dojoId || targetMember?.dojo?.id;
      if (detectedDojoId && detectedDojoId !== batchReg.dojoId) {
        setBatchReg((prev) => ({ ...prev, dojoId: detectedDojoId }));
      }
    }
  }, [batchReg.entries, members, showBatchRegModal]);

  const [actualWeightInput, setActualWeightInput] = useState("");
  const [weightStatusInput, setWeightStatusInput] = useState("VERIFIED");
  const [paymentMethodInput, setPaymentMethodInput] = useState<"TRANSFER" | "CASH">("TRANSFER");

  useEffect(() => {
    setAdminWaState(getAdminWaPhone());
  }, []);

  const handleSaveAdminWa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWaInput || editWaInput.trim().length < 8) {
      showError("Nomor WhatsApp minimal 8 digit angka");
      return;
    }
    const updated = setAdminWaPhone(editWaInput);
    setAdminWaState(updated);
    setShowEditWaModal(false);
    showSuccess(`Berhasil memperbarui nomor WA Admin menjadi ${updated.phone}`);
  };

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
        showSuccess("Event kejuaraan berhasil dibuat");
        setShowNewEventModal(false);
        setEventForm({ title: "", description: "", startDate: "", endDate: "", eventTime: "", location: "" });
        await fetchEvents();
        if (data.event) setSelectedEventId(data.event.id);
      } else {
        showError(data.error || "Gagal membuat event");
      }
    } catch (err) {
      console.error(err);
      showError("Terjadi kesalahan");
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
        showSuccess("Event kejuaraan berhasil diperbarui");
        setShowEditEventModal(null);
        fetchEvents();
      } else {
        const data = await res.json();
        showError(data.error || "Gagal memperbarui event");
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
        showSuccess("Ketentuan Pertandingan berhasil disimpan!");
        setShowRulesEditorModal(false);
        fetchEvents();
      } else {
        showError("Gagal menyimpan ketentuan pertandingan");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerDeleteEvent = (eventItem: EventItem) => {
    setConfirmDeleteEvent({
      open: true,
      id: eventItem.id,
      title: eventItem.title,
    });
  };

  const executeDeleteEvent = async () => {
    if (!confirmDeleteEvent) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/pertandingan/events?id=${confirmDeleteEvent.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showSuccess("Event kejuaraan berhasil dihapus");
        setSelectedEventId("");
        fetchEvents();
        setConfirmDeleteEvent(null);
      } else {
        const data = await res.json();
        showError(data.error || "Gagal menghapus event");
      }
    } catch (err) {
      console.error(err);
      showError("Terjadi kesalahan saat menghapus event");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBatchRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;

    try {
      const validEntries = batchReg.entries.filter(e => e.memberId && e.categoryId);
      if (validEntries.length === 0) {
        showError("Pilih minimal 1 atlet dan 1 kategori");
        return;
      }

      let targetDojoId = batchReg.dojoId;
      if (!targetDojoId && validEntries.length > 0) {
        const m = members.find((mem) => mem.id === validEntries[0].memberId);
        targetDojoId = m?.dojoId || m?.dojo?.id || "";
      }

      if (!targetDojoId) {
        showError("Dojo / Ranting atlet tidak ditemukan. Pastikan data anggota memiliki Dojo.");
        return;
      }

      const res = await fetch("/api/admin/pertandingan/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          dojoId: targetDojoId,
          officialName: batchReg.officialName,
          officialPhone: batchReg.officialPhone,
          entries: validEntries,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showSuccess(`Berhasil meregistrasikan ${data.createdCount} atlet/kategori!`);
        setShowBatchRegModal(false);
        setBatchReg({
          dojoId: "",
          officialName: "",
          officialPhone: "",
          entries: [{ memberId: "", categoryId: "" }],
        });
        fetchRegistrations();
      } else {
        showError(data.error || "Gagal pendaftaran");
      }
    } catch (err) {
      console.error(err);
      showError("Terjadi kesalahan");
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

  const handleUpdateCategory = async (id: string, categoryId: string) => {
    try {
      const res = await fetch("/api/admin/pertandingan/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, categoryId }),
      });
      if (res.ok) {
        showSuccess("Kelas pertandingan berhasil diubah");
        fetchRegistrations();
      } else {
        const data = await res.json();
        showError(data.error || "Gagal mengubah kelas pertandingan");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateInlineWeight = async (id: string, actualWeight: number | null) => {
    // Optimistic state update so table & modal stay 100% in sync
    setRegistrations((prev) => prev.map((r) => (r.id === id ? { ...r, actualWeight } : r)));
    if (showWeightModal && showWeightModal.id === id) {
      setShowWeightModal((prev) => (prev ? { ...prev, actualWeight } : null));
      setActualWeightInput(actualWeight !== null ? actualWeight.toString() : "");
    }

    try {
      const res = await fetch("/api/admin/pertandingan/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, actualWeight }),
      });
      if (res.ok) {
        showSuccess("Berat badan berhasil diperbarui & disinkronkan");
        fetchRegistrations();
      } else {
        const data = await res.json();
        showError(data.error || "Gagal memperbarui berat badan");
        fetchRegistrations();
      }
    } catch (err) {
      console.error(err);
      showError("Terjadi kesalahan saat memperbarui berat badan");
      fetchRegistrations();
    }
  };

  const handleUpdateWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showWeightModal) return;
    try {
      const cleanNotes = (showWeightModal.notes || "").replace(/\[(CASH|TRANSFER)\]|METODE:\s*(CASH|TRANSFER)/gi, "").trim();
      const updatedNotes = cleanNotes ? `${cleanNotes} [${paymentMethodInput}]` : `[${paymentMethodInput}]`;
      const parsedWeight = actualWeightInput ? parseFloat(actualWeightInput) : null;

      // Optimistic state update
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === showWeightModal.id
            ? { ...r, actualWeight: parsedWeight, status: weightStatusInput as any, notes: updatedNotes }
            : r
        )
      );

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
        showSuccess("Verifikasi timbang badan & berkas disimpam & disinkronkan");
        setShowWeightModal(null);
        fetchRegistrations();
      } else {
        fetchRegistrations();
      }
    } catch (err) {
      console.error(err);
      fetchRegistrations();
    }
  };

  const triggerDeleteRegistration = (reg: RegistrationItem) => {
    setConfirmDeleteReg({
      open: true,
      id: reg.id,
      athleteName: reg.member.fullName,
      categoryName: reg.category.name,
      dojoName: reg.dojo.name,
    });
  };

  const executeDeleteRegistration = async () => {
    if (!confirmDeleteReg) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/pertandingan/registrations?id=${confirmDeleteReg.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showSuccess("Pendaftaran atlet berhasil dihapus");
        fetchRegistrations();
        setConfirmDeleteReg(null);
      } else {
        const data = await res.json();
        showError(data.error || "Gagal menghapus pendaftaran");
      }
    } catch (err) {
      console.error(err);
      showError("Terjadi kesalahan saat menghapus pendaftaran");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdatePaymentMethod = async (regId: string, paymentMethod: "TRANSFER" | "CASH") => {
    try {
      const res = await fetch("/api/admin/pertandingan/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: regId, paymentMethod }),
      });
      if (res.ok) {
        fetchRegistrations();
      }
    } catch (err) {
      console.error(err);
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
        docType === "proofUrl" ? "bukti-tf" : docType === "certificateUrl" ? "piagam-pertandingan" : "dokumen-pertandingan"
      );

      const resUpload = await fetch("/api/public/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await resUpload.json();
      if (!resUpload.ok) throw new Error(uploadData.error || "Gagal mengunggah berkas");

      const fileUrl = uploadData.url;

      if (docType === "proofUrl") {
        await fetch("/api/admin/pertandingan/registrations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: regId, proofUrl: fileUrl, paymentMethod: "TRANSFER" }),
        });
      } else {
        await fetch("/api/admin/pertandingan/registrations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: regId, [docType]: fileUrl }),
        });
      }

      showSuccess("Berkas berhasil diunggah & dikompres (≤150KB)");
      fetchRegistrations();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleUpdateMedal = async (id: string, medal: string | null) => {
    try {
      const res = await fetch("/api/admin/pertandingan/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, medal }),
      });
      if (res.ok) {
        showSuccess("Prestasi medali atlet berhasil diperbarui");
        fetchRegistrations();
      } else {
        showError("Gagal memperbarui data medali");
      }
    } catch (err: any) {
      showError(err.message || "Gagal memperbarui medali");
    }
  };

  const medalTally = useMemo(() => {
    const map: Record<
      string,
      {
        dojoName: string;
        gold: number;
        silver: number;
        bronze: number;
        total: number;
        points: number;
        winners: { athleteName: string; categoryName: string; medal: string }[];
      }
    > = {};

    registrations.forEach((reg) => {
      if (!reg.medal) return;
      const dojoName = reg.dojo.name;
      if (!map[dojoName]) {
        map[dojoName] = { dojoName, gold: 0, silver: 0, bronze: 0, total: 0, points: 0, winners: [] };
      }
      if (reg.medal === "GOLD") {
        map[dojoName].gold += 1;
        map[dojoName].points += 5;
      } else if (reg.medal === "SILVER") {
        map[dojoName].silver += 1;
        map[dojoName].points += 3;
      } else if (reg.medal === "BRONZE") {
        map[dojoName].bronze += 1;
        map[dojoName].points += 1;
      }
      map[dojoName].total += 1;
      map[dojoName].winners.push({
        athleteName: reg.member.fullName,
        categoryName: reg.category.name,
        medal: reg.medal,
      });
    });

    return Object.values(map).sort((a, b) => {
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return b.points - a.points;
    });
  }, [registrations]);


  const displayedRegistrations = registrations.filter((reg) => {
    if (!selectedPaymentMethod) return true;
    if (selectedPaymentMethod === "CASH") return reg.notes?.includes("CASH");
    if (selectedPaymentMethod === "TRANSFER") return !reg.notes?.includes("CASH");
    return true;
  });

  const exportToExcel = () => {
    if (displayedRegistrations.length === 0) {
      showError("Tidak ada data pendaftaran untuk diekspor");
      return;
    }
    const activeEvent = events.find((e) => e.id === selectedEventId);
    const eventName = activeEvent?.title || "Kejuaraan Karate INKAI Surabaya";
    exportTournamentRosterToExcel(eventName, displayedRegistrations);
    showSuccess("Berhasil mengekspor roster peserta dengan format Excel rapi (.xls)");
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

  const printMedalTally = () => {
    const activeEvent = events.find((e) => e.id === selectedEventId);
    const html = generateTournamentMedalTallyHtml(activeEvent?.title || "Kejuaraan Karate INKAI Surabaya", medalTally);
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
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 w-full max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-red-900 via-red-800 to-red-950 text-white p-5 md:p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-7 h-7 md:w-8 md:h-8 text-yellow-400 animate-pulse" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Pendaftaran & Roster Kejuaraan</h1>
          </div>
          <p className="text-xs md:text-sm text-red-200">
            CRUD Event Pertandingan, Editor Ketentuan, Berkas Profil (Foto/Akte/BPJS), Timbang Badan, & ID Card
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setEventForm({
                title: "UKT Semester II-2026",
                description: "Pelaksanaan Kejuaraan & Ujian Kenaikan Tingkat Karate INKAI Cabang Kota Surabaya",
                startDate: "2026-10-04",
                endDate: "2026-10-04",
                eventTime: "08.00 – 12.00 WIB",
                location: "Gedung Olahraga Kodam V/Brawijaya Jl. Kesatriyan No.38 A, Gn. Sari, Kec. Dukuhpakis, Surabaya",
              });
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
            📜 Ketentuan Pertandingan
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
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Kejuaraan:</span>
          </div>
          
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full sm:w-80 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs md:text-sm font-medium focus:ring-2 focus:ring-red-500"
          >
            {events.length === 0 && <option value="">Belum ada event kejuaraan</option>}
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} ({new Date(ev.startDate).toLocaleDateString("id-ID")})
              </option>
            ))}
          </select>

          {activeEvent && (
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
          )}

          {activeEvent && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setEventForm({
                    title: activeEvent.title,
                    description: activeEvent.description || "",
                    startDate: activeEvent.startDate ? activeEvent.startDate.split("T")[0] : "",
                    endDate: activeEvent.endDate ? activeEvent.endDate.split("T")[0] : "",
                    eventTime: activeEvent.eventTime || "08.00 – 12.00 WIB",
                    location: activeEvent.location || "Gedung Olahraga Kodam V/Brawijaya Jl. Kesatriyan No.38 A, Gn. Sari, Kec. Dukuhpakis, Surabaya",
                  });
                  setShowEditEventModal(activeEvent);
                }}
                className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                title="Edit Event Kejuaraan Ini"
              >
                <Edit className="w-4 h-4 text-blue-500" />
              </button>

              <button
                onClick={() => triggerDeleteEvent(activeEvent)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                title="Hapus Event Kejuaraan Ini"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {activeEvent && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700">
              <Calendar className="w-3.5 h-3.5 text-red-500" />
              {new Date(activeEvent.startDate).toLocaleDateString("id-ID")} - {new Date(activeEvent.endDate).toLocaleDateString("id-ID")}
            </span>
            <span className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 max-w-xs md:max-w-md truncate">
              <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              <span className="truncate">{activeEvent.location || "Surabaya"}</span>
            </span>

            {/* Editable Admin WA Badge */}
            <button
              onClick={() => {
                setEditWaInput(adminWaState.phone);
                setShowEditWaModal(true);
              }}
              className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 transition font-semibold text-xs cursor-pointer shadow-xs"
              title="Edit Nomor WhatsApp Admin Panitia"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>WA Admin Panitia: <strong>{adminWaState.phone}</strong></span>
              <Edit className="w-3 h-3 text-emerald-600" />
            </button>
          </div>
        )}
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white dark:bg-zinc-900 p-3.5 md:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-3 md:gap-4">
          <div className="p-2.5 md:p-3 bg-red-100 dark:bg-red-950/50 rounded-xl text-red-600 dark:text-red-400 flex-shrink-0">
            <Users className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white truncate">{summary.totalCount || 0}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">Total Pendaftaran Kelas</div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-3.5 md:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-3 md:gap-4">
          <div className="p-2.5 md:p-3 bg-yellow-100 dark:bg-yellow-950/50 rounded-xl text-yellow-600 dark:text-yellow-400 flex-shrink-0">
            <UserCheck className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white truncate">{summary.uniqueAthletes || 0}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">Total Atlet Unik</div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-3.5 md:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-3 md:gap-4">
          <div className="p-2.5 md:p-3 bg-blue-100 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400 flex-shrink-0">
            <Building2 className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white truncate">{summary.uniqueDojos || 0}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">Kontingen / Dojo</div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-3.5 md:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-3 md:gap-4">
          <div className="p-2.5 md:p-3 bg-emerald-100 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400 flex-shrink-0">
            <DollarSign className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-lg md:text-xl font-bold text-emerald-600 dark:text-emerald-400 truncate">
              Rp {(summary.totalFee || 0).toLocaleString("id-ID")}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">Total Biaya Pendaftaran</div>
          </div>
        </div>
      </div>

      {/* Toolbar Controls */}
      <div className="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Filter Inputs Group */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64 lg:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Cari atlet, NIA, keanggotaan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => {
                  if (memberSuggestions.length > 0) setShowSuggestDropdown(true);
                }}
                className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-red-500"
              />

              {/* Suggestions Dropdown */}
              {showSuggestDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto">
                  <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    <span>💡 Keanggotaan INKAI (Pencarian DB)</span>
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
                              if (categories.length === 0) {
                                showError("Belum ada kategori kelas pertandingan pada event ini. Buat/kelola kelas terlebih dahulu.");
                                return;
                              }
                              try {
                                const res = await fetch("/api/admin/pertandingan/registrations", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    eventId: selectedEventId,
                                    dojoId: m.dojoId || m.dojo?.id || "",
                                    entries: [{ memberId: m.id, categoryId: categories[0].id }],
                                  }),
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  showSuccess("Atlet berhasil didaftarkan");
                                  setShowSuggestDropdown(false);
                                  await fetchRegistrations();
                                } else {
                                  showError(data.error || "Gagal meregistrasikan atlet");
                                }
                              } catch (err) {
                                console.error(err);
                                showError("Terjadi kesalahan saat registrasi atlet");
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
              value={selectedDojoId}
              onChange={(e) => setSelectedDojoId(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs md:text-sm"
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
              className="w-full sm:w-auto px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs md:text-sm"
            >
              <option value="">Semua Kategori Kelas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.isFeeVisible !== false ? ` (Rp ${c.fee.toLocaleString("id-ID")})` : ""}
                </option>
              ))}
            </select>

            {/* Filter Status */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs md:text-sm"
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
              className="w-full sm:w-auto px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs md:text-sm font-semibold text-blue-700 dark:text-blue-400"
            >
              <option value="">Semua Metode Bayar</option>
              <option value="TRANSFER">🏦 Transfer / QRIS</option>
              <option value="CASH">💵 Tunai / Cash</option>
            </select>
          </div>

          {/* Action Buttons Group */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
            <button
              onClick={() => setShowBatchRegModal(true)}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-xs md:text-sm rounded-lg flex items-center gap-1.5 transition shadow-xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Daftar Kontingen
            </button>

            <button
              onClick={() => setShowMedalTallyModal(true)}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs md:text-sm rounded-lg flex items-center gap-1.5 transition shadow-xs whitespace-nowrap"
            >
              <Trophy className="w-4 h-4 text-yellow-100" />
              Rekap Medali & Juara
            </button>

            <button
              onClick={printIdCards}
              disabled={registrations.length === 0}
              className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium text-xs md:text-sm rounded-lg flex items-center gap-1.5 transition disabled:opacity-50 whitespace-nowrap"
            >
              <CreditCard className="w-4 h-4 text-red-500" />
              Cetak ID Card
            </button>

            <button
              onClick={exportToExcel}
              disabled={displayedRegistrations.length === 0}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-semibold text-xs md:text-sm rounded-lg flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800 transition disabled:opacity-50 whitespace-nowrap"
              title="Ekspor Roster Terfilter ke Excel (.csv)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Export Excel
            </button>

            <button
              onClick={printRoster}
              disabled={displayedRegistrations.length === 0}
              className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium text-xs md:text-sm rounded-lg flex items-center gap-1.5 transition disabled:opacity-50 whitespace-nowrap"
            >
              <Printer className="w-4 h-4 text-emerald-500" />
              Cetak Roster
            </button>

            <button
              onClick={fetchRegistrations}
              className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg transition"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabel Roster Pendaftar & Berkas Profil */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center whitespace-nowrap">No</th>
                <th className="py-3.5 px-4 min-w-[200px]">Atlet / Foto</th>
                <th className="py-3.5 px-4 min-w-[170px] whitespace-nowrap">Tempat Tanggal Lahir</th>
                <th className="py-3.5 px-4 min-w-[140px] whitespace-nowrap">Dojo / Kontingen</th>
                <th className="py-3.5 px-4 min-w-[150px] text-center whitespace-nowrap">Kategori Usia</th>
                <th className="py-3.5 px-4 min-w-[180px] whitespace-nowrap">Berkas Profil (Akte / BPJS)</th>
                <th className="py-3.5 px-4 min-w-[200px]">Kelas Pertandingan</th>
                <th className="py-3.5 px-4 min-w-[120px] text-center whitespace-nowrap">BB (Berat Badan)</th>
                <th className="py-3.5 px-4 min-w-[140px] text-center whitespace-nowrap">Prestasi Medali</th>
                <th className="py-3.5 px-4 min-w-[110px] whitespace-nowrap text-right">Biaya Cabang</th>
                <th className="py-3.5 px-4 min-w-[210px] whitespace-nowrap text-center">Status & Pembayaran</th>
                <th className="py-3.5 px-4 min-w-[140px] whitespace-nowrap text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Memuat data roster pertandingan...
                  </td>
                </tr>
              ) : displayedRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Tidak ada pendaftaran atlet yang sesuai dengan filter terpilih.
                  </td>
                </tr>
              ) : (
                displayedRegistrations.map((reg, idx) => {
                  const ageCategoryLabel = deriveAgeCategoryLabel(
                    reg.category?.name,
                    reg.category?.minAge,
                    reg.category?.maxAge,
                    reg.member?.birthDate
                  );
                  return (
                    <tr key={reg.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition">
                      <td className="py-3 px-4 text-center font-mono text-xs text-zinc-500 whitespace-nowrap">{idx + 1}</td>
                      
                      {/* Atlet & Foto Profil */}
                      <td className="py-3 px-4 min-w-[200px]">
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
                          <div className="min-w-0">
                            <div className="font-semibold text-zinc-900 dark:text-white truncate">{reg.member.fullName}</div>
                            <div className="text-xs text-zinc-500 whitespace-nowrap">
                              {isBlackBeltRank(reg.member.currentRank)
                                ? `No. MSH: ${reg.member.mshNumber || "-"}`
                                : `NIA: ${reg.member.nia || "-"}`} • {reg.member.currentRank || "Putih"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-xs font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                        {formatTTL(reg.member.birthPlace, reg.member.birthDate)}
                      </td>

                      <td className="py-3 px-4 font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                        {reg.dojo.name}
                      </td>

                      {/* Kolom Kategori Usia */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 whitespace-nowrap shadow-xs">
                          {ageCategoryLabel}
                        </span>
                      </td>


                    {/* Berkas Profile Integration (Akte & BPJS) + Auto Compress 150KB Upload */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {reg.member.birthCertificateUrl ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setPreviewDocModal({ title: `Akte Kelahiran - ${reg.member.fullName}`, url: reg.member.birthCertificateUrl!, regId: reg.id, memberId: reg.member.id, docType: "birthCertificateUrl" })}
                              className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 hover:underline whitespace-nowrap"
                            >
                              <FileText className="w-3 h-3 text-emerald-600" />
                              Akte OK
                            </button>
                            <label title="Ganti / Upload Ulang Akte" className="cursor-pointer px-1.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                              <Upload className="w-3 h-3" />
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
                          </div>
                        ) : (
                          <label className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded text-[11px] text-zinc-600 dark:text-zinc-300 flex items-center gap-1 cursor-pointer whitespace-nowrap border border-zinc-200 dark:border-zinc-700 font-medium">
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

                        {reg.member.bpjsCardUrl ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setPreviewDocModal({ title: `Kartu BPJS - ${reg.member.fullName}`, url: reg.member.bpjsCardUrl!, regId: reg.id, memberId: reg.member.id, docType: "bpjsCardUrl" })}
                              className="px-2 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded text-[11px] font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1 hover:underline whitespace-nowrap"
                            >
                              <ShieldCheck className="w-3 h-3 text-blue-600" />
                              BPJS OK
                            </button>
                            <label title="Ganti / Upload Ulang BPJS" className="cursor-pointer px-1.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                              <Upload className="w-3 h-3" />
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
                          </div>
                        ) : (
                          <label className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded text-[11px] text-zinc-600 dark:text-zinc-300 flex items-center gap-1 cursor-pointer whitespace-nowrap border border-zinc-200 dark:border-zinc-700 font-medium">
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

                        {reg.certificateUrl ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setPreviewDocModal({ title: `Piagam Kejuaraan - ${reg.member.fullName}`, url: reg.certificateUrl!, regId: reg.id, memberId: reg.member.id, docType: "certificateUrl" })}
                              className="px-2 py-1 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded text-[11px] font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1 hover:underline whitespace-nowrap"
                            >
                              <Trophy className="w-3 h-3 text-purple-600" />
                              Piagam OK
                            </button>
                            <label title="Ganti / Upload Ulang Piagam" className="cursor-pointer px-1.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded text-[11px] text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                              <Upload className="w-3 h-3" />
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
                          </div>
                        ) : (
                          <label className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded text-[11px] text-zinc-600 dark:text-zinc-300 flex items-center gap-1 cursor-pointer whitespace-nowrap border border-zinc-200 dark:border-zinc-700 font-medium">
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

                    {/* Kelas Pertandingan (Inline Select Dropdown) */}
                    <td className="py-3 px-4 min-w-[200px]">
                      <select
                        value={reg.categoryId}
                        onChange={(e) => handleUpdateCategory(reg.id, e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-red-50/60 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs font-semibold text-red-700 dark:text-red-300 focus:ring-2 focus:ring-red-500 cursor-pointer shadow-xs truncate"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-normal">
                            {c.name}{c.isFeeVisible !== false ? ` (Rp ${c.fee.toLocaleString("id-ID")})` : ""}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Kolom BB (Berat Badan) di sebelah kanan Kelas Pertandingan */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
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
                              handleUpdateInlineWeight(reg.id, val);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = (e.target as HTMLInputElement).value ? parseFloat((e.target as HTMLInputElement).value) : null;
                              if (val !== reg.actualWeight) {
                                handleUpdateInlineWeight(reg.id, val);
                              }
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-16 px-1.5 py-0.5 bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 rounded text-xs font-bold text-amber-900 dark:text-amber-200 text-center focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">kg</span>
                      </div>
                    </td>

                    {/* Prestasi Medali Select Dropdown */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <select
                        value={reg.medal || ""}
                        onChange={(e) => handleUpdateMedal(reg.id, e.target.value || null)}
                        className={`px-2.5 py-1.5 border rounded-lg text-xs font-bold cursor-pointer transition shadow-xs ${
                          reg.medal === "GOLD"
                            ? "bg-yellow-100 text-yellow-900 border-yellow-400 dark:bg-yellow-950/60 dark:text-yellow-200"
                            : reg.medal === "SILVER"
                            ? "bg-slate-200 text-slate-900 border-slate-400 dark:bg-slate-800 dark:text-slate-100"
                            : reg.medal === "BRONZE"
                            ? "bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950/60 dark:text-amber-200"
                            : "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-400"
                        }`}
                      >
                        <option value="">— (Tanpa Medali)</option>
                        <option value="GOLD">🥇 Emas (Juara 1)</option>
                        <option value="SILVER">🥈 Perak (Juara 2)</option>
                        <option value="BRONZE">🥉 Perunggu (Juara 3)</option>
                      </select>
                    </td>

                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100 text-right whitespace-nowrap">
                      {reg.category.isFeeVisible !== false ? (
                        `Rp ${reg.category.fee.toLocaleString("id-ID")}`
                      ) : (
                        <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/60">
                          Disembunyikan
                        </span>
                      )}
                    </td>

                    {/* Status & Pilihan TF / Tunai + Upload Bukti TF & Lihat */}
                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap justify-center">
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

                          {/* Toggle TF vs Tunai */}
                          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <button
                              onClick={() => handleUpdatePaymentMethod(reg.id, "TRANSFER")}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${
                                (reg.paymentMethod || (reg.notes?.includes("CASH") ? "CASH" : "TRANSFER")) === "TRANSFER"
                                  ? "bg-blue-600 text-white shadow-xs"
                                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                              }`}
                            >
                              🏦 TF
                            </button>
                            <button
                              onClick={() => handleUpdatePaymentMethod(reg.id, "CASH")}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${
                                (reg.paymentMethod || (reg.notes?.includes("CASH") ? "CASH" : "TRANSFER")) === "CASH"
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                              }`}
                            >
                              💵 Tunai
                            </button>
                          </div>
                        </div>

                        {/* Bukti TF Upload & View (Kompres 150KB) */}
                        {(reg.paymentMethod || (reg.notes?.includes("CASH") ? "CASH" : "TRANSFER")) === "TRANSFER" && (
                          <div className="flex items-center gap-1 pt-0.5">
                            {reg.proofUrl ? (
                              <button
                                onClick={() => setPreviewDocModal({ title: `Bukti Transfer (TF): ${reg.member.fullName}`, url: reg.proofUrl! })}
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

                    <td className="py-3 px-4 text-right whitespace-nowrap">
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
                          onClick={() => triggerDeleteRegistration(reg)}
                          title="Hapus"
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md text-red-600"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}

            </tbody>


          </table>
        </div>
      </div>

      {/* Modal Ketentuan Pertandingan */}
      {showRulesEditorModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-yellow-500" />
                Ketentuan Pertandingan
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRulesMode(rulesMode === "VISUAL" ? "HTML" : "VISUAL")}
                  className="text-xs text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
                  title="Beralih antara mode visual Word dan mode kode HTML"
                >
                  <Code className="w-3.5 h-3.5 text-blue-500" />
                  {rulesMode === "VISUAL" ? "Kode HTML" : "Tampilan Word"}
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmResetRulesOpen(true)}
                  className="text-xs text-red-600 dark:text-red-400 font-semibold hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Templat INKAI
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 flex flex-col">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Tuliskan bab ketentuan pertandingan, persyaratan berkas, serta aturan tanding. Gunakan alat format teks di bawah ini (seperti Microsoft Word) untuk mengatur teks tebal, miring, judul bab, dan daftar nomor.
              </p>

              {/* Word-like Text Formatting Toolbar */}
              {rulesMode === "VISUAL" && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  {/* Font Style */}
                  <button
                    type="button"
                    onClick={() => execRulesCmd("bold")}
                    className="p-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
                    title="Tebal (Bold)"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => execRulesCmd("italic")}
                    className="p-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
                    title="Miring (Italic)"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => execRulesCmd("underline")}
                    className="p-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
                    title="Garis Bawah (Underline)"
                  >
                    <Underline className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => execRulesCmd("strikeThrough")}
                    className="p-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
                    title="Coret (Strikethrough)"
                  >
                    <Strikethrough className="w-4 h-4" />
                  </button>

                  <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1" />

                  {/* Headings */}
                  <button
                    type="button"
                    onClick={() => execRulesCmd("formatBlock", "h3")}
                    className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
                    title="Judul Bab (Heading 3)"
                  >
                    Bab (H3)
                  </button>
                  <button
                    type="button"
                    onClick={() => execRulesCmd("formatBlock", "h4")}
                    className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
                    title="Sub Judul (Heading 4)"
                  >
                    Sub Bab (H4)
                  </button>
                  <button
                    type="button"
                    onClick={() => execRulesCmd("formatBlock", "p")}
                    className="px-2 py-1 text-xs bg-white dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
                    title="Teks Paragraf Biasa"
                  >
                    Paragraf
                  </button>

                  <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1" />

                  {/* Lists */}
                  <button
                    type="button"
                    onClick={() => execRulesCmd("insertOrderedList")}
                    className="p-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
                    title="Daftar Nomor (1. 2. 3.)"
                  >
                    <ListOrdered className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => execRulesCmd("insertUnorderedList")}
                    className="p-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
                    title="Daftar Poin (Bullet List)"
                  >
                    <List className="w-4 h-4" />
                  </button>

                  <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1" />

                  {/* Alignment */}
                  <button
                    type="button"
                    onClick={() => execRulesCmd("justifyLeft")}
                    className="p-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
                    title="Rata Kiri"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => execRulesCmd("justifyCenter")}
                    className="p-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
                    title="Rata Tengah"
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => execRulesCmd("justifyRight")}
                    className="p-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
                    title="Rata Kanan"
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => execRulesCmd("justifyFull")}
                    className="p-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-700 transition"
                    title="Rata Kanan Kiri (Justify)"
                  >
                    <AlignJustify className="w-4 h-4" />
                  </button>

                  <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1" />

                  <button
                    type="button"
                    onClick={() => execRulesCmd("removeFormat")}
                    className="px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition"
                    title="Hapus Format Teks"
                  >
                    Hapus Format
                  </button>
                </div>
              )}

              {/* Visual Editable Area (Word-like) vs Code */}
              {rulesMode === "VISUAL" ? (
                <div
                  ref={rulesEditorRef}
                  contentEditable
                  onInput={() => {
                    if (rulesEditorRef.current) {
                      setRulesInput(rulesEditorRef.current.innerHTML);
                    }
                  }}
                  className="flex-1 min-h-[300px] p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-sm leading-relaxed overflow-y-auto text-zinc-900 dark:text-zinc-100 prose dark:prose-invert max-w-none"
                />
              ) : (
                <textarea
                  rows={14}
                  value={rulesInput}
                  onChange={(e) => {
                    setRulesInput(e.target.value);
                    if (rulesEditorRef.current) {
                      rulesEditorRef.current.innerHTML = e.target.value;
                    }
                  }}
                  placeholder="Tuliskan ketentuan pertandingan di sini..."
                  className="w-full p-3 font-mono text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-red-500 flex-1 min-h-[300px]"
                />
              )}
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
                  placeholder="mis. UKT Semester II-2026 atau Kejuaraan Karate INKAI Surabaya Cup 2026"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Lokasi / Tempat / Gelanggang *</label>
                <input
                  type="text"
                  required
                  placeholder="mis. Gedung Olahraga Kodam V/Brawijaya Jl. Kesatriyan No.38 A, Gn. Sari, Kec. Dukuhpakis, Surabaya"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-ellipsis"
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

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Pukul / Jam Pelaksanaan</label>
                <input
                  type="text"
                  placeholder="mis. 08.00 – 12.00 WIB"
                  value={eventForm.eventTime}
                  onChange={(e) => setEventForm({ ...eventForm, eventTime: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Deskripsi / Catatan Event</label>
                <textarea
                  rows={2}
                  placeholder="mis. Pelaksanaan Kejuaraan & Ujian Kenaikan Tingkat Karate INKAI Cabang Kota Surabaya..."
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm resize-none"
                />
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full p-4 space-y-3 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b pb-2 border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" /> {previewDocModal.title}
              </h3>
              <button onClick={() => setPreviewDocModal(null)} className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center min-h-[300px] bg-zinc-100 dark:bg-zinc-950 rounded-xl p-2 relative">
              {(() => {
                const cleanUrl = previewDocModal.url.split("?")[0].toLowerCase();
                const isPdf = cleanUrl.endsWith(".pdf") || previewDocModal.url.toLowerCase().includes(".pdf");
                if (isPdf) {
                  const embedUrl = previewDocModal.url.startsWith("http")
                    ? `https://docs.google.com/gview?url=${encodeURIComponent(previewDocModal.url)}&embedded=true`
                    : previewDocModal.url;
                  return (
                    <div className="w-full h-full flex flex-col space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-1">
                        <span>💡 Dokumen PDF (Viewer Aman INKAI)</span>
                        <a
                          href={previewDocModal.url}
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
                        title={previewDocModal.title}
                      />
                    </div>
                  );
                }
                return (
                  <img
                    src={previewDocModal.url}
                    alt="Pratinjau Berkas"
                    className="max-h-[70vh] object-contain rounded-lg shadow-md"
                    onError={(e) => {
                      const imgEl = e.currentTarget;
                      imgEl.style.display = "none";
                      const parent = imgEl.parentElement;
                      if (parent && !parent.querySelector(".fallback-preview")) {
                        const div = document.createElement("div");
                        div.className = "fallback-preview p-6 text-center space-y-3";
                        div.innerHTML = `
                          <div class="text-red-500 font-bold text-sm">Pratinjau Berkas Tidak Dapat Ditampilkan</div>
                          <p class="text-xs text-zinc-500 max-w-md mx-auto">Format berkas atau tautan bermasalah. Anda dapat membuka di tab baru atau mengunggah ulang berkas baru.</p>
                        `;
                        parent.appendChild(div);
                      }
                    }}
                  />
                );
              })()}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div>
                {previewDocModal.regId && previewDocModal.docType && (
                  <label className="cursor-pointer px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow">
                    <Upload className="w-3.5 h-3.5" /> Ganti / Upload Ulang (≤150KB)
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f && previewDocModal.regId && previewDocModal.docType) {
                          handleRowDocUpload(previewDocModal.regId, previewDocModal.memberId, f, previewDocModal.docType);
                          setPreviewDocModal(null);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDocModal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition"
                >
                  Buka Tab Baru
                </a>
                <button
                  onClick={() => setPreviewDocModal(null)}
                  className="px-4 py-1.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pendaftaran Kontingen (Batch) */}
      {showBatchRegModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-4xl lg:max-w-5xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-red-600" />
                Pendaftaran Kontingen / Dojo
              </h2>
              <button
                type="button"
                onClick={() => setShowBatchRegModal(false)}
                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBatchRegister} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between mb-1">
                    <span>Pilih Dojo / Ranting *</span>
                    {batchReg.dojoId && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium">
                        ✓ Otomatis dari Atlet
                      </span>
                    )}
                  </label>
                  <select
                    required
                    disabled
                    value={batchReg.dojoId}
                    onChange={(e) => setBatchReg({ ...batchReg, dojoId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 cursor-not-allowed opacity-90 font-medium"
                  >
                    <option value="">-- Pilih Dojo --</option>
                    {dojos.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 block">Nama Official / Manager</label>
                  <input
                    type="text"
                    placeholder="mis. Sensei Ahmad"
                    value={batchReg.officialName}
                    onChange={(e) => setBatchReg({ ...batchReg, officialName: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 block">No. WA Official</label>
                  <input
                    type="text"
                    placeholder="08123456789"
                    value={batchReg.officialPhone}
                    onChange={(e) => setBatchReg({ ...batchReg, officialPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Entries list */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Daftar Atlet & Kategori Kelas Pertandingan</span>
                  <button
                    type="button"
                    onClick={() => setBatchReg({
                      ...batchReg,
                      entries: [...batchReg.entries, { memberId: "", categoryId: "" }],
                    })}
                    className="text-xs bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 border border-red-200 dark:border-red-900"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Baris Baru
                  </button>
                </div>

                {batchReg.entries.map((entry, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/70 items-center">
                    <div className="md:col-span-5 flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-400 font-bold w-5 shrink-0">{idx + 1}.</span>
                      <select
                        required
                        value={entry.memberId}
                        onChange={(e) => {
                          const next = [...batchReg.entries];
                          next[idx].memberId = e.target.value;
                          setBatchReg({ ...batchReg, entries: next });
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="">-- Pilih Atlet / Anggota --</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fullName} ({m.dojo?.name || "Dojo -"}) - {m.currentRank || "Kyu"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-6">
                      <select
                        required
                        value={entry.categoryId}
                        onChange={(e) => {
                          const next = [...batchReg.entries];
                          next[idx].categoryId = e.target.value;
                          setBatchReg({ ...batchReg, entries: next });
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="">-- Pilih Kelas Pertandingan --</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} (Rp {c.fee.toLocaleString("id-ID")})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-1 flex justify-end">
                      {batchReg.entries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = batchReg.entries.filter((_, i) => i !== idx);
                            setBatchReg({ ...batchReg, entries: next });
                          }}
                          className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/60 rounded-lg transition"
                          title="Hapus Baris"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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

      {confirmDeleteReg && (
        <InkaiConfirmDialog
          open={confirmDeleteReg.open}
          onOpenChange={(open) => {
            if (!open) setConfirmDeleteReg(null);
          }}
          title="Hapus Pendaftaran Atlet"
          description="Hapus pendaftaran atlet ini dari kejuaraan? Data pendaftaran dan riwayat berkas atlet pada kejuaraan ini akan dihapus."
          confirmLabel="Ya, Hapus Pendaftaran"
          cancelLabel="Batal"
          variant="danger"
          loading={isDeleting}
          onConfirm={executeDeleteRegistration}
        >
          <div className="mt-2 rounded-xl border border-red-200/80 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/40 p-3 text-xs space-y-1">
            <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
              <span>{confirmDeleteReg.athleteName}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 font-semibold">
                Atlet
              </span>
            </div>
            <div className="text-zinc-600 dark:text-zinc-400">
              Kelas: <span className="font-semibold text-zinc-900 dark:text-zinc-200">{confirmDeleteReg.categoryName}</span>
            </div>
            <div className="text-zinc-600 dark:text-zinc-400">
              Dojo / Ranting: <span className="font-semibold text-zinc-900 dark:text-zinc-200">{confirmDeleteReg.dojoName}</span>
            </div>
          </div>
        </InkaiConfirmDialog>
      )}

      {confirmDeleteEvent && (
        <InkaiConfirmDialog
          open={confirmDeleteEvent.open}
          onOpenChange={(open) => {
            if (!open) setConfirmDeleteEvent(null);
          }}
          title="Hapus Event Kejuaraan"
          description={`Apakah Anda yakin ingin menghapus event kejuaraan "${confirmDeleteEvent.title}" beserta seluruh kategori dan data pendaftarannya?`}
          confirmLabel="Ya, Hapus Event"
          cancelLabel="Batal"
          variant="danger"
          loading={isDeleting}
          onConfirm={executeDeleteEvent}
        />
      )}

      <InkaiConfirmDialog
        open={confirmResetRulesOpen}
        onOpenChange={setConfirmResetRulesOpen}
        title="Reset Ketentuan Pertandingan"
        description="Kembalikan ketentuan pertandingan ke templat standar INKAI? Seluruh penyesuaian teks yang dibuat sebelumnya akan digantikan dengan templat baku."
        confirmLabel="Reset Templat Standard"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={() => {
          setRulesInput(DEFAULT_TOURNAMENT_RULES_TEMPLATE);
          if (rulesEditorRef.current) {
            rulesEditorRef.current.innerHTML = DEFAULT_TOURNAMENT_RULES_TEMPLATE;
          }
          setConfirmResetRulesOpen(false);
          showSuccess("Templat ketentuan berhasil direset");
        }}
      />

      {/* Modal Rekapitulasi Medali & Klasemen Juara Umum */}
      {showMedalTallyModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-yellow-500 animate-bounce" />
                  Rekapitulasi Medali & Klasemen Juara Umum
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {activeEvent?.title || "Kejuaraan Karate INKAI Surabaya"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMedalTallyModal(false)}
                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Top 3 Winner Highlights */}
            {medalTally.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/20 border border-amber-300 dark:border-amber-700/60 p-3.5 rounded-xl text-center space-y-1">
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">🥇 Juara Umum I</div>
                  <div className="text-base font-extrabold text-zinc-900 dark:text-white">{medalTally[0]?.dojoName || "-"}</div>
                  <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                    🥇 {medalTally[0]?.gold || 0} Emas | 🥈 {medalTally[0]?.silver || 0} Perak | 🥉 {medalTally[0]?.bronze || 0} Perunggu
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-400/10 to-slate-500/20 border border-slate-300 dark:border-slate-700/60 p-3.5 rounded-xl text-center space-y-1">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wide">🥈 Juara Umum II</div>
                  <div className="text-base font-extrabold text-zinc-900 dark:text-white">{medalTally[1]?.dojoName || "-"}</div>
                  <div className="text-xs text-slate-700 dark:text-slate-400 font-semibold">
                    🥇 {medalTally[1]?.gold || 0} Emas | 🥈 {medalTally[1]?.silver || 0} Perak | 🥉 {medalTally[1]?.bronze || 0} Perunggu
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-400/10 to-amber-600/20 border border-orange-300 dark:border-orange-700/60 p-3.5 rounded-xl text-center space-y-1">
                  <div className="text-xs font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wide">🥉 Juara Umum III</div>
                  <div className="text-base font-extrabold text-zinc-900 dark:text-white">{medalTally[2]?.dojoName || "-"}</div>
                  <div className="text-xs text-orange-700 dark:text-orange-400 font-semibold">
                    🥇 {medalTally[2]?.gold || 0} Emas | 🥈 {medalTally[2]?.silver || 0} Perak | 🥉 {medalTally[2]?.bronze || 0} Perunggu
                  </div>
                </div>
              </div>
            )}

            {/* Table Tally */}
            <div className="flex-1 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
              {medalTally.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  Belum ada medali yang diinputkan pada pendaftaran atlet. Pilih prestasi medali (🥇 Emas, 🥈 Perak, 🥉 Perunggu) pada tabel pendaftaran atlet.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 font-semibold text-zinc-700 dark:text-zinc-300">
                      <th className="py-2.5 px-3 text-center w-12">Peringkat</th>
                      <th className="py-2.5 px-3">Dojo / Ranting Kontingen</th>
                      <th className="py-2.5 px-3 text-center">🥇 Emas</th>
                      <th className="py-2.5 px-3 text-center">🥈 Perak</th>
                      <th className="py-2.5 px-3 text-center">🥉 Perunggu</th>
                      <th className="py-2.5 px-3 text-center">Total Medali</th>
                      <th className="py-2.5 px-3 text-center">Total Poin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                    {medalTally.map((t: any, idx: number) => (
                      <tr key={t.dojoName} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                        <td className="py-2.5 px-3 text-center font-bold">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-white">
                          {t.dojoName}
                          {idx === 0 && <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 rounded text-[10px] font-extrabold">Juara Umum 1</span>}
                          {idx === 1 && <span className="ml-2 px-2 py-0.5 bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 rounded text-[10px] font-extrabold">Juara Umum 2</span>}
                          {idx === 2 && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded text-[10px] font-extrabold">Juara Umum 3</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30">{t.gold}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-900/30">{t.silver}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/30">{t.bronze}</td>
                        <td className="py-2.5 px-3 text-center font-extrabold text-zinc-900 dark:text-white">{t.total}</td>
                        <td className="py-2.5 px-3 text-center font-extrabold text-blue-600 dark:text-blue-400">{t.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500">
                Kalkulasi Poin Standar: Emas = 5 poin, Perak = 3 poin, Perunggu = 1 poin.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={printMedalTally}
                  disabled={medalTally.length === 0}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" /> Cetak Rekap Medali & Juara (A4/PDF)
                </button>
                <button
                  type="button"
                  onClick={() => setShowMedalTallyModal(false)}
                  className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-xl"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Edit Nomor WA Admin */}
      {showEditWaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Edit Nomor WhatsApp Admin Panitia
              </h3>
              <button onClick={() => setShowEditWaModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdminWa} className="space-y-4 text-xs md:text-sm">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Nomor WhatsApp Admin Utama *
                </label>
                <input
                  type="text"
                  required
                  placeholder="085731241840"
                  value={editWaInput}
                  onChange={(e) => setEditWaInput(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400"
                />
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  Nomor ini akan digunakan sebagai tujuan resmi untuk semua permohonan koreksi data atlet, pembatalan pendaftaran, dan konfirmasi pembayaran di portal publik.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowEditWaModal(false)}
                  className="px-4 py-2 border border-zinc-300 text-xs font-semibold rounded-xl text-zinc-700 dark:text-zinc-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan Nomor WA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

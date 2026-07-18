"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Wallet,
  Banknote,
  Plus,
  MessageCircle,
  Printer,
  FileText,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  History,
  AlertTriangle,
  Pencil,
  Check,
  Trash2,
  CalendarClock,
  Download,
  LayoutList,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemberAvatarRing } from "@/components/admin/ukt/MemberAvatarRing";
import { UktPrintModal } from "@/components/admin/ukt/UktPrintModal";
import { UktSearchBar } from "@/components/admin/ukt/UktSearchBar";
import { AddMemberDialog } from "@/components/admin/AddMemberDialog";
import {
  BELT_RANK_OPTIONS,
  canEditKyuBaru,
  formatGenderLabel,
  formatMemberName,
  formatRankLabel,
} from "@/lib/belt";
import {
  type UktMemberRow,
  type UktSemester,
  type BeltFeeKey,
  BELT_FEE_KEYS,
  buildUktBranchRecapText,
  buildUktDojoRecaps,
  buildUktRecapCsv,
  canApplyUktKyuBaru,
  computeUktOperationalKpi,
  formatUktRegistrationBlockers,
  formatRupiahNota,
  getUktRegistrationBlockersWithWaiver,
  isRegistrationApproved,
  isNotaParticipant,
  isUktBillingUnpaid,
  isUktSelesai,
  filterUktRowsByView,
  filterUktRowsByDisplayStatus,
  formatUktPeriodLabel,
  participantAmount,
  formatUktRegistrationDeadline,
  getUktRegistrationDeadline,
  isUktRegistrationOpen,
  findUktPeriodForTerm,
  parseUktEventTitle,
  resolveEffectiveUktExamResult,
  resolveUktDisplayStatus,
  summarizeRowEligibility,
  triggerCsvDownload,
  toDateInput,
  toTimeInput,
  uktDisplayStatusLabel,
  UKT_DISPLAY_FILTER_OPTIONS,
  UKT_MIN_ATTENDANCE_PCT,
  type UktRegistrationBlocker,
  combineDateAndTimeLocal,
  HOURS_24,
  MINUTES_60,
  splitTimeInput,
  joinTimeInput,
} from "@/lib/ukt";
import { parseApiJson } from "@/lib/api-client";

export type UktPeriod = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  registrationCloseAt?: string | null;
};

export type UktDojo = { id: string; name: string };

type Props = {
  periods: UktPeriod[];
  selectedPeriodId: string | null;
  allRows: UktMemberRow[];
  dojos: UktDojo[];
  userRoles: string[];
  primaryRole: string;
  semester: UktSemester;
  year: number;
  canCreatePeriod: boolean;
  dbError?: string | null;
  defaultDojoFilter?: string;
  beltFees: Record<BeltFeeKey, number>;
  komisiRanting: number;
};

const PAGE_SIZES = [25, 50, 100, 1000] as const;

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function canCancelUktRegistration(row: UktMemberRow): boolean {
  if (!row.registrationId) return false;
  if (row.billingStatus === "PAID" || row.status === "PAID") return false;
  return true;
}

function formatRupiah(amount: number | null) {
  if (amount == null) return null;
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

function statusBadge(row: UktMemberRow) {
  const displayStatus = resolveUktDisplayStatus(row);
  const map: Record<string, string> = {
    selesai: "bg-emerald-600 hover:bg-emerald-600 text-white",
    lulus: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    gagal: "bg-red-100 text-red-700 hover:bg-red-100",
    mengulang: "bg-orange-100 text-orange-700 hover:bg-orange-100",
    menunggu_ujian: "bg-blue-100 text-blue-700 hover:bg-blue-100",
    menunggu_verifikasi: "bg-amber-100 text-amber-700 hover:bg-amber-100",
    belum_bayar: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  };
  const className = map[displayStatus];
  if (className) return <Badge className={className}>{uktDisplayStatusLabel(displayStatus)}</Badge>;
  if (displayStatus === "ditolak") return <Badge variant="destructive">{uktDisplayStatusLabel(displayStatus)}</Badge>;
  if (displayStatus === "belum_daftar") return <Badge variant="outline">{uktDisplayStatusLabel(displayStatus)}</Badge>;
  return <Badge variant="default">{uktDisplayStatusLabel(displayStatus)}</Badge>;
}

export function UktDashboard(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localQ, setLocalQ] = useState("");
  const [localStatus, setLocalStatus] = useState("");
  const [localDojo, setLocalDojo] = useState(props.defaultDojoFilter || "");
  const [localView, setLocalView] = useState("");
  const [localPage, setLocalPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState(25);
  const [yearInput, setYearInput] = useState(String(props.year));
  const [editingTitle, setEditingTitle] = useState(false);
  const [periodTitle, setPeriodTitle] = useState(
    props.periods.find((p) => p.id === props.selectedPeriodId)?.title ||
      formatUktPeriodLabel(props.semester, props.year),
  );
  const [selectedMember, setSelectedMember] = useState<UktMemberRow | null>(null);
  const [memberHistory, setMemberHistory] = useState<Record<string, unknown> | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showBeltFees, setShowBeltFees] = useState(false);
  const [beltFees, setBeltFees] = useState(props.beltFees);
  const [komisiRanting, setKomisiRanting] = useState(props.komisiRanting);
  const [loading, setLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; name: string } | null>(null);
  const [showRegistrationDeadline, setShowRegistrationDeadline] = useState(false);
  const [registrationDeadlineDate, setRegistrationDeadlineDate] = useState("");
  const [registrationDeadlineTime, setRegistrationDeadlineTime] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printOnlySelected, setPrintOnlySelected] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [waiverTarget, setWaiverTarget] = useState<UktMemberRow | null>(null);
  const [waiverBlockers, setWaiverBlockers] = useState<UktRegistrationBlocker[]>([]);
  const [waiverNote, setWaiverNote] = useState("");

  const isCabang = canEditKyuBaru(props.userRoles);
  const isDojoAdmin = props.primaryRole === "ADMIN_DOJO";

  useEffect(() => {
    if (isDojoAdmin) setCompactView(true);
  }, [isDojoAdmin]);

  useEffect(() => {
    setBeltFees(props.beltFees);
    setKomisiRanting(props.komisiRanting);
  }, [props.beltFees, props.komisiRanting]);
  const selectedPeriod = props.periods.find((p) => p.id === props.selectedPeriodId);
  const registrationOpen = selectedPeriod ? isUktRegistrationOpen(selectedPeriod) : true;
  const registrationDeadlineIso = selectedPeriod
    ? getUktRegistrationDeadline(selectedPeriod).toISOString()
    : null;
  const effectiveDojo = isDojoAdmin ? props.defaultDojoFilter || "" : localDojo;

  useEffect(() => {
    setYearInput(String(props.year));
  }, [props.year]);

  const scopedRows = useMemo(() => {
    let rows = props.allRows;
    if (effectiveDojo) rows = rows.filter((r) => r.dojoId === effectiveDojo);
    if (localStatus) rows = filterUktRowsByDisplayStatus(rows, localStatus);
    if (localQ.trim()) {
      const q = localQ.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.fullName.toLowerCase().includes(q) ||
          (r.nia?.toLowerCase().includes(q) ?? false),
      );
    }
    return rows;
  }, [props.allRows, effectiveDojo, localStatus, localQ]);

  const kpi = useMemo(() => computeUktOperationalKpi(scopedRows), [scopedRows]);

  const filteredRows = useMemo(() => {
    // Saat view "Terdaftar UKT" + pencarian aktif, tampilkan semua peserta yang cocok
    // agar admin bisa mendaftarkan anggota baru lewat tombol Daftar UKT.
    const viewFilter =
      localView === "registered" && localQ.trim() ? "" : localView;
    return filterUktRowsByView(scopedRows, viewFilter);
  }, [scopedRows, localView, localQ]);

  const dojoRecaps = useMemo(
    () => buildUktDojoRecaps(scopedRows, props.dojos),
    [scopedRows, props.dojos],
  );

  const totalFiltered = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / localPageSize));
  const safePage = Math.min(localPage, totalPages);
  const displayRows = useMemo(() => {
    const start = (safePage - 1) * localPageSize;
    return filteredRows.slice(start, start + localPageSize);
  }, [filteredRows, safePage, localPageSize]);

  const selectableRows = useMemo(
    () =>
      filteredRows.filter(
        (r) => r.registrationId && isNotaParticipant(r.status) && isUktBillingUnpaid(r),
      ),
    [filteredRows],
  );

  const selectedRows = useMemo(
    () => props.allRows.filter((r) => selectedIds.has(r.memberId)),
    [props.allRows, selectedIds],
  );

  const allSelectableChecked =
    selectableRows.length > 0 &&
    selectableRows.every((r) => selectedIds.has(r.memberId));

  const toggleSelect = (memberId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const toggleSelectAllSelectable = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelectableChecked) {
        selectableRows.forEach((r) => next.delete(r.memberId));
      } else {
        selectableRows.forEach((r) => next.add(r.memberId));
      }
      return next;
    });
  };

  const navigatePeriod = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v);
        else params.delete(k);
      });
      router.push(`/admin/ukt?${params.toString()}`);
    },
    [router, searchParams],
  );

  const syncNavigateTerm = useCallback(
    (updates: { semester?: UktSemester; year?: number }) => {
      const semester = updates.semester ?? props.semester;
      const year = updates.year ?? props.year;
      const match = findUktPeriodForTerm(props.periods, semester, year);
      navigatePeriod({
        semester,
        year: String(year),
        period: match?.id ?? "",
      });
    },
    [navigatePeriod, props.periods, props.semester, props.year],
  );

  const periodsForTerm = useMemo(
    () =>
      props.periods.filter((p) => {
        const parsed = parseUktEventTitle(p.title);
        return parsed?.semester === props.semester && parsed?.year === props.year;
      }),
    [props.periods, props.semester, props.year],
  );

  const handleKpiClick = (filter: string) => {
    const next =
      !filter || filter === "all" || localView === filter ? "" : filter;
    setLocalView(next);
    setLocalPage(1);
  };

  const selectedUnpaidCount = useMemo(
    () => selectedRows.filter((r) => r.registrationId && isUktBillingUnpaid(r)).length,
    [selectedRows],
  );

  const handleCreatePeriod = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ukt/period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semester: props.semester,
          year: props.year,
          title: periodTitle,
        }),
      });
      const data = await parseApiJson<{ error?: string; event?: { id: string }; created?: boolean }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal membuat periode");
      toast.success(data.created ? "Periode UKT dibuat" : "Periode UKT sudah ada");
      setShowCreateWizard(false);
      setWizardStep(0);
      navigatePeriod({
        semester: props.semester,
        year: String(props.year),
        period: data.event?.id ?? "",
      });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    const title = selectedPeriod?.title || formatUktPeriodLabel(props.semester, props.year);
    const rows =
      selectedIds.size > 0
        ? selectedRows.filter((r) => r.registrationId)
        : scopedRows.filter((r) => r.registrationId);
    if (rows.length === 0) {
      toast.error("Tidak ada peserta terdaftar untuk diekspor");
      return;
    }
    const csv = buildUktRecapCsv(rows, title);
    const slug = title.replace(/[^\w-]+/g, "-").slice(0, 40);
    triggerCsvDownload(`ukt-rekap-${slug}.csv`, csv);
    toast.success(`${rows.length} baris diekspor ke CSV`);
  };

  const openWaiverDialog = (row: UktMemberRow) => {
    const blockers = getUktRegistrationBlockersWithWaiver(
      row,
      { registrationOpen },
      null,
    ).filter((b) => b !== "PERIODE_TUTUP");
    setWaiverTarget(row);
    setWaiverBlockers(blockers);
    setWaiverNote("");
  };

  const handleSubmitWaiver = async () => {
    if (!waiverTarget || !props.selectedPeriodId || waiverBlockers.length === 0) {
      toast.error("Pilih syarat yang dikecualikan");
      return;
    }
    if (waiverNote.trim().length < 5) {
      toast.error("Catatan pengecualian minimal 5 karakter");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ukt/waiver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: props.selectedPeriodId,
          memberId: waiverTarget.memberId,
          blockers: waiverBlockers,
          note: waiverNote.trim(),
        }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan pengecualian");
      toast.success("Pengecualian pendaftaran disimpan");
      setWaiverTarget(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!props.selectedPeriodId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ukt/period", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: props.selectedPeriodId, title: periodTitle }),
      });
      if (!res.ok) {
        const data = await parseApiJson<{ error?: string }>(res);
        throw new Error(data.error);
      }
      toast.success("Label periode diperbarui");
      setEditingTitle(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const registrationTimeParts = splitTimeInput(registrationDeadlineTime || "00:00");

  const openRegistrationDeadlineDialog = () => {
    if (!registrationDeadlineIso) return;
    setRegistrationDeadlineDate(toDateInput(registrationDeadlineIso));
    setRegistrationDeadlineTime(toTimeInput(registrationDeadlineIso));
    setShowRegistrationDeadline(true);
  };

  const handleSaveRegistrationDeadline = async () => {
    if (!props.selectedPeriodId || !registrationDeadlineDate || !registrationDeadlineTime) return;
    const closeAt = combineDateAndTimeLocal(registrationDeadlineDate, registrationDeadlineTime);
    if (Number.isNaN(closeAt.getTime())) {
      toast.error("Batas pendaftaran tidak valid");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ukt/period", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: props.selectedPeriodId,
          registrationCloseAt: closeAt.toISOString(),
        }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan batas pendaftaran");
      toast.success("Batas pendaftaran UKT diperbarui");
      setShowRegistrationDeadline(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (memberId: string) => {
    if (!props.selectedPeriodId) {
      toast.error("Pilih atau buat periode UKT terlebih dahulu");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ukt/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: props.selectedPeriodId, memberId }),
      });
      const data = await parseApiJson<{ error?: string; success?: boolean }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal mendaftarkan anggota");
      toast.success("Anggota berhasil didaftarkan dan disetujui otomatis");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mendaftarkan");
    } finally {
      setLoading(false);
    }
  };

  const handleKyuUpdate = async (
    registrationId: string,
    newRank: string,
    row: UktMemberRow,
  ) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ukt/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newRank,
          action: "approve",
          eventId: props.selectedPeriodId,
          memberId: row.memberId,
          previousRank:
            row.kyuLama && row.kyuLama !== "—" ? row.kyuLama : undefined,
        }),
      });
      const data = await parseApiJson<{ error?: string; message?: string; kyuBaru?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui kyu");
      const paid =
        row.billingStatus === "PAID" ||
        row.status === "PAID" ||
        row.status === "SUCCESS";
      toast.success(
        paid
          ? `Kyu Baru diisi — status Selesai: ${formatRankLabel(newRank)}`
          : data.message || `Sabuk diperbarui: ${formatRankLabel(newRank)}`,
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const handleExamResult = async (
    registrationId: string,
    examResult: "LULUS" | "GAGAL" | "MENGULANG",
  ) => {
    if (!props.selectedPeriodId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ukt/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: props.selectedPeriodId, examResult }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan hasil ujian");
      toast.success(`Hasil ujian disimpan: ${examResult}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRegistration = async (registrationId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ukt/registrations/${registrationId}`, {
        method: "DELETE",
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal membatalkan");
      toast.success("Peserta berhasil dibatalkan dari UKT");
      setCancelTarget(null);
      setSelectedMember(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membatalkan");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBeltFees = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ukt/fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...beltFees, komisiRanting }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan biaya sabuk");
      toast.success("Biaya sabuk berhasil disimpan");
      setShowBeltFees(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (row: UktMemberRow) => {
    if (!row.registrationId) return;
    setLoading(true);
    try {
      if (row.billingId) {
        const res = await fetch(`/api/admin/billing/${row.billingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        });
        const data = await parseApiJson<{ error?: string }>(res);
        if (!res.ok) throw new Error(data.error || "Gagal verifikasi pembayaran");
      } else {
        const res = await fetch(`/api/admin/ukt/registrations/${row.registrationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_paid" }),
        });
        const data = await parseApiJson<{ error?: string }>(res);
        if (!res.ok) throw new Error(data.error || "Gagal menandai lunas");
      }
      toast.success(
        row.kyuBaru
          ? "Pembayaran diverifikasi — status Selesai"
          : "Pembayaran diverifikasi. Isi sabuk target untuk menyelesaikan.",
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkMarkPaid = async () => {
    const targets = selectedRows.filter(
      (r) => r.registrationId && isUktBillingUnpaid(r),
    );
    if (targets.length === 0) {
      toast.error("Pilih peserta yang belum lunas");
      return;
    }
    setLoading(true);
    let ok = 0;
    try {
      for (const row of targets) {
        try {
          if (row.billingId) {
            const res = await fetch(`/api/admin/billing/${row.billingId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "approve" }),
            });
            if (res.ok) ok += 1;
          } else if (row.registrationId) {
            const res = await fetch(`/api/admin/ukt/registrations/${row.registrationId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "mark_paid" }),
            });
            if (res.ok) ok += 1;
          }
        } catch {
          /* continue */
        }
      }
      toast.success(`${ok}/${targets.length} pembayaran diverifikasi`);
      setSelectedIds(new Set());
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const openPrintNota = (onlySelected: boolean) => {
    if (onlySelected && selectedRows.length === 0) {
      toast.error("Pilih peserta yang akan masuk nota");
      return;
    }
    setPrintOnlySelected(onlySelected);
    setShowPrint(true);
  };

  const loadMemberHistory = async (memberId: string) => {
    try {
      const res = await fetch(`/api/admin/ukt/members?memberId=${memberId}`);
      const data = await parseApiJson<{ error?: string; member?: Record<string, unknown> }>(res);
      if (!res.ok) throw new Error(data.error);
      setMemberHistory(data.member ?? null);
    } catch {
      toast.error("Gagal memuat riwayat anggota");
    }
  };

  const buildWaReport = () => {
    if (!effectiveDojo && isCabang) {
      const text = buildUktBranchRecapText(
        selectedPeriod?.title || periodTitle,
        dojoRecaps.filter((r) => r.totalMembers > 0),
      );
      navigator.clipboard.writeText(text).then(
        () => toast.success("Rekap cabang disalin — tempel di WhatsApp"),
        () => toast.error("Gagal menyalin"),
      );
      return;
    }
    const approved = props.allRows.filter(
      (r) => r.registrationId && isRegistrationApproved(r.status),
    );
    if (approved.length === 0) {
      toast.error("Belum ada peserta disetujui");
      return;
    }
    const dojoName = effectiveDojo
      ? props.dojos.find((d) => d.id === effectiveDojo)?.name || "Ranting"
      : "Semua Ranting";
    const lines = approved.map((r, i) => {
      const rk = formatRankLabel(r.kyuBaru || r.kyuLama);
      return `${i + 1}. ${formatMemberName(r.fullName)}${rk ? ` ${rk}` : ""}`;
    });
    let total = 0;
    approved.forEach((r) => {
      total += participantAmount(r.billingAmount, r.billingStatus, null);
    });
    const text = [
      selectedPeriod?.title || periodTitle,
      `Ranting/Dojo: ${dojoName}`,
      "",
      "Peserta yang terdaftar",
      ...lines,
      "",
      `Total pembayaran Rp ${new Intl.NumberFormat("id-ID").format(total)}`,
    ].join("\n");
    navigator.clipboard.writeText(text).then(
      () => toast.success("Laporan WA disalin — tempel di WhatsApp"),
      () => toast.error("Gagal menyalin"),
    );
  };

  const kpiCards = [
    { label: "Total Anggota", value: kpi.allMembers, icon: Users, color: "text-blue-600", filter: "all" },
    { label: "Belum Daftar", value: kpi.belumDaftar, icon: UserPlus, color: "text-amber-600", filter: "unregistered" },
    { label: "Belum Bayar", value: kpi.belumBayar, icon: Clock, color: "text-yellow-600", filter: "belum_bayar" },
    { label: "Menunggu Verif.", value: kpi.menungguVerifikasi, icon: Wallet, color: "text-purple-600", filter: "menunggu_verifikasi" },
    { label: "Menunggu Ujian", value: kpi.menungguUjian, icon: FileText, color: "text-indigo-600", filter: "menunggu_ujian" },
    { label: "Lulus", value: kpi.lulus, icon: CheckCircle2, color: "text-emerald-600", filter: "lulus" },
    { label: "Selesai", value: kpi.selesai, icon: Check, color: "text-green-600", filter: "selesai" },
    { label: "Gagal/Mengulang", value: kpi.gagal + kpi.mengulang, icon: XCircle, color: "text-red-600", filter: "gagal" },
  ];

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <Card className="border-inkai-red/20 bg-gradient-to-r from-background to-muted/30">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={props.semester}
              onValueChange={(v) => syncNavigateTerm({ semester: v as UktSemester })}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="I">Semester I</SelectItem>
                <SelectItem value="II">Semester II</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              className="w-24"
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              onBlur={() => {
                const y = parseInt(yearInput, 10);
                if (Number.isFinite(y) && y >= 2020 && y <= 2100) {
                  syncNavigateTerm({ year: y });
                } else {
                  setYearInput(String(props.year));
                }
              }}
              min={2020}
              max={2100}
            />
            {editingTitle && isCabang ? (
              <div className="flex items-center gap-1">
                <Input
                  value={periodTitle}
                  onChange={(e) => setPeriodTitle(e.target.value)}
                  className="min-w-48"
                />
                <Button size="sm" variant="ghost" onClick={handleSaveTitle} disabled={loading}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold">
                  {selectedPeriod?.title || formatUktPeriodLabel(props.semester, props.year)}
                </span>
                {isCabang && props.selectedPeriodId && (
                  <Button size="sm" variant="ghost" onClick={() => setEditingTitle(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {periodsForTerm.length > 1 && (
              <Select
                value={props.selectedPeriodId || ""}
                onValueChange={(v) =>
                  navigatePeriod({
                    semester: props.semester,
                    year: String(props.year),
                    period: v,
                  })
                }
              >
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Pilih periode" />
                </SelectTrigger>
                <SelectContent>
                  {periodsForTerm.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!props.selectedPeriodId && props.canCreatePeriod && (
              <Button
                onClick={() => {
                  setWizardStep(0);
                  setShowCreateWizard(true);
                }}
                disabled={loading}
                className="bg-inkai-red hover:bg-inkai-red/90"
              >
                <Plus className="mr-1 h-4 w-4" />
                Buat Periode
              </Button>
            )}
            {isCabang && props.selectedPeriodId && (
              <Button variant="outline" onClick={handleExportCsv}>
                <Download className="mr-1 h-4 w-4" />
                Export CSV
              </Button>
            )}
            <Button variant="outline" onClick={buildWaReport}>
              <MessageCircle className="mr-1 h-4 w-4" />
              Laporan WA
            </Button>
            <Button variant="outline" onClick={() => openPrintNota(false)}>
              <Printer className="mr-1 h-4 w-4" />
              Cetak Nota
            </Button>
            {(isDojoAdmin || isCabang) && selectedIds.size === 0 && (
              <Button
                variant="outline"
                onClick={() => openPrintNota(true)}
                disabled={selectedIds.size === 0}
              >
                <Printer className="mr-1 h-4 w-4" />
                Nota Terpilih
              </Button>
            )}
            {isCabang && (
              <Button variant="outline" onClick={() => setShowBeltFees(true)}>
                <Wallet className="mr-1 h-4 w-4" />
                Biaya Sabuk
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isDojoAdmin && !props.selectedPeriodId && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Periode UKT <b>{formatUktPeriodLabel(props.semester, props.year)}</b> belum
              dibuat oleh admin cabang. Pilih semester lain jika perlu melihat riwayat, atau
              hubungi cabang untuk membuka periode baru.
            </span>
          </CardContent>
        </Card>
      )}

      {props.selectedPeriodId && selectedPeriod && (
        <Card className="border-muted">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
              <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Batas pendaftaran:</span>
              <span className="font-medium">
                {registrationDeadlineIso
                  ? formatUktRegistrationDeadline(registrationDeadlineIso)
                  : "—"}
              </span>
              <Badge variant={registrationOpen ? "default" : "secondary"}>
                {registrationOpen ? "Masih terbuka" : "Sudah tutup"}
              </Badge>
              {isCabang && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={openRegistrationDeadlineDialog}
                  disabled={loading}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Atur
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {props.selectedPeriodId && !registrationOpen && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Batas waktu pendaftaran untuk periode ini sudah lewat.
                {isCabang
                  ? " Perpanjang batas pendaftaran agar ranting dapat mendaftarkan peserta."
                  : " Hubungi admin cabang untuk perpanjangan pendaftaran."}
              </span>
            </div>
            {isCabang && (
              <Button size="sm" onClick={openRegistrationDeadlineDialog} disabled={loading}>
                Perpanjang Batas
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(640px,94vw)] -translate-x-1/2">
          <Card className="shadow-xl">
            <CardContent className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-[120px] flex-1 text-sm text-muted-foreground">
                <span className="font-medium text-inkai-red">{selectedIds.size} terpilih</span>
              </div>
              {(isDojoAdmin || isCabang) && (
                <Button variant="outline" size="sm" onClick={() => openPrintNota(true)} disabled={loading}>
                  <Printer className="mr-1 h-4 w-4" />
                  Nota
                </Button>
              )}
              {isDojoAdmin && (
                <Button
                  size="sm"
                  className="bg-inkai-red hover:bg-inkai-red/90"
                  onClick={() => openPrintNota(true)}
                  disabled={loading}
                >
                  <Banknote className="mr-1 h-4 w-4" />
                  Siap Bayar
                </Button>
              )}
              {isCabang && selectedUnpaidCount > 0 && (
                <Button
                  size="sm"
                  className="bg-inkai-red hover:bg-inkai-red/90"
                  onClick={() => void handleBulkMarkPaid()}
                  disabled={loading}
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  Verifikasi ({selectedUnpaidCount})
                </Button>
              )}
              {isCabang && (
                <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={loading}>
                  <Download className="mr-1 h-4 w-4" />
                  CSV
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())} disabled={loading}>
                Tutup
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {kpiCards.map((card) => (
          <Card
            key={card.label}
            className={`cursor-pointer transition-all hover:shadow-md hover:ring-1 hover:ring-inkai-red/30 ${
              (localView === card.filter || (!localView && card.filter === "all")) ? "ring-2 ring-inkai-red" : ""
            }`}
            onClick={() => card.filter && handleKpiClick(card.filter)}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <card.icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-lg font-bold">{card.value}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {props.dbError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{props.dbError}</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => router.refresh()}>
              Muat Ulang
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search & inline filters */}
      <div className="flex flex-wrap items-center gap-2">
        <UktSearchBar
          allRows={props.allRows}
          value={localQ}
          onChange={(q) => {
            setLocalQ(q);
            setLocalPage(1);
          }}
          placeholder={
            localView === "registered"
              ? "Cari nama untuk daftarkan peserta UKT…"
              : "Cari nama atau NIA…"
          }
          showRegistrationStatus={localView === "registered"}
        />

        <Select
          value={localStatus || "all"}
          onValueChange={(v) => {
            setLocalStatus(v === "all" ? "" : v);
            setLocalPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {UKT_DISPLAY_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCompactView((v) => !v)}
          title={compactView ? "Tampilan lengkap" : "Tampilan ringkas"}
        >
          <LayoutList className="mr-1 h-4 w-4" />
          {compactView ? "Lengkap" : "Ringkas"}
        </Button>

        {!isDojoAdmin && (
          <Select
            value={localDojo || "all"}
            onValueChange={(v) => {
              setLocalDojo(v === "all" ? "" : v);
              setLocalPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Ranting" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua ranting</SelectItem>
              {props.dojos.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={String(localPageSize)}
          onValueChange={(v) => {
            setLocalPageSize(parseInt(v, 10));
            setLocalPage(1);
          }}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s} / hal
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="button" variant="outline" onClick={() => setShowAddMember(true)}>
          <UserPlus className="mr-1 h-4 w-4" />
          Tambah Anggota
        </Button>
      </div>

      {isDojoAdmin && (
        <Card className="border-muted">
          <CardContent className="p-3 text-sm text-muted-foreground">
            Centang peserta yang akan dibayar, lalu pakai <b>Nota Terpilih</b> /{" "}
            <b>Siap Bayar UKT</b> agar daftar selaras dengan nota. Cabang akan
            memverifikasi pembayaran dan mengisi Kyu Baru hingga status{" "}
            <b>Selesai</b>.
          </CardContent>
        </Card>
      )}

      {isCabang && (
        <Card className="border-muted">
          <CardContent className="p-3 text-sm text-muted-foreground">
            Verifikasi pembayaran (per baris atau massal), lalu isi{" "}
            <b>Kyu Baru</b>. Status menjadi <b>Selesai</b> setelah lunas +
            Kyu Baru terisi.
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <div className="mt-2 overflow-x-auto rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-inkai-red"
                  checked={allSelectableChecked}
                  onChange={toggleSelectAllSelectable}
                  title="Pilih semua yang belum lunas"
                  aria-label="Pilih semua yang belum lunas"
                />
              </TableHead>
              <TableHead className="w-10">No</TableHead>
              <TableHead className="w-14">Foto</TableHead>
              <TableHead>NIA</TableHead>
              <TableHead>Nama Lengkap</TableHead>
              {!compactView && !isDojoAdmin && (
                <>
                  <TableHead className="hidden md:table-cell">Tempat</TableHead>
                  <TableHead className="hidden lg:table-cell">Tgl Lahir</TableHead>
                  <TableHead className="hidden sm:table-cell">JK</TableHead>
                  <TableHead className="hidden xl:table-cell">Alamat</TableHead>
                </>
              )}
              <TableHead>Kyu Lama</TableHead>
              <TableHead>Kyu Baru</TableHead>
              {(compactView || isDojoAdmin) && (
                <>
                  <TableHead className="min-w-20">Kehadiran</TableHead>
                  <TableHead className="min-w-28">Syarat</TableHead>
                </>
              )}
              {!isDojoAdmin && !compactView && <TableHead className="hidden md:table-cell">Dokumen</TableHead>}
              {!isDojoAdmin && !compactView && <TableHead className="hidden sm:table-cell">Ranting</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead className="min-w-28">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={20} className="py-12 text-center text-muted-foreground">
                  {props.allRows.length === 0 && !props.dbError
                    ? "Belum ada anggota. Tambahkan anggota untuk memulai pendaftaran UKT."
                    : "Tidak ada data sesuai filter."}
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map((row, idx) => {
                const effectiveExam = resolveEffectiveUktExamResult(row);
                return (
                <TableRow
                  key={row.memberId}
                  className="group transition-colors hover:bg-muted/30"
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-inkai-red"
                      checked={selectedIds.has(row.memberId)}
                      disabled={
                        !row.registrationId ||
                        !isNotaParticipant(row.status) ||
                        !isUktBillingUnpaid(row)
                      }
                      onChange={() => toggleSelect(row.memberId)}
                      aria-label={`Pilih ${row.fullName}`}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(safePage - 1) * localPageSize + idx + 1}
                  </TableCell>
                  <TableCell>
                    <MemberAvatarRing
                      fullName={row.fullName}
                      currentRank={row.kyuBaru || row.kyuLama}
                      photoUrl={row.photoUrl}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.nia || "-"}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-medium text-inkai-red hover:underline"
                      onClick={() => {
                        setSelectedMember(row);
                        loadMemberHistory(row.memberId);
                      }}
                    >
                      {formatMemberName(row.fullName)}
                    </button>
                    {(row.outstandingDues > 0 || row.pendingVerifications > 0) && (
                      <span className="ml-1 inline-flex text-amber-500" title="Ada tanggungan">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </TableCell>
                  {!compactView && !isDojoAdmin && (
                    <>
                      <TableCell className="hidden md:table-cell">{row.birthPlace || "-"}</TableCell>
                      <TableCell className="hidden lg:table-cell">{formatDate(row.birthDate)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {formatGenderLabel(row.gender) || "-"}
                      </TableCell>
                      <TableCell className="hidden max-w-32 truncate xl:table-cell">{row.address || "-"}</TableCell>
                    </>
                  )}
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {formatRankLabel(row.kyuLama) || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.registrationId && isCabang ? (
                      <select
                        className="h-7 max-w-36 rounded border px-1 text-xs"
                        value={row.kyuBaru ? formatRankLabel(row.kyuBaru) : ""}
                        onChange={(e) =>
                          handleKyuUpdate(row.registrationId!, e.target.value, row)
                        }
                        disabled={loading}
                      >
                        <option value="">— Pilih —</option>
                        {BELT_RANK_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm">
                        {row.kyuBaru ? formatRankLabel(row.kyuBaru) : "-"}
                      </span>
                    )}
                  </TableCell>
                  {(compactView || isDojoAdmin) && (
                    <>
                      <TableCell className="text-xs">
                        {row.attendancePct != null ? (
                          <span
                            className={
                              row.attendancePct >= UKT_MIN_ATTENDANCE_PCT
                                ? "text-emerald-600"
                                : "text-amber-600"
                            }
                          >
                            {row.attendancePct}%
                            <span className="block text-muted-foreground">{row.attendanceCount}×</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {(() => {
                          const eligibility = summarizeRowEligibility(row, registrationOpen);
                          return (
                            <span
                              className={eligibility.ok ? "text-emerald-600" : "text-amber-700"}
                              title={eligibility.label}
                            >
                              {eligibility.ok ? "✓" : "!"}{" "}
                              {eligibility.label.length > 28
                                ? `${eligibility.label.slice(0, 28)}…`
                                : eligibility.label}
                            </span>
                          );
                        })()}
                      </TableCell>
                    </>
                  )}
                  {!isDojoAdmin && !compactView && (
                    <TableCell className="hidden md:table-cell">
                      <div className="flex gap-1">
                        {row.birthCertificateUrl ? (
                          <a href={row.birthCertificateUrl} target="_blank" rel="noreferrer">
                            <Badge variant="outline" className="text-xs">Akte</Badge>
                          </a>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Akte</Badge>
                        )}
                        {row.bpjsCardUrl ? (
                          <a href={row.bpjsCardUrl} target="_blank" rel="noreferrer">
                            <Badge variant="outline" className="text-xs">BPJS</Badge>
                          </a>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">BPJS</Badge>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {!isDojoAdmin && !compactView && (
                    <TableCell className="hidden sm:table-cell text-xs">{row.dojoName}</TableCell>
                  )}
                  <TableCell>
                    <div className="space-y-1">
                      {statusBadge(row)}
                      {row.billingAmount != null && (
                        <p className="text-xs text-muted-foreground">
                          {formatRupiah(row.billingAmount)}
                          {row.billingStatus === "PAID"
                            ? " · Lunas"
                            : row.billingStatus === "WAITING_VERIFICATION"
                              ? " · Menunggu"
                              : row.billingStatus === "PENDING"
                                ? " · Belum bayar"
                                : ""}
                        </p>
                      )}
                      {effectiveExam && (
                        <p className="text-xs text-muted-foreground">
                          Hasil ujian: {effectiveExam === "LULUS" ? "Lulus" : effectiveExam}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {!row.registrationId ? (
                        (() => {
                          const blockers = getUktRegistrationBlockersWithWaiver(
                            row,
                            { registrationOpen },
                            row.registrationWaiver,
                          );
                          const blocked = blockers.length > 0;
                          return (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => handleRegister(row.memberId)}
                                disabled={loading || !props.selectedPeriodId || blocked}
                                title={
                                  blocked ? formatUktRegistrationBlockers(blockers) : "Daftarkan ke UKT"
                                }
                              >
                                Daftar UKT
                              </Button>
                              {isCabang && blocked && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => openWaiverDialog(row)}
                                  disabled={loading}
                                  title="Berikan pengecualian syarat pendaftaran"
                                >
                                  <ShieldCheck className="mr-0.5 h-3 w-3" />
                                  Waiver
                                </Button>
                              )}
                            </>
                          );
                        })()
                      ) : (
                        <>
                          {isCabang && isUktBillingUnpaid(row) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => void handleMarkPaid(row)}
                              disabled={loading}
                              title="Verifikasi pembayaran UKT"
                            >
                              <CheckCircle2 className="mr-0.5 h-3 w-3" />
                              Verifikasi
                            </Button>
                          )}
                          {isCabang &&
                            (row.billingStatus === "PAID" || row.status === "PAID" || row.status === "SUCCESS") && (
                              <Select
                                value={effectiveExam || "PENDING"}
                                onValueChange={(v) => {
                                  if (v === "PENDING") return;
                                  void handleExamResult(
                                    row.registrationId!,
                                    v as "LULUS" | "GAGAL" | "MENGULANG",
                                  );
                                }}
                              >
                                <SelectTrigger className="h-7 w-[148px] text-xs">
                                  <SelectValue placeholder="Hasil ujian" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PENDING">Hasil Ujian</SelectItem>
                                  <SelectItem value="LULUS">Hasil Ujian Lulus</SelectItem>
                                  <SelectItem value="GAGAL">Tidak Lulus</SelectItem>
                                  <SelectItem value="MENGULANG">Mengulang</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          {canCancelUktRegistration(row) && (isDojoAdmin || isCabang) && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs"
                              onClick={() =>
                                setCancelTarget({
                                  id: row.registrationId!,
                                  name: row.fullName,
                                })
                              }
                              disabled={loading}
                              title="Batalkan pendaftaran UKT"
                            >
                              <Trash2 className="mr-0.5 h-3 w-3" />
                              Batal
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Halaman {safePage} dari {totalPages} ({totalFiltered} data)
          </p>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={safePage <= 1}
              onClick={() => setLocalPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const start = Math.max(1, Math.min(safePage - 3, totalPages - 6));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <Button
                  key={p}
                  size="sm"
                  variant={p === safePage ? "default" : "outline"}
                  className={p === safePage ? "bg-inkai-red" : ""}
                  onClick={() => setLocalPage(p)}
                >
                  {p}
                </Button>
              );
            })}
            <Button
              size="sm"
              variant="outline"
              disabled={safePage >= totalPages}
              onClick={() => setLocalPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Member detail drawer */}
      <Dialog open={!!selectedMember} onOpenChange={(o) => !o && setSelectedMember(null)}>
        <DialogContent className="max-w-lg sm:max-w-xl">
          {selectedMember && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <MemberAvatarRing
                    fullName={selectedMember.fullName}
                    currentRank={selectedMember.kyuLama}
                    photoUrl={selectedMember.photoUrl}
                  />
                  {formatMemberName(selectedMember.fullName)}
                </DialogTitle>
                <DialogDescription>
                  NIA: {selectedMember.nia || "-"} · {selectedMember.dojoName}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Tempat Lahir:</span> {selectedMember.birthPlace || "-"}</div>
                  <div><span className="text-muted-foreground">Tgl Lahir:</span> {formatDate(selectedMember.birthDate)}</div>
                  <div><span className="text-muted-foreground">Jenis Kelamin:</span> {formatGenderLabel(selectedMember.gender) || "-"}</div>
                  <div><span className="text-muted-foreground">Kyu Lama:</span> {formatRankLabel(selectedMember.kyuLama) || "—"}</div>
                  <div><span className="text-muted-foreground">Kyu Baru:</span> {selectedMember.kyuBaru ? formatRankLabel(selectedMember.kyuBaru) : "—"}</div>
                </div>
                {selectedMember.outstandingDues > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/20">
                    <div className="flex items-center gap-2 font-medium text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                      Tanggungan Iuran: {selectedMember.outstandingDues} tagihan belum lunas
                    </div>
                  </div>
                )}
                {selectedMember.attendancePct != null && (
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <div className="font-medium">
                      Kehadiran semester: {selectedMember.attendancePct}% ({selectedMember.attendanceCount} hadir)
                    </div>
                  </div>
                )}
                {memberHistory && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-1 font-medium">
                      <History className="h-4 w-4" /> Riwayat
                    </h4>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded border p-2 text-xs">
                      {(memberHistory as { ranks?: { rank: string; date: string }[] }).ranks?.map((r, i) => (
                        <div key={i}>{formatDate(r.date)} — {r.rank}</div>
                      ))}
                      {(memberHistory as { eventRegistrations?: { event: { title: string }; status: string }[] }).eventRegistrations?.map((er, i) => (
                        <div key={`e${i}`}>{er.event.title} — {er.status}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                {selectedMember.registrationId && canCancelUktRegistration(selectedMember) && (isDojoAdmin || isCabang) && (
                  <Button
                    variant="destructive"
                    onClick={() =>
                      setCancelTarget({
                        id: selectedMember.registrationId!,
                        name: selectedMember.fullName,
                      })
                    }
                    disabled={loading}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Batalkan UKT
                  </Button>
                )}
                {!selectedMember.registrationId && (
                  (() => {
                    const blockers = getUktRegistrationBlockersWithWaiver(
                      selectedMember,
                      { registrationOpen },
                      selectedMember.registrationWaiver,
                    );
                    const blocked = blockers.length > 0;
                    return (
                  <Button
                    className="bg-inkai-red"
                    onClick={() => {
                      handleRegister(selectedMember.memberId);
                      setSelectedMember(null);
                    }}
                    disabled={loading || !props.selectedPeriodId || blocked}
                    title={blocked ? formatUktRegistrationBlockers(blockers) : "Daftar UKT"}
                  >
                    Daftar UKT
                  </Button>
                    );
                  })()
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Batalkan Pendaftaran UKT?</DialogTitle>
            <DialogDescription>
              Peserta <strong>{cancelTarget?.name}</strong> akan dihapus dari daftar UKT periode ini.
              Tagihan yang belum lunas ikut dibatalkan. Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={loading}>
              Tutup
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelTarget && handleCancelRegistration(cancelTarget.id)}
              disabled={loading}
            >
              Ya, Batalkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add member modal */}
      <AddMemberDialog
        open={showAddMember}
        onOpenChange={setShowAddMember}
        dojos={props.dojos}
        defaultDojoId={effectiveDojo}
        lockDojo={isDojoAdmin}
        apiPath="/api/admin/ukt/members"
      />

      {/* Print modal */}
      {showPrint && (
        <UktPrintModal
          open={showPrint}
          onClose={() => {
            setShowPrint(false);
            setPrintOnlySelected(false);
          }}
          periodTitle={selectedPeriod?.title || periodTitle}
          semester={props.semester}
          year={props.year}
          rows={(printOnlySelected && selectedRows.length > 0
            ? selectedRows
            : props.allRows
          ).filter((r) => r.registrationId && isNotaParticipant(r.status))}
          dojos={props.dojos}
          dojoFilter={effectiveDojo}
          beltFees={beltFees}
          komisiRanting={komisiRanting}
          isDojoAdmin={isDojoAdmin}
        />
      )}

      <Dialog open={showRegistrationDeadline} onOpenChange={setShowRegistrationDeadline}>
        <DialogContent className="max-w-sm gap-4">
          <DialogHeader>
            <DialogTitle>Batas Pendaftaran UKT</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="ukt-registration-date" className="text-sm font-medium">
                Tanggal
              </label>
              <Input
                id="ukt-registration-date"
                type="date"
                lang="id-ID"
                value={registrationDeadlineDate}
                onChange={(e) => setRegistrationDeadlineDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Jam</label>
              <div className="flex items-center gap-1.5">
                <Select
                  value={registrationTimeParts.hour}
                  onValueChange={(hour) =>
                    setRegistrationDeadlineTime(
                      joinTimeInput(hour, registrationTimeParts.minute),
                    )
                  }
                >
                  <SelectTrigger className="w-[4.5rem]">
                    <SelectValue placeholder="JJ" />
                  </SelectTrigger>
                  <SelectContent className="max-h-52">
                    {HOURS_24.map((hour) => (
                      <SelectItem key={hour} value={hour}>
                        {hour}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm font-semibold text-muted-foreground">.</span>
                <Select
                  value={registrationTimeParts.minute}
                  onValueChange={(minute) =>
                    setRegistrationDeadlineTime(
                      joinTimeInput(registrationTimeParts.hour, minute),
                    )
                  }
                >
                  <SelectTrigger className="w-[4.5rem]">
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent className="max-h-52">
                    {MINUTES_60.map((minute) => (
                      <SelectItem key={minute} value={minute}>
                        {minute}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowRegistrationDeadline(false)} disabled={loading}>
              Batal
            </Button>
            <Button className="bg-inkai-red" onClick={handleSaveRegistrationDeadline} disabled={loading}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBeltFees} onOpenChange={setShowBeltFees}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Atur Biaya Sabuk UKT</DialogTitle>
            <DialogDescription>
              Nominal biaya sabuk dan komisi ranting ditentukan oleh admin cabang untuk pendaftaran serta cetak nota.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {BELT_FEE_KEYS.map((belt) => (
              <div key={belt} className="flex items-center gap-3">
                <span className="w-20 text-sm font-medium">{belt}</span>
                <Input
                  type="number"
                  value={beltFees[belt]}
                  onChange={(e) =>
                    setBeltFees((prev) => ({
                      ...prev,
                      [belt]: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatRupiahNota(beltFees[belt])}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-3 border-t pt-3">
              <span className="w-20 text-sm font-medium">Komisi</span>
              <Input
                type="number"
                value={komisiRanting}
                onChange={(e) => setKomisiRanting(parseInt(e.target.value, 10) || 0)}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatRupiahNota(komisiRanting)} / orang
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBeltFees(false)}>
              Batal
            </Button>
            <Button className="bg-inkai-red" onClick={handleSaveBeltFees} disabled={loading}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateWizard} onOpenChange={setShowCreateWizard}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Wizard Periode UKT Baru</DialogTitle>
            <DialogDescription>
              Langkah {wizardStep + 1} dari 3 — {formatUktPeriodLabel(props.semester, props.year)}
            </DialogDescription>
          </DialogHeader>
          {wizardStep === 0 && (
            <div className="space-y-3 text-sm">
              <p>
                Periode <b>{formatUktPeriodLabel(props.semester, props.year)}</b> akan dibuat
                sebagai event UKT terpisah dengan batas pendaftaran default akhir semester.
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Judul periode
                </label>
                <Input value={periodTitle} onChange={(e) => setPeriodTitle(e.target.value)} />
              </div>
            </div>
          )}
          {wizardStep === 1 && (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Pastikan biaya sabuk & komisi ranting sudah benar sebelum membuka periode.
              </p>
              {BELT_FEE_KEYS.map((belt) => (
                <div key={belt} className="flex justify-between gap-2">
                  <span>{belt}</span>
                  <span className="font-medium">{formatRupiahNota(beltFees[belt])}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2">
                <span>Komisi ranting</span>
                <span className="font-medium">{formatRupiahNota(komisiRanting)} / orang</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowBeltFees(true)}>
                Ubah biaya sabuk
              </Button>
            </div>
          )}
          {wizardStep === 2 && (
            <div className="space-y-2 text-sm">
              <p>Siap membuat periode dengan ringkasan berikut:</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Judul: {periodTitle}</li>
                <li>Semester {props.semester} · Tahun {props.year}</li>
                <li>Ketua ranting dapat mendaftarkan anggota setelah periode aktif</li>
                <li>Notifikasi otomatis dikirim saat status UKT berubah</li>
              </ul>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                if (wizardStep === 0) setShowCreateWizard(false);
                else setWizardStep((s) => s - 1);
              }}
              disabled={loading}
            >
              {wizardStep === 0 ? "Batal" : "Kembali"}
            </Button>
            {wizardStep < 2 ? (
              <Button className="bg-inkai-red" onClick={() => setWizardStep((s) => s + 1)}>
                Lanjut
              </Button>
            ) : (
              <Button className="bg-inkai-red" onClick={() => void handleCreatePeriod()} disabled={loading}>
                Buat Periode
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!waiverTarget} onOpenChange={(o) => !o && setWaiverTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pengecualian Syarat UKT</DialogTitle>
            <DialogDescription>
              {waiverTarget ? formatMemberName(waiverTarget.fullName) : ""} — hanya admin cabang
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Pilih syarat yang dikecualikan:</p>
            {(["IURAN_TUNGGAKAN", "DOKUMEN_KURANG", "ABSENSI_KURANG"] as UktRegistrationBlocker[]).map(
              (key) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-inkai-red"
                    checked={waiverBlockers.includes(key)}
                    onChange={(e) => {
                      setWaiverBlockers((prev) =>
                        e.target.checked ? [...prev, key] : prev.filter((b) => b !== key),
                      );
                    }}
                  />
                  {key === "IURAN_TUNGGAKAN" && "Iuran tunggak"}
                  {key === "DOKUMEN_KURANG" && "Dokumen kurang"}
                  {key === "ABSENSI_KURANG" && "Absensi di bawah 75%"}
                </label>
              ),
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Catatan audit (wajib)
              </label>
              <textarea
                className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={waiverNote}
                onChange={(e) => setWaiverNote(e.target.value)}
                placeholder="Alasan pengecualian untuk arsip pengurus…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWaiverTarget(null)}>
              Batal
            </Button>
            <Button className="bg-inkai-red" onClick={() => void handleSubmitWaiver()} disabled={loading}>
              Simpan Pengecualian
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

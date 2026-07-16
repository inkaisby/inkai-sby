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
  shortRankLabel,
} from "@/lib/belt";
import {
  type UktMemberRow,
  type UktSemester,
  type BeltFeeKey,
  BELT_FEE_KEYS,
  formatRupiahNota,
  isRegistrationApproved,
  isNotaParticipant,
  filterUktRowsByView,
  formatUktPeriodLabel,
  participantAmount,
  computeUktKpiStats,
  formatUktRegistrationDeadline,
  getUktRegistrationDeadline,
  isUktRegistrationOpen,
  toDateInput,
  toTimeInput,
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
  invoiceAcks: Record<string, { acknowledged: boolean; at: string; by: string }>;
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

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    PENDING: { label: "Terdaftar", variant: "default" },
    APPROVED: { label: "Disetujui", variant: "default" },
    PAID: { label: "Lunas", variant: "default" },
    SUCCESS: { label: "Lunas", variant: "default" },
    REJECTED: { label: "Ditolak", variant: "destructive" },
    BELUM_DAFTAR: { label: "Belum Daftar", variant: "outline" },
  };
  const s = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
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

  const isCabang = canEditKyuBaru(props.userRoles);
  const isDojoAdmin = props.primaryRole === "ADMIN_DOJO";

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
    if (localStatus) rows = rows.filter((r) => r.status === localStatus);
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

  const kpi = useMemo(() => computeUktKpiStats(scopedRows), [scopedRows]);

  const filteredRows = useMemo(() => {
    // Saat view "Terdaftar UKT" + pencarian aktif, tampilkan semua peserta yang cocok
    // agar admin bisa mendaftarkan anggota baru lewat tombol Daftar UKT.
    const viewFilter =
      localView === "registered" && localQ.trim() ? "" : localView;
    return filterUktRowsByView(scopedRows, viewFilter);
  }, [scopedRows, localView, localQ]);

  const totalFiltered = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / localPageSize));
  const safePage = Math.min(localPage, totalPages);
  const displayRows = useMemo(() => {
    const start = (safePage - 1) * localPageSize;
    return filteredRows.slice(start, start + localPageSize);
  }, [filteredRows, safePage, localPageSize]);

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

  const handleKpiClick = (filter: string) => {
    const next =
      !filter || filter === "all" || localView === filter ? "" : filter;
    setLocalView(next);
    setLocalPage(1);
  };

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
      navigatePeriod({ period: data.event?.id ?? "" });
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

  const handleKyuUpdate = async (registrationId: string, newRank: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ukt/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newRank, action: "approve" }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui kyu");
      toast.success("Kyu Baru diperbarui");
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

  const handleCreateInvoice = async () => {
    if (!props.selectedPeriodId || !effectiveDojo) {
      toast.error("Pilih ranting terlebih dahulu");
      return;
    }
    const memberIds = props.allRows
      .filter((r) => r.registrationId && r.dojoId === effectiveDojo)
      .map((r) => r.memberId);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ukt/invoice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: props.selectedPeriodId, dojoId: effectiveDojo, memberIds }),
      });
      const data = await parseApiJson<{ error?: string; created?: number }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal membuat invoice");
      toast.success(`${data.created ?? 0} invoice dibuat`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const handleAckInvoice = async (dojoId: string) => {
    if (!props.selectedPeriodId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ukt/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: props.selectedPeriodId, dojoId, acknowledged: true }),
      });
      if (!res.ok) {
        const data = await parseApiJson<{ error?: string }>(res);
        throw new Error(data.error);
      }
      toast.success("Invoice ditandai diterima");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
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
      const rk = shortRankLabel(r.kyuBaru || r.kyuLama);
      return `${i + 1}. ${r.fullName}${rk ? ` ${rk}` : ""}`;
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
    { label: "Terdaftar UKT", value: kpi.total, icon: FileText, color: "text-indigo-600", filter: "registered" },
    { label: "Belum Daftar", value: kpi.belumDaftar, icon: UserPlus, color: "text-amber-600", filter: "unregistered" },
    { label: "Disetujui/Lunas", value: kpi.disetujui, icon: CheckCircle2, color: "text-green-600", filter: "approved" },
    { label: "Belum Lunas", value: kpi.pending, icon: Clock, color: "text-yellow-600", filter: "pending" },
    { label: "Total Tagihan", value: `Rp ${(kpi.totalTagihan / 1000).toFixed(0)}rb`, icon: Wallet, color: "text-purple-600", filter: "" },
    { label: "Terbayar", value: `Rp ${(kpi.totalTerbayar / 1000).toFixed(0)}rb`, icon: Banknote, color: "text-emerald-600", filter: "paid" },
    { label: "Ditolak", value: kpi.ditolak, icon: XCircle, color: "text-red-600", filter: "rejected" },
  ];

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <Card className="border-inkai-red/20 bg-gradient-to-r from-background to-muted/30">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={props.semester}
              onValueChange={(v) => navigatePeriod({ semester: v })}
              disabled={isDojoAdmin}
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
                if (isDojoAdmin) {
                  setYearInput(String(props.year));
                  return;
                }
                const y = parseInt(yearInput, 10);
                if (Number.isFinite(y) && y >= 2020 && y <= 2100) {
                  navigatePeriod({ year: String(y) });
                } else {
                  setYearInput(String(props.year));
                }
              }}
              min={2020}
              max={2100}
              disabled={isDojoAdmin}
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
            {props.periods.length > 0 && (
              <Select
                value={props.selectedPeriodId || ""}
                onValueChange={(v) => navigatePeriod({ period: v })}
                disabled={isDojoAdmin}
              >
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Pilih periode" />
                </SelectTrigger>
                <SelectContent>
                  {props.periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!props.selectedPeriodId && props.canCreatePeriod && (
              <Button onClick={handleCreatePeriod} disabled={loading} className="bg-inkai-red hover:bg-inkai-red/90">
                <Plus className="mr-1 h-4 w-4" />
                Buat Periode
              </Button>
            )}
            <Button variant="outline" onClick={buildWaReport}>
              <MessageCircle className="mr-1 h-4 w-4" />
              Laporan WA
            </Button>
            <Button variant="outline" onClick={() => setShowPrint(true)}>
              <Printer className="mr-1 h-4 w-4" />
              Cetak Nota
            </Button>
            {isCabang && (
              <Button variant="outline" onClick={() => setShowBeltFees(true)}>
                <Wallet className="mr-1 h-4 w-4" />
                Biaya Sabuk
              </Button>
            )}
            {isCabang && props.selectedPeriodId && (
              <Button variant="outline" onClick={handleCreateInvoice} disabled={loading}>
                <FileText className="mr-1 h-4 w-4" />
                Buat Invoice
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="BELUM_DAFTAR">Belum Daftar</SelectItem>
            <SelectItem value="PENDING">Terdaftar</SelectItem>
            <SelectItem value="APPROVED">Disetujui</SelectItem>
            <SelectItem value="PAID">Lunas</SelectItem>
            <SelectItem value="REJECTED">Ditolak</SelectItem>
          </SelectContent>
        </Select>

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

      {/* Invoice ack banner for ketua ranting */}
      {isDojoAdmin &&
        effectiveDojo &&
        props.selectedPeriodId &&
        !props.invoiceAcks[effectiveDojo]?.acknowledged && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span>Invoice UKT dari cabang belum ditandai diterima</span>
              </div>
              <Button size="sm" onClick={() => handleAckInvoice(effectiveDojo)} disabled={loading}>
                <Check className="mr-1 h-4 w-4" />
                Tandai Diterima
              </Button>
            </CardContent>
          </Card>
        )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">No</TableHead>
              <TableHead className="w-14">Foto</TableHead>
              <TableHead>NIA</TableHead>
              <TableHead>Nama Lengkap</TableHead>
              <TableHead className="hidden md:table-cell">Tempat</TableHead>
              <TableHead className="hidden lg:table-cell">Tgl Lahir</TableHead>
              <TableHead className="hidden sm:table-cell">JK</TableHead>
              <TableHead className="hidden xl:table-cell">Alamat</TableHead>
              <TableHead>Kyu Lama</TableHead>
              <TableHead>Kyu Baru</TableHead>
              <TableHead className="hidden md:table-cell">Dokumen</TableHead>
              <TableHead className="hidden sm:table-cell">Ranting</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="min-w-28">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="py-12 text-center text-muted-foreground">
                  {props.allRows.length === 0 && !props.dbError
                    ? "Belum ada anggota. Tambahkan anggota untuk memulai pendaftaran UKT."
                    : "Tidak ada data sesuai filter."}
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map((row, idx) => (
                <TableRow
                  key={row.memberId}
                  className="group transition-colors hover:bg-muted/30"
                >
                  <TableCell className="text-muted-foreground">
                    {(safePage - 1) * localPageSize + idx + 1}
                  </TableCell>
                  <TableCell>
                    <MemberAvatarRing
                      fullName={row.fullName}
                      currentRank={row.kyuLama}
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
                      {row.fullName}
                    </button>
                    {(row.outstandingDues > 0 || row.pendingVerifications > 0) && (
                      <span className="ml-1 inline-flex text-amber-500" title="Ada tanggungan">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{row.birthPlace || "-"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{formatDate(row.birthDate)}</TableCell>
                  <TableCell className="hidden sm:table-cell">{row.gender || "-"}</TableCell>
                  <TableCell className="hidden max-w-32 truncate xl:table-cell">{row.address || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {shortRankLabel(row.kyuLama)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.registrationId && isCabang ? (
                      <select
                        className="h-7 max-w-36 rounded border px-1 text-xs"
                        value={row.kyuBaru || ""}
                        onChange={(e) => handleKyuUpdate(row.registrationId!, e.target.value)}
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
                      <span className="text-sm">{row.kyuBaru ? shortRankLabel(row.kyuBaru) : "-"}</span>
                    )}
                  </TableCell>
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
                  <TableCell className="hidden sm:table-cell text-xs">{row.dojoName}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {statusBadge(row.registrationId ? row.status : "BELUM_DAFTAR")}
                      {row.billingAmount != null && (
                        <p className="text-xs text-muted-foreground">
                          {formatRupiah(row.billingAmount)}
                          {row.billingStatus === "PAID" ? " · Lunas" : row.billingStatus === "WAITING_VERIFICATION" ? " · Menunggu" : ""}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {!row.registrationId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleRegister(row.memberId)}
                          disabled={loading || !props.selectedPeriodId}
                        >
                          Daftar UKT
                        </Button>
                      ) : (
                        <>
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
              ))
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
                  {selectedMember.fullName}
                </DialogTitle>
                <DialogDescription>
                  NIA: {selectedMember.nia || "-"} · {selectedMember.dojoName}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Tempat Lahir:</span> {selectedMember.birthPlace || "-"}</div>
                  <div><span className="text-muted-foreground">Tgl Lahir:</span> {formatDate(selectedMember.birthDate)}</div>
                  <div><span className="text-muted-foreground">Jenis Kelamin:</span> {selectedMember.gender || "-"}</div>
                  <div><span className="text-muted-foreground">Kyu Lama:</span> {selectedMember.kyuLama}</div>
                </div>
                {selectedMember.outstandingDues > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/20">
                    <div className="flex items-center gap-2 font-medium text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                      Tanggungan Iuran: {selectedMember.outstandingDues} tagihan belum lunas
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
                  <Button
                    className="bg-inkai-red"
                    onClick={() => {
                      handleRegister(selectedMember.memberId);
                      setSelectedMember(null);
                    }}
                    disabled={loading || !props.selectedPeriodId}
                  >
                    Daftar UKT
                  </Button>
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
          onClose={() => setShowPrint(false)}
          periodTitle={selectedPeriod?.title || periodTitle}
          semester={props.semester}
          year={props.year}
          rows={props.allRows.filter((r) => r.registrationId && isNotaParticipant(r.status))}
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
    </div>
  );
}

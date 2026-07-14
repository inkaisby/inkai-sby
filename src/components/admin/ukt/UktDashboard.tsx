"use client";

import { useCallback, useMemo, useState } from "react";
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
import {
  BELT_RANK_OPTIONS,
  canEditKyuBaru,
  shortRankLabel,
} from "@/lib/belt";
import {
  type UktMemberRow,
  type UktSemester,
  isRegistrationApproved,
  participantAmount,
  formatUktPeriodLabel,
} from "@/lib/ukt";

export type UktPeriod = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
};

export type UktDojo = { id: string; name: string };

type Props = {
  periods: UktPeriod[];
  selectedPeriodId: string | null;
  rows: UktMemberRow[];
  dojos: UktDojo[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  statusFilter: string;
  dojoFilter: string;
  viewFilter: string;
  userRoles: string[];
  primaryRole: string;
  semester: UktSemester;
  year: number;
  invoiceAcks: Record<string, { acknowledged: boolean; at: string; by: string }>;
  canCreatePeriod: boolean;
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

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    PENDING: { label: "Pending", variant: "secondary" },
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
  const [editingTitle, setEditingTitle] = useState(false);
  const [periodTitle, setPeriodTitle] = useState(
    props.periods.find((p) => p.id === props.selectedPeriodId)?.title ||
      formatUktPeriodLabel(props.semester, props.year),
  );
  const [selectedMember, setSelectedMember] = useState<UktMemberRow | null>(null);
  const [memberHistory, setMemberHistory] = useState<Record<string, unknown> | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newMember, setNewMember] = useState({
    fullName: "",
    gender: "",
    birthPlace: "",
    birthDate: "",
    address: "",
  });

  const isCabang = canEditKyuBaru(props.userRoles);
  const isDojoAdmin = props.primaryRole === "ADMIN_DOJO";
  const selectedPeriod = props.periods.find((p) => p.id === props.selectedPeriodId);

  const kpi = useMemo(() => {
    const registered = props.rows.filter((r) => r.registrationId);
    const total = registered.length;
    const disetujui = registered.filter((r) => isRegistrationApproved(r.status)).length;
    const pending = registered.filter((r) => r.status === "PENDING").length;
    const ditolak = registered.filter((r) => r.status === "REJECTED").length;
    let totalTagihan = 0;
    let totalTerbayar = 0;
    registered.forEach((r) => {
      const amt = participantAmount(r.billingAmount, r.billingStatus, null);
      totalTagihan += amt;
      if (r.billingStatus === "PAID" || r.status === "PAID") totalTerbayar += amt;
    });
    const belumDaftar = props.rows.filter((r) => !r.registrationId).length;
    return { total, disetujui, pending, ditolak, totalTagihan, totalTerbayar, belumDaftar, allMembers: props.rows.length };
  }, [props.rows]);

  const navigate = useCallback(
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

  const totalPages = Math.max(1, Math.ceil(props.total / props.pageSize));

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat periode");
      toast.success(data.created ? "Periode UKT dibuat" : "Periode UKT sudah ada");
      navigate({ period: data.event.id });
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
        const data = await res.json();
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Anggota berhasil didaftarkan UKT");
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Kyu Baru diperbarui");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (registrationId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ukt/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success("Pendaftaran disetujui");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!props.selectedPeriodId || !props.dojoFilter) {
      toast.error("Pilih ranting terlebih dahulu");
      return;
    }
    const memberIds = props.rows
      .filter((r) => r.registrationId && r.dojoId === props.dojoFilter)
      .map((r) => r.memberId);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ukt/invoice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: props.selectedPeriodId, dojoId: props.dojoFilter, memberIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.created} invoice dibuat`);
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
        const data = await res.json();
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMemberHistory(data.member);
    } catch {
      toast.error("Gagal memuat riwayat anggota");
    }
  };

  const handleAddMember = async () => {
    if (!newMember.fullName.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ukt/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newMember,
          dojoId: props.dojoFilter || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Anggota berhasil ditambahkan");
      setShowAddMember(false);
      setNewMember({ fullName: "", gender: "", birthPlace: "", birthDate: "", address: "" });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const buildWaReport = () => {
    const approved = props.rows.filter(
      (r) => r.registrationId && isRegistrationApproved(r.status),
    );
    if (approved.length === 0) {
      toast.error("Belum ada peserta disetujui");
      return;
    }
    const dojoName = props.dojoFilter
      ? props.dojos.find((d) => d.id === props.dojoFilter)?.name || "Ranting"
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
    { label: "Pending", value: kpi.pending, icon: Clock, color: "text-yellow-600", filter: "pending" },
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
              onValueChange={(v) => navigate({ semester: v, page: "1" })}
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
              value={props.year}
              onChange={(e) => navigate({ year: e.target.value, page: "1" })}
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
            {props.periods.length > 0 && (
              <Select
                value={props.selectedPeriodId || ""}
                onValueChange={(v) => navigate({ period: v, page: "1" })}
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
            {isCabang && props.selectedPeriodId && (
              <Button variant="outline" onClick={handleCreateInvoice} disabled={loading}>
                <FileText className="mr-1 h-4 w-4" />
                Buat Invoice
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {kpiCards.map((card) => (
          <Card
            key={card.label}
            className={`cursor-pointer transition-all hover:shadow-md hover:ring-1 hover:ring-inkai-red/30 ${
              props.viewFilter === card.filter ? "ring-2 ring-inkai-red" : ""
            }`}
            onClick={() => card.filter && navigate({ view: card.filter, page: "1" })}
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

      {/* Search & inline filters */}
      <div className="flex flex-wrap items-center gap-2">
        <UktSearchBar
          value={props.q}
          onSearch={(q) => navigate({ q, page: "1" })}
          dojoFilter={props.dojoFilter}
          periodId={props.selectedPeriodId}
        />

        <Select
          value={props.statusFilter || "all"}
          onValueChange={(v) => navigate({ status: v === "all" ? "" : v, page: "1" })}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="BELUM_DAFTAR">Belum Daftar</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Disetujui</SelectItem>
            <SelectItem value="PAID">Lunas</SelectItem>
            <SelectItem value="REJECTED">Ditolak</SelectItem>
          </SelectContent>
        </Select>

        {!isDojoAdmin && (
          <Select
            value={props.dojoFilter || "all"}
            onValueChange={(v) => navigate({ dojo: v === "all" ? "" : v, page: "1" })}
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
          value={String(props.pageSize)}
          onValueChange={(v) => navigate({ pageSize: v, page: "1" })}
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
        props.dojoFilter &&
        props.selectedPeriodId &&
        !props.invoiceAcks[props.dojoFilter]?.acknowledged && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span>Invoice UKT dari cabang belum ditandai diterima</span>
              </div>
              <Button size="sm" onClick={() => handleAckInvoice(props.dojoFilter)} disabled={loading}>
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
              <TableHead className="w-24">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="py-12 text-center text-muted-foreground">
                  {props.rows.length === 0 && props.total === 0
                    ? "Belum ada anggota. Tambahkan anggota untuk memulai pendaftaran UKT."
                    : "Tidak ada data sesuai filter."}
                </TableCell>
              </TableRow>
            ) : (
              props.rows.map((row, idx) => (
                <TableRow
                  key={row.memberId}
                  className="group transition-colors hover:bg-muted/30"
                >
                  <TableCell className="text-muted-foreground">
                    {(props.page - 1) * props.pageSize + idx + 1}
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
                  <TableCell>{statusBadge(row.registrationId ? row.status : "BELUM_DAFTAR")}</TableCell>
                  <TableCell>
                    {!row.registrationId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleRegister(row.memberId)}
                        disabled={loading || !props.selectedPeriodId}
                      >
                        Daftar
                      </Button>
                    ) : isCabang && row.status === "PENDING" ? (
                      <Button
                        size="sm"
                        className="h-7 bg-green-600 text-xs hover:bg-green-700"
                        onClick={() => handleApprove(row.registrationId!)}
                        disabled={loading}
                      >
                        Setujui
                      </Button>
                    ) : null}
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
            Halaman {props.page} dari {totalPages} ({props.total} data)
          </p>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={props.page <= 1}
              onClick={() => navigate({ page: String(props.page - 1) })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const start = Math.max(1, Math.min(props.page - 3, totalPages - 6));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <Button
                  key={p}
                  size="sm"
                  variant={p === props.page ? "default" : "outline"}
                  className={p === props.page ? "bg-inkai-red" : ""}
                  onClick={() => navigate({ page: String(p) })}
                >
                  {p}
                </Button>
              );
            })}
            <Button
              size="sm"
              variant="outline"
              disabled={props.page >= totalPages}
              onClick={() => navigate({ page: String(props.page + 1) })}
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
              <DialogFooter>
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

      {/* Add member modal */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Anggota Baru</DialogTitle>
            <DialogDescription>
              Ketua ranting dapat menambahkan anggota baru ke ranting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nama Lengkap *"
              value={newMember.fullName}
              onChange={(e) => setNewMember({ ...newMember, fullName: e.target.value })}
            />
            <select
              className="h-8 w-full rounded-lg border px-2 text-sm"
              value={newMember.gender}
              onChange={(e) => setNewMember({ ...newMember, gender: e.target.value })}
            >
              <option value="">Jenis Kelamin</option>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
            <Input
              placeholder="Tempat Lahir"
              value={newMember.birthPlace}
              onChange={(e) => setNewMember({ ...newMember, birthPlace: e.target.value })}
            />
            <Input
              type="date"
              placeholder="Tanggal Lahir"
              value={newMember.birthDate}
              onChange={(e) => setNewMember({ ...newMember, birthDate: e.target.value })}
            />
            <Input
              placeholder="Alamat"
              value={newMember.address}
              onChange={(e) => setNewMember({ ...newMember, address: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMember(false)}>
              Batal
            </Button>
            <Button className="bg-inkai-red" onClick={handleAddMember} disabled={loading}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print modal */}
      {showPrint && (
        <UktPrintModal
          open={showPrint}
          onClose={() => setShowPrint(false)}
          periodTitle={selectedPeriod?.title || periodTitle}
          semester={props.semester}
          year={props.year}
          rows={props.rows.filter((r) => r.registrationId && isRegistrationApproved(r.status))}
          dojos={props.dojos}
          dojoFilter={props.dojoFilter}
        />
      )}
    </div>
  );
}

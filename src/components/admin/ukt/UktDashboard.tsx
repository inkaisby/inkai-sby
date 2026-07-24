"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ClipboardCheck,
  Archive,
  Settings2,
  MoreHorizontal,
  RefreshCw,
  Link2,
  Share2,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemberAvatarRing } from "@/components/admin/ukt/MemberAvatarRing";
import { UktPrintModal } from "@/components/admin/ukt/UktPrintModal";
import { UktExportDialog } from "@/components/admin/ukt/UktExportDialog";
import { UktExamDayDialog } from "@/components/admin/ukt/UktExamDayDialog";
import { UktFloatingCountdown } from "@/components/admin/ukt/UktFloatingCountdown";
import { UktSearchBar } from "@/components/admin/ukt/UktSearchBar";
import { AdminMoreActions } from "@/components/admin/AdminMoreActions";
import { AddMemberDialog } from "@/components/admin/AddMemberDialog";
import { buildUktInviteUrl } from "@/lib/ukt-invite";
import {
  BELT_RANK_OPTIONS,
  canEditKyuBaru,
  displayUktKyuLama,
  formatGenderLabel,
  formatMemberName,
  formatRankLabel,
  inferPreviousBeltRank,
  isBlankUktRank,
} from "@/lib/belt";
import {
  parseUktDojoFilterValue,
  type UktDojoFilterGroup,
} from "@/lib/managed-dojos";
import {
  type UktMemberRow,
  type UktDepositRecord,
  type UktRegistrationSnapshotItem,
  applyUktRegistrationSnapshotToRows,
  type UktSemester,
  type BeltFeeKey,
  type UktDepositStatus,
  type UktPeriodMeta,
  BELT_FEE_KEYS,
  buildUktCabangWaReportText,
  buildUktRantingWaReportText,
  resolveUktWaDojoLabel,
  canApplyUktKyuBaru,
  computeUktOperationalKpi,
  formatUktRegistrationBlockers,
  formatRupiahNota,
  getUktRegistrationBlockersWithWaiver,
  isRegistrationApproved,
  isNotaParticipant,
  isUktBillingUnpaid,
  canRantingSubmitUktPayment,
  canCabangVerifyUktPayment,
  isUktSelesai,
  filterUktRowsByView,
  filterUktRowsByDisplayStatus,
  formatUktPeriodLabel,
  formatUktRegistrationDeadline,
  getUktRegistrationDeadline,
  getUktRegistrationOpenAt,
  isUktRegistrationNotYetOpen,
  isUktRegistrationOpen,
  isUktPeriodActiveView,
  findUktPeriodForTerm,
  findUktArchivedPeriodForTerm,
  findUktPeriodsForTerm,
  parseUktEventTitle,
  buildUktEventTitle,
  type UktAdminViewMode,
  buildUktDepositReconciliation,
  resolveEffectiveUktExamResult,
  resolveUktDisplayStatus,
  resolveUktPeriodOfficers,
  summarizeRowEligibility,
  toDateInput,
  toTimeInput,
  buildUktEventDates,
  uktDepositStatusLabel,
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
import {
  DEFAULT_UKT_REGISTRATION_POLICY,
  resolveUktMemberRequirementFlags,
  type UktRegistrationPolicy,
} from "@/lib/ukt-registration-policy";
import { parseApiJson } from "@/lib/api-client";
import { SortableTableHead } from "@/components/ui/SortableTableHead";
import {
  compareDates,
  compareNumbers,
  compareStrings,
  toggleSortKey,
  type SortDir,
} from "@/lib/table-sort";

function compareUktRows(
  a: UktMemberRow,
  b: UktMemberRow,
  key: string,
  dir: SortDir,
) {
  switch (key) {
    case "nia":
      return compareStrings(a.nia, b.nia, dir);
    case "fullName":
      return compareStrings(a.fullName, b.fullName, dir);
    case "birthPlace":
      return compareStrings(a.birthPlace, b.birthPlace, dir);
    case "birthDate":
      return compareDates(a.birthDate, b.birthDate, dir);
    case "gender":
      return compareStrings(a.gender, b.gender, dir);
    case "address":
      return compareStrings(a.address, b.address, dir);
    case "kyuLama":
      return compareStrings(
        formatRankLabel(a.kyuLama),
        formatRankLabel(b.kyuLama),
        dir,
      );
    case "kyuBaru":
      return compareStrings(
        formatRankLabel(a.kyuBaru ?? ""),
        formatRankLabel(b.kyuBaru ?? ""),
        dir,
      );
    case "attendancePct":
      return compareNumbers(a.attendancePct, b.attendancePct, dir);
    case "dojoName":
      return compareStrings(a.dojoName, b.dojoName, dir);
    case "status":
      return compareStrings(
        uktDisplayStatusLabel(resolveUktDisplayStatus(a)),
        uktDisplayStatusLabel(resolveUktDisplayStatus(b)),
        dir,
      );
    default:
      return compareStrings(a.fullName, b.fullName, dir);
  }
}

export type UktPeriod = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  registrationCloseAt?: string | null;
  createdAt?: string;
  archived?: boolean;
  locked?: boolean;
};

export type UktDojo = { id: string; name: string };

type Props = {
  periods: UktPeriod[];
  selectedPeriodId: string | null;
  allRows: UktMemberRow[];
  dojos: UktDojo[];
  /** Opsi gabungan multi-ranting untuk filter cabang. */
  dojoGroups?: UktDojoFilterGroup[];
  userRoles: string[];
  primaryRole: string;
  semester: UktSemester;
  year: number;
  canCreatePeriod: boolean;
  /** Mode buat periode (?create=1) — jangan auto-pilih event. */
  createMode?: boolean;
  dbError?: string | null;
  defaultDojoFilter?: string;
  /** Nama ranting utama sesuai akun login (ADMIN_DOJO). */
  loginDojoName?: string;
  beltFees: Record<BeltFeeKey, number>;
  komisiRanting: number;
  /** Biaya UI berasal dari snapshot period-meta (bukan template global). */
  feesFromSnapshot?: boolean;
  depositMap?: Record<string, UktDepositRecord>;
  periodMeta?: UktPeriodMeta;
  orgProfile?: {
    address?: string;
    bidangUjianName?: string;
    bendaharaCabangName?: string;
  };
  /** Pendaftaran = periode aktif; archive = riwayat/arsip (sidebar). */
  viewMode?: UktAdminViewMode;
  /** Teks lead di atas toolbar (ikut sticky saat scroll). */
  headerNote?: string;
  /** Toolbar semester/tahun sudah di shell halaman — sembunyikan sticky duplikat. */
  hideStickyTermBar?: boolean;
  /** Kebijakan syarat daftar dari Pengaturan UKT cabang. */
  registrationPolicy?: UktRegistrationPolicy;
};

const PAGE_SIZES = [25, 50, 100] as const;

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function canCancelUktRegistration(row: UktMemberRow): boolean {
  return Boolean(row.registrationId);
}

/** Cabang & ranting dapat membatalkan termasuk yang sudah lunas. */
function canForceCancelUktRegistration(
  row: UktMemberRow,
  canForcePaid: boolean,
): boolean {
  if (!row.registrationId || !canForcePaid) return false;
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
    menunggu_terima_ranting: "bg-orange-100 text-orange-800 hover:bg-orange-100",
    menunggu_konfirmasi_ranting: "bg-orange-100 text-orange-800 hover:bg-orange-100",
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
  const viewMode: UktAdminViewMode = props.viewMode ?? "registration";
  const isArchiveView = viewMode === "archive";
  const registrationPolicy =
    props.registrationPolicy ?? DEFAULT_UKT_REGISTRATION_POLICY;
  const memberRequirementOpts = useMemo(
    () => resolveUktMemberRequirementFlags(registrationPolicy, props.primaryRole),
    [registrationPolicy, props.primaryRole],
  );
  const [localQ, setLocalQ] = useState("");
  const [localStatus, setLocalStatus] = useState("");
  const [localDojo, setLocalDojo] = useState(props.defaultDojoFilter || "");
  const [localView, setLocalView] = useState("");
  const [localPage, setLocalPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState(25);
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({
    key: "fullName",
    dir: "asc",
  });
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
  /** Pending per anggota — aksi baris tidak memblokir seluruh tabel. */
  const [pendingMemberIds, setPendingMemberIds] = useState<Set<string>>(
    () => new Set(),
  );
  /** Salinan lokal agar status UI langsung berubah tanpa tunggu refresh penuh. */
  const [rows, setRows] = useState(props.allRows);
  /** Anggota yang baru dibatalkan lokal — cegah sync server usang menimpa UI. */
  const locallyClearedMemberIdsRef = useRef<Set<string>>(new Set());
  const pendingServerRowsSyncRef = useRef(false);
  const [cancelTarget, setCancelTarget] = useState<{
    id: string;
    name: string;
    memberId?: string;
    billingId?: string | null;
    force?: boolean;
  } | null>(null);
  const [deleteBillingTarget, setDeleteBillingTarget] = useState<{
    billingId: string;
    memberId: string;
    name: string;
    billingStatus: string | null;
  } | null>(null);
  const [showRegistrationDeadline, setShowRegistrationDeadline] = useState(false);
  const [registrationDeadlineDate, setRegistrationDeadlineDate] = useState("");
  const [registrationDeadlineTime, setRegistrationDeadlineTime] = useState("");
  const [registrationOpenDate, setRegistrationOpenDate] = useState("");
  const [registrationOpenTime, setRegistrationOpenTime] = useState("00:00");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printOnlySelected, setPrintOnlySelected] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [alurOpen, setAlurOpen] = useState(false);
  const [jadwalOpen, setJadwalOpen] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [showExamDay, setShowExamDay] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardOpenDate, setWizardOpenDate] = useState("");
  const [wizardOpenTime, setWizardOpenTime] = useState("00:00");
  const [wizardDeadlineDate, setWizardDeadlineDate] = useState("");
  const [wizardDeadlineTime, setWizardDeadlineTime] = useState("23:59");
  const [wizardExamDate, setWizardExamDate] = useState("");
  const [wizardExamTime, setWizardExamTime] = useState("08:00");
  const [wizardExamLocation, setWizardExamLocation] = useState("");
  const [wizardBidang, setWizardBidang] = useState("");
  const [wizardBendahara, setWizardBendahara] = useState("");
  const [updateFeesGlobal, setUpdateFeesGlobal] = useState(false);
  const [waiverTarget, setWaiverTarget] = useState<UktMemberRow | null>(null);
  const [waiverBlockers, setWaiverBlockers] = useState<UktRegistrationBlocker[]>([]);
  const [waiverNote, setWaiverNote] = useState("");

  const isCabang = canEditKyuBaru(props.userRoles);
  const isDojoAdmin = props.primaryRole === "ADMIN_DOJO";
  const canForcePaidCancel = isCabang || isDojoAdmin;
  const periodLocked = Boolean(props.periodMeta?.locked || props.periodMeta?.archived);
  const [depositMap, setDepositMap] = useState(props.depositMap ?? {});
  const periodOfficers = resolveUktPeriodOfficers(props.periodMeta, props.orgProfile);
  const [tableRefreshing, setTableRefreshing] = useState(false);
  const cancelRow = useMemo(
    () =>
      cancelTarget?.id
        ? rows.find((row) => row.registrationId === cancelTarget.id) ?? null
        : null,
    [rows, cancelTarget],
  );

  useEffect(() => {
    if (isDojoAdmin) setCompactView(true);
  }, [isDojoAdmin]);

  useEffect(() => {
    setBeltFees(props.beltFees);
    setKomisiRanting(props.komisiRanting);
  }, [props.beltFees, props.komisiRanting]);
  const selectedPeriod = props.periods.find((p) => p.id === props.selectedPeriodId);
  const periodSchedule = selectedPeriod
    ? {
        ...selectedPeriod,
        registrationOpenAt: props.periodMeta?.registrationOpenAt ?? null,
      }
    : null;
  const registrationOpen = periodSchedule ? isUktRegistrationOpen(periodSchedule) : true;
  const registrationNotYetOpen = periodSchedule
    ? isUktRegistrationNotYetOpen(periodSchedule)
    : false;
  const registrationDeadlineIso = periodSchedule
    ? getUktRegistrationDeadline(periodSchedule).toISOString()
    : null;
  const registrationOpenIso = periodSchedule
    ? (getUktRegistrationOpenAt(periodSchedule)?.toISOString() ?? null)
    : null;

  /** Filter ranting: satu id, gabungan multi-ranting, atau semua (null). */
  const isMultiDojoAdmin = isDojoAdmin && props.dojos.length > 1;
  const dojoFilterParsed = useMemo(() => {
    const raw = isDojoAdmin
      ? isMultiDojoAdmin
        ? localDojo
        : props.defaultDojoFilter || ""
      : localDojo;
    const parsed = parseUktDojoFilterValue(raw);
    if (raw.startsWith("group:")) {
      const group = (props.dojoGroups ?? []).find((g) => g.value === raw);
      if (group) {
        return {
          ids: group.dojoIds,
          primaryDojoId: group.primaryDojoId,
        };
      }
    }
    return parsed;
  }, [
    isDojoAdmin,
    isMultiDojoAdmin,
    props.defaultDojoFilter,
    localDojo,
    props.dojoGroups,
  ]);

  const effectiveDojoIds = dojoFilterParsed.ids;
  /** Satu dojo untuk dialog/default (primary gabungan bila filter group). */
  const effectiveDojo = dojoFilterParsed.primaryDojoId;

  const matchesDojoFilter = useCallback(
    (dojoId: string) =>
      !effectiveDojoIds || effectiveDojoIds.includes(dojoId),
    [effectiveDojoIds],
  );

  const normalizeRows = useCallback((list: UktMemberRow[]) => {
    const cleared = locallyClearedMemberIdsRef.current;
    return list.map((r) => {
      const lama = displayUktKyuLama(r.kyuLama, r.kyuBaru);
      let next = lama && lama !== r.kyuLama ? { ...r, kyuLama: lama } : r;
      if (cleared.has(r.memberId)) {
        if (r.registrationId) {
          // Server masih usang setelah hapus lokal — pertahankan Belum Daftar.
          next = {
            ...next,
            registrationId: null,
            billingId: null,
            billingStatus: null,
            billingAmount: null,
            status: "BELUM_DAFTAR",
            examResult: null,
            examPresent: null,
            kyuBaru: null,
          };
        } else {
          cleared.delete(r.memberId);
        }
      }
      return next;
    });
  }, []);

  const requestServerRowsSync = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (tableRefreshing) return;
      if (!props.selectedPeriodId) {
        if (!opts?.silent) toast.error("Pilih periode UKT terlebih dahulu");
        return;
      }
      setTableRefreshing(true);
      try {
        const qs = new URLSearchParams({ period: props.selectedPeriodId });
        const res = await fetch(`/api/admin/ukt/table?${qs.toString()}`, {
          cache: "no-store",
        });
        const data = await parseApiJson<{
          error?: string;
          participants?: UktRegistrationSnapshotItem[];
          depositMap?: Record<string, UktDepositRecord>;
        }>(res);
        if (!res.ok) throw new Error(data.error || "Gagal memuat ulang tabel");
        pendingServerRowsSyncRef.current = false;
        const participants = data.participants ?? [];
        setRows((prev) =>
          normalizeRows(
            applyUktRegistrationSnapshotToRows(prev, participants),
          ),
        );
        setDepositMap(data.depositMap ?? {});
        if (!opts?.silent) toast.success("Tabel diperbarui");
      } catch (e) {
        if (!opts?.silent) {
          toast.error(
            e instanceof Error ? e.message : "Gagal memuat ulang tabel",
          );
        }
      } finally {
        setTableRefreshing(false);
      }
    },
    [tableRefreshing, props.selectedPeriodId, normalizeRows],
  );

  useEffect(() => {
    setYearInput(String(props.year));
  }, [props.year]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    if (mq.matches) {
      setCompactView(true);
      setJadwalOpen(false);
    }
  }, []);

  const periodKey = `${props.selectedPeriodId ?? ""}|${props.semester}|${props.year}|${
    props.createMode ? 1 : 0
  }`;
  const prevPeriodKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const first = prevPeriodKeyRef.current === null;
    const periodChanged = prevPeriodKeyRef.current !== periodKey;
    prevPeriodKeyRef.current = periodKey;
    if (first || periodChanged) {
      locallyClearedMemberIdsRef.current.clear();
      pendingServerRowsSyncRef.current = false;
      setRows(normalizeRows(props.allRows));
      setDepositMap(props.depositMap ?? {});
    }
  }, [periodKey, props.allRows, props.depositMap, normalizeRows]);

  // Cabang: bila tab sempat disembunyikan, segarkan tabel (bukan reload halaman).
  useEffect(() => {
    if (!isCabang || isArchiveView) return;
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt > 0 && Date.now() - hiddenAt >= 2_000) {
        void requestServerRowsSync({ silent: true });
      }
      hiddenAt = 0;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isCabang, isArchiveView, requestServerRowsSync]);

  const patchRow = useCallback((memberId: string, patch: Partial<UktMemberRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.memberId === memberId ? { ...r, ...patch } : r)),
    );
  }, []);

  const clearMemberFromUktLocal = useCallback((memberId: string) => {
    locallyClearedMemberIdsRef.current.add(memberId);
    setRows((prev) =>
      prev.map((r) =>
        r.memberId === memberId
          ? {
              ...r,
              registrationId: null,
              billingId: null,
              billingStatus: null,
              billingAmount: null,
              status: "BELUM_DAFTAR",
              examResult: null,
              examPresent: null,
              kyuBaru: null,
            }
          : r,
      ),
    );
    setSelectedIds((prev) => {
      if (!prev.has(memberId)) return prev;
      const next = new Set(prev);
      next.delete(memberId);
      return next;
    });
    setSelectedMember((prev) =>
      prev && prev.memberId === memberId ? null : prev,
    );
  }, []);

  const resetTableFilters = useCallback(() => {
    setLocalQ("");
    setLocalStatus("");
    setLocalView("");
    if (!isDojoAdmin || isMultiDojoAdmin) {
      setLocalDojo(isDojoAdmin ? "" : props.defaultDojoFilter || "");
    }
    setLocalPage(1);
  }, [isDojoAdmin, isMultiDojoAdmin, props.defaultDojoFilter]);

  const setMemberPending = useCallback((memberId: string, pending: boolean) => {
    setPendingMemberIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(memberId);
      else next.delete(memberId);
      return next;
    });
  }, []);

  const isMemberPending = useCallback(
    (memberId: string) => pendingMemberIds.has(memberId),
    [pendingMemberIds],
  );

  useEffect(() => {
    if (!isArchiveView) return;
    if (localStatus === "belum_daftar") setLocalStatus("");
    if (localView === "unregistered") setLocalView("");
  }, [isArchiveView, localStatus, localView]);

  const scopedRows = useMemo(() => {
    let list = rows;
    // Registrants-first: default hanya peserta; Belum Daftar stub via search hydrate.
    list = list.filter(
      (r) =>
        Boolean(r.registrationId) ||
        Boolean(localQ.trim() && r.status === "BELUM_DAFTAR"),
    );
    if (effectiveDojoIds) {
      list = list.filter((r) => effectiveDojoIds.includes(r.dojoId));
    }
    if (localStatus) list = filterUktRowsByDisplayStatus(list, localStatus);
    if (localQ.trim()) {
      const q = localQ.toLowerCase();
      list = list.filter(
        (r) =>
          r.fullName.toLowerCase().includes(q) ||
          (r.nia?.toLowerCase().includes(q) ?? false),
      );
    }
    return list;
  }, [rows, effectiveDojoIds, localStatus, localQ]);

  /** KPI & rekap tidak ikut filter status/cari — selalu dari peserta periode (+ranting). */
  const kpiSourceRows = useMemo(() => {
    let list = rows.filter((r) => Boolean(r.registrationId));
    if (effectiveDojoIds) {
      list = list.filter((r) => effectiveDojoIds.includes(r.dojoId));
    }
    return list;
  }, [rows, effectiveDojoIds]);

  const archiveSearchRows = useMemo(() => rows, [rows]);

  const kpi = useMemo(
    () => computeUktOperationalKpi(kpiSourceRows),
    [kpiSourceRows],
  );

  const depositRecon = useMemo(
    () => buildUktDepositReconciliation(kpiSourceRows, props.dojos, depositMap),
    [kpiSourceRows, props.dojos, depositMap],
  );

  const filteredRows = useMemo(() => {
    if (localView === "gagal_mengulang") {
      return scopedRows.filter((row) => {
        const status = resolveUktDisplayStatus(row);
        return status === "gagal" || status === "mengulang";
      });
    }
    // Saat view "Terdaftar UKT" + pencarian aktif, tampilkan semua peserta yang cocok
    // agar admin bisa mendaftarkan anggota baru lewat tombol Daftar UKT.
    // Di arsip tidak perlu pool belum daftar.
    if (isArchiveView) {
      return filterUktRowsByView(
        scopedRows,
        localView === "unregistered" ? "registered" : localView,
      );
    }
    const viewFilter =
      localView === "registered" && localQ.trim() ? "" : localView;
    return filterUktRowsByView(scopedRows, viewFilter);
  }, [scopedRows, localView, localQ, isArchiveView]);

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    rows.sort((a, b) => compareUktRows(a, b, sort.key, sort.dir));
    return rows;
  }, [filteredRows, sort]);

  const handleSort = useCallback((key: string) => {
    setSort((prev) => toggleSortKey(prev.key, prev.dir, key));
    setLocalPage(1);
  }, []);

  const totalFiltered = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / localPageSize));
  const safePage = Math.min(localPage, totalPages);
  const displayRows = useMemo(() => {
    const start = (safePage - 1) * localPageSize;
    return sortedRows.slice(start, start + localPageSize);
  }, [sortedRows, safePage, localPageSize]);

  const selectableRows = useMemo(
    () =>
      filteredRows.filter(
        (r) =>
          r.registrationId &&
          isNotaParticipant(r.status) &&
          canCabangVerifyUktPayment(r),
      ),
    [filteredRows],
  );

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.memberId)),
    [rows, selectedIds],
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

  const uktBasePath =
    viewMode === "archive" ? "/admin/ukt/arsip" : "/admin/ukt";

  const navigatePeriod = useCallback(
    (updates: Record<string, string>, basePath = uktBasePath) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v);
        else params.delete(k);
      });
      router.push(`${basePath}?${params.toString()}`);
    },
    [router, searchParams, uktBasePath],
  );

  const syncNavigateTerm = useCallback(
    (updates: { semester?: UktSemester; year?: number }) => {
      const semester = updates.semester ?? props.semester;
      const year = updates.year ?? props.year;
      const match =
        viewMode === "archive"
          ? findUktArchivedPeriodForTerm(props.periods, semester, year)
          : findUktPeriodForTerm(props.periods, semester, year);
      navigatePeriod({
        semester,
        year: String(year),
        period: match?.id ?? "",
        create: "",
      });
    },
    [navigatePeriod, props.periods, props.semester, props.year, viewMode],
  );

  const periodsForTerm = useMemo(
    () => findUktPeriodsForTerm(props.periods, props.semester, props.year),
    [props.periods, props.semester, props.year],
  );
  const activePeriodsForTerm = useMemo(
    () => periodsForTerm.filter((p) => isUktPeriodActiveView(p)),
    [periodsForTerm],
  );
  const historyPeriodsForTerm = useMemo(
    () => periodsForTerm.filter((p) => !isUktPeriodActiveView(p)),
    [periodsForTerm],
  );
  const selectablePeriodsForTerm =
    viewMode === "archive" ? historyPeriodsForTerm : activePeriodsForTerm;

  /** Tombol Buat Periode: hanya di Pendaftaran; arsip tidak menghalangi. */
  const hasTermPeriod = activePeriodsForTerm.length > 0;
  const showCreatePeriod =
    viewMode === "registration" &&
    props.canCreatePeriod &&
    (!hasTermPeriod || Boolean(props.createMode));
  const goBackToCreatePeriod = () => {
    navigatePeriod({
      semester: props.semester,
      year: String(props.year),
      period: "",
      create: "1",
    });
  };

  const handleKpiClick = (filter: string) => {
    const next =
      !filter || filter === "all" || localView === filter ? "" : filter;
    setLocalView(next);
    setLocalPage(1);
  };

  const selectedUnpaidCount = useMemo(
    () =>
      selectedRows.filter((r) => r.registrationId && canCabangVerifyUktPayment(r))
        .length,
    [selectedRows],
  );

  const handleCreatePeriod = async () => {
    if (!wizardOpenDate || !wizardOpenTime) {
      toast.error("Isi tanggal dan jam buka pendaftaran");
      return;
    }
    if (!wizardDeadlineDate || !wizardDeadlineTime) {
      toast.error("Isi tanggal dan jam batas pendaftaran");
      return;
    }
    const openAt = combineDateAndTimeLocal(wizardOpenDate, wizardOpenTime);
    const closeAt = combineDateAndTimeLocal(wizardDeadlineDate, wizardDeadlineTime);
    if (Number.isNaN(openAt.getTime())) {
      toast.error("Tanggal buka pendaftaran tidak valid");
      return;
    }
    if (Number.isNaN(closeAt.getTime())) {
      toast.error("Batas pendaftaran tidak valid");
      return;
    }
    if (openAt.getTime() > closeAt.getTime()) {
      toast.error("Tanggal buka harus sebelum atau sama dengan batas pendaftaran");
      return;
    }
    let examAtIso: string | undefined;
    if (wizardExamDate && wizardExamTime) {
      const examAt = combineDateAndTimeLocal(wizardExamDate, wizardExamTime);
      if (Number.isNaN(examAt.getTime())) {
        toast.error("Tanggal/jam ujian tidak valid");
        return;
      }
      examAtIso = examAt.toISOString();
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ukt/period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semester: props.semester,
          year: props.year,
          title: periodTitle,
          registrationOpenAt: openAt.toISOString(),
          registrationCloseAt: closeAt.toISOString(),
          examAt: examAtIso ?? null,
          examLocation: wizardExamLocation.trim() || null,
          bidangUjianName: wizardBidang.trim() || null,
          bendaharaCabangName: wizardBendahara.trim() || null,
          beltFees,
          komisiRanting,
          notifyRanting: true,
        }),
      });
      const data = await parseApiJson<{
        error?: string;
        event?: { id: string };
        created?: boolean;
        message?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal membuat periode");
      toast.success(
        data.created
          ? "Periode UKT dibuat — periode lama di term ini dipindah ke arsip bila sudah tutup"
          : data.message || "Periode UKT sudah ada",
      );
      setShowCreateWizard(false);
      setWizardStep(0);
      navigatePeriod({
        semester: props.semester,
        year: String(props.year),
        period: data.event?.id ?? "",
        create: "",
      });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const openExportDialog = () => {
    if (!rows.some((r) => r.registrationId)) {
      toast.error("Tidak ada peserta terdaftar untuk diekspor");
      return;
    }
    setShowExport(true);
  };

  const handlePeriodArchive = async (archived: boolean) => {
    if (!props.selectedPeriodId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ukt/period-meta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: props.selectedPeriodId,
          archived,
          locked: archived,
        }),
      });
      const data = await parseApiJson<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal");
      toast.success(data.message || "Periode diperbarui");
      if (archived) {
        navigatePeriod(
          {
            semester: props.semester,
            year: String(props.year),
            period: props.selectedPeriodId,
            create: "",
          },
          "/admin/ukt/arsip",
        );
      } else {
        navigatePeriod(
          {
            semester: props.semester,
            year: String(props.year),
            period: props.selectedPeriodId,
            create: "",
          },
          "/admin/ukt",
        );
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const handleDepositStatus = async (dojoId: string, status: UktDepositStatus) => {
    if (!props.selectedPeriodId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ukt/deposit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: props.selectedPeriodId,
          dojoId,
          status,
        }),
      });
      const data = await parseApiJson<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal");
      toast.success(data.message || "Status setoran diperbarui");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const openWaiverDialog = (row: UktMemberRow) => {
    const blockers = getUktRegistrationBlockersWithWaiver(
      row,
      {
        registrationOpen,
        registrationNotYetOpen,
        requireNoOutstandingDues: registrationPolicy.requireNoOutstandingDues,
        requireDocuments: registrationPolicy.requireDocuments,
        requireMinAttendance: registrationPolicy.requireMinAttendance,
        minAttendancePct: registrationPolicy.minAttendancePct,
      },
      null,
    ).filter((b) => b !== "PERIODE_TUTUP" && b !== "PERIODE_BELUM_BUKA");
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
      const data = await parseApiJson<{ error?: string; message?: string }>(res);
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
  const registrationOpenTimeParts = splitTimeInput(registrationOpenTime || "00:00");
  const wizardTimeParts = splitTimeInput(wizardDeadlineTime || "23:59");
  const wizardOpenTimeParts = splitTimeInput(wizardOpenTime || "00:00");
  const wizardExamTimeParts = splitTimeInput(wizardExamTime || "08:00");

  const openCreateWizard = () => {
    setPeriodTitle(buildUktEventTitle(props.semester, props.year));
    const { registrationCloseAt, registrationOpenAt } = buildUktEventDates(
      props.semester,
      props.year,
    );
    const closeIso = registrationCloseAt.toISOString();
    const openIso = registrationOpenAt.toISOString();
    setWizardOpenDate(toDateInput(openIso));
    setWizardOpenTime(toTimeInput(openIso));
    setWizardDeadlineDate(toDateInput(closeIso));
    setWizardDeadlineTime(toTimeInput(closeIso));
    const examDefault = new Date();
    examDefault.setDate(examDefault.getDate() + 14);
    examDefault.setHours(8, 0, 0, 0);
    const examIso = examDefault.toISOString();
    setWizardExamDate(toDateInput(examIso));
    setWizardExamTime(toTimeInput(examIso));
    setWizardExamLocation("");
    setWizardBidang(props.orgProfile?.bidangUjianName?.trim() || "");
    setWizardBendahara(props.orgProfile?.bendaharaCabangName?.trim() || "");
    setWizardStep(0);
    setShowCreateWizard(true);
  };

  const openBeltFeesDialog = () => {
    setUpdateFeesGlobal(!props.selectedPeriodId);
    setShowBeltFees(true);
  };

  const openRegistrationDeadlineDialog = () => {
    if (!registrationDeadlineIso) return;
    setRegistrationDeadlineDate(toDateInput(registrationDeadlineIso));
    setRegistrationDeadlineTime(toTimeInput(registrationDeadlineIso));
    if (registrationOpenIso) {
      setRegistrationOpenDate(toDateInput(registrationOpenIso));
      setRegistrationOpenTime(toTimeInput(registrationOpenIso));
    } else {
      const { registrationOpenAt } = buildUktEventDates(props.semester, props.year);
      const iso = registrationOpenAt.toISOString();
      setRegistrationOpenDate(toDateInput(iso));
      setRegistrationOpenTime(toTimeInput(iso));
    }
    setShowRegistrationDeadline(true);
  };

  const handleSaveRegistrationDeadline = async () => {
    if (!props.selectedPeriodId || !registrationDeadlineDate || !registrationDeadlineTime) return;
    if (!registrationOpenDate || !registrationOpenTime) {
      toast.error("Isi tanggal dan jam buka pendaftaran");
      return;
    }
    const openAt = combineDateAndTimeLocal(registrationOpenDate, registrationOpenTime);
    const closeAt = combineDateAndTimeLocal(registrationDeadlineDate, registrationDeadlineTime);
    if (Number.isNaN(openAt.getTime())) {
      toast.error("Tanggal buka pendaftaran tidak valid");
      return;
    }
    if (Number.isNaN(closeAt.getTime())) {
      toast.error("Batas pendaftaran tidak valid");
      return;
    }
    if (openAt.getTime() > closeAt.getTime()) {
      toast.error("Tanggal buka harus sebelum atau sama dengan batas pendaftaran");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ukt/period", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: props.selectedPeriodId,
          registrationOpenAt: openAt.toISOString(),
          registrationCloseAt: closeAt.toISOString(),
        }),
      });
      const data = await parseApiJson<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan jadwal pendaftaran");
      toast.success("Jadwal pendaftaran UKT diperbarui");
      setShowRegistrationDeadline(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (memberId: string) => {
    if (periodLocked) {
      toast.error("Periode dikunci — pendaftaran ditutup");
      return;
    }
    if (!props.selectedPeriodId) {
      toast.error("Pilih atau buat periode UKT terlebih dahulu");
      return;
    }
    if (isMemberPending(memberId)) return;
    const row = rows.find((r) => r.memberId === memberId);
    if (row) {
      const blockers = getUktRegistrationBlockersWithWaiver(
        row,
        {
          registrationOpen,
          registrationNotYetOpen,
          ...memberRequirementOpts,
        },
        row.registrationWaiver,
      );
      if (blockers.length > 0) {
        toast.error(
          formatUktRegistrationBlockers(
            blockers,
            memberRequirementOpts.minAttendancePct,
          ),
        );
        return;
      }
    }
    setMemberPending(memberId, true);
    try {
      const res = await fetch("/api/admin/ukt/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: props.selectedPeriodId, memberId }),
      });
      const data = await parseApiJson<{
        error?: string;
        success?: boolean;
        registrationId?: string;
        billingId?: string | null;
        billingAmount?: number | null;
        billingStatus?: string | null;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal mendaftarkan anggota");
      const registrationId = data.registrationId
        ? String(data.registrationId)
        : `pending-${memberId}`;
      patchRow(memberId, {
        registrationId,
        billingId: data.billingId ? String(data.billingId) : null,
        billingStatus: data.billingStatus
          ? String(data.billingStatus)
          : "PENDING",
        billingAmount:
          data.billingAmount != null && Number.isFinite(Number(data.billingAmount))
            ? Number(data.billingAmount)
            : null,
        status: "APPROVED",
        examResult: null,
      });
      toast.success("Anggota didaftarkan — status Belum Bayar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mendaftarkan");
    } finally {
      setMemberPending(memberId, false);
    }
  };

  const handleKyuUpdate = async (
    registrationId: string,
    newRank: string,
    row: UktMemberRow,
  ) => {
    if (isMemberPending(row.memberId)) return;
    if (!canApplyUktKyuBaru(row)) {
      toast.error("Isi Kyu Baru setelah pembayaran diverifikasi (Menunggu Ujian)");
      return;
    }
    setMemberPending(row.memberId, true);
    try {
      const res = await fetch(`/api/admin/ukt/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newRank,
          action: "approve",
          eventId: props.selectedPeriodId,
          memberId: row.memberId,
          previousRank: !isBlankUktRank(row.kyuLama)
            ? row.kyuLama
            : inferPreviousBeltRank(newRank) || undefined,
        }),
      });
      const data = await parseApiJson<{
        error?: string;
        message?: string;
        kyuBaru?: string;
        kyuLama?: string;
        selesai?: boolean;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui kyu");
      const nextBaru = data.kyuBaru || newRank;
      const nextLama =
        displayUktKyuLama(data.kyuLama || row.kyuLama, nextBaru) || row.kyuLama;
      patchRow(row.memberId, {
        kyuBaru: nextBaru,
        kyuLama: nextLama,
        examResult: "LULUS",
        billingStatus: row.billingStatus === "PAID" ? "PAID" : row.billingStatus,
        status:
          row.status === "PAID" || row.billingStatus === "PAID"
            ? "PAID"
            : row.status,
      });
      toast.success(
        data.message ||
          `Kyu Baru disimpan — status Selesai: ${formatRankLabel(newRank)}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setMemberPending(row.memberId, false);
    }
  };

  const handleExamResult = async (
    registrationId: string,
    examResult: "LULUS" | "GAGAL" | "MENGULANG",
  ) => {
    if (!props.selectedPeriodId) return;
    const target = rows.find((r) => r.registrationId === registrationId);
    if (target && isMemberPending(target.memberId)) return;
    // Aksi ini selalu spesifik satu anggota — cukup pendingMemberIds, jangan kunci seluruh toolbar.
    if (target) setMemberPending(target.memberId, true);
    try {
      const res = await fetch(`/api/admin/ukt/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: props.selectedPeriodId, examResult }),
      });
      const data = await parseApiJson<{
        error?: string;
        selesai?: boolean;
        kyuBaru?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan hasil ujian");
      if (target) {
        patchRow(target.memberId, {
          examResult,
          ...(data.selesai && data.kyuBaru
            ? { kyuBaru: data.kyuBaru }
            : {}),
        });
      }
      toast.success(
        data.selesai
          ? `Lulus — status Selesai${data.kyuBaru ? `: ${formatRankLabel(data.kyuBaru)}` : ""}`
          : examResult === "LULUS" && target && !target.kyuBaru?.trim()
            ? "Lulus dicatat. Isi Kyu Baru untuk menyelesaikan."
            : `Hasil ujian disimpan: ${examResult}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      if (target) setMemberPending(target.memberId, false);
    }
  };

  const handleCancelRegistration = async (registrationId: string) => {
    if (periodLocked) {
      toast.error("Periode dikunci — pembatalan ditutup");
      return;
    }
    const target = cancelTarget;
    const memberId =
      target?.memberId ||
      rows.find((r) => r.registrationId === registrationId)?.memberId;
    if (memberId && isMemberPending(memberId)) return;
    // Aksi ini selalu spesifik satu anggota — cukup pendingMemberIds, jangan kunci seluruh toolbar.
    if (memberId) setMemberPending(memberId, true);
    const billingId =
      target?.billingId ||
      rows.find((r) => r.registrationId === registrationId)?.billingId ||
      null;
    const useForce =
      canForcePaidCancel ||
      Boolean(target?.force) ||
      cancelRow?.billingStatus === "PAID" ||
      cancelRow?.billingStatus === "SUCCESS" ||
      cancelRow?.status === "PAID";
    setCancelTarget(null);
    const toastId = toast.loading("Menghapus peserta UKT…");
    try {
      const qs = new URLSearchParams();
      if (billingId) qs.set("billingId", billingId);
      if (memberId) qs.set("memberId", memberId);
      if (useForce) qs.set("force", "1");
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      const res = await fetch(
        `/api/admin/ukt/registrations/${registrationId}${suffix}`,
        { method: "DELETE" },
      );
      const data = await parseApiJson<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal membatalkan");
      if (memberId) {
        clearMemberFromUktLocal(memberId);
      }
      toast.success(
        data.message ||
          "Peserta berhasil dihapus dari UKT beserta tagihan terkait",
        { id: toastId },
      );
      void requestServerRowsSync({ silent: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membatalkan", {
        id: toastId,
      });
    } finally {
      if (memberId) setMemberPending(memberId, false);
    }
  };

  const handleDeleteBilling = async () => {
    if (!deleteBillingTarget) return;
    const { billingId, memberId, billingStatus } = deleteBillingTarget;
    if (isMemberPending(memberId)) return;
    setMemberPending(memberId, true);
    try {
      const force =
        billingStatus === "PAID" ||
        billingStatus === "SUCCESS" ||
        billingStatus === "APPROVED";
      const qs = force ? "?force=1" : "";
      const res = await fetch(`/api/admin/billing/${billingId}${qs}`, {
        method: "DELETE",
      });
      const data = await parseApiJson<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menghapus tagihan");
      patchRow(memberId, {
        billingId: null,
        billingStatus: null,
        billingAmount: null,
      });
      toast.success(data.message || "Tagihan UKT berhasil dihapus");
      setDeleteBillingTarget(null);
      setSelectedMember((prev) =>
        prev && prev.memberId === memberId
          ? { ...prev, billingId: null, billingStatus: null, billingAmount: null }
          : prev,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus tagihan");
    } finally {
      setMemberPending(memberId, false);
    }
  };

  const handleSaveBeltFees = async () => {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        ...beltFees,
        komisiRanting,
      };
      if (props.selectedPeriodId) {
        payload.eventId = props.selectedPeriodId;
        payload.updateGlobal = updateFeesGlobal;
      } else {
        payload.updateGlobal = true;
      }
      const res = await fetch("/api/admin/ukt/fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseApiJson<{
        error?: string;
        periodSnapshot?: boolean;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan biaya sabuk");
      if (props.selectedPeriodId && !updateFeesGlobal) {
        toast.success("Biaya sabuk periode (snapshot) disimpan");
      } else if (props.selectedPeriodId && updateFeesGlobal) {
        toast.success("Biaya sabuk periode & global cabang disimpan");
      } else {
        toast.success("Biaya sabuk global cabang disimpan");
      }
      setShowBeltFees(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (row: UktMemberRow) => {
    if (periodLocked) {
      toast.error("Periode dikunci — verifikasi ditutup");
      return;
    }
    if (!row.registrationId) return;
    if (isMemberPending(row.memberId)) return;
    setMemberPending(row.memberId, true);
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
      patchRow(row.memberId, {
        billingStatus: "PAID",
        status: "PAID",
      });
      toast.success("Pembayaran diverifikasi — status Menunggu Ujian");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setMemberPending(row.memberId, false);
    }
  };

  /** Ranting: Terima daftar mandiri + bayar → teruskan ke cabang. */
  const handleAcceptSelfRegistration = async (row: UktMemberRow) => {
    if (periodLocked) {
      toast.error("Periode dikunci — tidak dapat menerima pendaftaran");
      return;
    }
    if (!row.registrationId) return;
    setMemberPending(row.memberId, true);
    try {
      const res = await fetch(
        `/api/admin/ukt/registrations/${row.registrationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accept_self_registration" }),
        },
      );
      const data = await parseApiJson<{
        error?: string;
        billingId?: string;
        billingStatus?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menerima pendaftaran");
      patchRow(row.memberId, {
        status: "APPROVED",
        billingId: data.billingId ?? row.billingId,
        billingStatus: data.billingStatus ?? "WAITING_VERIFICATION",
        selfRegistration: false,
        memberPaymentConfirmedAt: null,
      });
      toast.success("Diterima — diteruskan ke cabang (Menunggu Verifikasi)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setMemberPending(row.memberId, false);
    }
  };

  const handleRejectSelfRegistration = async (row: UktMemberRow) => {
    if (periodLocked) {
      toast.error("Periode dikunci — tidak dapat menolak pendaftaran");
      return;
    }
    if (!row.registrationId) return;
    if (
      !window.confirm(
        `Tolak pengajuan UKT ${formatMemberName(row.fullName)}?${
          row.memberPaymentConfirmedAt
            ? " Anggota sudah konfirmasi bayar — koordinasikan pengembalian."
            : ""
        }`,
      )
    ) {
      return;
    }
    setMemberPending(row.memberId, true);
    try {
      const res = await fetch(
        `/api/admin/ukt/registrations/${row.registrationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reject_self_registration" }),
        },
      );
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menolak");
      patchRow(row.memberId, {
        registrationId: null,
        status: "BELUM_DAFTAR",
        billingId: null,
        billingStatus: null,
        billingAmount: null,
        selfRegistration: false,
        memberPaymentConfirmedAt: null,
      });
      toast.success("Pengajuan ditolak");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setMemberPending(row.memberId, false);
    }
  };

  /** Ranting: ajukan Bayar UKT → Menunggu Verifikasi (bukan lunas). */
  const handleBayarUkt = async (
    targets: UktMemberRow[],
    opts?: { openNota?: boolean },
  ) => {
    if (periodLocked) {
      toast.error("Periode dikunci — pengajuan bayar ditutup");
      return;
    }
    const rows = targets.filter(
      (r) => r.registrationId && canRantingSubmitUktPayment(r),
    );
    if (rows.length === 0) {
      toast.error("Pilih peserta yang belum diajukan / belum lunas");
      return;
    }
    setLoading(true);
    let ok = 0;
    const submittedIds: string[] = [];
    const billingByMember = new Map<string, string>();
    try {
      const concurrency = 4;
      for (let i = 0; i < rows.length; i += concurrency) {
        const chunk = rows.slice(i, i + concurrency);
        const results = await Promise.all(
          chunk.map(async (row) => {
            try {
              if (row.billingId) {
                const res = await fetch(`/api/admin/billing/${row.billingId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "submit_for_verification" }),
                });
                const data = await parseApiJson<{ error?: string }>(res);
                if (!res.ok) throw new Error(data.error || "Gagal mengajukan");
                return { memberId: row.memberId, billingId: row.billingId };
              }
              if (row.registrationId) {
                const res = await fetch(
                  `/api/admin/ukt/registrations/${row.registrationId}`,
                  {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "submit_for_verification",
                    }),
                  },
                );
                const data = await parseApiJson<{
                  error?: string;
                  billingId?: string;
                }>(res);
                if (!res.ok) throw new Error(data.error || "Gagal mengajukan");
                return {
                  memberId: row.memberId,
                  billingId: data.billingId || null,
                };
              }
            } catch (e) {
              console.error("[handleBayarUkt]", e);
              return null;
            }
            return null;
          }),
        );
        for (const r of results) {
          if (r) {
            ok += 1;
            submittedIds.push(r.memberId);
            if (r.billingId) billingByMember.set(r.memberId, r.billingId);
          }
        }
      }
      if (submittedIds.length > 0) {
        setRows((prev) =>
          prev.map((r) =>
            submittedIds.includes(r.memberId)
              ? {
                  ...r,
                  billingStatus: "WAITING_VERIFICATION",
                  billingId: billingByMember.get(r.memberId) ?? r.billingId,
                }
              : r,
          ),
        );
      }
      if (ok === 0) {
        toast.error("Gagal mengajukan pembayaran ke cabang");
        return;
      }
      toast.success(
        ok === 1
          ? "Diajukan ke cabang — menunggu verifikasi (belum lunas)"
          : `${ok}/${rows.length} diajukan ke cabang — menunggu verifikasi`,
      );
      // Nota tidak otomatis — gunakan Cetak Nota di toolbar bila perlu.
      if (opts?.openNota === true) {
        openPrintNota(
          true,
          submittedIds.length > 0 ? submittedIds : undefined,
        );
      }
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  const handleBulkMarkPaid = async () => {
    if (periodLocked) {
      toast.error("Periode dikunci — verifikasi ditutup");
      return;
    }
    const targets = selectedRows.filter(
      (r) => r.registrationId && canCabangVerifyUktPayment(r),
    );
    if (targets.length === 0) {
      toast.error("Pilih peserta yang belum lunas");
      return;
    }
    setLoading(true);
    let ok = 0;
    const paidIds: string[] = [];
    try {
      const concurrency = 4;
      for (let i = 0; i < targets.length; i += concurrency) {
        const chunk = targets.slice(i, i + concurrency);
        const results = await Promise.all(
          chunk.map(async (row) => {
            try {
              if (row.billingId) {
                const res = await fetch(`/api/admin/billing/${row.billingId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "approve" }),
                });
                return res.ok ? row.memberId : null;
              }
              if (row.registrationId) {
                const res = await fetch(
                  `/api/admin/ukt/registrations/${row.registrationId}`,
                  {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "mark_paid" }),
                  },
                );
                return res.ok ? row.memberId : null;
              }
            } catch {
              return null;
            }
            return null;
          }),
        );
        for (const id of results) {
          if (id) {
            ok += 1;
            paidIds.push(id);
          }
        }
      }
      if (paidIds.length > 0) {
        setRows((prev) =>
          prev.map((r) =>
            paidIds.includes(r.memberId)
              ? { ...r, billingStatus: "PAID", status: "PAID" }
              : r,
          ),
        );
      }
      toast.success(`${ok}/${targets.length} pembayaran diverifikasi`);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  const openPrintNota = (onlySelected: boolean, forceMemberIds?: string[]) => {
    if (forceMemberIds) {
      if (forceMemberIds.length === 0) {
        toast.error("Pilih peserta yang akan masuk nota");
        return;
      }
      setSelectedIds(new Set(forceMemberIds));
    } else if (onlySelected && selectedRows.length === 0) {
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
    const title = selectedPeriod?.title || periodTitle;
    const approved = rows.filter(
      (r) =>
        r.registrationId &&
        isRegistrationApproved(r.status) &&
        matchesDojoFilter(r.dojoId),
    );
    if (approved.length === 0) {
      toast.error("Belum ada peserta disetujui");
      return;
    }

    // Admin cabang: selalu format ringkas (Total Ranting / List / Jumlah kyu)
    const text = isCabang
      ? buildUktCabangWaReportText(title, approved)
      : buildUktRantingWaReportText(
          title,
          resolveUktWaDojoLabel({
            effectiveDojoId: effectiveDojo,
            dojos: props.dojos,
            approvedRows: approved,
            loginDojoName: props.loginDojoName,
          }),
          approved,
        );

    // Buka WhatsApp dengan teks siap kirim (pilih penerima manual) — bukan salin clipboard.
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    const opened = window.open(waUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      toast.error("Popup diblokir — izinkan jendela baru untuk membuka WhatsApp");
      return;
    }
    toast.success("WhatsApp dibuka — pilih penerima lalu kirim laporan");
  };

  const ensureInviteSnapshot = (eventId: string) => {
    void fetch("/api/admin/ukt/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    }).catch(() => {
      /* snapshot opsional — halaman publik punya fallback */
    });
  };

  const copyTextRobust = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = text;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(el);
        return ok;
      } catch {
        return false;
      }
    }
  };

  const copyInviteLink = async () => {
    if (!props.selectedPeriodId) {
      toast.error("Pilih periode UKT terlebih dahulu");
      return;
    }
    // Salin dulu (masih dalam gesture klik) — jangan await API sebelum clipboard.
    const url = buildUktInviteUrl(props.selectedPeriodId);
    ensureInviteSnapshot(props.selectedPeriodId);
    const ok = await copyTextRobust(url);
    if (ok) {
      toast.success("Link undangan UKT disalin");
    } else {
      toast.error("Gagal menyalin — salin manual dari bilah alamat setelah buka link");
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const shareInviteWa = () => {
    if (!props.selectedPeriodId) {
      toast.error("Pilih periode UKT terlebih dahulu");
      return;
    }
    // window.open harus sinkron dengan klik (jangan await fetch dulu).
    const url = buildUktInviteUrl(props.selectedPeriodId);
    ensureInviteSnapshot(props.selectedPeriodId);
    const title = selectedPeriod?.title || periodTitle;
    const text = `Undangan ${title}\n\nKepada Yth. Pengurus Ranting INKAI Surabaya,\nsilakan buka undangan & daftarkan anggota ranting:\n${url}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    const opened = window.open(waUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      toast.error("Popup diblokir — izinkan jendela baru untuk membuka WhatsApp");
      return;
    }
    toast.success("WhatsApp dibuka — bagikan undangan UKT");
  };

  const kpiCards = [
    {
      label: "Peserta",
      value: kpi.total,
      icon: Users,
      color: "text-blue-600",
      filter: "registered",
    },
    { label: "Menunggu Terima", value: kpi.menungguTerima, icon: Clock, color: "text-orange-600", filter: "menunggu_terima_ranting" },
    { label: "Belum Bayar", value: kpi.belumBayar, icon: Clock, color: "text-yellow-600", filter: "belum_bayar" },
    { label: "Menunggu Verif.", value: kpi.menungguVerifikasi, icon: Wallet, color: "text-purple-600", filter: "menunggu_verifikasi" },
    { label: "Menunggu Ujian", value: kpi.menungguUjian, icon: FileText, color: "text-indigo-600", filter: "menunggu_ujian" },
    { label: "Lulus", value: kpi.lulus, icon: CheckCircle2, color: "text-emerald-600", filter: "lulus" },
    { label: "Selesai", value: kpi.selesai, icon: Check, color: "text-green-600", filter: "selesai" },
    {
      label: "Gagal/Mengulang",
      value: kpi.gagal + kpi.mengulang,
      icon: XCircle,
      color: "text-red-600",
      filter: "gagal_mengulang",
    },
  ];

  const periodActionBtn =
    "h-10 min-h-10 justify-center px-2 text-xs sm:h-9 sm:justify-start sm:px-3 sm:text-sm";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Sticky semester/tahun — disembunyikan bila shell halaman sudah punya UktTermNav */}
      {!props.hideStickyTermBar ? (
      <div className="sticky top-12 z-30 -mx-3 space-y-2 border-b border-border/50 bg-background/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:top-16 sm:-mx-6 sm:space-y-3 sm:px-6 sm:py-3">
        {props.headerNote ? (
          <p className="hidden text-sm text-muted-foreground sm:block">{props.headerNote}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={props.semester}
            onValueChange={(v) => syncNavigateTerm({ semester: v as UktSemester })}
          >
            <SelectTrigger
              className="h-9 w-[8.5rem] border-border/80 bg-background text-sm font-medium shadow-none sm:h-8"
              aria-label="Pilih semester UKT"
            >
              <SelectValue placeholder="Semester" />
            </SelectTrigger>
            <SelectContent className="min-w-[8.5rem]">
              <SelectItem value="I">Semester I</SelectItem>
              <SelectItem value="II">Semester II</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            className="h-9 w-20 text-sm font-medium sm:h-8"
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
            aria-label="Tahun UKT"
          />
        </div>
      </div>
      ) : null}

      {/* Period actions — di luar sticky agar tidak memakan viewport HP */}
      <Card className="border-inkai-red/20 bg-gradient-to-r from-background to-muted/30 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:p-4">
          {!isArchiveView &&
            props.selectedPeriodId &&
            registrationDeadlineIso &&
            !props.createMode && (
              <UktFloatingCountdown
                targetIso={registrationDeadlineIso}
                className="w-full sm:min-w-[min(100%,18rem)] sm:max-w-xl"
              />
            )}
          <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            {selectablePeriodsForTerm.length > 1 && (
              <Select
                value={props.selectedPeriodId || ""}
                onValueChange={(v) =>
                  navigatePeriod({
                    semester: props.semester,
                    year: String(props.year),
                    period: v,
                    create: "",
                  })
                }
              >
                <SelectTrigger className="col-span-2 h-10 w-full sm:h-9 sm:w-56">
                  <SelectValue
                    placeholder={
                      viewMode === "archive"
                        ? "Pilih arsip periode"
                        : "Pilih periode aktif"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {selectablePeriodsForTerm.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                      {viewMode === "archive"
                        ? p.archived
                          ? " (arsip)"
                          : p.locked
                            ? " (kunci)"
                            : ""
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {showCreatePeriod && isCabang && (
              <Button
                onClick={openCreateWizard}
                disabled={loading}
                className={`col-span-2 bg-inkai-red hover:bg-inkai-red/90 sm:col-span-1 ${periodActionBtn}`}
              >
                <Plus className="mr-1 h-4 w-4" />
                Buat Periode
              </Button>
            )}
            {viewMode === "registration" && !showCreatePeriod && isCabang && (
              <Button
                variant="outline"
                onClick={goBackToCreatePeriod}
                disabled={loading}
                className={periodActionBtn}
              >
                <Plus className="mr-1 h-4 w-4" />
                Periode baru
              </Button>
            )}
            {isCabang && props.selectedPeriodId && (
              <Button
                variant="outline"
                onClick={() => setShowExamDay(true)}
                disabled={periodLocked}
                className={periodActionBtn}
              >
                <ClipboardCheck className="mr-1 h-4 w-4" />
                Hari-H
              </Button>
            )}
            {isCabang && (
              <>
                <Button
                  variant="outline"
                  onClick={openExportDialog}
                  className={periodActionBtn}
                >
                  <Download className="mr-1 h-4 w-4" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  onClick={buildWaReport}
                  className={periodActionBtn}
                >
                  <MessageCircle className="mr-1 h-4 w-4" />
                  Laporan WA
                </Button>
                {props.selectedPeriodId && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => void copyInviteLink()}
                      className={periodActionBtn}
                    >
                      <Link2 className="mr-1 h-4 w-4" />
                      Salin Undangan
                    </Button>
                    <Button
                      variant="outline"
                      onClick={shareInviteWa}
                      className={periodActionBtn}
                    >
                      <Share2 className="mr-1 h-4 w-4" />
                      WA Undangan
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => openPrintNota(false)}
                  className={periodActionBtn}
                >
                  <Printer className="mr-1 h-4 w-4" />
                  Cetak Nota
                </Button>
                {(viewMode === "registration" || Boolean(props.selectedPeriodId)) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        aria-label="Aksi lainnya"
                        className={periodActionBtn}
                      >
                        <MoreHorizontal className="mr-1 h-4 w-4" />
                        Lainnya
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-48">
                      {viewMode === "registration" && (
                        <DropdownMenuItem
                          onClick={() => router.push("/admin/pengaturan/ukt")}
                        >
                          <Settings2 className="h-4 w-4" />
                          Syarat UKT
                        </DropdownMenuItem>
                      )}
                      {props.selectedPeriodId && (
                        <DropdownMenuItem onClick={() => setEditingTitle(true)}>
                          <Pencil className="h-4 w-4" />
                          Ubah judul
                        </DropdownMenuItem>
                      )}
                      {props.selectedPeriodId && (
                        <DropdownMenuItem
                          onClick={openBeltFeesDialog}
                          disabled={periodLocked}
                        >
                          <Wallet className="h-4 w-4" />
                          Biaya Sabuk
                        </DropdownMenuItem>
                      )}
                      {props.selectedPeriodId && (
                        <>
                          <DropdownMenuSeparator />
                          {periodLocked ? (
                            <DropdownMenuItem
                              onClick={() => void handlePeriodArchive(false)}
                              disabled={loading}
                            >
                              <Archive className="h-4 w-4" />
                              Buka arsip
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => void handlePeriodArchive(true)}
                              disabled={loading}
                            >
                              <Archive className="h-4 w-4" />
                              Arsipkan
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
            {isDojoAdmin && props.selectedPeriodId && (
              <>
                <Button
                  variant="outline"
                  onClick={buildWaReport}
                  className={periodActionBtn}
                >
                  <MessageCircle className="mr-1 h-4 w-4" />
                  Laporan WA
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void copyInviteLink()}
                  className={periodActionBtn}
                >
                  <Link2 className="mr-1 h-4 w-4" />
                  Salin Undangan
                </Button>
                <Button
                  variant="outline"
                  onClick={shareInviteWa}
                  className={periodActionBtn}
                >
                  <Share2 className="mr-1 h-4 w-4" />
                  WA Undangan
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openPrintNota(false)}
                  className={periodActionBtn}
                >
                  <Printer className="mr-1 h-4 w-4" />
                  Cetak Nota
                </Button>
              </>
            )}
            {!isCabang && !isDojoAdmin && (
              <>
                <Button
                  variant="outline"
                  onClick={buildWaReport}
                  className={periodActionBtn}
                >
                  <MessageCircle className="mr-1 h-4 w-4" />
                  Laporan WA
                </Button>
                {props.selectedPeriodId && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => void copyInviteLink()}
                      className={periodActionBtn}
                    >
                      <Link2 className="mr-1 h-4 w-4" />
                      Salin Undangan
                    </Button>
                    <Button
                      variant="outline"
                      onClick={shareInviteWa}
                      className={periodActionBtn}
                    >
                      <Share2 className="mr-1 h-4 w-4" />
                      WA Undangan
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => openPrintNota(false)}
                  className={periodActionBtn}
                >
                  <Printer className="mr-1 h-4 w-4" />
                  Cetak Nota
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {isDojoAdmin && !props.selectedPeriodId && viewMode === "registration" && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Periode UKT <b>{formatUktPeriodLabel(props.semester, props.year)}</b> belum
              dibuat oleh admin cabang. Pilih semester lain jika perlu, atau buka{" "}
              <a href="/admin/ukt/arsip" className="underline font-medium">
                Arsip UKT
              </a>{" "}
              untuk riwayat, atau hubungi cabang untuk membuka periode baru.
            </span>
          </CardContent>
        </Card>
      )}

      {viewMode === "archive" && !props.selectedPeriodId && (
        <Card className="border-muted">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm text-muted-foreground">
            <Archive className="h-4 w-4 shrink-0" />
            <span>
              Belum ada arsip UKT untuk{" "}
              <b className="text-foreground">
                {formatUktPeriodLabel(props.semester, props.year)}
              </b>
              . Periode aktif dikelola di menu{" "}
              <a href="/admin/ukt" className="underline font-medium text-foreground">
                Pendaftaran
              </a>
              .
            </span>
          </CardContent>
        </Card>
      )}

      {props.selectedPeriodId && selectedPeriod && (
        <details
          className="rounded-xl border border-muted bg-card"
          open={jadwalOpen}
          onToggle={(e) => setJadwalOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer list-none px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Jadwal periode
                </span>
              </div>
              <span className="text-xs font-normal text-muted-foreground sm:hidden">
                {jadwalOpen ? "Sembunyikan" : "Tampilkan"}
              </span>
            </div>
            {!jadwalOpen && (
              <p className="mt-1.5 text-sm font-medium text-foreground sm:hidden">
                Batas:{" "}
                {registrationDeadlineIso
                  ? formatUktRegistrationDeadline(registrationDeadlineIso)
                  : "—"}
                {registrationOpen ? " · terbuka" : ""}
              </p>
            )}
          </summary>
          <div className="border-t px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Buka pendaftaran</p>
                <p className="text-base font-semibold tracking-tight text-foreground">
                  {registrationOpenIso
                    ? formatUktRegistrationDeadline(registrationOpenIso)
                    : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground">Batas pendaftaran</p>
                  <Badge
                    variant={registrationOpen ? "default" : "secondary"}
                    className={registrationOpen ? "ukt-open-badge gap-1.5" : undefined}
                  >
                    {registrationOpen && (
                      <span className="ukt-open-badge-dot" aria-hidden />
                    )}
                    {registrationOpen
                      ? "Masih terbuka"
                      : registrationNotYetOpen
                        ? "Belum dibuka"
                        : "Sudah tutup"}
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
                <p className="text-base font-semibold tracking-tight text-foreground">
                  {registrationDeadlineIso
                    ? formatUktRegistrationDeadline(registrationDeadlineIso)
                    : "—"}
                </p>
              </div>
              {(props.periodMeta?.examAt || props.periodMeta?.examLocation) && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Ujian</p>
                  <p className="text-base font-semibold tracking-tight text-foreground">
                    {props.periodMeta?.examAt
                      ? formatUktRegistrationDeadline(props.periodMeta.examAt)
                      : "—"}
                  </p>
                  {props.periodMeta?.examLocation ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {props.periodMeta.examLocation}
                    </p>
                  ) : null}
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Pejabat</p>
                <p className="text-sm font-medium text-foreground">
                  Bidang Ujian{" "}
                  <span className="font-semibold">{periodOfficers.bidangUjianName}</span>
                </p>
                <p className="text-sm font-medium text-foreground">
                  Bendahara{" "}
                  <span className="font-semibold">
                    {periodOfficers.bendaharaCabangName}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </details>
      )}

      {props.selectedPeriodId && !registrationOpen && (
        <Card
          className={`ukt-registration-alert overflow-hidden ${
            registrationNotYetOpen
              ? "ukt-registration-alert--pending"
              : "ukt-registration-alert--closed"
          }`}
        >
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div
              className={`flex items-start gap-2.5 text-sm ${
                registrationNotYetOpen
                  ? "text-amber-900 dark:text-amber-100"
                  : "text-red-900 dark:text-red-100"
              }`}
            >
              <span className="ukt-registration-alert-icon mt-0.5 inline-flex shrink-0">
                <AlertTriangle
                  className={`h-4 w-4 ${
                    registrationNotYetOpen ? "text-amber-600" : "text-red-600"
                  }`}
                />
              </span>
              <span className="leading-relaxed">
                {registrationNotYetOpen
                  ? "Pendaftaran untuk periode ini belum dibuka."
                  : "Batas waktu pendaftaran untuk periode ini sudah lewat."}
                {isCabang
                  ? registrationNotYetOpen
                    ? " Atur tanggal buka agar ranting dapat mendaftarkan peserta."
                    : " Perpanjang batas pendaftaran agar ranting dapat mendaftarkan peserta."
                  : " Hubungi admin cabang untuk penyesuaian jadwal pendaftaran."}
              </span>
            </div>
            {isCabang && (
              <Button size="sm" onClick={openRegistrationDeadlineDialog} disabled={loading}>
                {registrationNotYetOpen ? "Atur Jadwal" : "Perpanjang Batas"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(640px,94vw)] -translate-x-1/2 pb-[env(safe-area-inset-bottom)]">
          <Card className="shadow-xl">
            <CardContent className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-[120px] flex-1 text-sm text-muted-foreground">
                <span className="font-medium text-inkai-red">{selectedIds.size} terpilih</span>
              </div>
              {isCabang && (
                <Button variant="outline" size="sm" onClick={() => openPrintNota(true)} disabled={loading}>
                  <Printer className="mr-1 h-4 w-4" />
                  Nota
                </Button>
              )}
              {isDojoAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openPrintNota(true)}
                  disabled={loading}
                >
                  <Printer className="mr-1 h-4 w-4" />
                  Nota
                </Button>
              )}
              {isDojoAdmin && (
                <Button
                  size="sm"
                  className="bg-inkai-red hover:bg-inkai-red/90"
                  onClick={() =>
                    void handleBayarUkt(
                      selectedRows.filter((r) => canRantingSubmitUktPayment(r)),
                    )
                  }
                  disabled={
                    loading ||
                    selectedRows.filter((r) => canRantingSubmitUktPayment(r))
                      .length === 0
                  }
                  title="Ajukan ke cabang untuk verifikasi (bukan lunas)"
                >
                  <Banknote className="mr-1 h-4 w-4" />
                  Bayar UKT
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
                <Button variant="outline" size="sm" onClick={openExportDialog} disabled={loading}>
                  <Download className="mr-1 h-4 w-4" />
                  Export
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())} disabled={loading}>
                Tutup
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {periodLocked && props.selectedPeriodId && (
        <Card className="border-slate-400 bg-slate-50 dark:bg-slate-950/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div className="flex items-start gap-2">
              <Archive className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  Periode {props.periodMeta?.archived ? "diarsipkan" : "dikunci"}
                </p>
                <p className="text-muted-foreground">
                  Pendaftaran, verifikasi, dan perubahan hasil dibatasi. Export & laporan tetap
                  tersedia.
                </p>
              </div>
            </div>
            {isCabang && (
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => void handlePeriodArchive(false)}
              >
                Buka kembali
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {props.selectedPeriodId && isCabang && (
        <Card className="border-muted">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Status setoran UKT</p>
                <p className="text-xs text-muted-foreground">
                  Cabang mencatat status setoran ranting (diterima / reset).
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {props.dojos
                .filter((d) => rows.some((r) => r.dojoId === d.id && r.registrationId))
                .map((d) => {
                const dep = depositMap[d.id];
                const status: UktDepositStatus = dep?.status ?? "PENDING";
                return (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {uktDepositStatusLabel(status)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {!periodLocked && (
                        <>
                          {status !== "RECEIVED" && (
                            <Button
                              size="sm"
                              className="h-7 bg-inkai-red text-xs hover:bg-inkai-red/90"
                              disabled={loading}
                              onClick={() => void handleDepositStatus(d.id, "RECEIVED")}
                            >
                              Terima
                            </Button>
                          )}
                          {status === "RECEIVED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={loading}
                              onClick={() => void handleDepositStatus(d.id, "PENDING")}
                            >
                              Reset
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {depositRecon.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ranting</TableHead>
                      <TableHead className="text-right">Peserta</TableHead>
                      <TableHead className="text-right">Lunas</TableHead>
                      <TableHead className="text-right">Total tagihan</TableHead>
                      <TableHead>Status setor</TableHead>
                      <TableHead>Keterangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {depositRecon.map((row) => (
                      <TableRow key={row.dojoId}>
                        <TableCell className="font-medium">{row.dojoName}</TableCell>
                        <TableCell className="text-right">{row.participantCount}</TableCell>
                        <TableCell className="text-right">{row.paidCount}</TableCell>
                        <TableCell className="text-right">
                          {formatRupiahNota(row.expectedAmount)}
                        </TableCell>
                        <TableCell>{uktDepositStatusLabel(row.depositStatus)}</TableCell>
                        <TableCell className="text-muted-foreground">{row.gapLabel}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div
        className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${
          isArchiveView ? "lg:grid-cols-7" : "lg:grid-cols-8"
        }`}
      >
        {kpiCards.map((card) => {
          const isDefault =
            !localView &&
            (card.filter === "all" ||
              (isArchiveView && card.filter === "registered"));
          const active = localView === card.filter || isDefault;
          return (
          <Card
            key={card.label}
            className={`cursor-pointer transition-all hover:shadow-md hover:ring-1 hover:ring-inkai-red/30 ${
              active ? "ring-2 ring-inkai-red" : ""
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
          );
        })}
      </div>

      {props.dbError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{props.dbError}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void requestServerRowsSync()}
              disabled={tableRefreshing}
            >
              <RefreshCw
                className={`mr-1 h-4 w-4 ${tableRefreshing ? "animate-spin" : ""}`}
              />
              {tableRefreshing ? "Memuat…" : "Muat Ulang"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search & inline filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="min-w-0 w-full sm:w-auto sm:min-w-[14rem] sm:flex-1 sm:max-w-md">
          <UktSearchBar
            allRows={archiveSearchRows}
            value={localQ}
            onChange={(q) => {
              setLocalQ(q);
              setLocalPage(1);
            }}
            placeholder={
              !isArchiveView
                ? "Cari nama untuk daftarkan / temukan peserta…"
                : "Cari nama atau NIA…"
            }
            showRegistrationStatus={!isArchiveView}
            enableRemoteSuggest={!isArchiveView}
            dojoFilter={
              effectiveDojoIds?.length === 1 ? effectiveDojoIds[0] : ""
            }
            onSelectRemote={(member) => {
              if (!props.selectedPeriodId) {
                toast.error("Pilih periode UKT dulu");
                return;
              }
              if (rows.some((r) => r.memberId === member.id)) return;
              void (async () => {
                const toastId = toast.loading("Memuat syarat UKT…");
                try {
                  const params = new URLSearchParams({
                    memberId: member.id,
                    periodId: props.selectedPeriodId!,
                  });
                  const res = await fetch(
                    `/api/admin/ukt/members?${params.toString()}`,
                  );
                  const data = await parseApiJson<{
                    error?: string;
                    uktRow?: UktMemberRow;
                  }>(res);
                  if (!res.ok || !data.uktRow) {
                    // #region agent log
                    fetch(
                      "http://127.0.0.1:7385/ingest/dfa53adf-1e28-4ee0-ab88-bbc21b01308f",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "X-Debug-Session-Id": "f0acf0",
                        },
                        body: JSON.stringify({
                          sessionId: "f0acf0",
                          hypothesisId: "B",
                          location: "UktDashboard.tsx:hydrate-fail",
                          message: "hydrate failed",
                          data: {
                            status: res.status,
                            hasError: Boolean(data.error),
                          },
                          timestamp: Date.now(),
                        }),
                      },
                    ).catch(() => {});
                    // #endregion
                    throw new Error(data.error || "Gagal memuat anggota");
                  }
                  const row = data.uktRow;
                  const hiddenByDojo = Boolean(
                    effectiveDojoIds &&
                      !effectiveDojoIds.includes(row.dojoId),
                  );
                  // #region agent log
                  fetch(
                    "http://127.0.0.1:7385/ingest/dfa53adf-1e28-4ee0-ab88-bbc21b01308f",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "X-Debug-Session-Id": "f0acf0",
                      },
                      body: JSON.stringify({
                        sessionId: "f0acf0",
                        hypothesisId: "C",
                        location: "UktDashboard.tsx:hydrate-ok",
                        message: "hydrate ok before setRows",
                        data: {
                          localView,
                          localQLen: localQ.trim().length,
                          hiddenByDojo,
                          hasDojoFilter: Boolean(effectiveDojoIds),
                          status: row.status,
                        },
                        timestamp: Date.now(),
                      }),
                    },
                  ).catch(() => {});
                  // #endregion
                  setRows((prev) => {
                    if (prev.some((r) => r.memberId === row.memberId)) {
                      return prev;
                    }
                    return [...prev, row];
                  });
                  toast.success("Anggota siap didaftarkan UKT", { id: toastId });
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Gagal memuat anggota",
                    { id: toastId },
                  );
                }
              })();
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:contents">
          <Select
            value={localStatus || "all"}
            onValueChange={(v) => {
              setLocalStatus(v === "all" ? "" : v);
              setLocalPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-full sm:h-8 sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {UKT_DISPLAY_FILTER_OPTIONS.filter(
                (opt) => !(isArchiveView && opt.value === "belum_daftar"),
              ).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            className="h-10 sm:h-8"
            onClick={() => setCompactView((v) => !v)}
            title={compactView ? "Tampilan lengkap" : "Tampilan ringkas"}
          >
            <LayoutList className="mr-1 h-4 w-4" />
            {compactView ? "Lengkap" : "Ringkas"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 sm:h-8"
            onClick={() => resetTableFilters()}
            title="Reset filter status, cari, dan ranting"
            disabled={tableRefreshing}
          >
            Reset filter
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 sm:h-8"
            onClick={() => void requestServerRowsSync()}
            title="Muat ulang data tabel tanpa refresh halaman"
            disabled={tableRefreshing || loading}
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${tableRefreshing ? "animate-spin" : ""}`}
            />
            {tableRefreshing ? "Memuat…" : "Refresh"}
          </Button>

          {(!isDojoAdmin || isMultiDojoAdmin) && (
            <Select
              value={localDojo || "all"}
              onValueChange={(v) => {
                setLocalDojo(v === "all" ? "" : v);
                setLocalPage(1);
              }}
            >
              <SelectTrigger className="col-span-2 h-10 w-full sm:col-span-1 sm:h-8 sm:w-[min(100%,16rem)] sm:min-w-[11rem]">
                <SelectValue placeholder="Ranting" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {isDojoAdmin ? "Semua ranting dikelola" : "Semua ranting"}
                </SelectItem>
                {!isDojoAdmin &&
                  (props.dojoGroups ?? []).map((g) => (
                    <SelectItem key={g.value} value={g.value} title={g.label}>
                      {g.shortLabel}
                    </SelectItem>
                  ))}
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
            <SelectTrigger className="h-10 w-full sm:h-8 sm:w-28">
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

          {!isDojoAdmin && (
            <Button
              type="button"
              variant="outline"
              className="h-10 sm:h-8"
              onClick={() => setShowAddMember(true)}
            >
              <UserPlus className="mr-1 h-4 w-4" />
              Tambah Anggota
            </Button>
          )}
        </div>
      </div>

      {isDojoAdmin && (
        <details
          className="rounded-xl border border-muted bg-card open:pb-0"
          open={alurOpen}
          onToggle={(e) => setAlurOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              Panduan aksi ranting
              <span className="text-xs font-normal text-muted-foreground">
                {alurOpen ? "Sembunyikan" : "Tampilkan"}
              </span>
            </span>
          </summary>
          <div className="space-y-1 border-t px-3 py-3 text-sm text-muted-foreground">
            <p>
              Aksi ranting: <b>Daftar UKT</b>, <b>Terima</b>/<b>Tolak</b>{" "}
              (daftar mandiri), <b>Batal UKT</b>, dan <b>Bayar UKT</b>. Cetak
              nota &amp; laporan WA lewat toolbar (manual).
            </p>
            <p>
              <b>Terima</b> = terima pendaftaran mandiri + konfirmasi uang,
              lalu teruskan ke cabang. <b>Bayar UKT</b> = ajukan ke cabang (
              <b>Menunggu Verifikasi</b>), bukan lunas. Cabang yang
              memverifikasi pembayaran, lalu mengisi hasil ujian &amp; Kyu
              Baru.
            </p>
          </div>
        </details>
      )}

      {isCabang && (
        <details
          className="rounded-xl border border-muted bg-card"
          open={alurOpen}
          onToggle={(e) => setAlurOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              Alur pendaftaran UKT
              <span className="text-xs font-normal text-muted-foreground">
                {alurOpen ? "Sembunyikan" : "Tampilkan"}
              </span>
            </span>
          </summary>
          <div className="border-t px-3 py-3 text-sm text-muted-foreground">
            Alur: ranting daftar (<b>Belum Bayar</b>) → ranting{" "}
            <b>Bayar UKT</b> (<b>Menunggu Verifikasi</b>) → cabang{" "}
            <b>Verifikasi</b> (<b>Menunggu Ujian</b>) → isi <b>Kyu Baru</b>{" "}
            (<b>Selesai</b>, otomatis Lulus). Jalur mandiri: anggota daftar →
            ranting <b>Terima</b> dulu (bukan Verifikasi cabang). Batal dari
            ranting (termasuk yang sudah lunas) akan memberi notifikasi ke
            cabang — sesuaikan pengembalian uang di luar sistem bila perlu.
          </div>
        </details>
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
              <TableHead className="hidden w-14 sm:table-cell">Foto</TableHead>
              <SortableTableHead
                label="NIA"
                sortKey="nia"
                activeKey={sort.key}
                activeDir={sort.dir}
                onSort={handleSort}
              />
              <SortableTableHead
                label="Nama Lengkap"
                sortKey="fullName"
                activeKey={sort.key}
                activeDir={sort.dir}
                onSort={handleSort}
              />
              {!compactView && !isDojoAdmin && (
                <>
                  <SortableTableHead
                    label="Tempat"
                    sortKey="birthPlace"
                    activeKey={sort.key}
                    activeDir={sort.dir}
                    onSort={handleSort}
                    className="hidden md:table-cell"
                  />
                  <SortableTableHead
                    label="Tgl Lahir"
                    sortKey="birthDate"
                    activeKey={sort.key}
                    activeDir={sort.dir}
                    onSort={handleSort}
                    className="hidden lg:table-cell"
                  />
                  <SortableTableHead
                    label="JK"
                    sortKey="gender"
                    activeKey={sort.key}
                    activeDir={sort.dir}
                    onSort={handleSort}
                    className="hidden sm:table-cell"
                  />
                  <SortableTableHead
                    label="Alamat"
                    sortKey="address"
                    activeKey={sort.key}
                    activeDir={sort.dir}
                    onSort={handleSort}
                    className="hidden xl:table-cell"
                  />
                </>
              )}
              <SortableTableHead
                label="Kyu Lama"
                sortKey="kyuLama"
                activeKey={sort.key}
                activeDir={sort.dir}
                onSort={handleSort}
              />
              <SortableTableHead
                label="Kyu Baru"
                sortKey="kyuBaru"
                activeKey={sort.key}
                activeDir={sort.dir}
                onSort={handleSort}
              />
              {(compactView || isDojoAdmin) && (
                <>
                  <SortableTableHead
                    label="Kehadiran"
                    sortKey="attendancePct"
                    activeKey={sort.key}
                    activeDir={sort.dir}
                    onSort={handleSort}
                    className="min-w-20"
                  />
                  <TableHead className="min-w-28">Syarat</TableHead>
                </>
              )}
              {!isDojoAdmin && !compactView && (
                <TableHead className="hidden md:table-cell">Dokumen</TableHead>
              )}
              {!isDojoAdmin && !compactView && (
                <SortableTableHead
                  label="Ranting"
                  sortKey="dojoName"
                  activeKey={sort.key}
                  activeDir={sort.dir}
                  onSort={handleSort}
                  className="hidden sm:table-cell"
                />
              )}
              {isMultiDojoAdmin && (
                <SortableTableHead
                  label="Ranting"
                  sortKey="dojoName"
                  activeKey={sort.key}
                  activeDir={sort.dir}
                  onSort={handleSort}
                  className="hidden sm:table-cell"
                />
              )}
              <SortableTableHead
                label="Status"
                sortKey="status"
                activeKey={sort.key}
                activeDir={sort.dir}
                onSort={handleSort}
              />
              <TableHead className="min-w-28">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={20} className="py-12 text-center text-muted-foreground">
                  {rows.length === 0 && !props.dbError
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
                  <TableCell className="hidden sm:table-cell">
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
                      {displayUktKyuLama(row.kyuLama, row.kyuBaru) || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.registrationId && isCabang ? (
                      <select
                        className="h-7 max-w-36 rounded border px-1 text-xs disabled:opacity-60"
                        value={
                          canApplyUktKyuBaru(row) || isUktSelesai(row)
                            ? row.kyuBaru
                              ? formatRankLabel(row.kyuBaru)
                              : ""
                            : ""
                        }
                        onChange={(e) =>
                          handleKyuUpdate(row.registrationId!, e.target.value, row)
                        }
                        disabled={
                          loading ||
                          isMemberPending(row.memberId) ||
                          !canApplyUktKyuBaru(row)
                        }
                        title={
                          canApplyUktKyuBaru(row)
                            ? "Isi Kyu Baru — otomatis Lulus & Selesai"
                            : isUktSelesai(row)
                              ? "UKT selesai"
                              : "Tersedia setelah Verifikasi pembayaran"
                        }
                      >
                        <option value="">
                          {canApplyUktKyuBaru(row)
                            ? "— Pilih —"
                            : isUktSelesai(row)
                              ? formatRankLabel(row.kyuBaru || "") || "—"
                              : "— Setelah verifikasi —"}
                        </option>
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
                          const eligibility = summarizeRowEligibility(
                            row,
                            registrationOpen,
                            registrationNotYetOpen,
                            memberRequirementOpts,
                          );
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
                  {isMultiDojoAdmin && (
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
                    {(() => {
                      const moreItems: {
                        label: string;
                        onSelect: () => void;
                        disabled?: boolean;
                        destructive?: boolean;
                        separatorBefore?: boolean;
                      }[] = [];

                      if (!row.registrationId) {
                        const blockers = getUktRegistrationBlockersWithWaiver(
                          row,
                          {
                            registrationOpen,
                            registrationNotYetOpen,
                            ...memberRequirementOpts,
                          },
                          row.registrationWaiver,
                        );
                        const blocked = blockers.length > 0;
                        if (
                          isCabang &&
                          getUktRegistrationBlockersWithWaiver(
                            row,
                            {
                              registrationOpen,
                              registrationNotYetOpen,
                              requireNoOutstandingDues:
                                registrationPolicy.requireNoOutstandingDues,
                              requireDocuments:
                                registrationPolicy.requireDocuments,
                              requireMinAttendance:
                                registrationPolicy.requireMinAttendance,
                              minAttendancePct:
                                registrationPolicy.minAttendancePct,
                            },
                            row.registrationWaiver,
                          ).length > 0
                        ) {
                          moreItems.push({
                            label: "Waiver",
                            onSelect: () => openWaiverDialog(row),
                            disabled: loading,
                          });
                        }
                        return (
                          <div className="flex flex-wrap items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleRegister(row.memberId)}
                              disabled={
                                isMemberPending(row.memberId) ||
                                !props.selectedPeriodId ||
                                periodLocked ||
                                blocked
                              }
                              title={
                                blocked
                                  ? formatUktRegistrationBlockers(
                                      blockers,
                                      memberRequirementOpts.minAttendancePct,
                                    )
                                  : "Daftarkan ke UKT"
                              }
                            >
                              {isMemberPending(row.memberId)
                                ? "Mendaftar…"
                                : "Daftar UKT"}
                            </Button>
                            {moreItems.length > 0 ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="hidden h-7 text-xs sm:inline-flex"
                                  onClick={() => openWaiverDialog(row)}
                                  disabled={loading}
                                  title="Berikan pengecualian syarat pendaftaran"
                                >
                                  <ShieldCheck className="mr-0.5 h-3 w-3" />
                                  Waiver
                                </Button>
                                <span className="sm:hidden">
                                  <AdminMoreActions
                                    items={moreItems}
                                    className="h-7 w-7 p-0"
                                  />
                                </span>
                              </>
                            ) : null}
                          </div>
                        );
                      }

                      if (isCabang && row.billingId) {
                        moreItems.push({
                          label: "Hapus tagihan",
                          onSelect: () =>
                            setDeleteBillingTarget({
                              billingId: row.billingId!,
                              memberId: row.memberId,
                              name: row.fullName,
                              billingStatus: row.billingStatus,
                            }),
                          disabled: loading || isMemberPending(row.memberId),
                        });
                      }
                      if (
                        ((canCancelUktRegistration(row) &&
                          (isDojoAdmin || isCabang)) ||
                          canForceCancelUktRegistration(
                            row,
                            canForcePaidCancel,
                          )) &&
                        !(isDojoAdmin && isUktSelesai(row))
                      ) {
                        moreItems.push({
                          label: isDojoAdmin ? "Batal UKT" : "Hapus pendaftaran",
                          onSelect: () =>
                            setCancelTarget({
                              id: row.registrationId!,
                              name: row.fullName,
                              memberId: row.memberId,
                              billingId: row.billingId,
                              force: canForceCancelUktRegistration(
                                row,
                                canForcePaidCancel,
                              ),
                            }),
                          disabled: loading || isMemberPending(row.memberId),
                          destructive: true,
                          separatorBefore: moreItems.length > 0,
                        });
                      }

                      return (
                        <div className="flex flex-wrap items-center gap-1">
                          {isDojoAdmin &&
                            (resolveUktDisplayStatus(row) ===
                              "menunggu_terima_ranting" ||
                              resolveUktDisplayStatus(row) ===
                                "menunggu_konfirmasi_ranting") && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-7 bg-inkai-red text-xs hover:bg-inkai-red/90"
                                  onClick={() =>
                                    void handleAcceptSelfRegistration(row)
                                  }
                                  disabled={
                                    loading ||
                                    periodLocked ||
                                    isMemberPending(row.memberId)
                                  }
                                  title="Terima pendaftaran mandiri dan konfirmasi pembayaran — teruskan ke cabang"
                                >
                                  <CheckCircle2 className="mr-0.5 h-3 w-3" />
                                  Terima
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-destructive"
                                  onClick={() =>
                                    void handleRejectSelfRegistration(row)
                                  }
                                  disabled={
                                    loading ||
                                    periodLocked ||
                                    isMemberPending(row.memberId)
                                  }
                                  title="Tolak pengajuan mandiri"
                                >
                                  Tolak
                                </Button>
                              </>
                            )}
                          {isDojoAdmin && canRantingSubmitUktPayment(row) && (
                            <Button
                              size="sm"
                              className="h-7 bg-inkai-red text-xs hover:bg-inkai-red/90"
                              onClick={() => void handleBayarUkt([row])}
                              disabled={
                                loading ||
                                periodLocked ||
                                isMemberPending(row.memberId)
                              }
                              title="Ajukan ke cabang untuk verifikasi (bukan lunas)"
                            >
                              <Banknote className="mr-0.5 h-3 w-3" />
                              Bayar UKT
                            </Button>
                          )}
                          {isCabang && canCabangVerifyUktPayment(row) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => void handleMarkPaid(row)}
                              disabled={
                                loading ||
                                periodLocked ||
                                isMemberPending(row.memberId)
                              }
                              title="Verifikasi pembayaran UKT"
                            >
                              <CheckCircle2 className="mr-0.5 h-3 w-3" />
                              {isMemberPending(row.memberId) ? "…" : "Verifikasi"}
                            </Button>
                          )}
                          {isCabang &&
                            (row.billingStatus === "PAID" ||
                              row.status === "PAID" ||
                              row.status === "SUCCESS") &&
                            !isUktSelesai(row) && (
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
                                <SelectTrigger className="h-7 w-[min(100%,148px)] text-xs">
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
                          {isCabang && isUktSelesai(row) && (
                            <Badge className="h-7 bg-emerald-600 text-xs text-white hover:bg-emerald-600">
                              Selesai
                            </Badge>
                          )}
                          {isDojoAdmin && isUktSelesai(row) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 cursor-not-allowed text-xs opacity-70"
                              disabled
                              title="UKT sudah selesai"
                            >
                              <Check className="mr-0.5 h-3 w-3" />
                              Selesai
                            </Button>
                          )}
                          {/* Desktop: aksi sekunder inline */}
                          <span className="hidden sm:contents">
                            {isCabang && row.billingId && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() =>
                                  setDeleteBillingTarget({
                                    billingId: row.billingId!,
                                    memberId: row.memberId,
                                    name: row.fullName,
                                    billingStatus: row.billingStatus,
                                  })
                                }
                                disabled={loading || isMemberPending(row.memberId)}
                                title="Hapus tagihan UKT saja (pendaftaran tetap)"
                              >
                                <Wallet className="mr-0.5 h-3 w-3" />
                                {isMemberPending(row.memberId) ? "…" : "Hapus tagihan"}
                              </Button>
                            )}
                            {((canCancelUktRegistration(row) &&
                              (isDojoAdmin || isCabang)) ||
                              canForceCancelUktRegistration(
                                row,
                                canForcePaidCancel,
                              )) &&
                            !(isDojoAdmin && isUktSelesai(row)) ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs"
                                onClick={() =>
                                  setCancelTarget({
                                    id: row.registrationId!,
                                    name: row.fullName,
                                    memberId: row.memberId,
                                    billingId: row.billingId,
                                    force: canForceCancelUktRegistration(
                                      row,
                                      canForcePaidCancel,
                                    ),
                                  })
                                }
                                disabled={loading || isMemberPending(row.memberId)}
                                title={
                                  isDojoAdmin
                                    ? "Batalkan pendaftaran UKT"
                                    : "Hapus pendaftaran UKT"
                                }
                              >
                                <Trash2 className="mr-0.5 h-3 w-3" />
                                {isMemberPending(row.memberId)
                                  ? "…"
                                  : isDojoAdmin
                                    ? "Batal UKT"
                                    : "Hapus"}
                              </Button>
                            ) : null}
                          </span>
                          {moreItems.length > 0 ? (
                            <span className="sm:hidden">
                              <AdminMoreActions
                                items={moreItems}
                                className="h-7 w-7 p-0"
                              />
                            </span>
                          ) : null}
                        </div>
                      );
                    })()}
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
                  <div><span className="text-muted-foreground">Kyu Lama:</span> {displayUktKyuLama(selectedMember.kyuLama, selectedMember.kyuBaru) || "—"}</div>
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
                {isCabang && selectedMember.billingId && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setDeleteBillingTarget({
                        billingId: selectedMember.billingId!,
                        memberId: selectedMember.memberId,
                        name: selectedMember.fullName,
                        billingStatus: selectedMember.billingStatus,
                      })
                    }
                    disabled={loading || isMemberPending(selectedMember.memberId)}
                  >
                    <Wallet className="mr-1 h-4 w-4" />
                    Hapus tagihan
                  </Button>
                )}
                {selectedMember.registrationId &&
                  isDojoAdmin &&
                  isUktSelesai(selectedMember) && (
                    <Button variant="outline" disabled title="UKT sudah selesai">
                      <Check className="mr-1 h-4 w-4" />
                      Selesai
                    </Button>
                  )}
                {selectedMember.registrationId &&
                  ((canCancelUktRegistration(selectedMember) &&
                    (isDojoAdmin || isCabang)) ||
                    canForceCancelUktRegistration(
                      selectedMember,
                      canForcePaidCancel,
                    )) &&
                  !(isDojoAdmin && isUktSelesai(selectedMember)) && (
                  <Button
                    variant="destructive"
                    onClick={() =>
                      setCancelTarget({
                        id: selectedMember.registrationId!,
                        name: selectedMember.fullName,
                        memberId: selectedMember.memberId,
                        billingId: selectedMember.billingId,
                        force: canForceCancelUktRegistration(
                          selectedMember,
                          canForcePaidCancel,
                        ),
                      })
                    }
                    disabled={loading || isMemberPending(selectedMember.memberId)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {isDojoAdmin ? "Batal UKT" : "Hapus UKT"}
                  </Button>
                )}
                {!selectedMember.registrationId && (
                  (() => {
                    const blockers = getUktRegistrationBlockersWithWaiver(
                      selectedMember,
                      {
                        registrationOpen,
                        registrationNotYetOpen,
                        ...memberRequirementOpts,
                      },
                      selectedMember.registrationWaiver,
                    );
                    const blocked = blockers.length > 0;
                    return (
                  <Button
                    className="bg-inkai-red"
                    onClick={() => {
                      void (async () => {
                        const id = selectedMember.memberId;
                        await handleRegister(id);
                        setSelectedMember(null);
                      })();
                    }}
                    disabled={
                      loading ||
                      isMemberPending(selectedMember.memberId) ||
                      !props.selectedPeriodId ||
                      periodLocked ||
                      blocked
                    }
                    title={
                      blocked
                        ? formatUktRegistrationBlockers(
                            blockers,
                            memberRequirementOpts.minAttendancePct,
                          )
                        : "Daftar UKT"
                    }
                  >
                    {isMemberPending(selectedMember.memberId)
                      ? "Mendaftar…"
                      : "Daftar UKT"}
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
            <DialogTitle>{isDojoAdmin ? "Batal Pendaftaran UKT?" : "Hapus Pendaftaran UKT?"}</DialogTitle>
            <DialogDescription>
              Peserta <strong>{cancelTarget?.name}</strong> akan dihapus dari daftar UKT periode ini.
              {" "}
              {isCabang || isDojoAdmin
                ? "Semua tagihan UKT terkait (termasuk yang sudah lunas) akan dicoba dihapus terlebih dahulu."
                : cancelRow?.billingId
                  ? "Tagihan UKT terkait juga akan ikut dihapus."
                  : "Jika ada tagihan UKT terkait, tagihan tersebut juga akan ikut dihapus."}{" "}
              {(cancelRow?.billingStatus === "PAID" ||
                cancelRow?.billingStatus === "SUCCESS" ||
                cancelRow?.status === "PAID") && (
                <>
                  {isDojoAdmin
                    ? "Cabang akan mendapat notifikasi. Jika uang sudah disetor, koordinasikan pengembalian dengan cabang di luar sistem."
                    : "Pastikan pengembalian uang (bila ada) dicatat di kas/SOP cabang."}{" "}
                </>
              )}
              Tindakan ini tidak dapat dibatalkan.
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
              Ya, {isDojoAdmin ? "Batalkan" : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteBillingTarget}
        onOpenChange={(o) => !o && setDeleteBillingTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus Tagihan UKT?</DialogTitle>
            <DialogDescription>
              Tagihan UKT untuk <strong>{deleteBillingTarget?.name}</strong> akan
              dihapus.
              {deleteBillingTarget?.billingStatus === "PAID" ||
              deleteBillingTarget?.billingStatus === "SUCCESS"
                ? " Tagihan ini sudah lunas — penghapusan paksa hanya untuk admin cabang."
                : " Pendaftaran UKT peserta tetap ada."}{" "}
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteBillingTarget(null)}
              disabled={loading}
            >
              Tutup
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteBilling()}
              disabled={
                loading ||
                (deleteBillingTarget
                  ? isMemberPending(deleteBillingTarget.memberId)
                  : false)
              }
            >
              Ya, Hapus Tagihan
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
            : rows
          ).filter(
            (r) =>
              r.registrationId &&
              isNotaParticipant(r.status) &&
              matchesDojoFilter(r.dojoId),
          )}
          dojos={props.dojos}
          dojoFilter={
            effectiveDojoIds && effectiveDojoIds.length === 1
              ? effectiveDojo
              : ""
          }
          beltFees={beltFees}
          komisiRanting={komisiRanting}
          isDojoAdmin={isDojoAdmin}
          orgProfile={{
            address: props.orgProfile?.address,
            ...periodOfficers,
          }}
        />
      )}

      <UktExportDialog
        open={showExport}
        onOpenChange={setShowExport}
        rows={rows}
        dojos={props.dojos}
        semester={props.semester}
        year={props.year}
        initialDojoId={effectiveDojo || undefined}
        bidangUjianName={props.orgProfile?.bidangUjianName}
        sekretariatAddress={props.orgProfile?.address}
      />

      <UktExamDayDialog
        open={showExamDay}
        onOpenChange={setShowExamDay}
        eventId={props.selectedPeriodId || ""}
        rows={rows}
        dojos={props.dojos}
        initialDojoId={effectiveDojo || undefined}
        locked={periodLocked}
      />

      <Dialog open={showRegistrationDeadline} onOpenChange={setShowRegistrationDeadline}>
        <DialogContent className="max-w-md gap-4">
          <DialogHeader>
            <DialogTitle>Jadwal Pendaftaran UKT</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">Buka pendaftaran</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ukt-registration-open-date" className="text-sm font-medium">
                  Tanggal
                </label>
                <Input
                  id="ukt-registration-open-date"
                  type="date"
                  lang="id-ID"
                  value={registrationOpenDate}
                  onChange={(e) => setRegistrationOpenDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Jam</label>
                <div className="flex items-center gap-1.5">
                  <Select
                    value={registrationOpenTimeParts.hour}
                    onValueChange={(hour) =>
                      setRegistrationOpenTime(
                        joinTimeInput(hour, registrationOpenTimeParts.minute),
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
                    value={registrationOpenTimeParts.minute}
                    onValueChange={(minute) =>
                      setRegistrationOpenTime(
                        joinTimeInput(registrationOpenTimeParts.hour, minute),
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
            <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">Batas pendaftaran</p>
              </div>
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
              {props.selectedPeriodId
                ? props.feesFromSnapshot
                  ? "Nilai saat ini dari snapshot periode ini. Simpan default hanya ke periode (bukan template global)."
                  : "Simpan default ke snapshot periode ini. Centang opsi di bawah untuk juga memperbarui template global cabang."
                : "Tidak ada periode terpilih — perubahan disimpan ke biaya global cabang (template + komisi)."}
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
            {props.selectedPeriodId ? (
              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-inkai-red"
                  checked={updateFeesGlobal}
                  onChange={(e) => setUpdateFeesGlobal(e.target.checked)}
                />
                <span>
                  Juga update biaya global cabang (berlaku untuk periode baru berikutnya)
                </span>
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">
                Mode tanpa periode: penyimpanan selalu ke biaya global.
              </p>
            )}
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
                sebagai event UKT terpisah. Atur jadwal pendaftaran (tanggal & jam 24 jam) di
                bawah — default buka di awal semester, tutup di akhir semester.
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Judul periode
                </label>
                <Input value={periodTitle} onChange={(e) => setPeriodTitle(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="ukt-wizard-open-date" className="text-xs font-medium text-muted-foreground">
                    Tanggal buka pendaftaran
                  </label>
                  <Input
                    id="ukt-wizard-open-date"
                    type="date"
                    lang="id-ID"
                    value={wizardOpenDate}
                    onChange={(e) => setWizardOpenDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Jam buka (24 jam)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={wizardOpenTimeParts.hour}
                      onValueChange={(hour) =>
                        setWizardOpenTime(joinTimeInput(hour, wizardOpenTimeParts.minute))
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
                      value={wizardOpenTimeParts.minute}
                      onValueChange={(minute) =>
                        setWizardOpenTime(joinTimeInput(wizardOpenTimeParts.hour, minute))
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="ukt-wizard-deadline-date" className="text-xs font-medium text-muted-foreground">
                    Tanggal batas pendaftaran
                  </label>
                  <Input
                    id="ukt-wizard-deadline-date"
                    type="date"
                    lang="id-ID"
                    value={wizardDeadlineDate}
                    onChange={(e) => setWizardDeadlineDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Jam batas (24 jam)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={wizardTimeParts.hour}
                      onValueChange={(hour) =>
                        setWizardDeadlineTime(joinTimeInput(hour, wizardTimeParts.minute))
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
                      value={wizardTimeParts.minute}
                      onValueChange={(minute) =>
                        setWizardDeadlineTime(joinTimeInput(wizardTimeParts.hour, minute))
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="ukt-wizard-exam-date" className="text-xs font-medium text-muted-foreground">
                    Tanggal ujian
                  </label>
                  <Input
                    id="ukt-wizard-exam-date"
                    type="date"
                    lang="id-ID"
                    value={wizardExamDate}
                    onChange={(e) => setWizardExamDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Jam ujian (24 jam)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={wizardExamTimeParts.hour}
                      onValueChange={(hour) =>
                        setWizardExamTime(joinTimeInput(hour, wizardExamTimeParts.minute))
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
                      value={wizardExamTimeParts.minute}
                      onValueChange={(minute) =>
                        setWizardExamTime(joinTimeInput(wizardExamTimeParts.hour, minute))
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
              <div className="space-y-1.5">
                <label htmlFor="ukt-wizard-exam-location" className="text-xs font-medium text-muted-foreground">
                  Tempat ujian
                </label>
                <Input
                  id="ukt-wizard-exam-location"
                  placeholder="Contoh: GOR UNESA / Dojo Cabang"
                  value={wizardExamLocation}
                  onChange={(e) => setWizardExamLocation(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="ukt-wizard-bidang" className="text-xs font-medium text-muted-foreground">
                    Bidang Ujian
                  </label>
                  <Input
                    id="ukt-wizard-bidang"
                    value={wizardBidang}
                    onChange={(e) => setWizardBidang(e.target.value)}
                    placeholder="Nama pejabat Bidang Ujian"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="ukt-wizard-bendahara" className="text-xs font-medium text-muted-foreground">
                    Bendahara Cabang
                  </label>
                  <Input
                    id="ukt-wizard-bendahara"
                    value={wizardBendahara}
                    onChange={(e) => setWizardBendahara(e.target.value)}
                    placeholder="Nama Bendahara Cabang"
                  />
                </div>
              </div>
            </div>
          )}
          {wizardStep === 1 && (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Pastikan biaya sabuk & komisi ranting sudah benar. Nominal ini akan
                di-snapshot ke periode baru (tidak berubah jika template global diubah nanti).
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
              <Button variant="outline" size="sm" onClick={openBeltFeesDialog}>
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
                <li>
                  Buka pendaftaran:{" "}
                  {wizardOpenDate && wizardOpenTime
                    ? formatUktRegistrationDeadline(
                        combineDateAndTimeLocal(
                          wizardOpenDate,
                          wizardOpenTime,
                        ).toISOString(),
                      )
                    : "—"}
                </li>
                <li>
                  Batas pendaftaran:{" "}
                  {wizardDeadlineDate && wizardDeadlineTime
                    ? formatUktRegistrationDeadline(
                        combineDateAndTimeLocal(
                          wizardDeadlineDate,
                          wizardDeadlineTime,
                        ).toISOString(),
                      )
                    : "—"}
                </li>
                <li>
                  Ujian:{" "}
                  {wizardExamDate && wizardExamTime
                    ? formatUktRegistrationDeadline(
                        combineDateAndTimeLocal(
                          wizardExamDate,
                          wizardExamTime,
                        ).toISOString(),
                      )
                    : "Belum diisi"}
                </li>
                <li>Tempat: {wizardExamLocation.trim() || "Belum diisi"}</li>
                <li>
                  Pejabat: Bidang Ujian {wizardBidang.trim() || periodOfficers.bidangUjianName}
                  {" · "}Bendahara{" "}
                  {wizardBendahara.trim() || periodOfficers.bendaharaCabangName}
                </li>
              </ul>
              <ul className="mt-2 space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Biaya sabuk & komisi siap di-snapshot
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Jadwal buka/batas (+ ujian jika diisi) OK
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Pejabat dokumen periode OK
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <MessageCircle className="h-4 w-4" />
                  Notifikasi otomatis ke ketua ranting saat periode dibuat
                </li>
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
              <Button
                className="bg-inkai-red"
                onClick={() => {
                  if (wizardStep === 0) {
                    if (!wizardOpenDate || !wizardOpenTime) {
                      toast.error("Isi tanggal dan jam buka pendaftaran");
                      return;
                    }
                    if (!wizardDeadlineDate || !wizardDeadlineTime) {
                      toast.error("Isi tanggal dan jam batas pendaftaran");
                      return;
                    }
                    const openAt = combineDateAndTimeLocal(
                      wizardOpenDate,
                      wizardOpenTime,
                    );
                    const closeAt = combineDateAndTimeLocal(
                      wizardDeadlineDate,
                      wizardDeadlineTime,
                    );
                    if (Number.isNaN(openAt.getTime())) {
                      toast.error("Tanggal buka pendaftaran tidak valid");
                      return;
                    }
                    if (Number.isNaN(closeAt.getTime())) {
                      toast.error("Batas pendaftaran tidak valid");
                      return;
                    }
                    if (openAt.getTime() > closeAt.getTime()) {
                      toast.error(
                        "Tanggal buka harus sebelum atau sama dengan batas pendaftaran",
                      );
                      return;
                    }
                  }
                  setWizardStep((s) => s + 1);
                }}
              >
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

      <Dialog open={editingTitle} onOpenChange={(o) => !o && setEditingTitle(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah judul periode</DialogTitle>
            <DialogDescription>
              Label yang tampil di daftar periode UKT.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={periodTitle}
            onChange={(e) => setPeriodTitle(e.target.value)}
            placeholder={formatUktPeriodLabel(props.semester, props.year)}
            aria-label="Judul periode UKT"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTitle(false)}>
              Batal
            </Button>
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              onClick={() => void handleSaveTitle()}
              disabled={loading || !periodTitle.trim()}
            >
              Simpan
            </Button>
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

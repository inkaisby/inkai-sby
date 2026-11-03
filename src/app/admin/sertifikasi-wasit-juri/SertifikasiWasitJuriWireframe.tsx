"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  CreditCard,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  Filter,
  FolderPlus,
  History,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { CrudPermission } from "@/lib/admin-dojo-grants";
import { DOCUMENT_COMPRESS_MAX_BYTES } from "@/lib/compress-image";
import { generateWasitJuriRecapHtml } from "@/lib/wasit-juri-print-html";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  AddMemberDialog,
  type AddMemberDojoOption,
  type CreatedMemberSummary,
} from "@/components/admin/AddMemberDialog";
import { DocumentPreviewDialog } from "@/components/admin/DocumentPreviewDialog";
import { FileUploadField } from "@/components/admin/FileUploadField";
import { MemberDocumentsEditor } from "@/components/admin/MemberDocumentsEditor";
import { InkaiConfirmDialog } from "@/components/ui/InkaiConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  DanRankLabel,
  WasitJuriDiscipline,
  WasitJuriLevelScope,
  WasitJuriLicenseGrade,
  WasitJuriMemberDocsDto,
  WasitJuriPaymentMethod,
  WasitJuriPaymentState,
  WasitJuriPeriodDto,
  WasitJuriRegistrantDto,
  WasitJuriRegistrationState,
  WasitJuriSubmissionType,
} from "@/lib/wasit-juri-data";

type ViewMode = "aktif" | "arsip";

interface MemberSuggestionItem {
  id: string;
  fullName: string;
  nia: string | null;
  mshNumber: string | null;
  currentRank: string;
  isBlackBelt: boolean;
  birthDate: string | null;
  age: number | null;
  dojoId: string | null;
  dojoName: string;
  photoUrl: string | null;
  birthCertificateUrl: string | null;
  bpjsCardUrl: string | null;
  bpjsCardNumber: string | null;
  latestLicense?: string | null;
  latestTargetGrade?: string | null;
  latestLicenseValidUntil?: string | null;
  latestDanCertificateUrl?: string | null;
  latestLicenseCertUrl?: string | null;
}

interface DocsEditTarget {
  memberId: string;
  fullName: string;
  docs: WasitJuriMemberDocsDto;
}

interface Props {
  scopeLabel: string;
  lockedDojoId: string | null;
  lockedDojoName: string | null;
  canManagePeriod: boolean;
  crudPermission?: CrudPermission;
  dojoList: AddMemberDojoOption[];
  initialPeriods: WasitJuriPeriodDto[];
  initialRegistrations: WasitJuriRegistrantDto[];
  initialViewMode?: ViewMode;
  initialCreateOpen?: boolean;
}

const DEFAULT_CRUD_PERMISSION: CrudPermission = {
  read: true,
  create: true,
  update: true,
  delete: true,
};

const EMPTY_MEMBER_DOCS: WasitJuriMemberDocsDto = {
  photoUrl: null,
  birthCertificateUrl: null,
  bpjsCardUrl: null,
  bpjsCardNumber: null,
};

function countMemberDocs(docs: WasitJuriMemberDocsDto) {
  return [
    Boolean(docs.photoUrl),
    Boolean(docs.birthCertificateUrl),
    Boolean(docs.bpjsCardUrl),
  ].filter(Boolean).length;
}

const DAN_OPTIONS: DanRankLabel[] = [
  "DAN I",
  "DAN II",
  "DAN III",
  "DAN IV",
  "DAN V",
  "DAN VI",
  "DAN VII",
  "Coklat (Kyu 1)",
];

const ROMAN_DAN: Record<number, DanRankLabel> = {
  1: "DAN I",
  2: "DAN II",
  3: "DAN III",
  4: "DAN IV",
  5: "DAN V",
  6: "DAN VI",
  7: "DAN VII",
};

function mapRankToDanClient(rankRaw: string | null | undefined): DanRankLabel {
  const r = (rankRaw || "").trim();
  const danNum = r.match(/\bdan\s*(\d+)\b/i);
  if (danNum) {
    const n = Number(danNum[1]);
    return ROMAN_DAN[n] ?? "DAN I";
  }
  if (/\bdan\s*vii\b/i.test(r)) return "DAN VII";
  if (/\bdan\s*vi\b/i.test(r)) return "DAN VI";
  if (/\bdan\s*v\b/i.test(r)) return "DAN V";
  if (/\bdan\s*iv\b/i.test(r)) return "DAN IV";
  if (/\bdan\s*iii\b/i.test(r)) return "DAN III";
  if (/\bdan\s*ii\b/i.test(r)) return "DAN II";
  if (/\bdan\s*i\b/i.test(r) || /hitam/i.test(r)) return "DAN I";
  if (/coklat/i.test(r)) return "Coklat (Kyu 1)";
  return "DAN I";
}

function nextHigherGrade(rawGrade: string | null | undefined): WasitJuriLicenseGrade {
  if (rawGrade === "JURI_B") return "JURI_A";
  if (rawGrade === "JURI_A") return "WASIT_B";
  if (rawGrade === "WASIT_B" || rawGrade === "WASIT_A") return "WASIT_A";
  return "JURI_B";
}

function computeAgeFromIso(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const d = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 10 && age <= 100 ? age : null;
}

function defaultExpiryFromPractical(practicalYmd: string | undefined, years = 3): string {
  const m = (practicalYmd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + years);
    return d.toISOString().slice(0, 10);
  }
  const yr = Number(m[1]) + years;
  const dd = m[2] === "02" && m[3] === "29" ? "28" : m[3];
  return `${yr}-${m[2]}-${dd}`;
}

function getLicenseValidityState(ymd: string | null | undefined): "valid" | "expiring" | "expired" | null {
  if (!ymd) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (ymd < today) return "expired";
  const soon = new Date();
  soon.setDate(soon.getDate() + 90);
  const soonYmd = soon.toISOString().slice(0, 10);
  return ymd <= soonYmd ? "expiring" : "valid";
}

const GRADE_LABELS: Record<WasitJuriLicenseGrade, string> = {
  JURI_B: "Juri B",
  JURI_A: "Juri A",
  WASIT_B: "Wasit B",
  WASIT_A: "Wasit A",
};

const DISCIPLINE_LABELS: Record<WasitJuriDiscipline, string> = {
  KATA_KUMITE: "Kata & Kumite",
  KUMITE: "Kumite",
  KATA: "Kata",
};

const SUBMISSION_LABELS: Record<WasitJuriSubmissionType, string> = {
  BARU: "Lisensi Baru",
  KENAIKAN: "Kenaikan",
  REFRESHING: "Refreshing",
};

const LICENSE_TIERS = [
  {
    grade: "Juri B",
    minDan: "DAN I / Coklat Kyu 1",
    minAge: "Minimal 20 tahun",
    examFocus: "Ujian tulis peraturan WKF dasar + praktik isyarat bendera/juri sudut",
    validity: "3 tahun (wajib refreshing sebelum memimpin kejuaraan resmi)",
  },
  {
    grade: "Juri A",
    minDan: "DAN I (aktif memimpin min. 2 kejuaraan cabang)",
    minAge: "Minimal 22 tahun",
    examFocus: "Ujian tulis Kata & Kumite lanjutan + evaluasi skor objektif gelanggang",
    validity: "3 tahun",
  },
  {
    grade: "Wasit B",
    minDan: "DAN II",
    minAge: "Minimal 25 tahun",
    examFocus: "Manajemen tatami penuh (Shushin), komando pertandingan, situasi penalti/cedera",
    validity: "3 tahun",
  },
  {
    grade: "Wasit A",
    minDan: "DAN III",
    minAge: "Minimal 28 tahun",
    examFocus: "Kepemimpinan tatami utama, resolusi protes resmi, koordinasi panel juri",
    validity: "3 tahun (rekomendasi ke penataran Pengprov / PB)",
  },
];

function formatRupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function formatDateId(ymd: string) {
  if (!ymd) return "-";
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function defaultFutureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function statusBadgeStyle(status: WasitJuriRegistrationState) {
  switch (status) {
    case "LULUS":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "SIAP_UJIAN":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "MENUNGGU_BAYAR":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "MENUNGGU_BERKAS":
      return "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300";
    case "MENGULANG":
      return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
}

function statusLabel(status: WasitJuriRegistrationState) {
  switch (status) {
    case "MENUNGGU_BERKAS":
      return "Menunggu Berkas";
    case "MENUNGGU_BAYAR":
      return "Menunggu Verifikasi Bayar";
    case "SIAP_UJIAN":
      return "Siap Ujian";
    case "LULUS":
      return "Lulus Sertifikasi";
    case "MENGULANG":
      return "Belum Lulus / Mengulang";
  }
}

function paymentLabel(state: WasitJuriPaymentState) {
  switch (state) {
    case "BELUM_BAYAR":
      return "Belum Bayar";
    case "MENUNGGU_VERIFIKASI":
      return "Menunggu Verifikasi";
    case "LUNAS":
      return "Lunas";
  }
}

function MemberDocPill({
  label,
  url,
  onPreview,
}: {
  label: string;
  url: string | null;
  onPreview: (title: string, url: string) => void;
}) {
  if (url) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPreview(label, url);
        }}
        className="inline-flex"
      >
        <Badge
          variant="outline"
          className="cursor-pointer gap-1 border-emerald-500/40 bg-emerald-500/10 text-[11px] font-medium text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-300"
        >
          {label}
          <Eye className="h-3 w-3" />
        </Badge>
      </button>
    );
  }

  return (
    <Badge
      variant="outline"
      className="text-[11px] text-muted-foreground opacity-75"
    >
      {label}
    </Badge>
  );
}

function MembershipDocsCell({
  memberName,
  memberId,
  docs,
  danCertificateUrl,
  licenseCertUrl,
  requiresPriorLicense,
  canEdit,
  onPreview,
  onEdit,
}: {
  memberName: string;
  memberId?: string | null;
  docs: WasitJuriMemberDocsDto;
  danCertificateUrl?: string | null;
  licenseCertUrl?: string | null;
  requiresPriorLicense?: boolean;
  canEdit: boolean;
  onPreview: (title: string, url: string) => void;
  onEdit?: () => void;
}) {
  const total = countMemberDocs(docs);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <MemberDocPill
          label="Foto"
          url={docs.photoUrl}
          onPreview={(t, u) => onPreview(`${t} — ${memberName}`, u)}
        />
        <MemberDocPill
          label="Akte"
          url={docs.birthCertificateUrl}
          onPreview={(t, u) => onPreview(`${t} — ${memberName}`, u)}
        />
        <MemberDocPill
          label="BPJS"
          url={docs.bpjsCardUrl}
          onPreview={(t, u) => onPreview(`${t} — ${memberName}`, u)}
        />
        {danCertificateUrl ? (
          <MemberDocPill
            label="Ijazah DAN"
            url={danCertificateUrl}
            onPreview={(t, u) => onPreview(`${t} — ${memberName}`, u)}
          />
        ) : null}
        {requiresPriorLicense || licenseCertUrl ? (
          <MemberDocPill
            label="Lisensi Lama"
            url={licenseCertUrl ?? null}
            onPreview={(t, u) => onPreview(`${t} — ${memberName}`, u)}
          />
        ) : null}
        {canEdit && memberId && onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-inkai-red"
          >
            <Pencil className="h-3 w-3" />
            Ubah
          </Button>
        ) : null}
      </div>
      <p
        className={`inline-flex items-center gap-1 text-[10px] font-medium ${
          total === 3
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-amber-700 dark:text-amber-400"
        }`}
      >
        <CheckCircle2 className="h-3 w-3" />
        {total}/3 berkas keanggotaan
        {danCertificateUrl ? " · Ijazah DAN ✓" : ""}
      </p>
    </div>
  );
}

function useMemberSuggest(query: string, enabled = true) {
  const [suggestions, setSuggestions] = useState<MemberSuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");

  useEffect(() => {
    const q = query.trim();
    if (!enabled || q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setSearchedQuery("");
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(
        `/api/admin/sertifikasi-wasit-juri/suggest?q=${encodeURIComponent(q)}`,
        { signal: controller.signal },
      )
        .then(async (res) => {
          if (!res.ok) return { suggestions: [] as MemberSuggestionItem[] };
          return (await res.json()) as {
            suggestions?: MemberSuggestionItem[];
          };
        })
        .then((data) => {
          setSuggestions(data.suggestions ?? []);
          setSearchedQuery(q);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setSuggestions([]);
          setSearchedQuery(q);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, enabled]);

  return { suggestions, loading, searchedQuery };
}

export function SertifikasiWasitJuriWireframe({
  scopeLabel,
  lockedDojoId,
  lockedDojoName,
  canManagePeriod,
  crudPermission = DEFAULT_CRUD_PERMISSION,
  dojoList,
  initialPeriods,
  initialRegistrations,
  initialViewMode = "aktif",
  initialCreateOpen = false,
}: Props) {
  const canCreate = crudPermission.create;
  const canUpdate = crudPermission.update;
  const canDelete = crudPermission.delete;
  const isReadOnlyUser = !canCreate && !canUpdate && !canDelete;

  const dojoOptions = useMemo(
    () => Array.from(new Set(dojoList.map((d) => d.name))),
    [dojoList],
  );

  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [periods, setPeriods] = useState<WasitJuriPeriodDto[]>(initialPeriods);
  const [rows, setRows] =
    useState<WasitJuriRegistrantDto[]>(initialRegistrations);
  const [refreshing, setRefreshing] = useState(false);
  const [paperSize, setPaperSize] = useState<"A4" | "F4">("A4");

  const [selectedActivePeriodId, setSelectedActivePeriodId] = useState<string>(
    () => initialPeriods.find((p) => !p.isArchived)?.id ?? "",
  );
  const [selectedArchivePeriodId, setSelectedArchivePeriodId] =
    useState<string>("ALL_ARCHIVED");

  const [activeTab, setActiveTab] = useState<"pendaftar" | "syarat">(
    "pendaftar",
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [toolbarSuggestOpen, setToolbarSuggestOpen] = useState(false);
  const toolbarSearchRef = useRef<HTMLDivElement>(null);

  const [dojoFilter, setDojoFilter] = useState<string>(
    lockedDojoName || "ALL",
  );
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | WasitJuriRegistrationState
  >("ALL");

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);

  const [periodModalOpen, setPeriodModalOpen] = useState(
    Boolean(initialCreateOpen && canManagePeriod && canCreate),
  );
  const [periodModalMode, setPeriodModalMode] = useState<"create" | "edit">(
    "create",
  );
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [periodSubmitting, setPeriodSubmitting] = useState(false);
  const [periodArchiveBusyId, setPeriodArchiveBusyId] = useState<string | null>(
    null,
  );

  const [archiveConfirmPeriod, setArchiveConfirmPeriod] =
    useState<WasitJuriPeriodDto | null>(null);
  const [deleteConfirmRow, setDeleteConfirmRow] =
    useState<WasitJuriRegistrantDto | null>(null);

  const [inspectRow, setInspectRow] = useState<WasitJuriRegistrantDto | null>(
    null,
  );
  const [inspectSaving, setInspectSaving] = useState(false);
  const [draftTeoriKata, setDraftTeoriKata] = useState("");
  const [draftTeoriKumite, setDraftTeoriKumite] = useState("");
  const [draftPraktik, setDraftPraktik] = useState("");
  const [draftGrantedLicense, setDraftGrantedLicense] = useState("");
  const [draftValidUntil, setDraftValidUntil] = useState("");
  const [draftNotes, setDraftNotes] = useState("");

  const [docPreview, setDocPreview] = useState<{
    title: string;
    url: string;
  } | null>(null);
  const [docsEditTarget, setDocsEditTarget] = useState<DocsEditTarget | null>(
    null,
  );
  const [photoSaving, setPhotoSaving] = useState(false);

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberInitialName, setAddMemberInitialName] = useState("");

  const [modalMemberQuery, setModalMemberQuery] = useState("");
  const [modalSuggestOpen, setModalSuggestOpen] = useState(false);
  const [linkedMemberLabel, setLinkedMemberLabel] = useState<string | null>(
    null,
  );
  const [linkedLatestLicense, setLinkedLatestLicense] = useState<{
    license: string;
    validUntil: string | null;
  } | null>(null);
  const [formMemberId, setFormMemberId] = useState<string | null>(null);
  const [formMemberDocs, setFormMemberDocs] =
    useState<WasitJuriMemberDocsDto>(EMPTY_MEMBER_DOCS);
  const modalSearchRef = useRef<HTMLDivElement>(null);

  const [formName, setFormName] = useState("");
  const [formNia, setFormNia] = useState("");
  const [formMsh, setFormMsh] = useState("");
  const [formDan, setFormDan] = useState<DanRankLabel>("DAN I");
  const [formAge, setFormAge] = useState("");
  const [formDojo, setFormDojo] = useState(
    lockedDojoName || dojoOptions[0] || "",
  );
  const [formType, setFormType] = useState<WasitJuriSubmissionType>("BARU");
  const [formGrade, setFormGrade] =
    useState<WasitJuriLicenseGrade>("JURI_B");
  const [formDiscipline, setFormDiscipline] =
    useState<WasitJuriDiscipline>("KATA_KUMITE");
  const [formOldLicense, setFormOldLicense] = useState("");
  const [formDanCertUrl, setFormDanCertUrl] = useState("");
  const [formLicenseCertUrl, setFormLicenseCertUrl] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] =
    useState<WasitJuriPaymentMethod>("TRANSFER");
  const [formProofUrl, setFormProofUrl] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const [newPeriodTitle, setNewPeriodTitle] = useState("");
  const [newPeriodScope, setNewPeriodScope] =
    useState<WasitJuriLevelScope>("Cabang");
  const [newTheoryDate, setNewTheoryDate] = useState(() =>
    defaultFutureDate(14),
  );
  const [newPracticalDate, setNewPracticalDate] = useState(() =>
    defaultFutureDate(15),
  );
  const [newCloseDate, setNewCloseDate] = useState(() =>
    defaultFutureDate(10),
  );
  const [newLocation, setNewLocation] = useState("GOR CLS Kertajaya, Surabaya");
  const [newQuota, setNewQuota] = useState("50");
  const [newFeeNew, setNewFeeNew] = useState("350000");
  const [newFeeUpgrade, setNewFeeUpgrade] = useState("300000");
  const [newFeeRefreshing, setNewFeeRefreshing] = useState("200000");
  const [archivePreviousOnCreate, setArchivePreviousOnCreate] = useState(true);

  const openPeriods = useMemo(
    () => periods.filter((p) => !p.isArchived),
    [periods],
  );
  const archivedPeriods = useMemo(
    () => periods.filter((p) => p.isArchived),
    [periods],
  );

  const periodMap = useMemo(
    () => new Map(periods.map((p) => [p.id, p])),
    [periods],
  );

  const activePeriod = useMemo(
    () =>
      openPeriods.find((p) => p.id === selectedActivePeriodId) ??
      openPeriods[0] ??
      null,
    [openPeriods, selectedActivePeriodId],
  );

  const focusedArchivedPeriod = useMemo(
    () =>
      selectedArchivePeriodId === "ALL_ARCHIVED"
        ? null
        : archivedPeriods.find((p) => p.id === selectedArchivePeriodId) ?? null,
    [archivedPeriods, selectedArchivePeriodId],
  );

  useEffect(() => {
    if (!inspectRow) {
      setDraftTeoriKata("");
      setDraftTeoriKumite("");
      setDraftPraktik("");
      setDraftGrantedLicense("");
      setDraftValidUntil("");
      setDraftNotes("");
      return;
    }
    const rowPeriod = periodMap.get(inspectRow.periodId);
    const defaultExp = defaultExpiryFromPractical(rowPeriod?.practicalDate, 3);
    setDraftTeoriKata(
      inspectRow.scores.teoriKata !== null
        ? String(inspectRow.scores.teoriKata)
        : "",
    );
    setDraftTeoriKumite(
      inspectRow.scores.teoriKumite !== null
        ? String(inspectRow.scores.teoriKumite)
        : "",
    );
    setDraftPraktik(
      inspectRow.scores.praktik !== null
        ? String(inspectRow.scores.praktik)
        : "",
    );
    setDraftGrantedLicense(
      inspectRow.grantedLicense ||
        `${GRADE_LABELS[inspectRow.targetGrade]} ${DISCIPLINE_LABELS[inspectRow.discipline]} — ${rowPeriod?.levelScope ?? "Cabang"}`,
    );
    setDraftValidUntil(inspectRow.licenseValidUntil || defaultExp);
    setDraftNotes(inspectRow.notes || "");
  }, [inspectRow, periodMap]);

  const toolbarSuggest = useMemberSuggest(
    searchQuery,
    viewMode === "aktif" &&
      Boolean(activePeriod) &&
      activeTab === "pendaftar" &&
      toolbarSuggestOpen,
  );
  const modalSuggest = useMemberSuggest(
    modalMemberQuery,
    registerOpen && modalSuggestOpen,
  );

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        toolbarSearchRef.current &&
        !toolbarSearchRef.current.contains(e.target as Node)
      ) {
        setToolbarSuggestOpen(false);
      }
      if (
        modalSearchRef.current &&
        !modalSearchRef.current.contains(e.target as Node)
      ) {
        setModalSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function switchViewMode(nextMode: ViewMode) {
    setViewMode(nextMode);
    setToolbarSuggestOpen(false);
    if (typeof window !== "undefined") {
      const targetUrl =
        nextMode === "arsip"
          ? "/admin/sertifikasi-wasit-juri?view=arsip"
          : "/admin/sertifikasi-wasit-juri";
      window.history.replaceState(null, "", targetUrl);
    }
  }

  async function refreshFromDatabase() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/sertifikasi-wasit-juri", {
        cache: "no-store",
      });
      if (!res.ok) {
        toast.error("Gagal memuat ulang data dari database.");
        return;
      }
      const data = (await res.json()) as {
        periods?: WasitJuriPeriodDto[];
        registrations?: WasitJuriRegistrantDto[];
      };
      if (data.periods) setPeriods(data.periods);
      if (data.registrations) setRows(data.registrations);
    } catch {
      toast.error("Gagal memuat ulang data dari database.");
    } finally {
      setRefreshing(false);
    }
  }

  const scopedRows = useMemo(() => {
    const archivedIds = new Set(archivedPeriods.map((p) => p.id));

    return rows.filter((r) => {
      if (lockedDojoName && r.dojoName !== lockedDojoName) return false;
      if (viewMode === "aktif") {
        if (!activePeriod) return false;
        return r.periodId === activePeriod.id;
      }
      if (selectedArchivePeriodId === "ALL_ARCHIVED") {
        return archivedIds.has(r.periodId);
      }
      return r.periodId === selectedArchivePeriodId;
    });
  }, [
    rows,
    lockedDojoName,
    viewMode,
    activePeriod,
    archivedPeriods,
    selectedArchivePeriodId,
  ]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedRows.filter((r) => {
      if (dojoFilter !== "ALL" && r.dojoName !== dojoFilter) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (q) {
        const periodTitle = periodMap.get(r.periodId)?.title ?? "";
        const hay =
          `${r.name} ${r.nia} ${r.mshNumber} ${r.dojoName} ${r.grantedLicense ?? ""} ${periodTitle}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scopedRows, dojoFilter, statusFilter, searchQuery, periodMap]);

  const activePeriodState = useMemo(() => {
    if (!activePeriod) {
      return { isClosedByDate: false, isQuotaFull: false, totalInPeriod: 0 };
    }
    const todayYmd = new Date().toISOString().slice(0, 10);
    const totalInPeriod = rows.filter(
      (r) => r.periodId === activePeriod.id,
    ).length;
    return {
      isClosedByDate: Boolean(
        activePeriod.closeDate && todayYmd > activePeriod.closeDate,
      ),
      isQuotaFull: totalInPeriod >= activePeriod.quota,
      totalInPeriod,
    };
  }, [activePeriod, rows]);

  const kpi = useMemo(() => {
    const total = scopedRows.length;
    const baruCount = scopedRows.filter(
      (r) => r.submissionType === "BARU",
    ).length;
    const waitingCount = scopedRows.filter(
      (r) => r.status === "MENUNGGU_BERKAS" || r.status === "MENUNGGU_BAYAR",
    ).length;
    const readyCount = scopedRows.filter(
      (r) => r.status === "SIAP_UJIAN",
    ).length;
    const passedCount = scopedRows.filter((r) => r.status === "LULUS").length;
    const repeatCount = scopedRows.filter(
      (r) => r.status === "MENGULANG",
    ).length;
    return {
      total,
      baruCount,
      waitingCount,
      readyCount,
      passedCount,
      repeatCount,
    };
  }, [scopedRows]);

  function applySyncedMemberDocs(
    memberId: string,
    patch: Partial<WasitJuriMemberDocsDto>,
  ) {
    setFormMemberDocs((prev) =>
      formMemberId === memberId ? { ...prev, ...patch } : prev,
    );

    setDocsEditTarget((prev) =>
      prev && prev.memberId === memberId
        ? { ...prev, docs: { ...prev.docs, ...patch } }
        : prev,
    );

    setRows((prev) =>
      prev.map((row) => {
        if (row.memberId !== memberId) return row;
        const nextDocs: WasitJuriMemberDocsDto = {
          ...row.memberDocs,
          ...patch,
        };
        const complete = countMemberDocs(nextDocs) === 3;
        const nextStatus =
          row.status === "MENUNGGU_BERKAS" && complete
            ? "MENUNGGU_BAYAR"
            : row.status === "MENUNGGU_BAYAR" && !complete
              ? "MENUNGGU_BERKAS"
              : row.status;
        return {
          ...row,
          memberDocs: nextDocs,
          status: nextStatus,
        };
      }),
    );

    setInspectRow((prev) => {
      if (!prev || prev.memberId !== memberId) return prev;
      const nextDocs: WasitJuriMemberDocsDto = {
        ...prev.memberDocs,
        ...patch,
      };
      const complete = countMemberDocs(nextDocs) === 3;
      const nextStatus =
        prev.status === "MENUNGGU_BERKAS" && complete
          ? "MENUNGGU_BAYAR"
          : prev.status === "MENUNGGU_BAYAR" && !complete
            ? "MENUNGGU_BERKAS"
            : prev.status;
      return {
        ...prev,
        memberDocs: nextDocs,
        status: nextStatus,
      };
    });
  }

  async function handleSaveMemberPhoto(
    memberId: string,
    photoUrl: string | null,
  ) {
    setPhotoSaving(true);
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_photo", photoUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        photoUrl?: string | null;
      };
      if (!res.ok) {
        toast.error(data.error || "Gagal menyimpan foto keanggotaan.");
        return;
      }
      const savedUrl =
        typeof data.photoUrl === "string"
          ? data.photoUrl
          : data.photoUrl === null
            ? null
            : photoUrl;
      applySyncedMemberDocs(memberId, { photoUrl: savedUrl });
      toast.success(
        savedUrl
          ? "Foto anggota berhasil disinkronkan ke Keanggotaan."
          : "Foto anggota dihapus.",
      );
    } catch {
      toast.error("Gagal menyimpan foto keanggotaan.");
    } finally {
      setPhotoSaving(false);
    }
  }

  function isAlreadyRegisteredInPeriod(m: MemberSuggestionItem) {
    if (!activePeriod) return false;
    return rows.some(
      (r) => r.periodId === activePeriod.id && r.memberId === m.id,
    );
  }

  function autofillFromMember(m: MemberSuggestionItem, openModal = true) {
    setFormMemberId(m.id);
    setFormMemberDocs({
      photoUrl: m.photoUrl,
      birthCertificateUrl: m.birthCertificateUrl,
      bpjsCardUrl: m.bpjsCardUrl,
      bpjsCardNumber: m.bpjsCardNumber,
    });
    setFormName(m.fullName.toUpperCase());
    setFormNia(m.nia ?? "");
    setFormMsh(m.mshNumber ?? "");
    setFormDan(mapRankToDanClient(m.currentRank));
    setFormAge(m.age !== null ? String(m.age) : "");
    if (!lockedDojoName && m.dojoName) {
      setFormDojo(m.dojoName);
    }

    if (m.latestDanCertificateUrl) {
      setFormDanCertUrl(m.latestDanCertificateUrl);
    } else {
      setFormDanCertUrl("");
    }

    if (m.latestLicense) {
      setLinkedLatestLicense({
        license: m.latestLicense,
        validUntil: m.latestLicenseValidUntil ?? null,
      });
      setFormOldLicense(m.latestLicense);
      if (m.latestLicenseCertUrl) {
        setFormLicenseCertUrl(m.latestLicenseCertUrl);
      }
      const validity = getLicenseValidityState(m.latestLicenseValidUntil);
      if (validity === "expired" || validity === "expiring") {
        setFormType("REFRESHING");
        setFormGrade(
          (m.latestTargetGrade as WasitJuriLicenseGrade) || "JURI_B",
        );
      } else {
        setFormType("KENAIKAN");
        setFormGrade(nextHigherGrade(m.latestTargetGrade));
      }
    } else {
      setLinkedLatestLicense(null);
      setFormOldLicense("");
      setFormLicenseCertUrl("");
      setFormType("BARU");
      setFormGrade("JURI_B");
    }

    setLinkedMemberLabel(
      `${m.fullName.toUpperCase()}${m.dojoName ? ` · Ranting ${m.dojoName}` : ""}`,
    );
    setModalMemberQuery(m.fullName);
    setModalSuggestOpen(false);
    setToolbarSuggestOpen(false);
    if (openModal && canCreate) {
      setRegisterOpen(true);
    }
  }

  function handleMemberCreated(created: CreatedMemberSummary) {
    const computedAge = computeAgeFromIso(created.birthDate);
    setFormMemberId(created.id ?? null);
    setFormMemberDocs(EMPTY_MEMBER_DOCS);
    setLinkedLatestLicense(null);
    setFormName(created.fullName);
    setFormNia(created.nia);
    setFormMsh(created.mshNumber);
    setFormDan(mapRankToDanClient(created.currentRank));
    setFormAge(computedAge !== null ? String(computedAge) : "");
    if (!lockedDojoName && created.dojoName) {
      setFormDojo(created.dojoName);
    }
    setLinkedMemberLabel(
      `${created.fullName}${created.dojoName ? ` · Ranting ${created.dojoName}` : ""}`,
    );
    setModalMemberQuery(created.fullName);
    setSearchQuery("");
    setToolbarSuggestOpen(false);
    setModalSuggestOpen(false);
    if (activePeriod && canCreate) {
      switchViewMode("aktif");
      setRegisterOpen(true);
      toast.success(
        "Data keanggotaan baru otomatis diisikan ke formulir pendaftaran Wasit/Juri.",
      );
    } else {
      toast.success("Anggota baru berhasil disimpan ke keanggotaan.");
    }
  }

  function openAddNewMemberDialog(prefillName: string) {
    setAddMemberInitialName(prefillName.trim().toUpperCase());
    setToolbarSuggestOpen(false);
    setModalSuggestOpen(false);
    setAddMemberOpen(true);
  }

  function openCreatePeriodModal() {
    setPeriodModalMode("create");
    setEditingPeriodId(null);
    setNewPeriodTitle("");
    setNewPeriodScope("Cabang");
    setNewTheoryDate(defaultFutureDate(14));
    setNewPracticalDate(defaultFutureDate(15));
    setNewCloseDate(defaultFutureDate(10));
    setNewLocation("GOR CLS Kertajaya, Surabaya");
    setNewQuota("50");
    setNewFeeNew("350000");
    setNewFeeUpgrade("300000");
    setNewFeeRefreshing("200000");
    setArchivePreviousOnCreate(true);
    setPeriodModalOpen(true);
  }

  function openEditPeriodModal(p: WasitJuriPeriodDto) {
    setPeriodModalMode("edit");
    setEditingPeriodId(p.id);
    setNewPeriodTitle(p.title);
    setNewPeriodScope(p.levelScope);
    setNewTheoryDate(p.theoryDate);
    setNewPracticalDate(p.practicalDate);
    setNewCloseDate(p.closeDate);
    setNewLocation(p.location);
    setNewQuota(String(p.quota));
    setNewFeeNew(String(p.feeNew));
    setNewFeeUpgrade(String(p.feeUpgrade));
    setNewFeeRefreshing(String(p.feeRefreshing));
    setPeriodModalOpen(true);
  }

  function openFreshRegistrationModal() {
    if (!canCreate) {
      toast.error("Akun Anda berstatus baca-saja untuk modul ini.");
      return;
    }
    if (!activePeriod) {
      if (canManagePeriod) {
        toast.info("Buat periode sertifikasi baru terlebih dahulu.");
        openCreatePeriodModal();
      } else {
        toast.info("Belum ada periode sertifikasi aktif yang dibuka pengurus Cabang.");
      }
      return;
    }
    setFormMemberId(null);
    setFormMemberDocs(EMPTY_MEMBER_DOCS);
    setLinkedMemberLabel(null);
    setLinkedLatestLicense(null);
    setModalMemberQuery("");
    setFormName("");
    setFormNia("");
    setFormMsh("");
    setFormDan("DAN I");
    setFormAge("");
    setFormType("BARU");
    setFormGrade("JURI_B");
    setFormDiscipline("KATA_KUMITE");
    setFormOldLicense("");
    setFormDanCertUrl("");
    setFormLicenseCertUrl("");
    setFormPaymentMethod("TRANSFER");
    setFormProofUrl("");
    setFormNotes("");
    setRegisterOpen(true);
  }

  async function handleAddRegistrant(e: React.FormEvent) {
    e.preventDefault();
    if (!activePeriod) return;
    if (!formMemberId) {
      toast.error(
        "Pilih anggota dari pencarian Keanggotaan di atas, atau klik Tambahkan Daftar Anggota terlebih dahulu.",
      );
      return;
    }

    setRegisterSubmitting(true);
    try {
      const res = await fetch("/api/admin/sertifikasi-wasit-juri/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId: activePeriod.id,
          memberId: formMemberId,
          danRank: formDan,
          mshNumber: formMsh.trim() || undefined,
          submissionType: formType,
          currentLicense:
            formType === "BARU" ? null : formOldLicense.trim() || null,
          targetGrade: formGrade,
          discipline: formDiscipline,
          paymentMethod: formPaymentMethod,
          proofUrl:
            formPaymentMethod === "TRANSFER"
              ? formProofUrl.trim() || null
              : null,
          danCertificateUrl: formDanCertUrl.trim() || null,
          licenseCertUrl:
            formType === "BARU" ? null : formLicenseCertUrl.trim() || null,
          notes: formNotes.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        registration?: WasitJuriRegistrantDto;
      };
      if (!res.ok || !data.registration) {
        toast.error(data.error || "Gagal menyimpan pendaftaran ke database.");
        return;
      }

      setRows((prev) => [data.registration!, ...prev]);
      setRegisterOpen(false);
      setSearchQuery("");
      toast.success(
        `${data.registration.name} berhasil didaftarkan ke periode aktif.`,
      );
    } catch {
      toast.error("Gagal menghubungi server untuk menyimpan pendaftaran.");
    } finally {
      setRegisterSubmitting(false);
    }
  }

  async function handleSubmitPeriodModal(e: React.FormEvent) {
    e.preventDefault();
    const title = newPeriodTitle.trim();
    if (!title) {
      toast.error("Judul periode penataran wajib diisi.");
      return;
    }

    const payload = {
      title,
      levelScope: newPeriodScope,
      theoryDate: newTheoryDate,
      practicalDate: newPracticalDate,
      closeDate: newCloseDate,
      location: newLocation.trim() || "Surabaya",
      quota: Math.max(1, Number.parseInt(newQuota, 10) || 50),
      feeNew: Math.max(0, Number.parseInt(newFeeNew, 10) || 350_000),
      feeUpgrade: Math.max(0, Number.parseInt(newFeeUpgrade, 10) || 300_000),
      feeRefreshing: Math.max(
        0,
        Number.parseInt(newFeeRefreshing, 10) || 200_000,
      ),
    };

    setPeriodSubmitting(true);
    try {
      if (periodModalMode === "edit" && editingPeriodId) {
        const res = await fetch(
          `/api/admin/sertifikasi-wasit-juri/periods/${editingPeriodId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "edit", ...payload }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          period?: WasitJuriPeriodDto;
          feesSynced?: boolean;
        };
        if (!res.ok || !data.period) {
          toast.error(data.error || "Gagal memperbarui periode.");
          return;
        }
        setPeriods((prev) =>
          prev.map((p) => (p.id === editingPeriodId ? data.period! : p)),
        );
        if (data.feesSynced) {
          await refreshFromDatabase();
        }
        setPeriodModalOpen(false);
        toast.success("Pengaturan periode berhasil diperbarui.");
        return;
      }

      const res = await fetch("/api/admin/sertifikasi-wasit-juri/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          archivePrevious: archivePreviousOnCreate,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        period?: WasitJuriPeriodDto;
        periods?: WasitJuriPeriodDto[];
      };
      if (!res.ok || !data.period) {
        toast.error(data.error || "Gagal membuat periode baru.");
        return;
      }

      if (data.periods) {
        setPeriods(data.periods);
      } else {
        setPeriods((prev) => [data.period!, ...prev]);
      }
      setSelectedActivePeriodId(data.period.id);
      switchViewMode("aktif");
      setActiveTab("pendaftar");
      setPeriodModalOpen(false);
      setNewPeriodTitle("");
      toast.success("Periode sertifikasi baru berhasil disimpan ke database.");
    } catch {
      toast.error("Gagal menyimpan periode ke database.");
    } finally {
      setPeriodSubmitting(false);
    }
  }

  async function handleArchivePeriod(periodId: string) {
    setPeriodArchiveBusyId(periodId);
    try {
      const res = await fetch(
        `/api/admin/sertifikasi-wasit-juri/periods/${periodId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive" }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        period?: WasitJuriPeriodDto;
      };
      if (!res.ok || !data.period) {
        toast.error(data.error || "Gagal mengarsipkan periode.");
        return;
      }

      setPeriods((prev) =>
        prev.map((p) => (p.id === periodId ? data.period! : p)),
      );
      setArchiveConfirmPeriod(null);
      setSelectedArchivePeriodId(periodId);
      switchViewMode("arsip");
      toast.success("Periode dipindahkan ke Arsip Riwayat.");
    } catch {
      toast.error("Gagal mengarsipkan periode.");
    } finally {
      setPeriodArchiveBusyId(null);
    }
  }

  async function handleRestoreArchivedPeriod(periodId: string) {
    setPeriodArchiveBusyId(periodId);
    try {
      const res = await fetch(
        `/api/admin/sertifikasi-wasit-juri/periods/${periodId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "restore" }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        period?: WasitJuriPeriodDto;
      };
      if (!res.ok || !data.period) {
        toast.error(data.error || "Gagal membuka kembali periode arsip.");
        return;
      }

      setPeriods((prev) =>
        prev.map((p) => (p.id === periodId ? data.period! : p)),
      );
      setSelectedActivePeriodId(periodId);
      switchViewMode("aktif");
      toast.success("Periode dikembalikan ke Pendaftaran Aktif.");
    } catch {
      toast.error("Gagal membuka kembali periode arsip.");
    } finally {
      setPeriodArchiveBusyId(null);
    }
  }

  function parseScoreInput(raw: string): number | null {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  async function patchRegistration(
    id: string,
    payload: {
      paymentState?: WasitJuriPaymentState;
      paymentMethod?: WasitJuriPaymentMethod;
      proofUrl?: string | null;
      danCertificateUrl?: string | null;
      licenseCertUrl?: string | null;
      notes?: string | null;
      status?: WasitJuriRegistrationState;
      scoreTeoriKata?: number | null;
      scoreTeoriKumite?: number | null;
      scorePraktik?: number | null;
      grantedLicense?: string | null;
      licenseValidUntil?: string | null;
    },
    successMessage: string,
  ) {
    setInspectSaving(true);
    try {
      const res = await fetch(
        `/api/admin/sertifikasi-wasit-juri/registrations/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        registration?: WasitJuriRegistrantDto;
        kasWarning?: string;
      };
      if (!res.ok || !data.registration) {
        toast.error(data.error || "Gagal menyimpan perubahan.");
        return;
      }

      setRows((prev) =>
        prev.map((r) => (r.id === id ? data.registration! : r)),
      );
      setInspectRow((prev) =>
        prev && prev.id === id ? data.registration! : prev,
      );
      toast.success(successMessage);
      if (data.kasWarning) {
        toast.warning(data.kasWarning);
      }
    } catch {
      toast.error("Gagal menyimpan perubahan ke database.");
    } finally {
      setInspectSaving(false);
    }
  }

  async function handleDeleteRegistration(row: WasitJuriRegistrantDto) {
    setInspectSaving(true);
    try {
      const res = await fetch(
        `/api/admin/sertifikasi-wasit-juri/registrations/${row.id}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        deletedId?: string;
        kasWarning?: string;
      };
      if (!res.ok) {
        toast.error(data.error || "Gagal menghapus pendaftaran.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setDeleteConfirmRow(null);
      setInspectRow(null);
      toast.success(
        row.paymentState === "LUNAS"
          ? `Pendaftaran ${row.name} dihapus dan jurnal Buku Kas dibalik otomatis.`
          : `Pendaftaran ${row.name} berhasil dihapus.`,
      );
      if (data.kasWarning) {
        toast.warning(data.kasWarning);
      }
    } catch {
      toast.error("Gagal menghapus pendaftaran dari database.");
    } finally {
      setInspectSaving(false);
    }
  }

  function exportFilteredCsv() {
    if (filteredRows.length === 0) {
      toast.info("Belum ada data peserta untuk diekspor.");
      return;
    }

    const header = [
      "No",
      "Nama Peserta",
      "NIA",
      "No MSH",
      "Tingkatan DAN",
      "Ranting",
      "Usia",
      "Periode",
      "Jenis Pengajuan",
      "Target Kualifikasi",
      "Nomor",
      "Berkas Keanggotaan",
      "Biaya",
      "Metode Bayar",
      "Status Bayar",
      "Status Sertifikasi",
      "Teori Kata",
      "Teori Kumite",
      "Praktik",
      "Lisensi Diterbitkan",
      "Berlaku Sampai",
    ];

    const csvCell = (val: string | number) => {
      const s = String(val);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = [
      header.map(csvCell).join(","),
      ...filteredRows.map((r, idx) => {
        const pTitle = periodMap.get(r.periodId)?.title ?? "-";
        return [
          idx + 1,
          r.name,
          r.nia,
          r.mshNumber,
          r.danRank,
          r.dojoName,
          r.age ?? "-",
          pTitle,
          SUBMISSION_LABELS[r.submissionType],
          GRADE_LABELS[r.targetGrade],
          DISCIPLINE_LABELS[r.discipline],
          `${countMemberDocs(r.memberDocs)}/3`,
          r.feeAmount,
          r.paymentMethod,
          paymentLabel(r.paymentState),
          statusLabel(r.status),
          r.scores.teoriKata ?? "-",
          r.scores.teoriKumite ?? "-",
          r.scores.praktik ?? "-",
          r.grantedLicense ?? "-",
          r.licenseValidUntil ?? "-",
        ]
          .map(csvCell)
          .join(",");
      }),
    ];

    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sertifikasi-wasit-juri-${viewMode}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printFilteredRekap() {
    if (filteredRows.length === 0) {
      toast.info("Belum ada data peserta untuk dicetak.");
      return;
    }

    const periodForPrint =
      viewMode === "arsip" ? focusedArchivedPeriod : activePeriod;
    const title =
      viewMode === "arsip"
        ? focusedArchivedPeriod?.title || "Arsip Riwayat Sertifikasi Wasit & Juri"
        : activePeriod?.title || "Daftar Peserta Sertifikasi Wasit & Juri";

    const html = generateWasitJuriRecapHtml({
      periodTitle: title,
      period: periodForPrint,
      registrants: filteredRows,
      scopeLabel,
      isArchiveView: viewMode === "arsip",
      paperSize,
      origin: typeof window !== "undefined" ? window.location.origin : "",
    });

    const win = window.open("", "_blank", "width=1080,height=760");
    if (!win) {
      toast.error("Izinkan pop-up browser untuk membuka jendela cetak.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 280);
  }

  function resetFilters() {
    setSearchQuery("");
    setToolbarSuggestOpen(false);
    if (!lockedDojoName) setDojoFilter("ALL");
    setStatusFilter("ALL");
  }

  const showToolbarDropdown =
    viewMode === "aktif" &&
    Boolean(activePeriod) &&
    toolbarSuggestOpen &&
    searchQuery.trim().length >= 2;
  const showModalDropdown =
    modalSuggestOpen && modalMemberQuery.trim().length >= 2;

  const isInspectingArchive = useMemo(() => {
    if (!inspectRow) return false;
    return Boolean(periodMap.get(inspectRow.periodId)?.isArchived);
  }, [inspectRow, periodMap]);

  return (
    <div className="space-y-3.5">
      <AdminPageHeader
        title={
          viewMode === "arsip"
            ? "Arsip Riwayat Sertifikasi Wasit Juri"
            : "Sertifikasi Wasit Juri"
        }
        description={
          viewMode === "arsip"
            ? `Riwayat gelombang penataran, hasil ujian, dan daftar pemegang lisensi · Cakupan: ${scopeLabel}`
            : `Pendaftaran penataran, ujian lisensi, dan refreshing Wasit & Juri · Cakupan: ${scopeLabel}`
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={() => void refreshFromDatabase()}
              className="gap-1.5 text-xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Muat Ulang</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                switchViewMode(viewMode === "arsip" ? "aktif" : "arsip")
              }
              className="gap-1.5 text-xs"
            >
              {viewMode === "arsip" ? (
                <>
                  <Scale className="h-3.5 w-3.5" />
                  Pendaftaran Aktif ({openPeriods.length})
                </>
              ) : (
                <>
                  <History className="h-3.5 w-3.5" />
                  Arsip Riwayat ({archivedPeriods.length})
                </>
              )}
            </Button>

            {canManagePeriod && canCreate ? (
              <Button
                type="button"
                variant={viewMode === "arsip" ? "default" : "outline"}
                size="sm"
                onClick={openCreatePeriodModal}
                className={
                  viewMode === "arsip"
                    ? "gap-1.5 bg-inkai-red text-xs text-white hover:bg-inkai-red/90"
                    : "gap-1.5 border-inkai-red/40 text-xs font-semibold text-inkai-red hover:bg-inkai-red/10"
                }
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Buat Baru
              </Button>
            ) : null}

            {viewMode === "aktif" && canCreate ? (
              <Button
                type="button"
                size="sm"
                onClick={openFreshRegistrationModal}
                className="gap-1.5 bg-inkai-red text-xs text-white hover:bg-inkai-red/90"
              >
                <Plus className="h-3.5 w-3.5" />
                Daftarkan Peserta
              </Button>
            ) : null}
          </>
        }
      />

      {isReadOnlyUser ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>
            Akun Anda berstatus <strong>Hanya Lihat (Read-Only)</strong> pada
            modul ini. Anda dapat menelusuri, mengekspor CSV, dan mencetak rekap
            tanpa mengubah data.
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center rounded-md border border-border/80 bg-muted/50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => switchViewMode("aktif")}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-semibold transition-colors ${
                viewMode === "aktif"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
              Pendaftaran Aktif
              <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] tabular-nums">
                {openPeriods.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => switchViewMode("arsip")}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-semibold transition-colors ${
                viewMode === "arsip"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Archive className="h-3.5 w-3.5" />
              Arsip Riwayat
              <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] tabular-nums">
                {archivedPeriods.length}
              </span>
            </button>
          </div>

          {canManagePeriod && canCreate ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openCreatePeriodModal}
              className="h-7 gap-1 px-2.5 text-xs"
            >
              <FolderPlus className="h-3.5 w-3.5 text-inkai-red" />
              + Buat Baru
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {canCreate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openAddNewMemberDialog("")}
              className="h-7 gap-1 px-2 text-xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Tambah Anggota
            </Button>
          ) : null}
        </div>
      </div>

      {viewMode === "aktif" ? (
        activePeriod ? (
          <section className="rounded-lg border bg-card p-3.5 shadow-xs sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Label
                    htmlFor="period-select-active"
                    className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Periode Aktif
                  </Label>
                  {activePeriodState.isClosedByDate ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                      Batas Daftar Ranting Ditutup
                    </span>
                  ) : activePeriodState.isQuotaFull ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-300">
                      Kuota Penuh ({activePeriodState.totalInPeriod}/{activePeriod.quota})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                      Pendaftaran Terbuka
                    </span>
                  )}
                  <span className="rounded-md border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground">
                    Tingkat: {activePeriod.levelScope}
                  </span>
                  {canManagePeriod && canUpdate ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditPeriodModal(activePeriod)}
                        className="h-6 gap-1 px-2 text-[11px]"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit Periode
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={periodArchiveBusyId === activePeriod.id}
                        onClick={() => setArchiveConfirmPeriod(activePeriod)}
                        className="h-6 gap-1 px-2 text-[11px]"
                      >
                        {periodArchiveBusyId === activePeriod.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Archive className="h-3 w-3" />
                        )}
                        Arsipkan Selesai
                      </Button>
                    </>
                  ) : null}
                </div>

                {openPeriods.length > 1 ? (
                  <select
                    id="period-select-active"
                    value={activePeriod.id}
                    onChange={(e) => setSelectedActivePeriodId(e.target.value)}
                    className="h-9 w-full max-w-2xl rounded-md border border-input bg-background px-2.5 text-xs font-semibold text-foreground sm:text-sm"
                  >
                    {openPeriods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <h3 className="text-sm font-bold text-foreground sm:text-base">
                    {activePeriod.title}
                  </h3>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-foreground/70" />
                    Teori:{" "}
                    <strong className="text-foreground">
                      {formatDateId(activePeriod.theoryDate)}
                    </strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ClipboardCheck className="h-3.5 w-3.5 text-foreground/70" />
                    Praktik Gelanggang:{" "}
                    <strong className="text-foreground">
                      {formatDateId(activePeriod.practicalDate)}
                    </strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-foreground/70" />
                    {activePeriod.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-foreground/70" />
                    Tutup daftar: {formatDateId(activePeriod.closeDate)}
                  </span>
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-3 gap-2 rounded-md border bg-muted/30 p-2.5 text-left sm:min-w-[320px]">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground">
                    Lisensi Baru
                  </p>
                  <p className="text-xs font-bold tabular-nums text-foreground sm:text-sm">
                    {formatRupiah(activePeriod.feeNew)}
                  </p>
                </div>
                <div className="border-l pl-2">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    Kenaikan Lisensi
                  </p>
                  <p className="text-xs font-bold tabular-nums text-foreground sm:text-sm">
                    {formatRupiah(activePeriod.feeUpgrade)}
                  </p>
                </div>
                <div className="border-l pl-2">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    Refreshing
                  </p>
                  <p className="text-xs font-bold tabular-nums text-foreground sm:text-sm">
                    {formatRupiah(activePeriod.feeRefreshing)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card px-4 py-10 text-center">
            <FolderPlus className="h-9 w-9 text-muted-foreground/70" />
            <h3 className="mt-2.5 text-sm font-bold text-foreground">
              Belum Ada Periode Pendaftaran Aktif
            </h3>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              {canManagePeriod
                ? "Buat periode sertifikasi baru untuk membuka pendaftaran penataran atau refreshing Wasit & Juri."
                : "Saat ini belum ada periode penataran Wasit & Juri yang sedang dibuka oleh pengurus Cabang."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {canManagePeriod && canCreate ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={openCreatePeriodModal}
                  className="gap-1.5 bg-inkai-red text-xs text-white hover:bg-inkai-red/90"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  + Buat Baru
                </Button>
              ) : null}
              {archivedPeriods.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => switchViewMode("arsip")}
                  className="gap-1.5 text-xs"
                >
                  <History className="h-3.5 w-3.5" />
                  Buka Arsip Riwayat ({archivedPeriods.length})
                </Button>
              ) : null}
            </div>
          </section>
        )
      ) : (
        <section className="rounded-lg border bg-card p-3.5 shadow-xs sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
                  <Archive className="h-3 w-3" />
                  Arsip & Riwayat Terkunci
                </span>
                {focusedArchivedPeriod?.archivedAt ? (
                  <span className="text-[11px] text-muted-foreground">
                    Diarsipkan: {formatDateId(focusedArchivedPeriod.archivedAt)}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Pilih periode arsip"
                  value={selectedArchivePeriodId}
                  onChange={(e) => setSelectedArchivePeriodId(e.target.value)}
                  className="h-9 w-full max-w-2xl rounded-md border border-input bg-background px-2.5 text-xs font-semibold text-foreground sm:text-sm"
                >
                  <option value="ALL_ARCHIVED">
                    Semua Periode Arsip — Gabungan ({archivedPeriods.length}{" "}
                    gelombang)
                  </option>
                  {archivedPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({formatDateId(p.practicalDate)})
                    </option>
                  ))}
                </select>

                {focusedArchivedPeriod && canManagePeriod && canUpdate ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={periodArchiveBusyId === focusedArchivedPeriod.id}
                    onClick={() =>
                      void handleRestoreArchivedPeriod(focusedArchivedPeriod.id)
                    }
                    className="h-9 gap-1.5 text-xs"
                  >
                    {periodArchiveBusyId === focusedArchivedPeriod.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    )}
                    Buka Kembali ke Aktif
                  </Button>
                ) : null}
              </div>

              {focusedArchivedPeriod ? (
                <p className="text-xs text-muted-foreground">
                  Pelaksanaan: {formatDateId(focusedArchivedPeriod.theoryDate)}{" "}
                  – {formatDateId(focusedArchivedPeriod.practicalDate)} ·{" "}
                  {focusedArchivedPeriod.location} · Tingkat{" "}
                  {focusedArchivedPeriod.levelScope}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Menampilkan seluruh riwayat peserta penataran, hasil ujian,
                  dan masa berlaku lisensi lintas tahun dari database.
                </p>
              )}
            </div>

            {canManagePeriod && canCreate ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={openCreatePeriodModal}
                  className="gap-1.5 bg-inkai-red text-xs text-white hover:bg-inkai-red/90"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  + Buat Periode Baru
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setStatusFilter("ALL")}
          className="rounded-lg border bg-card p-3 text-left transition-colors hover:border-foreground/30"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">
              {viewMode === "arsip"
                ? "Total Riwayat Peserta"
                : "Total Pendaftar"}
            </span>
            <Users className="h-4 w-4" />
          </div>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground sm:text-2xl">
            {kpi.total}
            {viewMode === "aktif" && activePeriod ? (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                / kuota {activePeriod.quota}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {kpi.baruCount} baru · {Math.max(0, kpi.total - kpi.baruCount)}{" "}
            kenaikan/refreshing
          </p>
        </button>

        {viewMode === "aktif" ? (
          <>
            <button
              type="button"
              onClick={() => setStatusFilter("MENUNGGU_BAYAR")}
              className="rounded-lg border bg-card p-3 text-left transition-colors hover:border-amber-500/50"
            >
              <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                <span className="text-xs font-medium">Menunggu Verifikasi</span>
                <FileCheck2 className="h-4 w-4" />
              </div>
              <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                {kpi.waitingCount}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Kelengkapan berkas & bukti transfer
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("SIAP_UJIAN")}
              className="rounded-lg border bg-card p-3 text-left transition-colors hover:border-sky-500/50"
            >
              <div className="flex items-center justify-between text-sky-600 dark:text-sky-400">
                <span className="text-xs font-medium">Siap Ujian</span>
                <ShieldCheck className="h-4 w-4" />
              </div>
              <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                {kpi.readyCount}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Berkas lengkap & lunas (tercatat di Kas)
              </p>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStatusFilter("MENGULANG")}
              className="rounded-lg border bg-card p-3 text-left transition-colors hover:border-rose-500/50"
            >
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                <span className="text-xs font-medium">
                  Belum Lulus / Mengulang
                </span>
                <RotateCcw className="h-4 w-4" />
              </div>
              <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                {kpi.repeatCount}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Peserta evaluasi ulang periode berikutnya
              </p>
            </button>

            <div className="rounded-lg border bg-card p-3 text-left">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Gelombang Tersimpan</span>
                <Archive className="h-4 w-4" />
              </div>
              <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                {archivedPeriods.length}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Periode penataran & refreshing selesai
              </p>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => setStatusFilter("LULUS")}
          className="rounded-lg border bg-card p-3 text-left transition-colors hover:border-emerald-500/50"
        >
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-medium">Lulus Sertifikasi</span>
            <Award className="h-4 w-4" />
          </div>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground sm:text-2xl">
            {kpi.passedCount}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Memenuhi standar ujian tulis & praktik
          </p>
        </button>
      </section>

      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3.5 pt-2.5">
          <div className="flex flex-wrap gap-1">
            {[
              {
                id: "pendaftar" as const,
                label:
                  viewMode === "arsip"
                    ? "Riwayat Peserta & Lisensi"
                    : "Daftar Pendaftar",
                icon: viewMode === "arsip" ? History : Users,
              },
              {
                id: "syarat" as const,
                label: "Syarat & Jenjang Lisensi",
                icon: BookOpen,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? "border-inkai-red text-inkai-red"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "pendaftar" ? (
            <div className="flex items-center gap-1.5 pb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={exportFilteredCsv}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
              <select
                aria-label="Ukuran Kertas Cetak"
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as "A4" | "F4")}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs font-medium"
              >
                <option value="A4">A4</option>
                <option value="F4">F4 Folio</option>
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={printFilteredRekap}
              >
                <Printer className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cetak Rekap</span>
              </Button>
            </div>
          ) : null}
        </div>

        {activeTab === "pendaftar" ? (
          <div className="p-3.5">
            <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
              <div ref={toolbarSearchRef} className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onFocus={() => setToolbarSuggestOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setToolbarSuggestOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setToolbarSuggestOpen(false);
                  }}
                  placeholder={
                    viewMode === "arsip"
                      ? "Cari riwayat nama wasit/juri, NIA, No. MSH, ranting, atau periode..."
                      : "Cari nama / NIA / MSH untuk filter tabel atau pilih dari keanggotaan terdaftar..."
                  }
                  className="h-8 pl-8 pr-8 text-xs"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    aria-label="Bersihkan pencarian"
                    onClick={() => {
                      setSearchQuery("");
                      setToolbarSuggestOpen(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}

                {showToolbarDropdown ? (
                  <div className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                    <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                      <span>Pencarian Data Keanggotaan Terdaftar</span>
                      {toolbarSuggest.loading ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Mencari...
                        </span>
                      ) : null}
                    </div>

                    {toolbarSuggest.suggestions.length > 0 ? (
                      <>
                        <ul className="max-h-64 divide-y overflow-y-auto">
                          {toolbarSuggest.suggestions.map((m) => {
                            const already = isAlreadyRegisteredInPeriod(m);
                            const docSummary = [
                              m.photoUrl ? "Foto ✓" : null,
                              m.birthCertificateUrl ? "Akte ✓" : null,
                              m.bpjsCardUrl ? "BPJS ✓" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ");
                            return (
                              <li
                                key={m.id}
                                className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-muted/60"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (already || !canCreate) {
                                      setSearchQuery(m.fullName);
                                      setToolbarSuggestOpen(false);
                                    } else {
                                      autofillFromMember(m, true);
                                    }
                                  }}
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-semibold text-foreground">
                                      {m.fullName}
                                    </span>
                                    {m.currentRank ? (
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                          m.isBlackBelt
                                            ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                                            : "border bg-muted text-muted-foreground"
                                        }`}
                                      >
                                        {m.currentRank}
                                      </span>
                                    ) : null}
                                    {m.latestLicense ? (
                                      <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                                        {m.latestLicense}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                    {[
                                      m.nia ? `NIA ${m.nia}` : "Tanpa NIA",
                                      m.mshNumber ? m.mshNumber : null,
                                      m.dojoName
                                        ? `Ranting ${m.dojoName}`
                                        : null,
                                      m.age !== null ? `${m.age} th` : null,
                                      docSummary || "Berkas belum diunggah",
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                </button>

                                {already ? (
                                  <span className="shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                                    Sudah di Daftar
                                  </span>
                                ) : canCreate ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => autofillFromMember(m, true)}
                                    className="h-7 shrink-0 gap-1 bg-inkai-red px-2.5 text-[11px] text-white hover:bg-inkai-red/90"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Pilih & Daftarkan
                                  </Button>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>

                        {canCreate ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2 text-[11px]">
                            <span className="text-muted-foreground">
                              Nama yang dicari belum ada di daftar keanggotaan?
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openAddNewMemberDialog(searchQuery)}
                              className="h-7 gap-1 px-2.5 text-[11px]"
                            >
                              <UserPlus className="h-3 w-3" />
                              Tambahkan Daftar Anggota
                            </Button>
                          </div>
                        ) : null}
                      </>
                    ) : !toolbarSuggest.loading &&
                      toolbarSuggest.searchedQuery &&
                      canCreate ? (
                      <div className="flex flex-col items-start gap-2 px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-foreground">
                            &ldquo;{searchQuery.trim()}&rdquo; belum ditemukan
                            di data keanggotaan.
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Tambahkan ke daftar anggota terlebih dahulu agar
                            otomatis terisi ke pendaftaran Wasit/Juri.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openAddNewMemberDialog(searchQuery)}
                          className="h-7 shrink-0 gap-1.5 bg-inkai-red px-2.5 text-xs text-white hover:bg-inkai-red/90"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Tambahkan Daftar Anggota
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" />
                </div>

                {!lockedDojoName ? (
                  <select
                    aria-label="Filter Ranting"
                    value={dojoFilter}
                    onChange={(e) => setDojoFilter(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                  >
                    <option value="ALL">Semua Ranting</option>
                    {dojoOptions.map((d) => (
                      <option key={d} value={d}>
                        Ranting {d}
                      </option>
                    ))}
                  </select>
                ) : null}

                <select
                  aria-label="Filter Status"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as "ALL" | WasitJuriRegistrationState,
                    )
                  }
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                >
                  <option value="ALL">Semua Status</option>
                  {viewMode === "aktif" ? (
                    <>
                      <option value="MENUNGGU_BERKAS">Menunggu Berkas</option>
                      <option value="MENUNGGU_BAYAR">
                        Menunggu Verif Bayar
                      </option>
                      <option value="SIAP_UJIAN">Siap Ujian</option>
                    </>
                  ) : null}
                  <option value="LULUS">Lulus Sertifikasi</option>
                  <option value="MENGULANG">Belum Lulus</option>
                </select>

                {searchQuery ||
                (dojoFilter !== "ALL" && !lockedDojoName) ||
                statusFilter !== "ALL" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-8 gap-1 px-2 text-xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                ) : null}
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
                {viewMode === "arsip" ? (
                  <Archive className="h-8 w-8 text-muted-foreground/60" />
                ) : (
                  <Scale className="h-8 w-8 text-muted-foreground/60" />
                )}
                <p className="mt-2.5 text-sm font-semibold text-foreground">
                  {scopedRows.length > 0
                    ? "Tidak ada data yang cocok dengan filter"
                    : viewMode === "arsip"
                      ? "Belum ada riwayat sertifikasi yang diarsipkan"
                      : activePeriod
                        ? "Belum ada peserta terdaftar pada periode ini"
                        : "Belum ada periode sertifikasi aktif"}
                </p>
                <p className="mt-1 max-w-md px-4 text-xs text-muted-foreground">
                  {viewMode === "aktif" &&
                  searchQuery.trim().length >= 2 &&
                  canCreate
                    ? `Jika "${searchQuery.trim()}" belum terdaftar sebagai anggota INKAI, gunakan tombol Tambahkan Daftar Anggota di bawah.`
                    : scopedRows.length > 0
                      ? "Ubah kata kunci pencarian atau tekan tombol Reset untuk menampilkan seluruh data."
                      : viewMode === "arsip"
                        ? "Periode yang telah selesai diarsipkan akan tersimpan dan dapat ditelusuri kembali di halaman ini."
                        : activePeriod
                          ? "Ketik nama anggota di kolom pencarian untuk autofill langsung dari Keanggotaan, atau klik Daftarkan Peserta."
                          : canManagePeriod
                            ? "Klik tombol Buat Baru untuk membuka gelombang sertifikasi Wasit & Juri pertama."
                            : "Silakan menunggu pengurus Cabang membuka gelombang pendaftaran baru."}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {viewMode === "aktif" &&
                  searchQuery.trim().length >= 2 &&
                  canCreate ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openAddNewMemberDialog(searchQuery)}
                      className="gap-1.5 bg-inkai-red text-xs text-white hover:bg-inkai-red/90"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Tambahkan Daftar Anggota
                    </Button>
                  ) : null}
                  {scopedRows.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetFilters}
                      className="text-xs"
                    >
                      Reset Filter
                    </Button>
                  ) : null}
                  {viewMode === "arsip" ? (
                    canManagePeriod && canCreate ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={openCreatePeriodModal}
                        className="gap-1.5 bg-inkai-red text-xs text-white hover:bg-inkai-red/90"
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                        + Buat Baru
                      </Button>
                    ) : null
                  ) : activePeriod && canCreate ? (
                    <Button
                      type="button"
                      variant={
                        searchQuery.trim().length >= 2 ? "outline" : "default"
                      }
                      size="sm"
                      onClick={openFreshRegistrationModal}
                      className={
                        searchQuery.trim().length >= 2
                          ? "gap-1.5 text-xs"
                          : "gap-1.5 bg-inkai-red text-xs text-white hover:bg-inkai-red/90"
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Daftarkan Peserta
                    </Button>
                  ) : canManagePeriod && canCreate ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={openCreatePeriodModal}
                      className="gap-1.5 bg-inkai-red text-xs text-white hover:bg-inkai-red/90"
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                      + Buat Baru
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2.5">Peserta & Ranting</th>
                      {viewMode === "arsip" &&
                      selectedArchivePeriodId === "ALL_ARCHIVED" ? (
                        <th className="px-3 py-2.5">Periode Riwayat</th>
                      ) : null}
                      <th className="px-3 py-2.5">Tingkatan & Target</th>
                      <th className="px-3 py-2.5">Berkas Keanggotaan</th>
                      <th className="px-3 py-2.5">Biaya & Bayar</th>
                      <th className="px-3 py-2.5">Status / Nilai</th>
                      <th className="px-3 py-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRows.map((row) => {
                      const rowPeriod = periodMap.get(row.periodId);
                      const validity = getLicenseValidityState(
                        row.licenseValidUntil,
                      );

                      return (
                        <tr
                          key={row.id}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <td className="px-3 py-2.5 align-top">
                            <p className="font-semibold text-foreground">
                              {row.name}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              NIA {row.nia} · Ranting {row.dojoName}
                              {row.age !== null ? ` (${row.age} th)` : ""}
                            </p>
                          </td>

                          {viewMode === "arsip" &&
                          selectedArchivePeriodId === "ALL_ARCHIVED" ? (
                            <td className="max-w-[220px] px-3 py-2.5 align-top">
                              <p className="line-clamp-2 font-medium text-foreground">
                                {rowPeriod?.title ?? "-"}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {rowPeriod
                                  ? formatDateId(rowPeriod.practicalDate)
                                  : ""}
                              </p>
                            </td>
                          ) : null}

                          <td className="px-3 py-2.5 align-top">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="inline-flex items-center rounded-md border bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
                                {row.danRank}
                              </span>
                              <span className="inline-flex items-center rounded-md border bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                                {GRADE_LABELS[row.targetGrade]} ·{" "}
                                {SUBMISSION_LABELS[row.submissionType]}
                              </span>
                            </div>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                              {row.mshNumber} · {DISCIPLINE_LABELS[row.discipline]}
                            </p>
                          </td>

                          <td className="px-3 py-2.5 align-top">
                            <MembershipDocsCell
                              memberName={row.name}
                              memberId={row.memberId}
                              docs={row.memberDocs}
                              danCertificateUrl={row.danCertificateUrl}
                              licenseCertUrl={row.licenseCertUrl}
                              requiresPriorLicense={
                                row.submissionType !== "BARU"
                              }
                              canEdit={!rowPeriod?.isArchived && canUpdate}
                              onPreview={(title, url) =>
                                setDocPreview({ title, url })
                              }
                              onEdit={() =>
                                setDocsEditTarget({
                                  memberId: row.memberId,
                                  fullName: row.name,
                                  docs: row.memberDocs,
                                })
                              }
                            />
                          </td>

                          <td className="px-3 py-2.5 align-top tabular-nums">
                            <p className="font-semibold text-foreground">
                              {formatRupiah(row.feeAmount)}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                              <span
                                className={`text-[11px] font-medium ${
                                  row.paymentState === "LUNAS"
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : row.paymentState === "MENUNGGU_VERIFIKASI"
                                      ? "text-amber-700 dark:text-amber-400"
                                      : "text-muted-foreground"
                                }`}
                              >
                                {paymentLabel(row.paymentState)}
                              </span>
                              <span className="rounded border bg-muted/50 px-1 py-0.2 text-[10px] text-muted-foreground">
                                {row.paymentMethod}
                              </span>
                            </div>
                            {row.proofUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setDocPreview({
                                    title: `Bukti Transfer — ${row.name}`,
                                    url: row.proofUrl!,
                                  })
                                }
                                className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-inkai-red hover:underline"
                              >
                                <Eye className="h-3 w-3" />
                                Lihat Bukti TF
                              </button>
                            ) : null}
                          </td>

                          <td className="px-3 py-2.5 align-top">
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusBadgeStyle(
                                row.status,
                              )}`}
                            >
                              {statusLabel(row.status)}
                            </span>
                            {row.scores.teoriKata !== null ||
                            row.scores.teoriKumite !== null ||
                            row.scores.praktik !== null ? (
                              <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                                Kata {row.scores.teoriKata ?? "-"} · Kumite{" "}
                                {row.scores.teoriKumite ?? "-"} · Praktik{" "}
                                {row.scores.praktik ?? "-"}
                              </p>
                            ) : null}
                            {row.grantedLicense ? (
                              <p className="mt-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                {row.grantedLicense}
                              </p>
                            ) : null}
                            {row.licenseValidUntil ? (
                              <p
                                className={`mt-0.5 text-[10px] font-medium ${
                                  validity === "expired"
                                    ? "text-rose-600 dark:text-rose-400"
                                    : validity === "expiring"
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-muted-foreground"
                                }`}
                              >
                                Berlaku s/d {formatDateId(row.licenseValidUntil)}
                                {validity === "expired"
                                  ? " (Kedaluwarsa — Wajib Refreshing)"
                                  : validity === "expiring"
                                    ? " (Segera Habis)"
                                    : ""}
                              </p>
                            ) : null}
                          </td>

                          <td className="px-3 py-2.5 text-right align-top">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setInspectRow(row)}
                              className="h-7 gap-1 px-2.5 text-xs"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              {viewMode === "arsip" || isReadOnlyUser
                                ? "Detail"
                                : "Periksa"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "syarat" ? (
          <div className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              {LICENSE_TIERS.map((tier) => (
                <div
                  key={tier.grade}
                  className="rounded-lg border bg-background p-3.5"
                >
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-sm font-bold text-foreground">
                      Kualifikasi {tier.grade}
                    </h3>
                    <span className="rounded-md border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                      {tier.minDan}
                    </span>
                  </div>
                  <dl className="mt-2.5 space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Batas Usia:</dt>
                      <dd className="font-medium text-foreground">
                        {tier.minAge}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Materi Evaluasi:</dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {tier.examFocus}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Masa Berlaku:</dt>
                      <dd className="mt-0.5 text-foreground">
                        {tier.validity}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>

            <div className="rounded-lg border bg-muted/20 p-3.5 text-xs">
              <h4 className="font-semibold text-foreground">
                Integrasi Berkas Keanggotaan, Sertifikat & Buku Kas Cabang
              </h4>
              <p className="mt-1.5 text-muted-foreground">
                Berkas dasar (<strong>Foto</strong>, <strong>Akte</strong>,{" "}
                <strong>BPJS</strong>) ditarik langsung dari profil{" "}
                <code>Member</code>, dilengkapi lampiran{" "}
                <strong>Ijazah DAN</strong>,{" "}
                <strong>Lisensi Sebelumnya</strong>, serta{" "}
                <strong>Bukti Transfer</strong> (dikompres otomatis ≤ 150 KB).
                Saat pengurus Cabang memverifikasi pembayaran menjadi{" "}
                <strong>Lunas</strong>, pemasukan otomatis tercatat ke{" "}
                <strong>Buku Kas Cabang (`/admin/kas`)</strong> dan jejak{" "}
                <strong>Log Audit</strong>.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Modal Pendaftaran Peserta */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Daftarkan Peserta Sertifikasi Wasit/Juri</DialogTitle>
            <DialogDescription>
              Pilih anggota terdaftar agar identitas, riwayat lisensi, dan berkas
              otomatis terisi dari database.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddRegistrant} className="space-y-3 text-xs">
            <div
              ref={modalSearchRef}
              className="relative rounded-md border bg-muted/25 p-2.5"
            >
              <Label
                htmlFor="wj-member-lookup"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Cari & Pilih dari Keanggotaan Terdaftar
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="wj-member-lookup"
                  value={modalMemberQuery}
                  onFocus={() => setModalSuggestOpen(true)}
                  onChange={(e) => {
                    setModalMemberQuery(e.target.value);
                    setModalSuggestOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setModalSuggestOpen(false);
                  }}
                  placeholder="Ketik nama anggota, NIA, atau No. MSH (min. 2 huruf)..."
                  className="h-9 bg-background pl-8 text-xs"
                />
              </div>

              {linkedMemberLabel ? (
                <div className="mt-2 space-y-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <UserCheck className="h-3.5 w-3.5 shrink-0" />
                      Terhubung: {linkedMemberLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setLinkedMemberLabel(null);
                        setLinkedLatestLicense(null);
                        setFormMemberId(null);
                        setFormMemberDocs(EMPTY_MEMBER_DOCS);
                        setFormName("");
                        setFormNia("");
                        setFormMsh("");
                        setFormAge("");
                        setFormOldLicense("");
                        setFormDanCertUrl("");
                        setFormLicenseCertUrl("");
                        setModalMemberQuery("");
                      }}
                      className="underline hover:no-underline"
                    >
                      Ganti
                    </button>
                  </div>
                  {linkedLatestLicense ? (
                    <p className="text-[10px]">
                      Lisensi tercatat: <strong>{linkedLatestLicense.license}</strong>
                      {linkedLatestLicense.validUntil
                        ? ` (s/d ${formatDateId(linkedLatestLicense.validUntil)})`
                        : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {showModalDropdown ? (
                <div className="absolute left-2.5 right-2.5 z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
                  {modalSuggest.loading ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Mencari data anggota...
                    </div>
                  ) : modalSuggest.suggestions.length > 0 ? (
                    <>
                      <ul className="max-h-52 divide-y overflow-y-auto">
                        {modalSuggest.suggestions.map((m) => {
                          const docSummary = [
                            m.photoUrl ? "Foto ✓" : null,
                            m.birthCertificateUrl ? "Akte ✓" : null,
                            m.bpjsCardUrl ? "BPJS ✓" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ");
                          return (
                            <li key={m.id}>
                              <button
                                type="button"
                                onClick={() => autofillFromMember(m, false)}
                                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                              >
                                <div className="min-w-0">
                                  <p className="font-semibold text-foreground">
                                    {m.fullName}
                                  </p>
                                  <p className="truncate text-[11px] text-muted-foreground">
                                    {[
                                      m.nia ? `NIA ${m.nia}` : "Tanpa NIA",
                                      m.mshNumber || null,
                                      m.dojoName ? `Ranting ${m.dojoName}` : null,
                                      m.age !== null ? `${m.age} th` : null,
                                      m.latestLicense || null,
                                      docSummary || "Berkas belum diunggah",
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                </div>
                                {m.currentRank ? (
                                  <span
                                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                      m.isBlackBelt
                                        ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                                        : "border bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {m.currentRank}
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-3 py-1.5 text-[11px]">
                        <span className="text-muted-foreground">
                          Belum ada di keanggotaan?
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openAddNewMemberDialog(modalMemberQuery)
                          }
                          className="h-6 gap-1 px-2 text-[11px]"
                        >
                          <UserPlus className="h-3 w-3" />
                          Tambahkan Daftar Anggota
                        </Button>
                      </div>
                    </>
                  ) : modalSuggest.searchedQuery ? (
                    <div className="space-y-2 p-3 text-xs">
                      <p className="text-muted-foreground">
                        Anggota{" "}
                        <strong className="text-foreground">
                          &ldquo;{modalMemberQuery.trim()}&rdquo;
                        </strong>{" "}
                        belum ditemukan di database keanggotaan.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openAddNewMemberDialog(modalMemberQuery)}
                        className="h-7 w-full gap-1.5 bg-inkai-red text-xs text-white hover:bg-inkai-red/90"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Tambahkan ke Daftar Anggota
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="wj-name">Nama Lengkap Peserta</Label>
                <Input
                  id="wj-name"
                  value={formName}
                  readOnly
                  placeholder="Otomatis terisi setelah memilih anggota di atas"
                  className="bg-muted/40"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="wj-nia">Nomor Induk Anggota (NIA)</Label>
                <Input
                  id="wj-nia"
                  value={formNia}
                  readOnly
                  placeholder="Otomatis dari Keanggotaan"
                  className="bg-muted/40"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="wj-msh">Nomor MSH</Label>
                <Input
                  id="wj-msh"
                  value={formMsh}
                  onChange={(e) => setFormMsh(e.target.value)}
                  placeholder="Contoh: MSH-12904"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="wj-dan">Tingkatan Sabuk / DAN</Label>
                <select
                  id="wj-dan"
                  value={formDan}
                  onChange={(e) => setFormDan(e.target.value as DanRankLabel)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                >
                  {DAN_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="wj-age">Usia & Ranting Asal</Label>
                <Input
                  id="wj-age"
                  value={
                    [
                      formAge ? `${formAge} th` : null,
                      formDojo ? `Ranting ${formDojo}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"
                  }
                  readOnly
                  className="bg-muted/40"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="wj-type">Jenis Pengajuan</Label>
                <select
                  id="wj-type"
                  value={formType}
                  onChange={(e) =>
                    setFormType(e.target.value as WasitJuriSubmissionType)
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                >
                  <option value="BARU">
                    Lisensi Baru ({formatRupiah(activePeriod?.feeNew ?? 350_000)})
                  </option>
                  <option value="KENAIKAN">
                    Kenaikan Tingkat (
                    {formatRupiah(activePeriod?.feeUpgrade ?? 300_000)})
                  </option>
                  <option value="REFRESHING">
                    Refreshing (
                    {formatRupiah(activePeriod?.feeRefreshing ?? 200_000)})
                  </option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="wj-grade">Target Kualifikasi</Label>
                <select
                  id="wj-grade"
                  value={formGrade}
                  onChange={(e) =>
                    setFormGrade(e.target.value as WasitJuriLicenseGrade)
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                >
                  <option value="JURI_B">Juri B</option>
                  <option value="JURI_A">Juri A</option>
                  <option value="WASIT_B">Wasit B</option>
                  <option value="WASIT_A">Wasit A</option>
                </select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="wj-disc">Nomor Perwasitan</Label>
                <select
                  id="wj-disc"
                  value={formDiscipline}
                  onChange={(e) =>
                    setFormDiscipline(e.target.value as WasitJuriDiscipline)
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                >
                  <option value="KATA_KUMITE">Kata & Kumite (Lengkap)</option>
                  <option value="KUMITE">Kumite Saja</option>
                  <option value="KATA">Kata Saja</option>
                </select>
              </div>

              {formType !== "BARU" ? (
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="wj-old-lic">
                    Keterangan / Nomor Lisensi Terakhir
                  </Label>
                  <Input
                    id="wj-old-lic"
                    value={formOldLicense}
                    onChange={(e) => setFormOldLicense(e.target.value)}
                    placeholder="Contoh: Juri B Kata & Kumite — Cabang (2024)"
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-2.5 rounded-md border bg-muted/30 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-foreground">
                  Berkas Keanggotaan & Sertifikat Pendukung
                </p>
                {formMemberId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDocsEditTarget({
                        memberId: formMemberId,
                        fullName: formName || "Anggota",
                        docs: formMemberDocs,
                      })
                    }
                    className="h-6 gap-1 px-2 text-[11px]"
                  >
                    <Pencil className="h-3 w-3" />
                    Ubah Foto/Akte/BPJS
                  </Button>
                ) : null}
              </div>

              {formMemberId ? (
                <div className="space-y-2.5">
                  <MembershipDocsCell
                    memberName={formName || "Anggota"}
                    memberId={formMemberId}
                    docs={formMemberDocs}
                    danCertificateUrl={formDanCertUrl || null}
                    licenseCertUrl={formLicenseCertUrl || null}
                    requiresPriorLicense={formType !== "BARU"}
                    canEdit={false}
                    onPreview={(title, url) => setDocPreview({ title, url })}
                  />

                  <div className="grid gap-2.5 pt-1 sm:grid-cols-2">
                    <FileUploadField
                      label="Scan Ijazah DAN / MSH (Opsional)"
                      value={formDanCertUrl}
                      folder="wasit-juri/dan-cert"
                      hideUrl
                      compressToMaxBytes={DOCUMENT_COMPRESS_MAX_BYTES}
                      hint="Foto/PDF ≤ 150 KB"
                      onChange={setFormDanCertUrl}
                    />
                    {formType !== "BARU" ? (
                      <FileUploadField
                        label="Scan Lisensi Sebelumnya"
                        value={formLicenseCertUrl}
                        folder="wasit-juri/license-cert"
                        hideUrl
                        compressToMaxBytes={DOCUMENT_COMPRESS_MAX_BYTES}
                        hint="Wajib untuk Kenaikan / Refreshing"
                        onChange={setFormLicenseCertUrl}
                      />
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Pilih anggota terdaftar di atas agar berkas{" "}
                  <strong>Foto</strong>, <strong>Akte</strong>, dan{" "}
                  <strong>BPJS</strong> otomatis tampil.
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-md border bg-muted/20 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs font-semibold text-foreground">
                  Metode Pembayaran & Bukti Transfer (Opsional saat daftar)
                </Label>
                <div className="inline-flex rounded-md border bg-background p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setFormPaymentMethod("TRANSFER")}
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium ${
                      formPaymentMethod === "TRANSFER"
                        ? "bg-inkai-red text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <CreditCard className="h-3 w-3" />
                    Transfer / QRIS
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormPaymentMethod("TUNAI")}
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium ${
                      formPaymentMethod === "TUNAI"
                        ? "bg-inkai-red text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Wallet className="h-3 w-3" />
                    Tunai
                  </button>
                </div>
              </div>

              {formPaymentMethod === "TRANSFER" ? (
                <FileUploadField
                  label="Unggah Bukti Transfer"
                  value={formProofUrl}
                  folder="wasit-juri/proof"
                  hideUrl
                  compressToMaxBytes={DOCUMENT_COMPRESS_MAX_BYTES}
                  hint="Jika diunggah sekarang, status otomatis menjadi Menunggu Verifikasi Cabang"
                  onChange={setFormProofUrl}
                />
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Pembayaran tunai diserahkan ke bendahara panitia / Cabang untuk
                  diverifikasi Lunas.
                </p>
              )}
            </div>

            <DialogFooter className="pt-1">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={registerSubmitting}
                >
                  Batal
                </Button>
              </DialogClose>
              <Button
                type="submit"
                size="sm"
                disabled={registerSubmitting || !formMemberId}
                className="gap-1.5 bg-inkai-red text-white hover:bg-inkai-red/90"
              >
                {registerSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Simpan Pendaftaran
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AddMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        dojos={dojoList}
        defaultDojoId={lockedDojoId ?? dojoList[0]?.id ?? ""}
        lockDojo={Boolean(lockedDojoId)}
        initialFullName={addMemberInitialName}
        defaultRank="Hitam (DAN 1)"
        onCreated={handleMemberCreated}
      />

      {/* Modal Buat Baru / Edit Periode */}
      <Dialog open={periodModalOpen} onOpenChange={setPeriodModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {periodModalMode === "edit"
                ? "Edit Pengaturan Periode Sertifikasi"
                : "Buat Baru — Periode Sertifikasi Wasit/Juri"}
            </DialogTitle>
            <DialogDescription>
              {periodModalMode === "edit"
                ? "Perbarui jadwal, lokasi, kuota, atau rincian biaya. Tagihan peserta yang belum dibayar otomatis menyesuaikan tarif baru."
                : "Buka gelombang penataran, ujian lisensi, atau refreshing baru dan simpan ke database."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitPeriodModal} className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label htmlFor="per-title">Nama Kegiatan / Periode</Label>
              <Input
                id="per-title"
                value={newPeriodTitle}
                onChange={(e) => setNewPeriodTitle(e.target.value)}
                placeholder="Contoh: Penataran Wasit/Juri Cabang Surabaya Semester I 2027"
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="per-scope">Tingkat Penyelenggara</Label>
                <select
                  id="per-scope"
                  value={newPeriodScope}
                  onChange={(e) =>
                    setNewPeriodScope(e.target.value as WasitJuriLevelScope)
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                >
                  <option value="Cabang">Cabang</option>
                  <option value="Pengprov Jatim">Pengprov Jatim</option>
                  <option value="PB INKAI / FORKI">PB INKAI / FORKI</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="per-quota">Kuota Peserta</Label>
                <Input
                  id="per-quota"
                  type="number"
                  min={1}
                  value={newQuota}
                  onChange={(e) => setNewQuota(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="per-theory">Tanggal Penataran & Teori</Label>
                <Input
                  id="per-theory"
                  type="date"
                  value={newTheoryDate}
                  onChange={(e) => setNewTheoryDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="per-prac">Tanggal Praktik Gelanggang</Label>
                <Input
                  id="per-prac"
                  type="date"
                  value={newPracticalDate}
                  onChange={(e) => setNewPracticalDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="per-close">Batas Akhir Pendaftaran</Label>
                <Input
                  id="per-close"
                  type="date"
                  value={newCloseDate}
                  onChange={(e) => setNewCloseDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="per-loc">Lokasi Pelaksanaan</Label>
                <Input
                  id="per-loc"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="per-fn">Biaya Lisensi Baru (Rp)</Label>
                <Input
                  id="per-fn"
                  type="number"
                  value={newFeeNew}
                  onChange={(e) => setNewFeeNew(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="per-fu">Biaya Kenaikan Tingkat (Rp)</Label>
                <Input
                  id="per-fu"
                  type="number"
                  value={newFeeUpgrade}
                  onChange={(e) => setNewFeeUpgrade(e.target.value)}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="per-fr">Biaya Refreshing (Rp)</Label>
                <Input
                  id="per-fr"
                  type="number"
                  value={newFeeRefreshing}
                  onChange={(e) => setNewFeeRefreshing(e.target.value)}
                />
              </div>
            </div>

            {periodModalMode === "create" && openPeriods.length > 0 ? (
              <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-2.5 text-xs">
                <input
                  type="checkbox"
                  checked={archivePreviousOnCreate}
                  onChange={(e) => setArchivePreviousOnCreate(e.target.checked)}
                  className="mt-0.5 rounded border-input"
                />
                <span>
                  Pindahkan otomatis periode aktif sebelumnya ke{" "}
                  <strong>Arsip Riwayat</strong> saat periode baru dibuka.
                </span>
              </label>
            ) : null}

            <DialogFooter className="pt-1">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={periodSubmitting}
                >
                  Batal
                </Button>
              </DialogClose>
              <Button
                type="submit"
                size="sm"
                disabled={periodSubmitting}
                className="gap-1.5 bg-inkai-red text-white hover:bg-inkai-red/90"
              >
                {periodSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {periodModalMode === "edit"
                  ? "Simpan Perubahan"
                  : "Buat & Aktifkan Periode"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Inspeksi Berkas, Pembayaran & Penilaian */}
      <Dialog
        open={Boolean(inspectRow)}
        onOpenChange={(open) => {
          if (!open) setInspectRow(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {inspectRow ? (
            <>
              <DialogHeader>
                <DialogTitle>{inspectRow.name}</DialogTitle>
                <DialogDescription>
                  {inspectRow.danRank} ({inspectRow.mshNumber}) · Ranting{" "}
                  {inspectRow.dojoName} · {SUBMISSION_LABELS[inspectRow.submissionType]} →{" "}
                  {GRADE_LABELS[inspectRow.targetGrade]} (
                  {DISCIPLINE_LABELS[inspectRow.discipline]})
                </DialogDescription>
              </DialogHeader>

              {isInspectingArchive ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                  Data ini berada di <strong>Arsip Riwayat</strong> (mode baca
                  saja). Buka kembali periode jika perlu mengubah nilai atau
                  status.
                </div>
              ) : null}

              <div className="space-y-3.5 text-xs">
                {/* 1. Berkas */}
                <div className="space-y-2.5 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">
                      1. Berkas Keanggotaan & Sertifikat Syarat
                    </p>
                    {!isInspectingArchive && canUpdate ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDocsEditTarget({
                            memberId: inspectRow.memberId,
                            fullName: inspectRow.name,
                            docs: inspectRow.memberDocs,
                          })
                        }
                        className="h-7 gap-1 px-2 text-[11px]"
                      >
                        <Pencil className="h-3 w-3" />
                        Kelola Foto/Akte/BPJS
                      </Button>
                    ) : null}
                  </div>
                  <MembershipDocsCell
                    memberName={inspectRow.name}
                    memberId={inspectRow.memberId}
                    docs={inspectRow.memberDocs}
                    danCertificateUrl={inspectRow.danCertificateUrl}
                    licenseCertUrl={inspectRow.licenseCertUrl}
                    requiresPriorLicense={inspectRow.submissionType !== "BARU"}
                    canEdit={false}
                    onPreview={(title, url) => setDocPreview({ title, url })}
                  />

                  {!isInspectingArchive && canUpdate ? (
                    <div className="grid gap-2.5 border-t pt-2.5 sm:grid-cols-2">
                      <FileUploadField
                        label="Scan Ijazah DAN / MSH"
                        value={inspectRow.danCertificateUrl ?? ""}
                        folder="wasit-juri/dan-cert"
                        hideUrl
                        compressToMaxBytes={DOCUMENT_COMPRESS_MAX_BYTES}
                        onChange={(url) => {
                          if (!url.trim()) {
                            void patchRegistration(
                              inspectRow.id,
                              { danCertificateUrl: null },
                              "Ijazah DAN dihapus.",
                            );
                          }
                        }}
                        onUploaded={(url) =>
                          void patchRegistration(
                            inspectRow.id,
                            { danCertificateUrl: url },
                            "Scan Ijazah DAN berhasil disimpan.",
                          )
                        }
                      />
                      {inspectRow.submissionType !== "BARU" ? (
                        <FileUploadField
                          label="Scan Lisensi Sebelumnya"
                          value={inspectRow.licenseCertUrl ?? ""}
                          folder="wasit-juri/license-cert"
                          hideUrl
                          compressToMaxBytes={DOCUMENT_COMPRESS_MAX_BYTES}
                          onChange={(url) => {
                            if (!url.trim()) {
                              void patchRegistration(
                                inspectRow.id,
                                { licenseCertUrl: null },
                                "Scan lisensi sebelumnya dihapus.",
                              );
                            }
                          }}
                          onUploaded={(url) =>
                            void patchRegistration(
                              inspectRow.id,
                              { licenseCertUrl: url },
                              "Scan lisensi sebelumnya berhasil disimpan.",
                            )
                          }
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* 2. Pembayaran & Bukti TF */}
                <div className="space-y-2.5 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">
                        2. Biaya Pendaftaran ({formatRupiah(inspectRow.feeAmount)})
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Status:{" "}
                        <strong>{paymentLabel(inspectRow.paymentState)}</strong>{" "}
                        · Metode: <strong>{inspectRow.paymentMethod}</strong>
                        {inspectRow.paymentState === "LUNAS"
                          ? " · Tercatat di Buku Kas"
                          : ""}
                      </p>
                    </div>

                    {!isInspectingArchive && canUpdate ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {inspectRow.paymentState !== "LUNAS" ? (
                          <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-[11px]">
                            <button
                              type="button"
                              disabled={inspectSaving}
                              onClick={() =>
                                void patchRegistration(
                                  inspectRow.id,
                                  { paymentMethod: "TRANSFER" },
                                  "Metode bayar diubah ke Transfer.",
                                )
                              }
                              className={`rounded px-2 py-0.5 font-medium ${
                                inspectRow.paymentMethod === "TRANSFER"
                                  ? "bg-background text-foreground shadow-xs"
                                  : "text-muted-foreground"
                              }`}
                            >
                              Transfer
                            </button>
                            <button
                              type="button"
                              disabled={inspectSaving}
                              onClick={() =>
                                void patchRegistration(
                                  inspectRow.id,
                                  { paymentMethod: "TUNAI" },
                                  "Metode bayar diubah ke Tunai.",
                                )
                              }
                              className={`rounded px-2 py-0.5 font-medium ${
                                inspectRow.paymentMethod === "TUNAI"
                                  ? "bg-background text-foreground shadow-xs"
                                  : "text-muted-foreground"
                              }`}
                            >
                              Tunai
                            </button>
                          </div>
                        ) : null}

                        {!canManagePeriod &&
                        inspectRow.paymentState === "BELUM_BAYAR" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={inspectSaving}
                            className="h-7 text-xs"
                            onClick={() =>
                              void patchRegistration(
                                inspectRow.id,
                                { paymentState: "MENUNGGU_VERIFIKASI" },
                                "Konfirmasi pembayaran dikirim untuk diverifikasi Cabang.",
                              )
                            }
                          >
                            Konfirmasi Sudah Bayar
                          </Button>
                        ) : null}

                        {canManagePeriod ? (
                          inspectRow.paymentState === "LUNAS" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={inspectSaving}
                              className="h-7 text-xs"
                              onClick={() =>
                                void patchRegistration(
                                  inspectRow.id,
                                  {
                                    paymentState: "MENUNGGU_VERIFIKASI",
                                    status: "MENUNGGU_BAYAR",
                                  },
                                  "Status Lunas dibatalkan dan jurnal Buku Kas dibalik otomatis.",
                                )
                              }
                            >
                              Batalkan Lunas
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              disabled={inspectSaving}
                              className="h-7 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                              onClick={() =>
                                void patchRegistration(
                                  inspectRow.id,
                                  {
                                    paymentState: "LUNAS",
                                    status:
                                      inspectRow.status === "LULUS"
                                        ? "LULUS"
                                        : "SIAP_UJIAN",
                                  },
                                  "Pembayaran diverifikasi Lunas dan tercatat ke Buku Kas.",
                                )
                              }
                            >
                              Tandai Lunas
                            </Button>
                          )
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {inspectRow.proofUrl ? (
                    <div className="flex items-center justify-between rounded border bg-muted/30 px-2.5 py-1.5">
                      <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        Bukti transfer telah terlampir
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-2 text-[11px] text-inkai-red"
                        onClick={() =>
                          setDocPreview({
                            title: `Bukti Transfer — ${inspectRow.name}`,
                            url: inspectRow.proofUrl!,
                          })
                        }
                      >
                        <Eye className="h-3 w-3" />
                        Lihat Bukti TF
                      </Button>
                    </div>
                  ) : null}

                  {!isInspectingArchive &&
                  canUpdate &&
                  inspectRow.paymentMethod === "TRANSFER" &&
                  (canManagePeriod || inspectRow.paymentState !== "LUNAS") ? (
                    <FileUploadField
                      label={
                        inspectRow.proofUrl
                          ? "Ganti Bukti Transfer"
                          : "Unggah Bukti Transfer"
                      }
                      value={inspectRow.proofUrl ?? ""}
                      folder="wasit-juri/proof"
                      hideUrl
                      compressToMaxBytes={DOCUMENT_COMPRESS_MAX_BYTES}
                      hint="Foto struk/screenshot m-banking otomatis dikompres ≤ 150 KB"
                      onChange={(url) => {
                        if (!url.trim()) {
                          void patchRegistration(
                            inspectRow.id,
                            { proofUrl: null },
                            "Bukti transfer dihapus.",
                          );
                        }
                      }}
                      onUploaded={(url) =>
                        void patchRegistration(
                          inspectRow.id,
                          {
                            proofUrl: url,
                            ...(inspectRow.paymentState === "BELUM_BAYAR"
                              ? { paymentState: "MENUNGGU_VERIFIKASI" }
                              : {}),
                          },
                          "Bukti transfer berhasil diunggah.",
                        )
                      }
                    />
                  ) : null}
                </div>

                {/* 3. Nilai & Lisensi */}
                <div className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">
                      3. Nilai Ujian, Lisensi & Masa Berlaku
                    </p>
                    {!isInspectingArchive && canManagePeriod && canUpdate ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={inspectSaving}
                        className="h-7 gap-1 px-2 text-[11px]"
                        onClick={() =>
                          void patchRegistration(
                            inspectRow.id,
                            {
                              scoreTeoriKata: parseScoreInput(draftTeoriKata),
                              scoreTeoriKumite:
                                parseScoreInput(draftTeoriKumite),
                              scorePraktik: parseScoreInput(draftPraktik),
                              notes: draftNotes.trim() || null,
                            },
                            "Nilai & catatan ujian tersimpan ke database.",
                          )
                        }
                      >
                        <Save className="h-3 w-3" />
                        Simpan Nilai
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="sc-kata" className="text-[11px]">
                        Teori Kata
                      </Label>
                      <Input
                        id="sc-kata"
                        type="number"
                        min={0}
                        max={100}
                        disabled={
                          isInspectingArchive || !canManagePeriod || !canUpdate
                        }
                        value={draftTeoriKata}
                        onChange={(e) => setDraftTeoriKata(e.target.value)}
                        placeholder="0–100"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sc-kumite" className="text-[11px]">
                        Teori Kumite
                      </Label>
                      <Input
                        id="sc-kumite"
                        type="number"
                        min={0}
                        max={100}
                        disabled={
                          isInspectingArchive || !canManagePeriod || !canUpdate
                        }
                        value={draftTeoriKumite}
                        onChange={(e) => setDraftTeoriKumite(e.target.value)}
                        placeholder="0–100"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sc-praktik" className="text-[11px]">
                        Praktik Tatami
                      </Label>
                      <Input
                        id="sc-praktik"
                        type="number"
                        min={0}
                        max={100}
                        disabled={
                          isInspectingArchive || !canManagePeriod || !canUpdate
                        }
                        value={draftPraktik}
                        onChange={(e) => setDraftPraktik(e.target.value)}
                        placeholder="0–100"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="sc-lic" className="text-[11px]">
                        Nama / Nomor Lisensi Diterbitkan
                      </Label>
                      <Input
                        id="sc-lic"
                        disabled={
                          isInspectingArchive || !canManagePeriod || !canUpdate
                        }
                        value={draftGrantedLicense}
                        onChange={(e) => setDraftGrantedLicense(e.target.value)}
                        placeholder="Contoh: Juri B Kata & Kumite — Cabang Surabaya"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sc-exp" className="text-[11px]">
                        Masa Berlaku s/d
                      </Label>
                      <Input
                        id="sc-exp"
                        type="date"
                        disabled={
                          isInspectingArchive || !canManagePeriod || !canUpdate
                        }
                        value={draftValidUntil}
                        onChange={(e) => setDraftValidUntil(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {!isInspectingArchive && canManagePeriod && canUpdate ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={inspectSaving}
                        className="h-7 text-xs"
                        onClick={() =>
                          void patchRegistration(
                            inspectRow.id,
                            {
                              scoreTeoriKata: parseScoreInput(draftTeoriKata),
                              scoreTeoriKumite:
                                parseScoreInput(draftTeoriKumite),
                              scorePraktik: parseScoreInput(draftPraktik),
                              status: "SIAP_UJIAN",
                              grantedLicense: null,
                              licenseValidUntil: null,
                            },
                            "Status diperbarui ke Siap Ujian.",
                          )
                        }
                      >
                        Set Siap Ujian
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={inspectSaving}
                        className="h-7 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                        onClick={() =>
                          void patchRegistration(
                            inspectRow.id,
                            {
                              scoreTeoriKata: parseScoreInput(draftTeoriKata),
                              scoreTeoriKumite:
                                parseScoreInput(draftTeoriKumite),
                              scorePraktik: parseScoreInput(draftPraktik),
                              paymentState: "LUNAS",
                              status: "LULUS",
                              grantedLicense:
                                draftGrantedLicense.trim() ||
                                `${GRADE_LABELS[inspectRow.targetGrade]} ${DISCIPLINE_LABELS[inspectRow.discipline]}`,
                              licenseValidUntil: draftValidUntil || null,
                            },
                            "Peserta dinyatakan Lulus Sertifikasi.",
                          )
                        }
                      >
                        Nyatakan Lulus
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={inspectSaving}
                        className="h-7 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400"
                        onClick={() =>
                          void patchRegistration(
                            inspectRow.id,
                            {
                              scoreTeoriKata: parseScoreInput(draftTeoriKata),
                              scoreTeoriKumite:
                                parseScoreInput(draftTeoriKumite),
                              scorePraktik: parseScoreInput(draftPraktik),
                              status: "MENGULANG",
                              grantedLicense: null,
                              licenseValidUntil: null,
                            },
                            "Status diperbarui ke Belum Lulus / Mengulang.",
                          )
                        }
                      >
                        Belum Lulus
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              <DialogFooter className="flex flex-wrap items-center justify-between gap-2 sm:justify-between">
                <div>
                  {!isInspectingArchive &&
                  canDelete &&
                  (canManagePeriod || inspectRow.paymentState !== "LUNAS") ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={inspectSaving}
                      onClick={() => setDeleteConfirmRow(inspectRow)}
                      className="gap-1.5 text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus Pendaftaran
                    </Button>
                  ) : null}
                </div>
                <DialogClose asChild>
                  <Button type="button" size="sm" disabled={inspectSaving}>
                    Tutup
                  </Button>
                </DialogClose>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Bermerek INKAI: Arsip Periode */}
      <InkaiConfirmDialog
        open={Boolean(archiveConfirmPeriod)}
        onOpenChange={(open) => {
          if (!open) setArchiveConfirmPeriod(null);
        }}
        title="Arsipkan Periode Sertifikasi?"
        description="Periode yang diarsipkan akan terkunci dalam mode baca-saja di halaman Arsip Riwayat. Pengurus Cabang tetap dapat membukanya kembali bila diperlukan."
        confirmLabel="Ya, Arsipkan Selesai"
        loading={Boolean(
          archiveConfirmPeriod &&
            periodArchiveBusyId === archiveConfirmPeriod.id,
        )}
        onConfirm={() => {
          if (archiveConfirmPeriod) {
            void handleArchivePeriod(archiveConfirmPeriod.id);
          }
        }}
      >
        {archiveConfirmPeriod ? (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <p className="font-semibold text-foreground">
              {archiveConfirmPeriod.title}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Praktik: {formatDateId(archiveConfirmPeriod.practicalDate)} ·{" "}
              {archiveConfirmPeriod.location}
            </p>
          </div>
        ) : null}
      </InkaiConfirmDialog>

      {/* Dialog Konfirmasi Bermerek INKAI: Hapus Pendaftaran */}
      <InkaiConfirmDialog
        open={Boolean(deleteConfirmRow)}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmRow(null);
        }}
        variant="danger"
        title="Hapus Pendaftaran Peserta?"
        description={
          deleteConfirmRow?.paymentState === "LUNAS"
            ? "Peserta ini sudah berstatus LUNAS. Menghapus pendaftaran akan otomatis membalik jurnal pemasukan terkait di Buku Kas Cabang."
            : "Data pendaftaran peserta pada periode ini akan dihapus dari database."
        }
        confirmLabel="Ya, Hapus Pendaftaran"
        loading={inspectSaving}
        onConfirm={() => {
          if (deleteConfirmRow) {
            void handleDeleteRegistration(deleteConfirmRow);
          }
        }}
      >
        {deleteConfirmRow ? (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <p className="font-semibold text-foreground">
              {deleteConfirmRow.name}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Ranting {deleteConfirmRow.dojoName} ·{" "}
              {GRADE_LABELS[deleteConfirmRow.targetGrade]} (
              {formatRupiah(deleteConfirmRow.feeAmount)} —{" "}
              {paymentLabel(deleteConfirmRow.paymentState)})
            </p>
          </div>
        ) : null}
      </InkaiConfirmDialog>

      {/* Modal Edit Berkas Dasar Keanggotaan */}
      <Dialog
        open={Boolean(docsEditTarget)}
        onOpenChange={(open) => {
          if (!open) setDocsEditTarget(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Berkas Keanggotaan — {docsEditTarget?.fullName ?? "Anggota"}
            </DialogTitle>
            <DialogDescription>
              Perubahan Foto, Akte, dan BPJS langsung tersimpan ke profil
              Keanggotaan anggota ini di database.
            </DialogDescription>
          </DialogHeader>

          {docsEditTarget ? (
            <div className="space-y-4">
              <div className="space-y-2 border-b pb-4">
                <FileUploadField
                  label="Foto anggota"
                  value={docsEditTarget.docs.photoUrl ?? ""}
                  folder="members/photo"
                  hideUrl
                  accept="image/jpeg,image/png,image/webp"
                  hint="Otomatis dipotong & dikompres sesuai standar foto Keanggotaan"
                  onChange={(url) => {
                    if (!url.trim()) {
                      void handleSaveMemberPhoto(docsEditTarget.memberId, null);
                    }
                  }}
                  onUploaded={(url) =>
                    void handleSaveMemberPhoto(docsEditTarget.memberId, url)
                  }
                />
                {photoSaving ? (
                  <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Menyimpan foto ke profil Keanggotaan...
                  </p>
                ) : docsEditTarget.docs.photoUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 px-2 text-inkai-red"
                    onClick={() =>
                      setDocPreview({
                        title: `Foto — ${docsEditTarget.fullName}`,
                        url: docsEditTarget.docs.photoUrl!,
                      })
                    }
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Lihat foto
                  </Button>
                ) : null}
              </div>

              <MemberDocumentsEditor
                memberId={docsEditTarget.memberId}
                birthCertificateUrl={docsEditTarget.docs.birthCertificateUrl}
                bpjsCardUrl={docsEditTarget.docs.bpjsCardUrl}
                bpjsCardNumber={docsEditTarget.docs.bpjsCardNumber}
                onPreview={(title, url) => setDocPreview({ title, url })}
                onSaved={(next) => {
                  applySyncedMemberDocs(docsEditTarget.memberId, {
                    birthCertificateUrl: next.birthCertificateUrl,
                    bpjsCardUrl: next.bpjsCardUrl,
                    bpjsCardNumber: next.bpjsCardNumber,
                  });
                }}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <DocumentPreviewDialog
        open={Boolean(docPreview)}
        onOpenChange={(open) => {
          if (!open) setDocPreview(null);
        }}
        title={docPreview?.title ?? "Pratinjau Berkas"}
        url={docPreview?.url ?? null}
      />
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Copy, Check, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MemberAvatarRing } from "@/components/admin/ukt/MemberAvatarRing";
import { DocumentPreviewDialog } from "@/components/admin/DocumentPreviewDialog";
import { MemberDocumentsEditor } from "@/components/admin/MemberDocumentsEditor";
import {
  MergeMemberDialog,
  type MergeCandidate,
} from "@/components/admin/MergeMemberDialog";
import { showError, showSuccess } from "@/lib/client-toast";
import type { AdminMemberRow } from "@/lib/inkai-api/admin-data";
import {
  BELT_RANK_OPTIONS,
  canEditKyuBaru,
  formatGenderLabel,
  formatMemberName,
  formatRankLabel,
} from "@/lib/belt";
import { passwordPatternHint } from "@/lib/security/password";
import {
  reasonLabel,
  statusKindLabel,
  type MemberImpactSummary,
  type MemberLifecycleMeta,
} from "@/lib/member-lifecycle";
import { canManageIuranByWilayah, canToggleMemberActive } from "@/lib/wilayah-rbac";
import { MemberActions } from "./MemberActions";
import { BulkDeactivateBar } from "./BulkDeactivateBar";
import { usePersistedBulkSelection } from "./usePersistedBulkSelection";

type MemberDetail = Record<string, unknown>;

type BillingRow = {
  id?: string;
  type?: string;
  description?: string | null;
  amount?: number;
  status?: string;
  dueDate?: string;
};

function formatDate(value: unknown) {
  if (!value) return "-";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Contoh: 19 Juli 2026 14:10 */
function formatDateTime(value: unknown) {
  if (!value) return "-";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  const date = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} ${time}`;
}

function formatRp(amount: unknown) {
  const n = Number(amount);
  if (Number.isNaN(n)) return "-";
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function str(value: unknown, fallback = "-") {
  if (value == null || value === "") return fallback;
  return String(value);
}

function billingStatusLabel(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    PAID: {
      label: "Lunas",
      className:
        "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
    },
    PENDING: {
      label: "Belum bayar",
      className:
        "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
    },
    WAITING_VERIFICATION: {
      label: "Menunggu verifikasi",
      className:
        "border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950/30 dark:text-sky-200",
    },
  };
  return (
    map[status] || {
      label: status || "—",
      className: "",
    }
  );
}

function billingTypeLabel(type: string) {
  if (type === "MONTHLY_IURAN") return "Iuran bulanan";
  if (type === "EVENT" || type === "UKT") return "UKT / Event";
  return type || "Tagihan";
}

/** Password referensi yang sering dipakai: nama depan huruf kecil + 123 → jonathan123 */
function memberPasswordHint(fullName: string): string {
  const first =
    fullName
      .split(/\s+/)
      .find((p) => /[a-zA-Z]/.test(p))
      ?.replace(/[^a-zA-Z]/g, "") || "inkai";
  return `${first.toLowerCase()}123`;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}

function DocBadge({
  label,
  url,
  onOpen,
}: {
  label: string;
  url?: string | null;
  onOpen?: (label: string, url: string) => void;
}) {
  if (url && onOpen) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(label, url);
        }}
        className="inline-flex"
      >
        <Badge
          variant="outline"
          className="gap-1 text-xs text-inkai-red hover:bg-inkai-red/5 cursor-pointer"
        >
          {label}
          <Eye className="h-3 w-3" />
        </Badge>
      </button>
    );
  }

  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      {label}
    </Badge>
  );
}

function DocumentsCell({
  birthCertificateUrl,
  bpjsCardUrl,
  onOpen,
}: {
  birthCertificateUrl?: string | null;
  bpjsCardUrl?: string | null;
  onOpen: (label: string, url: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <DocBadge
        label="Akte"
        url={birthCertificateUrl}
        onOpen={onOpen}
      />
      <DocBadge label="BPJS" url={bpjsCardUrl} onOpen={onOpen} />
    </div>
  );
}

function MemberStatusBadge({ status }: { status: string }) {
  const key = status.trim();
  const map: Record<string, { label: string; className: string }> = {
    PENDING: {
      label: "Menunggu",
      className:
        "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
    },
    Active: {
      label: "Aktif",
      className:
        "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
    },
    ACTIVE: {
      label: "Aktif",
      className:
        "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
    },
    INACTIVE: {
      label: "Nonaktif",
      className:
        "border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
    },
    SUSPENDED: {
      label: "Ditangguhkan",
      className:
        "border-orange-300 bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-200",
    },
    REJECTED: {
      label: "Ditolak",
      className:
        "border-destructive/40 bg-destructive/10 text-destructive",
    },
  };
  const s = map[key] || { label: status, className: "" };
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  );
}

function memberPhotoUrl(member: AdminMemberRow) {
  if (member.photoUrl) return member.photoUrl;
  const nested = member as AdminMemberRow & {
    user?: { photoUrl?: string | null };
  };
  return nested.user?.photoUrl ?? null;
}

function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      showSuccess("Disalin");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showError("Gagal menyalin");
    }
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono">{value}</span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => void copy()}
        aria-label="Salin"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </span>
  );
}

export function MembersTable({
  members,
  userRoles = [],
  page = 1,
  pageSize = 25,
}: {
  members: AdminMemberRow[];
  userRoles?: string[];
  /** Halaman saat ini (1-based) — untuk nomor urut global. */
  page?: number;
  pageSize?: number;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [rankSavingId, setRankSavingId] = useState<string | null>(null);
  const [duesSaving, setDuesSaving] = useState(false);
  const [duesDraft, setDuesDraft] = useState("");
  const {
    selectedIds,
    pendingSelectedIds,
    toggleSelect,
    toggleSelectPage,
    clearSelection,
  } = usePersistedBulkSelection();
  const [dupCandidates, setDupCandidates] = useState<MergeCandidate[]>([]);
  const [mergeTarget, setMergeTarget] = useState<MergeCandidate | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [docPreview, setDocPreview] = useState<{
    title: string;
    url: string;
  } | null>(null);
  const canBulk = canToggleMemberActive(userRoles);
  const canEditRank = canEditKyuBaru(userRoles);
  const canEditDues = canManageIuranByWilayah(userRoles);

  const activeSelectable = members.filter((m) => {
    const s = m.status.trim().toUpperCase();
    return s === "ACTIVE" || s === "PENDING";
  });
  const allPageSelected =
    activeSelectable.length > 0 &&
    activeSelectable.every((m) => selectedIds.has(m.id));

  function onToggleSelect(id: string, status: string) {
    toggleSelect(id, status);
  }

  function onToggleSelectAll() {
    toggleSelectPage(
      activeSelectable.map((m) => ({ id: m.id, status: m.status })),
    );
  }

  async function openDetail(member: AdminMemberRow) {
    // Tampilkan data baris segera; lengkapi dari API tanpa blank skeleton penuh.
    setSelectedId(member.id);
    setDupCandidates([]);
    setMergeTarget(null);
    setDetail({
      id: member.id,
      fullName: member.fullName,
      nia: member.nia,
      currentRank: member.currentRank,
      status: member.status,
      dojo: member.dojo,
      birthCertificateUrl: member.birthCertificateUrl,
      bpjsCardUrl: member.bpjsCardUrl,
      photoUrl: member.photoUrl ?? null,
      _partial: true,
    });
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/members/${member.id}`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        member?: MemberDetail;
      };
      if (!res.ok) {
        showError(data.error || "Gagal memuat detail anggota");
        return;
      }
      if (data.member) {
        setDetail(data.member);
        const dues = data.member.monthlyDuesAmount;
        setDuesDraft(
          dues != null && Number.isFinite(Number(dues))
            ? String(Math.round(Number(dues)))
            : "50000",
        );
      }
    } catch {
      showError("Gagal memuat detail anggota");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedId) {
      setDupCandidates([]);
      return;
    }
    let cancelled = false;
    void fetch(`/api/admin/members/${selectedId}/duplicates`)
      .then((r) => r.json())
      .then((data: { candidates?: MergeCandidate[] }) => {
        if (!cancelled) setDupCandidates(data.candidates ?? []);
      })
      .catch(() => {
        if (!cancelled) setDupCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function handleSetRank(memberId: string, currentRank: string) {
    if (!currentRank.trim()) return;
    setRankSavingId(memberId);
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_rank", currentRank }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        currentRank?: string;
      };
      if (!res.ok) {
        showError(data.error || "Gagal memperbarui sabuk");
        return;
      }
      showSuccess(data.message || `Sabuk diperbarui: ${currentRank}`);
      if (selectedId === memberId && detail) {
        setDetail({ ...detail, currentRank: data.currentRank || currentRank });
      }
      router.refresh();
    } catch {
      showError("Gagal memperbarui sabuk");
    } finally {
      setRankSavingId(null);
    }
  }

  async function handleSetDues() {
    if (!selectedId || !canEditDues) return;
    const amount = Math.round(Number(duesDraft.replace(/\D/g, "")));
    if (!Number.isFinite(amount) || amount < 0) {
      showError("Nominal iuran tidak valid");
      return;
    }
    setDuesSaving(true);
    try {
      const res = await fetch(`/api/admin/members/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_dues", monthlyDuesAmount: amount }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        monthlyDuesAmount?: number;
      };
      if (!res.ok) {
        showError(data.error || "Gagal menyimpan iuran/bln");
        return;
      }
      const saved = data.monthlyDuesAmount ?? amount;
      setDetail((prev) =>
        prev ? { ...prev, monthlyDuesAmount: saved } : prev,
      );
      setDuesDraft(String(saved));
      showSuccess(data.message || "Iuran/bln disimpan");
      router.refresh();
    } catch {
      showError("Gagal menyimpan iuran/bln");
    } finally {
      setDuesSaving(false);
    }
  }

  const dojo = detail?.dojo as
    | { name?: string; branch?: { name?: string } }
    | undefined;
  const user = detail?.user as
    | { email?: string; phoneNumber?: string; photoUrl?: string }
    | undefined;
  const ranks =
    (detail?.ranks as Array<{ rank?: string; date?: string }> | undefined) ??
    [];
  const eventRegistrations =
    (detail?.eventRegistrations as
      | Array<{ status?: string; event?: { title?: string } }>
      | undefined) ?? [];
  const billings = (detail?.billings as BillingRow[] | undefined) ?? [];

  const fullName = str(detail?.fullName, "");
  const currentRank = str(detail?.currentRank, "");
  const photoUrl =
    user?.photoUrl ??
    (typeof detail?.photoUrl === "string" ? detail.photoUrl : null);
  const birthCertificateUrl =
    typeof detail?.birthCertificateUrl === "string"
      ? detail.birthCertificateUrl
      : null;
  const bpjsCardUrl =
    typeof detail?.bpjsCardUrl === "string" ? detail.bpjsCardUrl : null;
  const bpjsCardNumber =
    typeof detail?.bpjsCardNumber === "string" ? detail.bpjsCardNumber : null;

  const passwordHint = fullName
    ? memberPasswordHint(fullName)
    : typeof detail?.suggestedPassword === "string"
      ? detail.suggestedPassword
      : "";
  const passwordAdminStyle = fullName ? passwordPatternHint(fullName) : "";

  const unpaid = billings.filter((b) => b.status && b.status !== "PAID");
  const paidCount = billings.filter((b) => b.status === "PAID").length;
  const lifecycle = detail?.lifecycle as MemberLifecycleMeta | null | undefined;
  const impact = detail?.impact as MemberImpactSummary | null | undefined;
  const colCount = canBulk ? 11 : 10;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              {canBulk ? (
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-inkai-red"
                    checked={allPageSelected}
                    onChange={onToggleSelectAll}
                    aria-label="Pilih semua di halaman ini"
                  />
                </TableHead>
              ) : null}
              <TableHead className="w-12 text-center">No</TableHead>
              <TableHead className="w-12">Foto</TableHead>
              <TableHead>NIA</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Sabuk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Dokumen</TableHead>
              <TableHead className="hidden sm:table-cell">Dojo</TableHead>
              <TableHead className="whitespace-nowrap">Terdaftar</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="h-24 text-center text-muted-foreground"
                >
                  Tidak ada anggota ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m, index) => {
                const statusKey = m.status.trim().toUpperCase();
                const isSelectableRow =
                  statusKey === "ACTIVE" || statusKey === "PENDING";
                const rowNo = (page - 1) * pageSize + index + 1;
                return (
                  <TableRow
                    key={m.id}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={() => openDetail(m)}
                  >
                    {canBulk ? (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {isSelectableRow ? (
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-inkai-red"
                            checked={selectedIds.has(m.id)}
                            onChange={() => onToggleSelect(m.id, m.status)}
                            aria-label={`Pilih ${m.fullName}`}
                          />
                        ) : null}
                      </TableCell>
                    ) : null}
                    <TableCell className="text-center tabular-nums text-muted-foreground text-sm">
                      {rowNo}
                    </TableCell>
                    <TableCell>
                      <MemberAvatarRing
                        fullName={m.fullName}
                        currentRank={m.currentRank}
                        photoUrl={memberPhotoUrl(m)}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {m.nia ? (
                        m.nia
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs text-amber-700 border-amber-300 bg-amber-50"
                        >
                          Belum ada NIA
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-inkai-red">
                      {formatMemberName(m.fullName)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canEditRank ? (
                        <select
                          className="h-8 max-w-40 rounded border bg-background px-1 text-xs"
                          value={formatRankLabel(m.currentRank) || ""}
                          disabled={rankSavingId === m.id}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (!next || next === formatRankLabel(m.currentRank)) return;
                            void handleSetRank(m.id, next);
                          }}
                          aria-label={`Ubah sabuk ${m.fullName}`}
                        >
                          {!formatRankLabel(m.currentRank) ? (
                            <option value="">— Pilih —</option>
                          ) : null}
                          {BELT_RANK_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                          {m.currentRank &&
                          formatRankLabel(m.currentRank) &&
                          !(BELT_RANK_OPTIONS as readonly string[]).includes(
                            formatRankLabel(m.currentRank),
                          ) ? (
                            <option value={formatRankLabel(m.currentRank)}>
                              {formatRankLabel(m.currentRank)}
                            </option>
                          ) : null}
                        </select>
                      ) : (
                        <Badge variant="secondary">
                          {formatRankLabel(m.currentRank) || "—"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <MemberStatusBadge status={m.status} />
                    </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <DocumentsCell
                          birthCertificateUrl={m.birthCertificateUrl}
                          bpjsCardUrl={m.bpjsCardUrl}
                          onOpen={(label, url) =>
                            setDocPreview({ title: label, url })
                          }
                        />
                      </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {m.dojo?.name ?? "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(m.createdAt)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <MemberActions
                        memberId={m.id}
                        status={m.status}
                        nia={m.nia}
                        fullName={m.fullName}
                        userRoles={userRoles}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {canBulk ? (
        <BulkDeactivateBar
          selectedIds={[...selectedIds]}
          pendingIds={pendingSelectedIds}
          onClear={clearSelection}
        />
      ) : null}

      <Sheet
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setDetail(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto sm:max-w-md"
        >
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-3 pr-8">
              <MemberAvatarRing
                fullName={fullName || "Anggota"}
                currentRank={currentRank || null}
                photoUrl={photoUrl}
                size="lg"
              />
              <span className="leading-tight">
                {formatMemberName(fullName) || "Detail Anggota"}
              </span>
            </SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-2">
              <span>
                NIA:{" "}
                {detail?.nia ? (
                  str(detail.nia)
                ) : (
                  <Badge
                    variant="outline"
                    className="text-xs text-amber-700 border-amber-300 bg-amber-50"
                  >
                    Belum ada NIA
                  </Badge>
                )}
              </span>
              {detail?.status ? (
                <MemberStatusBadge status={String(detail.status)} />
              ) : null}
              {loading ? (
                <span className="text-xs text-muted-foreground">Memuat detail…</span>
              ) : null}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 p-4">
            {detail ? (
              <>
                {dupCandidates.length > 0 ? (
                  <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
                    <p className="font-medium text-amber-950 dark:text-amber-100">
                      Duplikat terdeteksi — ranting dapat menggabungkan data
                    </p>
                    <ul className="mt-2 space-y-2">
                      {dupCandidates.map((c) => (
                        <li
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <span>
                            {c.fullName}
                            {c.nia ? ` · ${c.nia}` : ""}
                            {` · ${c.status}`}
                            {c.hasAccount
                              ? ` · akun ${c.email || "ada"}`
                              : " · tanpa akun"}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7"
                            disabled={!c.mergeEligible}
                            title={c.mergeBlockReason || undefined}
                            onClick={() => {
                              setMergeTarget(c);
                              setMergeOpen(true);
                            }}
                          >
                            Gabungkan
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Identitas
                  </h3>
                  <dl className="space-y-2">
                    <DetailRow
                      label="Sabuk"
                      value={
                        canEditRank ? (
                          <select
                            className="h-8 max-w-44 rounded border bg-background px-1 text-xs"
                            value={formatRankLabel(currentRank) || ""}
                            disabled={rankSavingId === selectedId || loading}
                            onChange={(e) => {
                              const next = e.target.value;
                              if (
                                !next ||
                                !selectedId ||
                                next === formatRankLabel(currentRank)
                              ) {
                                return;
                              }
                              void handleSetRank(selectedId, next);
                            }}
                            aria-label="Ubah sabuk"
                          >
                            {!formatRankLabel(currentRank) ? (
                              <option value="">— Pilih —</option>
                            ) : null}
                            {BELT_RANK_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                            {currentRank &&
                            formatRankLabel(currentRank) &&
                            !(BELT_RANK_OPTIONS as readonly string[]).includes(
                              formatRankLabel(currentRank),
                            ) ? (
                              <option value={formatRankLabel(currentRank)}>
                                {formatRankLabel(currentRank)}
                              </option>
                            ) : null}
                          </select>
                        ) : (
                          <Badge variant="secondary">
                            {formatRankLabel(currentRank) || "-"}
                          </Badge>
                        )
                      }
                    />
                    <DetailRow label="NIK" value={loading && !detail.nik ? "…" : str(detail.nik)} />
                    <DetailRow
                      label="Tempat lahir"
                      value={loading && !detail.birthPlace ? "…" : str(detail.birthPlace)}
                    />
                    <DetailRow
                      label="Tanggal lahir"
                      value={loading && !detail.birthDate ? "…" : formatDate(detail.birthDate)}
                    />
                    <DetailRow
                      label="Jenis kelamin"
                      value={
                        loading && !detail.gender
                          ? "…"
                          : formatGenderLabel(str(detail.gender, "")) || "-"
                      }
                    />
                    <DetailRow
                      label="Alamat"
                      value={loading && !detail.address ? "…" : str(detail.address)}
                    />
                    <DetailRow
                      label="Terdaftar"
                      value={loading && !detail.createdAt ? "…" : formatDate(detail.createdAt)}
                    />
                  </dl>
                </section>

                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Organisasi
                  </h3>
                  <dl className="space-y-2">
                    <DetailRow label="Dojo" value={str(dojo?.name)} />
                    <DetailRow label="Cabang" value={str(dojo?.branch?.name)} />
                    <DetailRow label="Email" value={str(user?.email)} />
                    <DetailRow
                      label="Telepon"
                      value={str(user?.phoneNumber ?? detail.phoneNumber)}
                    />
                    <DetailRow
                      label="Iuran/bln"
                      value={
                        canEditDues ? (
                          <span className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Rp</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="h-8 w-28 rounded border bg-background px-2 text-sm tabular-nums"
                              value={duesDraft}
                              disabled={duesSaving || loading}
                              onChange={(e) =>
                                setDuesDraft(e.target.value.replace(/\D/g, ""))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void handleSetDues();
                                }
                              }}
                              aria-label="Nominal iuran bulanan"
                            />
                            <Button
                              size="sm"
                              className="h-8 bg-inkai-red px-2 text-xs"
                              disabled={duesSaving || loading}
                              onClick={() => void handleSetDues()}
                            >
                              {duesSaving ? "…" : "Simpan"}
                            </Button>
                          </span>
                        ) : detail.monthlyDuesAmount != null ? (
                          formatRp(detail.monthlyDuesAmount)
                        ) : (
                          "-"
                        )
                      }
                    />
                  </dl>
                </section>

                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Akun login
                  </h3>
                  <dl className="space-y-2">
                    <DetailRow
                      label="Username"
                      value={
                        user?.email ? (
                          <CopyableValue value={String(user.email)} />
                        ) : (
                          "-"
                        )
                      }
                    />
                    <DetailRow
                      label="Password"
                      value={
                        passwordHint ? (
                          <CopyableValue value={passwordHint} />
                        ) : (
                          "-"
                        )
                      }
                    />
                  </dl>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Password referensi (nama depan + 123). Bila anggota sudah
                    mengubah password, gunakan reset password ranting.
                    {passwordAdminStyle &&
                    passwordAdminStyle !== passwordHint
                      ? ` Pola admin: ${passwordAdminStyle}.`
                      : null}
                  </p>
                </section>

                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Iuran
                  </h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      Total tagihan: {billings.length}
                    </Badge>
                    <Badge variant="outline" className="text-emerald-700">
                      Lunas: {paidCount}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        unpaid.length > 0
                          ? "border-amber-300 text-amber-800"
                          : ""
                      }
                    >
                      Belum lunas: {unpaid.length}
                    </Badge>
                  </div>
                  {billings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Belum ada data iuran.
                    </p>
                  ) : (
                    <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-2">
                      {billings.slice(0, 12).map((b, i) => {
                        const st = billingStatusLabel(String(b.status || ""));
                        return (
                          <li
                            key={String(b.id || i)}
                            className="flex items-start justify-between gap-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="font-medium">
                                {billingTypeLabel(String(b.type || ""))}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {str(b.description, "Iuran anggota")} · JT{" "}
                                {formatDate(b.dueDate)}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-semibold">
                                {formatRp(b.amount)}
                              </p>
                              <Badge
                                variant="outline"
                                className={`mt-0.5 text-[10px] ${st.className}`}
                              >
                                {st.label}
                              </Badge>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Dokumen
                  </h3>
                  <MemberDocumentsEditor
                    memberId={String(detail.id)}
                    birthCertificateUrl={birthCertificateUrl}
                    bpjsCardUrl={bpjsCardUrl}
                    bpjsCardNumber={bpjsCardNumber}
                    onPreview={(title, url) =>
                      setDocPreview({ title, url })
                    }
                    onSaved={(next) => {
                      setDetail((prev) =>
                        prev
                          ? {
                              ...prev,
                              birthCertificateUrl: next.birthCertificateUrl,
                              bpjsCardUrl: next.bpjsCardUrl,
                              bpjsCardNumber: next.bpjsCardNumber,
                            }
                          : prev,
                      );
                      router.refresh();
                    }}
                  />
                </section>

                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Riwayat sabuk
                  </h3>
                  {ranks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Belum ada riwayat. Kyu saat ini:{" "}
                      <span className="font-medium text-foreground">
                        {formatRankLabel(currentRank) || "—"}
                      </span>
                    </p>
                  ) : (
                    <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-2 text-sm">
                      {ranks.map((r, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span>
                            {formatRankLabel(str(r.rank, "")) || str(r.rank)}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDate(r.date)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {eventRegistrations.length > 0 ? (
                  <section className="space-y-2.5">
                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Riwayat event
                    </h3>
                    <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-2 text-sm">
                      {eventRegistrations.map((er, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span>{str(er.event?.title)}</span>
                          <span className="text-muted-foreground">
                            {str(er.status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {lifecycle ? (
                  <section className="space-y-2.5">
                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Riwayat status
                    </h3>
                    <dl className="space-y-2 rounded-lg border p-3">
                      <DetailRow
                        label="Jenis"
                        value={statusKindLabel(lifecycle.statusKind)}
                      />
                      <DetailRow
                        label="Alasan"
                        value={reasonLabel(lifecycle.reasonCode)}
                      />
                      {lifecycle.reasonNote ? (
                        <DetailRow label="Catatan" value={lifecycle.reasonNote} />
                      ) : null}
                      <DetailRow
                        label="Sejak"
                        value={formatDate(lifecycle.changedAt)}
                      />
                      <DetailRow
                        label="Oleh"
                        value={
                          lifecycle.changedByName ||
                          lifecycle.changedByEmail ||
                          "—"
                        }
                      />
                    </dl>
                  </section>
                ) : null}

                <section className="border-t pt-4">
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {detail.status === "PENDING" || detail.status === "REJECTED"
                      ? "Aksi registrasi"
                      : detail.status === "Active" && !detail.nia
                        ? "NIA & status"
                        : "Kelola status"}
                  </h3>
                  <MemberActions
                    memberId={String(detail.id)}
                    status={String(detail.status)}
                    nia={typeof detail.nia === "string" ? detail.nia : null}
                    fullName={fullName}
                    userRoles={userRoles}
                    compact
                    impact={impact ?? null}
                    isArchived={detail.isDeleted === true}
                    onSuccess={() => {
                      const row = members.find(
                        (m) => m.id === String(detail.id),
                      );
                      if (row) void openDetail(row);
                      else {
                        setSelectedId(null);
                        setDetail(null);
                      }
                    }}
                  />
                </section>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Detail anggota tidak tersedia.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <MergeMemberDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        currentMemberId={selectedId || ""}
        currentLabel={detail ? formatMemberName(String(detail.fullName || "")) : ""}
        currentHasAccount={Boolean(
          (detail?.user as { email?: string } | undefined)?.email ||
            (detail as { userId?: string } | null)?.userId,
        )}
        currentEmail={
          ((detail?.user as { email?: string } | undefined)?.email as
            | string
            | undefined) ?? null
        }
        candidate={mergeTarget}
        onMerged={(keepId) => {
          setDupCandidates([]);
          const row = members.find((m) => m.id === keepId);
          if (row) void openDetail(row);
          else {
            setSelectedId(null);
            setDetail(null);
          }
        }}
      />

      <DocumentPreviewDialog
        open={Boolean(docPreview)}
        onOpenChange={(next) => {
          if (!next) setDocPreview(null);
        }}
        title={docPreview?.title || "Dokumen"}
        url={docPreview?.url ?? null}
      />
    </>
  );
}

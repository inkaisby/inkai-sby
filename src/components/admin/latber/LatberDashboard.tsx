"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Calendar,
  Clock,
  Copy,
  Download,
  FileSpreadsheet,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canEditKyuBaru } from "@/lib/belt";
import { canRegisterMembersToEvents } from "@/lib/wilayah-rbac";
import { buildLatberInviteUrl } from "@/lib/latber-invite";
import {
  buildLatberCabangWaReportText,
  buildLatberNotaTotals,
  buildLatberRekapFilename,
  buildLatberRekapRows,
  buildLatberRantingWaReportText,
  DEFAULT_LATBER_FEE,
  DEFAULT_LATBER_KOMISI_RANTING,
  filterLatberApprovedRows,
  formatLatberCurrency,
  formatLatberPeriodLabel,
  formatLatberRank,
  isLatberPaidStatus,
  latberDisplayStatusLabel,
  latberStatusBadgeClass,
  resolveLatberDisplayStatus,
  resolveLatberWaDojoLabel,
  type LatberMemberRow,
  type LatberPeriodMeta,
  type LatberPeriodOption,
} from "@/lib/latber";
import {
  downloadLatberRekapPdf,
  printLatberRekapDocument,
} from "@/lib/latber-rekap-html";
import { countLatberKpis } from "@/lib/latber-data";
import { formatRegisteredAtWib } from "@/lib/format-wib";
import { combineDateAndTimeLocal, toDateInput, toTimeInput } from "@/lib/ukt";
import { Time24Fields } from "@/components/admin/Time24Fields";
import { parseApiJson } from "@/lib/api-client";
import { showError, showSuccess } from "@/lib/client-toast";
import { LatberPrintModal } from "@/components/admin/latber/LatberPrintModal";
import { LatberSearchBar } from "@/components/admin/latber/LatberSearchBar";
import { LatberPromoteMembershipDialog } from "@/components/admin/latber/LatberPromoteMembershipDialog";
import { LatberAddGuestDialog } from "@/components/latber/LatberAddGuestDialog";
import { InkaiConfirmDialog } from "@/components/ui/InkaiConfirmDialog";

type LatberDashboardProps = {
  periods: LatberPeriodOption[];
  selectedPeriodId: string | null;
  selectedPeriod: LatberPeriodOption | null;
  periodMeta: LatberPeriodMeta;
  feeAmount: number;
  komisiRanting: number;
  rows: LatberMemberRow[];
  dojos: Array<{ id: string; name: string }>;
  userRoles: string[];
  primaryRole: string;
  canCreatePeriod: boolean;
  isArchiveView?: boolean;
  dbError?: boolean;
  orgProfile?: {
    address?: string;
    bendaharaCabangName?: string;
  };
};

const FETCH_TIMEOUT_MS = 28_000;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Permintaan timeout — coba lagi");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function StatusBadge({ row }: { row: LatberMemberRow }) {
  const status = resolveLatberDisplayStatus(row);
  const label = latberDisplayStatusLabel(status);
  return <Badge className={latberStatusBadgeClass(status)}>{label}</Badge>;
}

function LatberRekapMenu({
  loading,
  onExcel,
  onPdf,
  onPrint,
}: {
  loading: boolean;
  onExcel: () => void;
  onPdf: () => void;
  onPrint: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={loading}>
          <FileSpreadsheet className="mr-1 h-4 w-4" />
          {loading ? "Menyusun…" : "Rekap"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={onExcel} disabled={loading}>
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPdf} disabled={loading}>
          <Download className="h-4 w-4" />
          Unduh PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint} disabled={loading}>
          <Printer className="h-4 w-4" />
          Print
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LatberDashboard(props: LatberDashboardProps) {
  const router = useRouter();
  const [rows, setRows] = useState(props.rows);
  const [localDojo, setLocalDojo] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setRows(props.rows);
  }, [props.rows]);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [promoteRow, setPromoteRow] = useState<LatberMemberRow | null>(null);
  const [confirmCash, setConfirmCash] = useState<LatberMemberRow | null>(null);
  const [confirmLunas, setConfirmLunas] = useState<LatberMemberRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    registrationId: string;
    force: boolean;
  } | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [rekapDownloading, setRekapDownloading] = useState(false);
  const [showCabangWaPicker, setShowCabangWaPicker] = useState(false);
  const [cabangWaSelectedDojoId, setCabangWaSelectedDojoId] = useState<
    string | null
  >(null);
  const emptyPeriodForm = {
    title: "",
    openDate: "",
    openTime: "00:00",
    closeDate: "",
    closeTime: "23:59",
    eventDate: "",
    eventTime: "08:00",
    eventLocation: "",
    feeAmount: 45000,
    komisiRanting: 5000,
  };
  const [createForm, setCreateForm] = useState(emptyPeriodForm);
  const [editForm, setEditForm] = useState(emptyPeriodForm);

  const isCabang = canEditKyuBaru(props.userRoles);
  const isDojoAdmin = props.primaryRole === "ADMIN_DOJO";
  const periodLocked = Boolean(props.periodMeta?.archived || props.periodMeta?.locked);
  const isMultiDojoAdmin = !isDojoAdmin && props.dojos.length > 1;
  const canQuickRegister = canRegisterMembersToEvents(props.userRoles);

  const displayRows = useMemo(() => {
    let list = rows;
    if (localDojo) list = list.filter((r) => r.dojoId === localDojo);
    const q = searchQ.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.fullName.toLowerCase().includes(q) ||
          String(r.nia ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, localDojo, searchQ]);

  const kpis = useMemo(() => countLatberKpis(rows), [rows]);
  const notaTotals = useMemo(
    () => buildLatberNotaTotals(rows, props.feeAmount, props.komisiRanting),
    [rows, props.feeAmount, props.komisiRanting],
  );
  const approvedForRecap = useMemo(() => {
    let list = rows;
    if (localDojo) list = list.filter((r) => r.dojoId === localDojo);
    return filterLatberApprovedRows(list);
  }, [rows, localDojo]);
  const cabangWaDojoOptions = useMemo(() => {
    const map = new Map<string, { dojoId: string; dojoName: string; count: number }>();
    for (const row of filterLatberApprovedRows(rows)) {
      const key = row.dojoId || row.dojoName || "unknown";
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, {
          dojoId: row.dojoId || key,
          dojoName: row.dojoName?.trim() || "Ranting",
          count: 1,
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      a.dojoName.localeCompare(b.dojoName, "id"),
    );
  }, [rows]);

  const refresh = useCallback(() => router.refresh(), [router]);

  async function runAction(
    registrationId: string,
    body: Record<string, unknown>,
    successMsg: string,
  ) {
    setPendingId(registrationId);
    try {
      const res = await fetch(`/api/admin/latber/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseApiJson<{
        error?: string;
        billingStatus?: string;
        status?: string;
        alreadyPaid?: boolean;
        paymentMethod?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal memproses");

      const action = String(body.action ?? "");
      setRows((prev) =>
        prev.map((row) => {
          if (row.registrationId !== registrationId) return row;
          const next = { ...row };
          if (typeof data.billingStatus === "string") {
            next.billingStatus = data.billingStatus;
          } else if (
            action === "mark_paid" ||
            action === "mark_cash" ||
            action === "mark_lunas"
          ) {
            next.billingStatus = "PAID";
          } else if (action === "submit_for_verification") {
            next.billingStatus = "WAITING_VERIFICATION";
          } else if (action === "accept_self_registration") {
            next.status = "APPROVED";
            next.selfRegistration = false;
            next.memberPaymentConfirmedAt = null;
            if (!next.billingStatus || next.billingStatus === "NONE") {
              next.billingStatus = "PENDING";
            }
          } else if (action === "reject_self_registration") {
            next.status = "REJECTED";
            next.selfRegistration = false;
            next.memberPaymentConfirmedAt = null;
          }
          if (action === "mark_cash") {
            next.paymentMethod = data.paymentMethod || "CASH";
          }
          if (action === "mark_lunas") {
            next.paymentMethod = data.paymentMethod || "TRANSFER";
          }
          if (typeof data.status === "string") {
            next.status = data.status;
          }
          return next;
        }),
      );

      showSuccess(
        data.alreadyPaid ? "Pembayaran sudah diverifikasi sebelumnya" : successMsg,
      );
      refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal memproses");
    } finally {
      setPendingId(null);
    }
  }

  async function handleRegister(memberId: string) {
    if (!props.selectedPeriodId) return;
    if (pendingId != null) return;
    setPendingId(memberId);
    try {
      const res = await fetchWithTimeout("/api/admin/latber/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: props.selectedPeriodId,
          memberId,
        }),
      });
      const data = await parseApiJson<{
        error?: string;
        registrationId?: string;
        billingStatus?: string;
        billingAmount?: number;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal mendaftar");
      setRows((prev) =>
        prev.map((r) => {
          if (r.memberId !== memberId) return r;
          return {
            ...r,
            registrationId: data.registrationId ?? r.registrationId,
            status: "APPROVED",
            billingStatus: data.billingStatus ?? "PENDING",
            billingAmount: data.billingAmount ?? props.feeAmount,
            registeredAt: new Date().toISOString(),
          };
        }),
      );
      showSuccess("Anggota didaftarkan — status Belum Bayar");
      refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal mendaftar");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(registrationId: string, force = false) {
    setConfirmDelete({ registrationId, force });
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    const { registrationId, force } = confirmDelete;
    setPendingId(registrationId);
    try {
      const qs = force ? "?force=1" : "";
      const res = await fetch(
        `/api/admin/latber/registrations/${registrationId}${qs}`,
        { method: "DELETE" },
      );
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal membatalkan");
      setRows((prev) => prev.filter((r) => r.registrationId !== registrationId));
      showSuccess("Pendaftaran dibatalkan");
      setConfirmDelete(null);
      refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal membatalkan");
    } finally {
      setPendingId(null);
    }
  }

  async function handlePeriodArchive(archived: boolean) {
    if (!props.selectedPeriodId) return;
    setArchiveLoading(true);
    try {
      const res = await fetch("/api/admin/latber/period", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: props.selectedPeriodId,
          archived,
          locked: archived,
        }),
      });
      const data = await parseApiJson<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui periode");
      showSuccess(data.message || (archived ? "Periode diarsipkan" : "Periode dibuka kembali"));
      setConfirmArchive(false);
      if (archived) {
        router.push(`/admin/latber/arsip?period=${props.selectedPeriodId}`);
      } else {
        router.push(`/admin/latber?period=${props.selectedPeriodId}`);
      }
      refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal memperbarui periode");
    } finally {
      setArchiveLoading(false);
    }
  }

  const hydrateRemoteMember = useCallback(
    (member: {
      id: string;
      fullName: string;
      nia: string | null;
      dojoName?: string;
      currentRank?: string;
    }) => {
      if (!props.selectedPeriodId || periodLocked) return;
      if (rows.some((r) => r.memberId === member.id)) return;
      void (async () => {
        setPendingId(member.id);
        try {
          const params = new URLSearchParams({
            memberId: member.id,
            periodId: props.selectedPeriodId!,
          });
          const res = await fetchWithTimeout(`/api/admin/latber/members?${params}`);
          const data = await parseApiJson<{
            error?: string;
            latberRow?: LatberMemberRow & {
              hydrateOk?: boolean;
              hydrateError?: string | null;
            };
          }>(res);
          if (!res.ok || !data.latberRow) {
            throw new Error(data.error || "Gagal memuat anggota");
          }
          if (data.latberRow.hydrateOk === false) {
            throw new Error(data.latberRow.hydrateError || "Anggota tidak memenuhi syarat");
          }
          setRows((prev) => {
            if (prev.some((r) => r.memberId === data.latberRow!.memberId)) {
              return prev;
            }
            return [...prev, data.latberRow!];
          });
          showSuccess("Anggota siap didaftarkan Latihan Bersama");
        } catch (e) {
          showError(e instanceof Error ? e.message : "Gagal memuat anggota");
        } finally {
          setPendingId(null);
        }
      })();
    },
    [props.selectedPeriodId, periodLocked, rows],
  );

  /** Quick-reg dari dropdown: hydrate (hormati hydrateOk) lalu daftar. */
  const handleQuickRegisterFromSearch = useCallback(
    async (member: {
      id: string;
      fullName: string;
      nia: string | null;
      dojoName?: string;
      currentRank?: string;
    }) => {
      if (!props.selectedPeriodId || periodLocked) {
        showError("Periode dikunci atau belum dipilih");
        throw new Error("Periode tidak tersedia");
      }
      if (pendingId != null) {
        throw new Error("Sedang memproses");
      }

      setPendingId(member.id);
      try {
        let row = rows.find((r) => r.memberId === member.id);
        if (!row || row.status === "BELUM_DAFTAR") {
          const params = new URLSearchParams({
            memberId: member.id,
            periodId: props.selectedPeriodId,
          });
          const res = await fetchWithTimeout(`/api/admin/latber/members?${params}`);
          const data = await parseApiJson<{
            error?: string;
            latberRow?: LatberMemberRow & {
              hydrateOk?: boolean;
              hydrateError?: string | null;
            };
          }>(res);
          if (!res.ok || !data.latberRow) {
            throw new Error(data.error || "Gagal memuat anggota");
          }
          if (data.latberRow.hydrateOk === false) {
            throw new Error(
              data.latberRow.hydrateError || "Anggota tidak memenuhi syarat",
            );
          }
          row = data.latberRow;
          setRows((prev) => {
            if (prev.some((r) => r.memberId === row!.memberId)) return prev;
            return [...prev, row!];
          });
        }

        const regRes = await fetchWithTimeout("/api/admin/latber/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: props.selectedPeriodId,
            memberId: member.id,
          }),
        });
        const regData = await parseApiJson<{
          error?: string;
          registrationId?: string;
          billingStatus?: string;
          billingAmount?: number;
        }>(regRes);
        if (!regRes.ok) throw new Error(regData.error || "Gagal mendaftar");
        setRows((prev) =>
          prev.map((r) => {
            if (r.memberId !== member.id) return r;
            return {
              ...r,
              registrationId: regData.registrationId ?? r.registrationId,
              status: "APPROVED",
              billingStatus: regData.billingStatus ?? "PENDING",
              billingAmount: regData.billingAmount ?? props.feeAmount,
              registeredAt: new Date().toISOString(),
            };
          }),
        );
        showSuccess("Anggota didaftarkan — status Belum Bayar");
        refresh();
      } catch (e) {
        showError(e instanceof Error ? e.message : "Gagal mendaftar");
        throw e instanceof Error ? e : new Error("Gagal mendaftar");
      } finally {
        setPendingId(null);
      }
    },
    [
      props.selectedPeriodId,
      props.feeAmount,
      periodLocked,
      pendingId,
      rows,
      refresh,
    ],
  );

  async function handleCreatePeriod() {
    try {
      const toIso = (date: string, time: string, label: string) => {
        if (!date || !time) return undefined;
        const d = combineDateAndTimeLocal(date, time);
        if (Number.isNaN(d.getTime())) {
          throw new Error(`${label} tidak valid`);
        }
        return d.toISOString();
      };

      const registrationOpenAt = toIso(
        createForm.openDate,
        createForm.openTime,
        "Tanggal buka pendaftaran",
      );
      const registrationCloseAt = toIso(
        createForm.closeDate,
        createForm.closeTime,
        "Batas pendaftaran",
      );
      const eventAt = toIso(
        createForm.eventDate,
        createForm.eventTime,
        "Waktu latihan",
      );

      const res = await fetch("/api/admin/latber/period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.title || "Latihan Bersama",
          registrationOpenAt,
          registrationCloseAt,
          eventAt,
          eventLocation: createForm.eventLocation || undefined,
        }),
      });
      const data = await parseApiJson<{
        error?: string;
        event?: { id?: string };
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal membuat periode");
      showSuccess("Periode Latihan Bersama dibuat");
      setCreateOpen(false);
      const periodId = data.event?.id;
      if (periodId) {
        router.push(`/admin/latber?period=${periodId}`);
      } else {
        refresh();
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal membuat periode");
    }
  }

  function openEditPeriod() {
    if (!props.selectedPeriod) return;
    const closeIso =
      props.selectedPeriod.registrationCloseAt ||
      props.selectedPeriod.endDate ||
      props.selectedPeriod.startDate ||
      "";
    const openIso =
      props.periodMeta.registrationOpenAt ||
      props.selectedPeriod.startDate ||
      "";
    const eventIso = props.periodMeta.eventAt || "";
    setEditForm({
      title: formatLatberPeriodLabel(props.selectedPeriod.title),
      openDate: openIso ? toDateInput(openIso) : "",
      openTime: openIso ? toTimeInput(openIso) : "00:00",
      closeDate: closeIso ? toDateInput(closeIso) : "",
      closeTime: closeIso ? toTimeInput(closeIso) : "23:59",
      eventDate: eventIso ? toDateInput(eventIso) : "",
      eventTime: eventIso ? toTimeInput(eventIso) : "08:00",
      eventLocation: props.periodMeta.eventLocation ?? "",
      feeAmount: props.feeAmount ?? 45000,
      komisiRanting: props.komisiRanting ?? 5000,
    });
    setEditOpen(true);
  }

  async function handleEditPeriod() {
    if (!props.selectedPeriodId) return;
    setEditSaving(true);
    try {
      const toIso = (date: string, time: string, label: string) => {
        if (!date || !time) return undefined;
        const d = combineDateAndTimeLocal(date, time);
        if (Number.isNaN(d.getTime())) {
          throw new Error(`${label} tidak valid`);
        }
        return d.toISOString();
      };

      const registrationOpenAt = toIso(
        editForm.openDate,
        editForm.openTime,
        "Tanggal buka pendaftaran",
      );
      const registrationCloseAt = toIso(
        editForm.closeDate,
        editForm.closeTime,
        "Batas pendaftaran",
      );
      const eventAt = toIso(
        editForm.eventDate,
        editForm.eventTime,
        "Waktu latihan",
      );

      const res = await fetch("/api/admin/latber/period", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: props.selectedPeriodId,
          title: editForm.title || undefined,
          registrationOpenAt: registrationOpenAt ?? null,
          registrationCloseAt,
          eventAt: eventAt ?? null,
          eventLocation: editForm.eventLocation.trim() || null,
          feeAmount: editForm.feeAmount,
          komisiRanting: editForm.komisiRanting,
        }),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal mengubah periode");
      showSuccess("Periode Latihan Bersama diperbarui");
      setEditOpen(false);
      refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal mengubah periode");
    } finally {
      setEditSaving(false);
    }
  }

  function copyInvite() {
    if (!props.selectedPeriodId) return;
    const url = buildLatberInviteUrl(props.selectedPeriodId, {
      archivedOrLocked: periodLocked || Boolean(props.isArchiveView),
    });
    void navigator.clipboard.writeText(url);
    showSuccess("Link undangan disalin");
  }

  function waInvite() {
    if (!props.selectedPeriodId) return;
    const url = buildLatberInviteUrl(props.selectedPeriodId, {
      archivedOrLocked: periodLocked || Boolean(props.isArchiveView),
    });
    const title = formatLatberPeriodLabel(
      props.selectedPeriod?.title ?? "Latihan Bersama",
    );
    const eventAt = props.periodMeta.eventAt
      ? new Date(props.periodMeta.eventAt).toLocaleString("id-ID", {
          dateStyle: "long",
          timeStyle: "short",
        })
      : null;
    const location = props.periodMeta.eventLocation?.trim() || null;
    const lines = [
      `Undangan Latihan Bersama — ${title}`,
      "INKAI Surabaya",
      eventAt ? `Jadwal: ${eventAt}` : null,
      location ? `Lokasi: ${location}` : null,
      `Biaya: ${formatLatberCurrency(props.feeAmount)} / peserta`,
      "",
      "Daftar / bayar di portal:",
      url,
    ].filter((line): line is string => line != null);
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  function openWaReport(text: string) {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    const opened = window.open(waUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      showError("Popup diblokir — izinkan jendela baru untuk membuka WhatsApp");
      return;
    }
    showSuccess("WhatsApp dibuka — pilih penerima lalu kirim laporan");
  }

  function sendCabangWaReport(dojoId: string | null) {
    const title = props.selectedPeriod?.title ?? "Latihan Bersama";
    const eventLocation = props.periodMeta.eventLocation?.trim() || null;
    const approvedAll = filterLatberApprovedRows(rows);
    if (approvedAll.length === 0) {
      showError("Belum ada peserta disetujui");
      return;
    }
    const text = !dojoId
      ? buildLatberCabangWaReportText(title, approvedAll, eventLocation)
      : (() => {
          const approved = approvedAll.filter((r) => r.dojoId === dojoId);
          if (approved.length === 0) {
            showError("Ranting terpilih tidak punya peserta disetujui");
            return "";
          }
          const dojoName =
            cabangWaDojoOptions.find((o) => o.dojoId === dojoId)?.dojoName ||
            props.dojos.find((d) => d.id === dojoId)?.name ||
            "Ranting";
          return buildLatberRantingWaReportText(
            title,
            dojoName,
            approved,
            props.feeAmount,
            props.komisiRanting,
            eventLocation,
          );
        })();
    if (!text) return;
    setShowCabangWaPicker(false);
    openWaReport(text);
  }

  function buildWaReport() {
    if (isCabang) {
      setCabangWaSelectedDojoId(null);
      setShowCabangWaPicker(true);
      return;
    }
    const title = props.selectedPeriod?.title ?? "Latihan Bersama";
    const approved = approvedForRecap;
    if (approved.length === 0) {
      showError("Belum ada peserta disetujui");
      return;
    }
    const text = buildLatberRantingWaReportText(
      title,
      resolveLatberWaDojoLabel({
        effectiveDojoId: localDojo,
        dojos: props.dojos,
        approvedRows: approved,
      }),
      approved,
      props.feeAmount,
      props.komisiRanting,
      props.periodMeta.eventLocation?.trim() || null,
    );
    openWaReport(text);
  }

  function printedAtLabel() {
    return new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function recapPrintPayload() {
    const title = props.selectedPeriod?.title ?? "Latihan Bersama";
    return {
      periodTitle: title,
      feeAmount: props.feeAmount,
      komisiRanting: props.komisiRanting,
      rows: buildLatberRekapRows(approvedForRecap, props.feeAmount),
      origin: window.location.origin,
      printedAt: printedAtLabel(),
      sekretariatAddress: props.orgProfile?.address,
      includeRanting: !isDojoAdmin,
    };
  }

  function ensureRecapRows(): ReturnType<typeof buildLatberRekapRows> | null {
    const recapRows = buildLatberRekapRows(approvedForRecap, props.feeAmount);
    if (recapRows.length === 0) {
      showError("Belum ada peserta disetujui untuk direkap");
      return null;
    }
    return recapRows;
  }

  async function handleDownloadRekapExcel() {
    const recapRows = ensureRecapRows();
    if (!recapRows) return;
    const title = props.selectedPeriod?.title ?? "Latihan Bersama";
    setRekapDownloading(true);
    try {
      const res = await fetch("/api/admin/latber/rekap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodTitle: title,
          feeAmount: props.feeAmount,
          komisiRanting: props.komisiRanting,
          rows: recapRows,
        }),
      });
      if (!res.ok) {
        const data = await parseApiJson<{ error?: string }>(res);
        throw new Error(data.error || "Gagal membuat rekap Excel");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildLatberRekapFilename(title, "xlsx");
      a.click();
      URL.revokeObjectURL(url);
      showSuccess(`${recapRows.length} peserta direkap ke Excel`);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal mengunduh rekap");
    } finally {
      setRekapDownloading(false);
    }
  }

  async function handleDownloadRekapPdf() {
    const recapRows = ensureRecapRows();
    if (!recapRows) return;
    setRekapDownloading(true);
    try {
      await downloadLatberRekapPdf(recapPrintPayload());
      showSuccess(`${recapRows.length} peserta diunduh sebagai PDF`);
    } catch (e) {
      showError(
        e instanceof Error
          ? e.message
          : "Gagal membuat PDF. Coba Print / Save as PDF.",
      );
    } finally {
      setRekapDownloading(false);
    }
  }

  function handlePrintRekap() {
    const recapRows = ensureRecapRows();
    if (!recapRows) return;
    printLatberRekapDocument(recapPrintPayload());
    showSuccess(
      `${recapRows.length} peserta siap — di dialog cetak pilih printer atau Save as PDF`,
    );
  }

  const isRegClosed = useMemo(() => {
    if (!props.selectedPeriod) return false;
    if (periodLocked) return false;
    const closeIso =
      props.selectedPeriod.registrationCloseAt || props.selectedPeriod.endDate;
    if (!closeIso) return false;
    const closeDate = new Date(closeIso);
    return !Number.isNaN(closeDate.getTime()) && Date.now() > closeDate.getTime();
  }, [props.selectedPeriod, periodLocked]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={props.selectedPeriodId ?? "none"}
          onValueChange={(v) => {
            if (v === "none") return;
            const base = props.isArchiveView ? "/admin/latber/arsip" : "/admin/latber";
            router.push(`${base}?period=${v}`);
          }}
        >
          <SelectTrigger className="w-[min(100%,340px)]">
            <SelectValue placeholder="Pilih periode" />
          </SelectTrigger>
          <SelectContent>
            {props.periods.map((p) => {
              const closeIso = p.registrationCloseAt || p.endDate;
              const isClosed =
                !p.archived &&
                !p.locked &&
                Boolean(
                  closeIso &&
                    !Number.isNaN(new Date(closeIso).getTime()) &&
                    Date.now() > new Date(closeIso).getTime(),
                );
              return (
                <SelectItem key={p.id} value={p.id}>
                  {formatLatberPeriodLabel(p.title)}
                  {p.archived
                    ? " (Arsip)"
                    : isClosed
                      ? " (Pendaftaran Ditutup)"
                      : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {props.canCreatePeriod && !props.isArchiveView && (
          <Button type="button" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Buat Periode
          </Button>
        )}

        {isCabang &&
          props.selectedPeriodId &&
          !props.isArchiveView &&
          !periodLocked && (
            <Button type="button" variant="outline" onClick={openEditPeriod}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Periode
            </Button>
          )}

        {props.selectedPeriodId && (
          <>
            <LatberRekapMenu
              loading={rekapDownloading}
              onExcel={() => void handleDownloadRekapExcel()}
              onPdf={() => void handleDownloadRekapPdf()}
              onPrint={handlePrintRekap}
            />
            <Button type="button" variant="outline" size="sm" onClick={buildWaReport}>
              <MessageCircle className="mr-1 h-4 w-4" />
              Laporan WA
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={copyInvite}>
              <Copy className="mr-1 h-4 w-4" />
              Salin Undangan
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={waInvite}>
              <MessageCircle className="mr-1 h-4 w-4" />
              WA Undangan
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPrintOpen(true)}>
              <Printer className="mr-1 h-4 w-4" />
              Cetak Nota
            </Button>
          </>
        )}

        <Button type="button" variant="ghost" size="icon" onClick={refresh} title="Muat ulang">
          <RefreshCw className="h-4 w-4" />
        </Button>

        {isCabang && props.selectedPeriodId && !props.isArchiveView && !periodLocked && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={archiveLoading}
            onClick={() => setConfirmArchive(true)}
          >
            <Archive className="mr-1 h-4 w-4" />
            Arsipkan
          </Button>
        )}

        {props.selectedPeriodId && !periodLocked && !props.isArchiveView && (
          <Button
            type="button"
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => setGuestOpen(true)}
          >
            <UserPlus className="mr-1 h-4 w-4" />
            Tambah Peserta
          </Button>
        )}
      </div>

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
                  Pendaftaran dan perubahan status dibatasi. Lihat data, cetak nota, dan hapus
                  pendaftaran lunas tetap tersedia untuk cabang/ranting.
                </p>
              </div>
            </div>
            {isCabang && props.isArchiveView && (
              <Button
                size="sm"
                variant="outline"
                disabled={archiveLoading}
                onClick={() => void handlePeriodArchive(false)}
              >
                Buka kembali
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isRegClosed && props.selectedPeriodId && !periodLocked && (
        <Card className="border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Pendaftaran Mandiri / Publik Ditutup
                </p>
                <p className="text-amber-800/90 dark:text-amber-300/90">
                  Timer pendaftaran online telah berakhir. Seluruh data peserta tetap tersimpan dan dapat diverifikasi, dibayar tunai, serta dicetak nota dan laporannya.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {props.selectedPeriod && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Peserta
            </div>
            <p className="mt-1 text-2xl font-semibold">{kpis.total}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Belum Bayar</p>
            <p className="mt-1 text-2xl font-semibold text-amber-700">{kpis.belumBayar}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Menunggu Verifikasi</p>
            <p className="mt-1 text-2xl font-semibold">{kpis.menungguVerifikasi}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Lunas</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700">{kpis.lunas}</p>
          </div>
        </div>
      )}

      {!props.selectedPeriodId && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center space-y-3 p-8 text-center text-muted-foreground">
            <Archive className="h-10 w-10 text-muted-foreground/60" />
            <div>
              <p className="text-base font-medium text-foreground">
                {props.isArchiveView
                  ? "Belum ada periode Latihan Bersama yang diarsipkan"
                  : "Belum ada periode Latihan Bersama yang sedang berjalan"}
              </p>
              <p className="mt-1 max-w-md text-sm">
                {props.isArchiveView
                  ? "Periode Latihan Bersama saat ini sedang aktif (MASIH TERBUKA). Klik tombol di bawah untuk melihat dan mengelola data peserta di Pendaftaran Latber Aktif."
                  : props.canCreatePeriod
                    ? "Periode sebelumnya mungkin sudah selesai dan tersimpan di Arsip, atau klik Buat Periode untuk memulai."
                    : "Data periode sebelumnya yang telah selesai atau diarsipkan dapat dilihat melalui menu Arsip."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {props.isArchiveView ? (
                <Button
                  type="button"
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => router.push("/admin/latber")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Kelola Data Peserta di Pendaftaran Latber Aktif
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/admin/latber/arsip")}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Lihat Arsip Latihan Bersama
                </Button>
              )}
              {props.canCreatePeriod && !props.isArchiveView && (
                <Button type="button" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Buat Periode Baru
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {props.selectedPeriodId && (
        <>
          <div className="flex flex-wrap items-end gap-2">
            {!isDojoAdmin && (
              <Select value={localDojo || "all"} onValueChange={(v) => setLocalDojo(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Semua ranting" />
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
            <LatberSearchBar
              allRows={rows}
              value={searchQ}
              onChange={setSearchQ}
              placeholder={
                periodLocked
                  ? "Cari nama atau NIA…"
                  : "Cari nama untuk daftarkan / temukan peserta…"
              }
              enableRemoteSuggest={!periodLocked}
              dojoFilter={localDojo}
              showDojoInSuggest={isMultiDojoAdmin}
              onSelectRemote={hydrateRemoteMember}
              disabled={!props.selectedPeriodId}
              latberEventId={props.selectedPeriodId || ""}
              canQuickRegister={!periodLocked && canQuickRegister}
              onQuickRegister={
                !periodLocked && canQuickRegister
                  ? handleQuickRegisterFromSearch
                  : undefined
              }
              registerPendingId={pendingId}
            />
          </div>

          {!periodLocked && (
            <p className="text-xs text-muted-foreground">
              Ketik nama di kotak cari, pilih saran → <b>Daftar</b> untuk anggota Belum Daftar.
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10">No</TableHead>
                  <TableHead>NIA</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="whitespace-nowrap">Tanggal daftar</TableHead>
                  <TableHead>Sabuk</TableHead>
                  {!isDojoAdmin && <TableHead>Ranting</TableHead>}
                  <TableHead>Biaya</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[220px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isDojoAdmin ? 8 : 9} className="py-10 text-center text-muted-foreground">
                      {props.dbError
                        ? "Gagal memuat data."
                        : "Belum ada peserta. Cari anggota lalu daftar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayRows.map((row, i) => {
                    const status = resolveLatberDisplayStatus(row);
                    const busy =
                      pendingId != null &&
                      (pendingId === row.registrationId ||
                        pendingId === row.memberId);
                    return (
                      <TableRow key={row.registrationId ?? row.memberId}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{row.nia || "—"}</TableCell>
                        <TableCell className="font-medium">
                          <span className="inline-flex flex-wrap items-center gap-1">
                            {row.fullName}
                            {row.isLatberGuest ? (
                              <Badge
                                variant="outline"
                                className="border-amber-400 text-[10px] text-amber-800"
                              >
                                Tamu
                              </Badge>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatRegisteredAtWib(row.registeredAt)}
                        </TableCell>
                        <TableCell>{formatLatberRank(row)}</TableCell>
                        {!isDojoAdmin && <TableCell>{row.dojoName || "—"}</TableCell>}
                        <TableCell>
                          {formatLatberCurrency(props.feeAmount)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge row={row} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {status === "belum_daftar" && !periodLocked && (
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => handleRegister(row.memberId)}
                              >
                                {busy ? "Mendaftar…" : "Daftar"}
                              </Button>
                            )}
                            {(status === "menunggu_terima_ranting" ||
                              status === "menunggu_konfirmasi_ranting") &&
                              !periodLocked && (
                              <>
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    runAction(
                                      row.registrationId!,
                                      { action: "accept_self_registration" },
                                      status === "menunggu_konfirmasi_ranting"
                                        ? "Pendaftaran dikonfirmasi — diteruskan ke cabang"
                                        : "Pendaftaran diterima",
                                    )
                                  }
                                >
                                  {status === "menunggu_konfirmasi_ranting"
                                    ? "Konfirmasi"
                                    : "Terima"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() =>
                                    runAction(
                                      row.registrationId!,
                                      { action: "reject_self_registration" },
                                      "Pendaftaran ditolak",
                                    )
                                  }
                                >
                                  Tolak
                                </Button>
                              </>
                            )}
                            {status === "belum_bayar" && !periodLocked && (
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  runAction(
                                    row.registrationId!,
                                    { action: "submit_for_verification" },
                                    "Diajukan ke cabang",
                                  )
                                }
                              >
                                TF
                              </Button>
                            )}
                            {(status === "belum_bayar" ||
                              status === "menunggu_verifikasi") &&
                              !periodLocked &&
                              row.registrationId && (
                              <Button
                                size="sm"
                                className="bg-teal-600 text-white hover:bg-teal-700"
                                disabled={busy}
                                onClick={() => setConfirmCash(row)}
                              >
                                Tunai
                              </Button>
                            )}
                            {status === "tunai" &&
                              !periodLocked &&
                              row.registrationId &&
                              (isCabang || isDojoAdmin) && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 text-white hover:bg-emerald-700"
                                disabled={busy}
                                onClick={() => setConfirmLunas(row)}
                              >
                                Lunas
                              </Button>
                            )}
                            {status === "menunggu_verifikasi" && isCabang && !periodLocked && (
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  runAction(
                                    row.registrationId!,
                                    { action: "mark_paid" },
                                    "Pembayaran diverifikasi",
                                  )
                                }
                              >
                                Verifikasi
                              </Button>
                            )}
                            {row.isLatberGuest &&
                              row.registrationId &&
                              !periodLocked && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                  if (row.membershipReady) {
                                    void (async () => {
                                      setPendingId(row.memberId);
                                      try {
                                        const res = await fetchWithTimeout(
                                          "/api/admin/latber/promote-membership",
                                          {
                                            method: "POST",
                                            headers: {
                                              "Content-Type": "application/json",
                                            },
                                            body: JSON.stringify({
                                              memberId: row.memberId,
                                              registrationId: row.registrationId,
                                            }),
                                          },
                                        );
                                        const data = await parseApiJson<{
                                          error?: string;
                                        }>(res);
                                        if (!res.ok) {
                                          showError(
                                            data.error ||
                                              "Gagal menambah keanggotaan",
                                          );
                                          return;
                                        }
                                        showSuccess("Keanggotaan diaktifkan");
                                        refresh();
                                      } catch (e) {
                                        showError(
                                          e instanceof Error
                                            ? e.message
                                            : "Gagal menambah keanggotaan",
                                        );
                                      } finally {
                                        setPendingId(null);
                                      }
                                    })();
                                  } else {
                                    setPromoteRow(row);
                                  }
                                }}
                              >
                                Tambah keanggotaan
                              </Button>
                            )}
                            {row.registrationId &&
                              !periodLocked &&
                              !isLatberPaidStatus(status) &&
                              status !== "ditolak" &&
                              status !== "batal" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => handleDelete(row.registrationId!, false)}
                                >
                                  Batal
                                </Button>
                              )}
                            {row.registrationId &&
                              (isLatberPaidStatus(status) ||
                                status === "menunggu_verifikasi") &&
                              (isCabang || isDojoAdmin) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => handleDelete(row.registrationId!, true)}
                                >
                                  Hapus
                                </Button>
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

          <p className="text-sm text-muted-foreground">
            Biaya {formatLatberCurrency(props.feeAmount)}/peserta · CASHBACK ranting{" "}
            {formatLatberCurrency(props.komisiRanting)} · Setor cabang{" "}
            {formatLatberCurrency(props.feeAmount - props.komisiRanting)}/peserta lunas
          </p>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Periode Latihan Bersama</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="latber-title">Nama periode</Label>
              <Input
                id="latber-title"
                placeholder="Latihan Bersama Maret 2026"
                value={createForm.title}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <Time24Fields
              dateId="latber-open-date"
              dateLabel="Tanggal buka pendaftaran"
              date={createForm.openDate}
              time={createForm.openTime}
              onDateChange={(openDate) => setCreateForm((f) => ({ ...f, openDate }))}
              onTimeChange={(openTime) => setCreateForm((f) => ({ ...f, openTime }))}
            />
            <Time24Fields
              dateId="latber-close-date"
              dateLabel="Tanggal batas pendaftaran"
              date={createForm.closeDate}
              time={createForm.closeTime}
              onDateChange={(closeDate) => setCreateForm((f) => ({ ...f, closeDate }))}
              onTimeChange={(closeTime) => setCreateForm((f) => ({ ...f, closeTime }))}
            />
            <Time24Fields
              dateId="latber-event-date"
              dateLabel="Tanggal latihan"
              date={createForm.eventDate}
              time={createForm.eventTime}
              onDateChange={(eventDate) => setCreateForm((f) => ({ ...f, eventDate }))}
              onTimeChange={(eventTime) => setCreateForm((f) => ({ ...f, eventTime }))}
            />
            <div>
              <Label htmlFor="latber-loc">Lokasi</Label>
              <Input
                id="latber-loc"
                placeholder="Alamat / venue"
                value={createForm.eventLocation}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, eventLocation: e.target.value }))
                }
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Biaya peserta {formatLatberCurrency(DEFAULT_LATBER_FEE)} (tetap) · CASHBACK
              ranting {formatLatberCurrency(DEFAULT_LATBER_KOMISI_RANTING)}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Batal
            </Button>
            <Button type="button" onClick={handleCreatePeriod}>
              <Calendar className="mr-2 h-4 w-4" />
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Periode Latihan Bersama</DialogTitle>
            <DialogDescription>
              Ubah nama, jadwal pendaftaran, waktu latihan, dan lokasi. Tarif tetap{" "}
              {formatLatberCurrency(DEFAULT_LATBER_FEE)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="latber-edit-title">Nama periode</Label>
              <Input
                id="latber-edit-title"
                placeholder="Latihan Bersama Maret 2026"
                value={editForm.title}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <Time24Fields
              dateId="latber-edit-open-date"
              dateLabel="Tanggal buka pendaftaran"
              date={editForm.openDate}
              time={editForm.openTime}
              onDateChange={(openDate) => setEditForm((f) => ({ ...f, openDate }))}
              onTimeChange={(openTime) => setEditForm((f) => ({ ...f, openTime }))}
            />
            <Time24Fields
              dateId="latber-edit-close-date"
              dateLabel="Tanggal batas pendaftaran"
              date={editForm.closeDate}
              time={editForm.closeTime}
              onDateChange={(closeDate) => setEditForm((f) => ({ ...f, closeDate }))}
              onTimeChange={(closeTime) => setEditForm((f) => ({ ...f, closeTime }))}
            />
            <Time24Fields
              dateId="latber-edit-event-date"
              dateLabel="Tanggal latihan"
              date={editForm.eventDate}
              time={editForm.eventTime}
              onDateChange={(eventDate) => setEditForm((f) => ({ ...f, eventDate }))}
              onTimeChange={(eventTime) => setEditForm((f) => ({ ...f, eventTime }))}
            />
            <div>
              <Label htmlFor="latber-edit-loc">Lokasi</Label>
              <Input
                id="latber-edit-loc"
                placeholder="Alamat / venue"
                value={editForm.eventLocation}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, eventLocation: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="latber-edit-fee">Tarif tetap Peserta (Rp)</Label>
              <Input
                id="latber-edit-fee"
                type="number"
                min={0}
                step={1000}
                value={editForm.feeAmount}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    feeAmount: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="latber-edit-komisi">CASHBACK Ranting per Peserta (Rp)</Label>
              <Input
                id="latber-edit-komisi"
                type="number"
                min={0}
                step={500}
                value={editForm.komisiRanting}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    komisiRanting: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={editSaving}
              onClick={() => setEditOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={editSaving}
              onClick={() => void handleEditPeriod()}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {editSaving ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {printOpen && props.selectedPeriod && (
        <LatberPrintModal
          open={printOpen}
          onOpenChange={setPrintOpen}
          periodTitle={props.selectedPeriod.title}
          rows={rows.filter((r) =>
            isLatberPaidStatus(resolveLatberDisplayStatus(r)),
          )}
          dojos={props.dojos}
          feeAmount={props.feeAmount}
          komisiRanting={props.komisiRanting}
          totals={notaTotals}
          orgProfile={props.orgProfile}
        />
      )}

      <InkaiConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={confirmDelete?.force ? "Hapus pendaftaran?" : "Batalkan pendaftaran?"}
        description={
          confirmDelete?.force
            ? "Pendaftaran lunas atau menunggu verifikasi akan dibatalkan beserta tagihannya."
            : "Pendaftaran akan dibatalkan. Tindakan ini tidak dapat dibatalkan."
        }
        confirmLabel={confirmDelete?.force ? "Ya, hapus" : "Ya, batalkan"}
        cancelLabel="Tutup"
        variant="danger"
        loading={Boolean(pendingId && confirmDelete?.registrationId === pendingId)}
        onConfirm={() => void executeDelete()}
      />

      <InkaiConfirmDialog
        open={Boolean(confirmCash)}
        onOpenChange={(open) => !open && setConfirmCash(null)}
        title="Tandai lunas tunai?"
        description={
          confirmCash
            ? `${confirmCash.fullName} — ${formatLatberCurrency(props.feeAmount)}. Status menjadi Tunai; kas dan kredit kehadiran ikut dicatat.`
            : ""
        }
        confirmLabel="Ya, Tunai"
        cancelLabel="Batal"
        loading={Boolean(
          confirmCash &&
            (pendingId === confirmCash.registrationId ||
              pendingId === confirmCash.memberId),
        )}
        onConfirm={() => {
          if (!confirmCash?.registrationId) return;
          const regId = confirmCash.registrationId;
          setConfirmCash(null);
          void runAction(
            regId,
            { action: "mark_cash" },
            "Lunas tunai",
          );
        }}
      />

      <InkaiConfirmDialog
        open={Boolean(confirmLunas)}
        onOpenChange={(open) => !open && setConfirmLunas(null)}
        title="Ubah Tunai menjadi Lunas?"
        description={
          confirmLunas
            ? `${confirmLunas.fullName} — metode tercatat transfer/QRIS. Kas dan kehadiran tidak dicatat ulang.`
            : ""
        }
        confirmLabel="Ya, Lunas"
        cancelLabel="Batal"
        loading={Boolean(
          confirmLunas &&
            (pendingId === confirmLunas.registrationId ||
              pendingId === confirmLunas.memberId),
        )}
        onConfirm={() => {
          if (!confirmLunas?.registrationId) return;
          const regId = confirmLunas.registrationId;
          setConfirmLunas(null);
          void runAction(regId, { action: "mark_lunas" }, "Status menjadi Lunas");
        }}
      />

      {props.selectedPeriodId && !periodLocked ? (
        <LatberAddGuestDialog
          open={guestOpen}
          onOpenChange={setGuestOpen}
          eventId={props.selectedPeriodId}
          dojos={props.dojos}
          defaultDojoId={
            isDojoAdmin && props.dojos.length === 1 ? props.dojos[0].id : localDojo
          }
          lockDojo={isDojoAdmin && props.dojos.length === 1}
          apiPath="/api/admin/latber/add-guest"
          onRegistered={() => refresh()}
          onRegisterExisting={(memberId) => void handleRegister(memberId)}
        />
      ) : null}

      <LatberPromoteMembershipDialog
        open={Boolean(promoteRow)}
        onOpenChange={(open) => !open && setPromoteRow(null)}
        row={promoteRow}
        onPromoted={() => refresh()}
      />

      {isCabang ? (
        <Dialog open={showCabangWaPicker} onOpenChange={setShowCabangWaPicker}>
          <DialogContent className="max-w-md gap-4">
            <DialogHeader>
              <DialogTitle>Pilih Laporan WA</DialogTitle>
              <DialogDescription>
                Untuk cabang: ringkas semua ranting, atau rincian per ranting tanpa ganti akun.
              </DialogDescription>
            </DialogHeader>
            <Select
              value={cabangWaSelectedDojoId ?? "all"}
              onValueChange={(v) =>
                setCabangWaSelectedDojoId(v === "all" ? null : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih ranting" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua ranting (ringkas)</SelectItem>
                {cabangWaDojoOptions.map((o) => (
                  <SelectItem key={o.dojoId} value={o.dojoId}>
                    {o.dojoName} ({o.count} peserta)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCabangWaPicker(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={() => sendCabangWaReport(cabangWaSelectedDojoId)}
              >
                Buka WhatsApp
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <InkaiConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Arsipkan periode?"
        description="Periode akan dikunci dan dipindah ke Arsip Latihan Bersama. Pendaftaran baru tidak dapat dilakukan."
        confirmLabel="Ya, arsipkan"
        cancelLabel="Batal"
        variant="danger"
        loading={archiveLoading}
        onConfirm={() => void handlePeriodArchive(true)}
      />
    </div>
  );
}

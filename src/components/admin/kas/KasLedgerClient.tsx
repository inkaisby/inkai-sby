"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Lock,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Unlock,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InkaiConfirmDialog } from "@/components/ui/InkaiConfirmDialog";
import { formatRp } from "@/lib/terbilang";
import {
  firstOfMonthWib,
  formatKasDateId,
  kasGroupKegiatanNames,
  KAS_MAX_BATCH,
  mergeMassPasteRows,
  parseKasImportTsv,
  parseKasMassPaste,
  visibleKasTableRows,
  ymdWib,
  type KasLedgerRow,
  type KasTableRow,
} from "@/lib/kas";
import { printKasDocument } from "@/lib/kas-print-html";
import { KasDateField } from "@/components/admin/kas/KasDateField";

type KasPayload = {
  canWrite: boolean;
  canLock: boolean;
  canTransfer?: boolean;
  rows: KasLedgerRow[];
  groups: KasTableRow[];
  kpis: {
    totalIn: number;
    totalOut: number;
    saldoAkhir: number;
    opening: number;
    unmatched: number;
  };
  kegiatanOptions: string[];
  lockedMonths: string[];
  currentMonth: string;
  scope: { type: "branch" | "dojo"; id: string };
  scopes?: Array<{ type: "branch" | "dojo"; id: string; label: string }>;
};

type DraftRow = {
  txnDate: string;
  description: string;
  direction: "in" | "out";
  amount: string;
};

function emptyMassRow(txnDate: string): DraftRow {
  return { txnDate, description: "", direction: "out", amount: "" };
}

function isValidYmd(ymd: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd);
}

export function KasLedgerClient({
  scopeLabel,
  isRanting,
}: {
  scopeLabel: string;
  isRanting?: boolean;
}) {
  const [fromYmd, setFromYmd] = useState(firstOfMonthWib);
  const [toYmd, setToYmd] = useState(ymdWib);
  const [kegiatan, setKegiatan] = useState("");
  const [source, setSource] = useState("all");
  const [recon, setRecon] = useState("all");
  const [collapsedKegiatan, setCollapsedKegiatan] = useState<string[]>([]);
  const [massRowsOpen, setMassRowsOpen] = useState(true);
  const [data, setData] = useState<KasPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [massOpen, setMassOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [scopeKey, setScopeKey] = useState("");
  const [moveScopeKey, setMoveScopeKey] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [transferKegiatan, setTransferKegiatan] = useState<string | null>(null);
  const [transferKegiatanTarget, setTransferKegiatanTarget] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchTransferOpen, setBatchTransferOpen] = useState(false);
  const [batchTarget, setBatchTarget] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [form, setForm] = useState({
    txnDate: ymdWib(),
    description: "",
    kegiatan: "",
    direction: "in" as "in" | "out",
    amount: "",
  });
  const [massDate, setMassDate] = useState(ymdWib());
  const [massKegiatan, setMassKegiatan] = useState("");
  const [massRows, setMassRows] = useState<DraftRow[]>(() => [emptyMassRow(ymdWib())]);
  const [postScopeKey, setPostScopeKey] = useState("");
  const [massPasteText, setMassPasteText] = useState("");
  const [massPasteDirection, setMassPasteDirection] = useState<"in" | "out">("out");
  const collapseSeedQsRef = useRef<string | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    let from = fromYmd;
    let to = toYmd;
    if (from && to && from > to) {
      const swap = from;
      from = to;
      to = swap;
    }
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (scopeKey) {
      const [scopeType, scopeId] = scopeKey.split(":", 2);
      if (scopeType && scopeId) {
        p.set("scopeType", scopeType);
        p.set("scopeId", scopeId);
      }
    }
    if (kegiatan) p.set("kegiatan", kegiatan);
    if (source !== "all") p.set("source", source);
    if (recon !== "all") p.set("recon", recon);
    return p.toString();
  }, [fromYmd, toYmd, scopeKey, kegiatan, source, recon]);

  const [selectionQs, setSelectionQs] = useState(qs);
  if (qs !== selectionQs) {
    setSelectionQs(qs);
    setSelectedIds([]);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/kas?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat");
      setData(json);
      const nextScopeKey = `${json.scope.type}:${json.scope.id}`;
      setScopeKey((prev) => prev || nextScopeKey);
      if (collapseSeedQsRef.current !== qs) {
        collapseSeedQsRef.current = qs;
        setCollapsedKegiatan(
          kegiatan.trim() ? [] : kasGroupKegiatanNames(json.groups ?? []),
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat kas");
    } finally {
      setLoading(false);
    }
  }, [qs, kegiatan]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const lockMonth = (toYmd || fromYmd || ymdWib()).slice(0, 7);
  const locked = Boolean(data?.lockedMonths.includes(lockMonth));

  async function postEntries(
    entries: Array<{
      txnDate: string;
      description: string;
      kegiatan?: string;
      direction: "in" | "out";
      amount: number;
    }>,
    scopeKeyOverride?: string,
  ) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const key = scopeKeyOverride || postScopeKey || scopeKey;
    const [scopeType, scopeId] = key.split(":", 2);
    if (scopeType && scopeId) {
      headers["x-kas-scope-type"] = scopeType;
      headers["x-kas-scope-id"] = scopeId;
    } else if (data?.scope) {
      headers["x-kas-scope-type"] = data.scope.type;
      headers["x-kas-scope-id"] = data.scope.id;
    }
    const res = await fetch("/api/admin/kas", {
      method: "POST",
      headers,
      body: JSON.stringify({ entries }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Gagal simpan");
    return json;
  }

  function postScopeLabel(key: string) {
    return (
      data?.scopes?.find((s) => `${s.type}:${s.id}` === key)?.label ??
      activeScopeLabel
    );
  }

  function canPickLokasi() {
    return Boolean(
      data?.canTransfer && !isRanting && (data?.scopes?.length ?? 0) > 1,
    );
  }

  function expandKegiatan(name: string) {
    const k = name.trim();
    if (!k) return;
    setCollapsedKegiatan((prev) => prev.filter((x) => x !== k));
  }

  async function handleAdd() {
    try {
      const savedKegiatan = form.kegiatan;
      await postEntries(
        [
          {
            txnDate: form.txnDate,
            description: form.description,
            kegiatan: form.kegiatan,
            direction: form.direction,
            amount: Number(form.amount),
          },
        ],
        postScopeKey || scopeKey,
      );
      const key = postScopeKey || scopeKey;
      const sameBook = key === scopeKey || key === `${data?.scope.type}:${data?.scope.id}`;
      toast.success(
        sameBook
          ? "Mutasi kas tersimpan"
          : `Mutasi tersimpan ke ${postScopeLabel(key)}`,
      );
      expandKegiatan(savedKegiatan);
      closeMutasiDialog();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal simpan");
    }
  }

  function closeMutasiDialog() {
    setAddOpen(false);
    setEditId(null);
    setMoveOpen(false);
    setMoveScopeKey("");
    setPostScopeKey("");
    setForm({
      txnDate: ymdWib(),
      description: "",
      kegiatan: "",
      direction: "in",
      amount: "",
    });
  }

  function openAddDialog() {
    setPostScopeKey(scopeKey || `${data?.scope.type}:${data?.scope.id}`);
    setAddOpen(true);
  }

  function openAddToKegiatan(kegiatan: string) {
    setPostScopeKey(scopeKey || `${data?.scope.type}:${data?.scope.id}`);
    setEditId(null);
    setForm({
      txnDate: ymdWib(),
      description: "",
      kegiatan,
      direction: "out",
      amount: "",
    });
    setAddOpen(true);
  }

  function openMassDialog() {
    const today = ymdWib();
    setPostScopeKey(scopeKey || `${data?.scope.type}:${data?.scope.id}`);
    setMassDate(today);
    setMassPasteText("");
    setMassPasteDirection("out");
    setMassRows([emptyMassRow(today)]);
    setMassRowsOpen(true);
    setMassOpen(true);
  }

  function openEdit(row: KasLedgerRow) {
    setEditId(row.id);
    setAddOpen(false);
    setForm({
      txnDate: row.txnDate,
      description: row.description,
      kegiatan: row.kegiatan,
      direction: row.amountOut > 0 ? "out" : "in",
      amount: String(row.amountIn || row.amountOut),
    });
    setMoveScopeKey("");
    setMoveOpen(false);
  }

  async function handleEdit() {
    if (!editId) return;
    const res = await fetch(`/api/admin/kas/${editId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-kas-scope-type": data?.scope.type ?? "",
        "x-kas-scope-id": data?.scope.id ?? "",
      },
      body: JSON.stringify({
        txnDate: form.txnDate,
        description: form.description,
        kegiatan: form.kegiatan,
        direction: form.direction,
        amount: Number(form.amount),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal mengubah");
      return;
    }
    toast.success("Mutasi diperbarui");
    closeMutasiDialog();
    await load();
  }

  async function handleTransfer() {
    if (!editId || !moveScopeKey || !data?.scope) return;
    const [targetScopeType, targetScopeId] = moveScopeKey.split(":", 2);
    const res = await fetch(`/api/admin/kas/${editId}/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-kas-scope-type": data.scope.type,
        "x-kas-scope-id": data.scope.id,
      },
      body: JSON.stringify({ targetScopeType, targetScopeId }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal memindahkan baris");
      return;
    }
    toast.success("Baris dipindahkan ke buku tujuan");
    closeMutasiDialog();
    await load();
  }

  function countManualForKegiatan(kegiatanName: string) {
    return (data?.rows ?? []).filter(
      (r) => r.sourceType === "manual" && r.kegiatan === kegiatanName,
    ).length;
  }

  function openTransferKegiatan(kegiatanName: string) {
    const n = countManualForKegiatan(kegiatanName);
    if (n === 0) {
      toast.error("Tidak ada baris manual");
      return;
    }
    setTransferKegiatan(kegiatanName);
    setTransferKegiatanTarget("");
  }

  async function handleTransferKegiatan() {
    if (!transferKegiatan || !transferKegiatanTarget || !data?.scope) return;
    const [targetScopeType, targetScopeId] = transferKegiatanTarget.split(":", 2);
    const res = await fetch("/api/admin/kas/transfer-kegiatan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-kas-scope-type": data.scope.type,
        "x-kas-scope-id": data.scope.id,
      },
      body: JSON.stringify({
        kegiatan: transferKegiatan,
        targetScopeType,
        targetScopeId,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal memindahkan kegiatan");
      return;
    }
    toast.success(`${json.moved} baris dipindahkan`);
    setTransferKegiatan(null);
    setTransferKegiatanTarget("");
    await load();
  }

  async function handleBatchTransfer() {
    if (!batchTarget || !data?.scope || selectedIds.length === 0) return;
    if (selectedIds.length > 100) {
      toast.error("Maksimal 100 baris per pemindahan");
      return;
    }
    const [targetScopeType, targetScopeId] = batchTarget.split(":", 2);
    const res = await fetch("/api/admin/kas/transfer-batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-kas-scope-type": data.scope.type,
        "x-kas-scope-id": data.scope.id,
      },
      body: JSON.stringify({
        ids: selectedIds,
        targetScopeType,
        targetScopeId,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal memindahkan baris");
      return;
    }
    toast.success(`${json.moved} baris dipindahkan`);
    setBatchTransferOpen(false);
    setBatchTarget("");
    setSelectedIds([]);
    await load();
  }

  function monthLocked(ymd: string) {
    return Boolean(data?.lockedMonths.includes(ymd.slice(0, 7)));
  }

  async function handleMass() {
    const rows = massRows.filter((r) => r.description.trim() && Number(r.amount) > 0);
    if (!rows.length) {
      toast.error("Isi minimal satu baris");
      return;
    }
    const invalidDate = rows.filter((r) => !isValidYmd(r.txnDate));
    if (invalidDate.length) {
      toast.error(`${invalidDate.length} baris tanggal tidak valid`);
      return;
    }
    const lockedRows = rows.filter((r) => monthLocked(r.txnDate));
    if (lockedRows.length) {
      toast.error(
        `${lockedRows.length} baris di bulan yang dikunci — ubah tanggal atau buka buku dulu`,
      );
      return;
    }
    const entries = rows.map((r) => ({
      txnDate: r.txnDate,
      description: r.description.trim(),
      kegiatan: massKegiatan,
      direction: r.direction,
      amount: Number(r.amount),
    }));
    try {
      const key = postScopeKey || scopeKey;
      await postEntries(entries, key);
      const sameBook = key === scopeKey || key === `${data?.scope.type}:${data?.scope.id}`;
      toast.success(
        sameBook
          ? `${entries.length} baris tersimpan`
          : `${entries.length} baris tersimpan ke ${postScopeLabel(key)}`,
      );
      expandKegiatan(massKegiatan);
      setMassOpen(false);
      setMassPasteText("");
      setMassRows([emptyMassRow(ymdWib())]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal simpan");
    }
  }

  function applyMassPaste() {
    const parsed = parseKasMassPaste(massPasteText, {
      defaultDirection: massPasteDirection,
      defaultTxnDate: massDate,
    });
    if (!parsed.length) {
      toast.error("Tidak ada baris valid dari tempel");
      return;
    }
    const newRows: DraftRow[] = parsed.map((r) => ({
      txnDate: r.txnDate ?? massDate,
      description: r.description,
      direction: r.direction,
      amount: String(r.amount),
    }));
    const merged = mergeMassPasteRows(massRows, newRows, KAS_MAX_BATCH);
    if ("error" in merged) {
      toast.error(`Maksimal ${KAS_MAX_BATCH} baris per simpan`);
      return;
    }
    setMassRows(merged.rows);
    setMassPasteText("");
    setMassRowsOpen(true);
    toast.success(`${merged.added} baris ditambahkan (total ${merged.rows.length})`);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const res = await fetch(`/api/admin/kas/${deleteId}`, {
      method: "DELETE",
      headers: {
        "x-kas-scope-type": data?.scope.type ?? "",
        "x-kas-scope-id": data?.scope.id ?? "",
      },
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal hapus");
      return;
    }
    toast.success("Baris dihapus");
    setDeleteId(null);
    await load();
  }

  async function handleBatchDelete() {
    if (!data?.scope || selectedIds.length === 0) return;
    if (selectedIds.length > 100) {
      toast.error("Maksimal 100 baris per penghapusan");
      return;
    }
    const res = await fetch("/api/admin/kas/delete-batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-kas-scope-type": data.scope.type,
        "x-kas-scope-id": data.scope.id,
      },
      body: JSON.stringify({ ids: selectedIds }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal menghapus baris");
      return;
    }
    toast.success(`${json.deleted} baris dihapus`);
    setBatchDeleteOpen(false);
    setSelectedIds([]);
    await load();
  }

  async function toggleRecon(row: KasLedgerRow) {
    const next = row.reconStatus === "matched" ? "open" : "matched";
    const res = await fetch(`/api/admin/kas/${row.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-kas-scope-type": data?.scope.type ?? "",
        "x-kas-scope-id": data?.scope.id ?? "",
      },
      body: JSON.stringify({ reconStatus: next }),
    });
    if (!res.ok) {
      toast.error("Gagal mengubah rekon");
      return;
    }
    await load();
  }

  async function toggleLock() {
    const yearMonth = lockMonth;
    const res = await fetch("/api/admin/kas/lock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-kas-scope-type": data?.scope.type ?? "",
        "x-kas-scope-id": data?.scope.id ?? "",
      },
      body: JSON.stringify({
        yearMonth,
        lock: !locked,
        reason: locked ? "Buka buku" : undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal kunci buku");
      return;
    }
    toast.success(locked ? "Buku dibuka" : "Buku ditutup");
    await load();
  }

  function exportCsv() {
    const rows = data?.rows ?? [];
    const lines = [
      "No,Tanggal,Keterangan,Masuk,Keluar,Saldo,Kegiatan,Sumber",
      ...rows.map(
        (r) =>
          `${r.no},"${formatKasDateId(r.txnDate)}","${r.description.replace(/"/g, '""')}",${r.amountIn},${r.amountOut},${r.saldo},"${r.kegiatan}","${r.sourceType}"`,
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      fromYmd || toYmd ? `kas-${fromYmd || "awal"}_${toYmd || "akhir"}.csv` : "kas-semua.csv";
    a.click();
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const drafts = parseKasImportTsv(
      file.name.endsWith(".csv") ? text.replace(/,/g, "\t") : text,
    );
    if (!drafts.length) {
      toast.error("Tidak ada baris valid (Tanggal/Keterangan/Masuk/Keluar/Kegiatan)");
      return;
    }
    const res = await fetch("/api/admin/kas/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-kas-scope-type": data?.scope.type ?? "",
        "x-kas-scope-id": data?.scope.id ?? "",
      },
      body: JSON.stringify({
        entries: drafts.map((d) => ({
          txnDate: d.txnDate,
          description: d.description,
          kegiatan: d.kegiatan,
          direction: d.direction,
          amount: d.amount,
        })),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal impor");
      return;
    }
    toast.success(`${json.created} baris diimpor`);
    await load();
  }

  const periodCaption =
    fromYmd && toYmd
      ? `${formatKasDateId(fromYmd)} – ${formatKasDateId(toYmd)}`
      : fromYmd
        ? `Dari ${formatKasDateId(fromYmd)}`
        : toYmd
          ? `Sampai ${formatKasDateId(toYmd)}`
          : "Semua tanggal";
  const extraFilterOn =
    Boolean(kegiatan) || source !== "all" || recon !== "all";
  const activeScopeLabel =
    data?.scopes?.find((scope) => scope.type === data.scope.type && scope.id === data.scope.id)
      ?.label ?? scopeLabel;

  function handlePrint() {
    printKasDocument({
      origin: window.location.origin,
      scopeLabel: activeScopeLabel,
      periodLabel: periodCaption,
      printedAt: `${ymdWib()} WIB`,
      saldoAkhir: data?.kpis.saldoAkhir ?? 0,
      rows: data?.rows ?? [],
    });
  }

  const groups = visibleKasTableRows(data?.groups ?? [], collapsedKegiatan);
  const canSelect = Boolean(data?.canTransfer && !isRanting);
  const visibleManualIds = groups
    .filter(
      (row): row is Extract<KasTableRow, { kind: "entry" }> =>
        row.kind === "entry" && row.sourceType === "manual",
    )
    .map((row) => row.id);
  const allVisibleSelected =
    visibleManualIds.length > 0 &&
    visibleManualIds.every((id) => selectedIds.includes(id));
  const colSpan = canSelect ? 9 : 8;

  function pruneSelectedIds(groups: KasTableRow[], collapsed: string[]) {
    const visible = new Set(
      visibleKasTableRows(groups, collapsed)
        .filter(
          (row): row is Extract<KasTableRow, { kind: "entry" }> =>
            row.kind === "entry" && row.sourceType === "manual",
        )
        .map((row) => row.id),
    );
    setSelectedIds((prev) => {
      const next = prev.filter((id) => visible.has(id));
      return next.length === prev.length ? prev : next;
    });
  }

  function setCollapsedWithPrune(next: string[]) {
    setCollapsedKegiatan(next);
    if (data?.groups) pruneSelectedIds(data.groups, next);
  }

  function toggleCollapsed(name: string) {
    const next = collapsedKegiatan.includes(name)
      ? collapsedKegiatan.filter((k) => k !== name)
      : [...collapsedKegiatan, name];
    setCollapsedWithPrune(next);
  }

  function toggleSelectId(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleManualIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...visibleManualIds])]);
  }

  function openBatchTransfer() {
    if (selectedIds.length === 0) return;
    if (selectedIds.length > 100) {
      toast.error("Maksimal 100 baris per pemindahan");
      return;
    }
    setBatchTarget("");
    setBatchTransferOpen(true);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 md:gap-4">
      <div className="shrink-0 space-y-3 md:space-y-4">
        <div className="md:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            aria-expanded={summaryOpen}
            onClick={() => setSummaryOpen((o) => !o)}
          >
            {summaryOpen ? (
              <ChevronDown className="mr-1 h-4 w-4" />
            ) : (
              <ChevronRight className="mr-1 h-4 w-4" />
            )}
            Ringkasan
          </Button>
        </div>

        <div className={`${summaryOpen ? "block" : "hidden"} space-y-2 md:block`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi
              label="Total masuk"
              caption={periodCaption}
              value={formatRp(data?.kpis.totalIn ?? 0)}
              tone="in"
            />
            <Kpi
              label="Total keluar"
              caption={periodCaption}
              value={formatRp(data?.kpis.totalOut ?? 0)}
              tone="out"
            />
            <Kpi
              label="Saldo akhir"
              caption={periodCaption}
              value={formatRp(data?.kpis.saldoAkhir ?? 0)}
              tone={(data?.kpis.saldoAkhir ?? 0) < 0 ? "negative" : "saldo"}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Saldo bawa sebelum periode {formatRp(data?.kpis.opening ?? 0)} · Belum rekon{" "}
            {data?.kpis.unmatched ?? 0}
            {locked ? ` · Buku ${lockMonth} dikunci` : ""}
            {extraFilterOn
              ? " · Saldo bawa dihitung dari seluruh buku, bukan filter kegiatan/sumber/rekon."
              : ""}
          </p>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="-mx-1 flex items-end gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
            <Field label="Periode awal">
              <KasDateField allowEmpty value={fromYmd} onChange={setFromYmd} />
            </Field>
            <Field label="Periode akhir">
              <KasDateField allowEmpty value={toYmd} onChange={setToYmd} />
            </Field>
            {!isRanting && (data?.scopes?.length ?? 0) > 1 ? (
              <Field label="Buku kas">
                <select
                  className="h-10 rounded-md border bg-background px-2 text-sm"
                  value={scopeKey}
                  onChange={(e) => setScopeKey(e.target.value)}
                >
                  {(data?.scopes ?? []).map((scope) => (
                    <option key={`${scope.type}:${scope.id}`} value={`${scope.type}:${scope.id}`}>
                      {scope.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 text-xs"
              onClick={() => {
                setFromYmd("");
                setToYmd("");
              }}
            >
              Semua tanggal
            </Button>
            <select
              className="h-10 shrink-0 rounded-md border bg-background px-2 text-sm"
              value={kegiatan}
              onChange={(e) => setKegiatan(e.target.value)}
            >
              <option value="">Semua kegiatan</option>
              {(data?.kegiatanOptions ?? []).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <select
              className="h-10 shrink-0 rounded-md border bg-background px-2 text-sm"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="all">Semua sumber</option>
              <option value="manual">Manual</option>
              <option value="iuran">Iuran</option>
              <option value="ukt">UKT</option>
              <option value="latber">Latber</option>
              <option value="kwitansi">Kwitansi</option>
            </select>
            <select
              className="h-10 shrink-0 rounded-md border bg-background px-2 text-sm"
              value={recon}
              onChange={(e) => setRecon(e.target.value)}
            >
              <option value="all">Rekon semua</option>
              <option value="open">Belum rekon</option>
              <option value="matched">Cocok rekening</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="text-xs" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              Cetak
            </Button>
            <Button type="button" variant="outline" className="text-xs" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            {data?.canWrite ? (
              <>
                <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-md border px-3 text-xs">
                  <Upload className="h-4 w-4" />
                  Impor
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleImportFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <Button type="button" variant="outline" className="text-xs" onClick={openMassDialog}>
                  <Plus className="h-4 w-4" />
                  Tambah massal
                </Button>
                <Button
                  type="button"
                  className="bg-inkai-red text-xs hover:bg-inkai-red/90"
                  onClick={openAddDialog}
                >
                  <Plus className="h-4 w-4" />
                  Tambah
                </Button>
              </>
            ) : null}
            {data?.canLock ? (
              <Button type="button" variant="outline" className="text-xs" onClick={() => void toggleLock()}>
                {locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {locked ? "Buka buku" : "Tutup buku"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-auto rounded-lg border bg-card">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b bg-muted/95 text-left text-muted-foreground backdrop-blur">
                {canSelect ? (
                  <th className="w-10 p-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={visibleManualIds.length === 0}
                      aria-label="Pilih semua baris manual tampil"
                      onChange={toggleSelectAllVisible}
                    />
                  </th>
                ) : null}
                <th className="p-3">No</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3 text-right">Masuk</th>
                <th className="p-3 text-right">Keluar</th>
                <th className="p-3 text-right">Saldo</th>
                <th className="p-3">Kegiatan</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="p-6 text-center text-muted-foreground">
                  Memuat…
                </td>
              </tr>
            ) : groups.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="p-6 text-center text-muted-foreground">
                  Belum ada mutasi pada periode ini.{" "}
                  {isRanting
                    ? "Ranting hanya melihat iuran lunas di ranting dan komisi Latber (bukan UKT cabang). "
                    : ""}
                  Gunakan Tambah, Tambah massal, atau tunggu verifikasi. Isi Saldo awal sekali jika pindah dari Excel.
                </td>
              </tr>
            ) : (
              groups.map((row, idx) =>
                row.kind === "group" ? (
                  <tr key={`g-${row.kegiatan}-${idx}`} className="bg-muted/50 font-medium">
                    <td colSpan={canSelect ? 4 : 3} className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-left"
                          aria-expanded={!collapsedKegiatan.includes(row.kegiatan)}
                          aria-label={
                            collapsedKegiatan.includes(row.kegiatan)
                              ? `Buka grup ${row.kegiatan}`
                              : `Lipat grup ${row.kegiatan}`
                          }
                          onClick={() => toggleCollapsed(row.kegiatan)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleCollapsed(row.kegiatan);
                            }
                          }}
                        >
                          {collapsedKegiatan.includes(row.kegiatan) ? (
                            <ChevronRight className="h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0" />
                          )}
                          {row.kegiatan}
                        </button>
                        {data?.canTransfer && !isRanting ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => openTransferKegiatan(row.kegiatan)}
                          >
                            Pindah kegiatan
                          </Button>
                        ) : null}
                        {data?.canWrite ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => openAddToKegiatan(row.kegiatan)}
                          >
                            <Plus className="h-3 w-3" />
                            Tambah item
                          </Button>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3 text-right">{formatRp(row.totalIn)}</td>
                    <td className="p-3 text-right">{formatRp(row.totalOut)}</td>
                    <td colSpan={3} />
                  </tr>
                ) : (
                  <tr key={row.id} className="border-b">
                    {canSelect ? (
                      <td className="p-3">
                        {row.sourceType === "manual" ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(row.id)}
                            aria-label={`Pilih baris ${row.no}`}
                            onChange={() => toggleSelectId(row.id)}
                          />
                        ) : null}
                      </td>
                    ) : null}
                    <td className="p-3">{row.no}</td>
                    <td className="p-3 whitespace-nowrap">{formatKasDateId(row.txnDate)}</td>
                    <td className="p-3">
                      <div>{row.description}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {row.sourceHref ? (
                          <Link href={row.sourceHref} className="underline">
                            {row.sourceType}
                          </Link>
                        ) : (
                          row.sourceType
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      {row.amountIn ? formatRp(row.amountIn) : "—"}
                    </td>
                    <td className="p-3 text-right">
                      {row.amountOut ? formatRp(row.amountOut) : "—"}
                    </td>
                    <td className="p-3 text-right">{formatRp(row.saldo)}</td>
                    <td className="p-3">{row.kegiatan || "—"}</td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          title="Dicocokkan manual ke mutasi rekening. Tidak mengubah Masuk, Keluar, atau Saldo."
                          className={`h-8 text-[11px] ${
                            row.reconStatus === "matched"
                              ? "text-green-700 dark:text-green-400"
                              : "text-muted-foreground"
                          }`}
                          onClick={() => void toggleRecon(row)}
                        >
                          {row.reconStatus === "matched" ? "Cocok rekening" : "Belum rekon"}
                        </Button>
                        {data?.canWrite && row.sourceType === "manual" && !monthLocked(row.txnDate) ? (
                          <>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              aria-label="Ubah"
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              aria-label="Hapus"
                              onClick={() => setDeleteId(row.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
          </table>
        </div>
        {canSelect && selectedIds.length > 0 ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-20 print:hidden">
            <div className="pointer-events-auto inline-flex max-w-[min(100%,24rem)] items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm shadow-md">
              <span className="text-xs font-medium">{selectedIds.length} dipilih</span>
              <Button
                type="button"
                size="sm"
                className="h-7 bg-inkai-red px-2 text-xs hover:bg-inkai-red/90"
                onClick={openBatchTransfer}
              >
                Pindah lokasi
              </Button>
              {data?.canWrite ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs text-destructive"
                  onClick={() => setBatchDeleteOpen(true)}
                >
                  Hapus
                </Button>
              ) : null}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label="Batalkan pilihan"
                onClick={() => setSelectedIds([])}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog
        open={addOpen || Boolean(editId)}
        onOpenChange={(o) => {
          if (!o) closeMutasiDialog();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Ubah mutasi" : "Tambah mutasi"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tanggal">
              <KasDateField
                value={form.txnDate}
                onChange={(txnDate) => setForm({ ...form, txnDate })}
              />
            </Field>
            <Field label="Arah">
              <select
                className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                value={form.direction}
                onChange={(e) =>
                  setForm({ ...form, direction: e.target.value as "in" | "out" })
                }
              >
                <option value="in">Masuk</option>
                <option value="out">Keluar</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
            <Field label="Keterangan">
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            </div>
            <Field label="Kegiatan">
              <Input
                list="kas-kegiatan-options"
                value={form.kegiatan}
                onChange={(e) => setForm({ ...form, kegiatan: e.target.value })}
                placeholder="Pilih atau ketik kegiatan"
                maxLength={120}
                autoComplete="off"
              />
              <datalist id="kas-kegiatan-options">
                {(data?.kegiatanOptions ?? []).map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </Field>
            <Field label="Nominal">
              <Input
                type="number"
                min={1}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            {!editId && canPickLokasi() ? (
              <div className="sm:col-span-2">
                <Field label="Lokasi">
                  <select
                    className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                    value={postScopeKey}
                    onChange={(e) => setPostScopeKey(e.target.value)}
                  >
                    {(data?.scopes ?? []).map((scope) => (
                      <option
                        key={`${scope.type}:${scope.id}`}
                        value={`${scope.type}:${scope.id}`}
                      >
                        {scope.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : null}
            {editId && data?.canTransfer && !isRanting ? (
              <div className="sm:col-span-2 rounded-md border border-dashed p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={moveOpen}
                    onChange={(e) => setMoveOpen(e.target.checked)}
                  />
                  Pindah ke buku lain
                </label>
                {moveOpen ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Buku tujuan">
                      <select
                        className="h-10 rounded-md border bg-background px-2 text-sm"
                        value={moveScopeKey}
                        onChange={(e) => setMoveScopeKey(e.target.value)}
                      >
                        <option value="">Pilih buku tujuan</option>
                        {(data?.scopes ?? [])
                          .filter((scope) => `${scope.type}:${scope.id}` !== scopeKey)
                          .map((scope) => (
                            <option key={`${scope.type}:${scope.id}`} value={`${scope.type}:${scope.id}`}>
                              {scope.label}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <p className="text-xs text-muted-foreground">
                      Baris akan hilang dari buku saat ini dan muncul di buku tujuan.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeMutasiDialog}>
              Batal
            </Button>
            {editId && moveOpen ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleTransfer()}
                disabled={!moveScopeKey}
              >
                Pindahkan
              </Button>
            ) : null}
            <Button
              type="button"
              className="bg-inkai-red hover:bg-inkai-red/90"
              onClick={() => void (editId ? handleEdit() : handleAdd())}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={batchTransferOpen}
        onOpenChange={(open) => {
          setBatchTransferOpen(open);
          if (!open) setBatchTarget("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pindah lokasi</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Memindahkan {selectedIds.length} baris manual ke buku tujuan.
            </p>
            <Field label="Buku tujuan">
              <select
                className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                value={batchTarget}
                onChange={(e) => setBatchTarget(e.target.value)}
              >
                <option value="">Pilih buku tujuan</option>
                {(data?.scopes ?? [])
                  .filter((scope) => `${scope.type}:${scope.id}` !== scopeKey)
                  .map((scope) => (
                    <option
                      key={`${scope.type}:${scope.id}`}
                      value={`${scope.type}:${scope.id}`}
                    >
                      {scope.label}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBatchTransferOpen(false);
                setBatchTarget("");
              }}
            >
              Batal
            </Button>
            <Button
              type="button"
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={!batchTarget}
              onClick={() => void handleBatchTransfer()}
            >
              Pindahkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(transferKegiatan)}
        onOpenChange={(open) => {
          if (!open) {
            setTransferKegiatan(null);
            setTransferKegiatanTarget("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pindah kegiatan</DialogTitle>
          </DialogHeader>
          {transferKegiatan ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                Memindahkan {countManualForKegiatan(transferKegiatan)} baris manual
                kegiatan {transferKegiatan}. Baris otomatis tidak ikut.
              </p>
              <Field label="Buku tujuan">
                <select
                  className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                  value={transferKegiatanTarget}
                  onChange={(e) => setTransferKegiatanTarget(e.target.value)}
                >
                  <option value="">Pilih buku tujuan</option>
                  {(data?.scopes ?? [])
                    .filter((scope) => `${scope.type}:${scope.id}` !== scopeKey)
                    .map((scope) => (
                      <option
                        key={`${scope.type}:${scope.id}`}
                        value={`${scope.type}:${scope.id}`}
                      >
                        {scope.label}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTransferKegiatan(null);
                setTransferKegiatanTarget("");
              }}
            >
              Batal
            </Button>
            <Button
              type="button"
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={!transferKegiatanTarget}
              onClick={() => void handleTransferKegiatan()}
            >
              Pindahkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={massOpen}
        onOpenChange={(open) => {
          setMassOpen(open);
          if (!open) setMassPasteText("");
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Tambah massal</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tanggal default">
              <KasDateField value={massDate} onChange={setMassDate} />
              <p className="mt-1 text-xs text-muted-foreground">
                Baris baru & tempel 2 kolom memakai ini; bisa diubah per baris.
              </p>
            </Field>
            <Field label="Kegiatan bersama">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0"
                  aria-expanded={massRowsOpen}
                  aria-label={massRowsOpen ? "Lipat daftar baris" : "Buka daftar baris"}
                  onClick={() => setMassRowsOpen((o) => !o)}
                >
                  {massRowsOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
                <Input
                  className="min-w-0 flex-1"
                  list="kas-kegiatan-massal"
                  value={massKegiatan}
                  onChange={(e) => setMassKegiatan(e.target.value)}
                  placeholder="Pilih atau ketik kegiatan"
                  maxLength={120}
                  autoComplete="off"
                />
                <datalist id="kas-kegiatan-massal">
                  {(data?.kegiatanOptions ?? []).map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </div>
            </Field>
            {canPickLokasi() ? (
              <div className="sm:col-span-2">
                <Field label="Lokasi">
                  <select
                    className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                    value={postScopeKey}
                    onChange={(e) => setPostScopeKey(e.target.value)}
                  >
                    {(data?.scopes ?? []).map((scope) => (
                      <option
                        key={`${scope.type}:${scope.id}`}
                        value={`${scope.type}:${scope.id}`}
                      >
                        {scope.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : null}
            <div className="sm:col-span-2 space-y-2 rounded-md border border-dashed p-3">
              <Field label="Tempel dari Excel">
                <textarea
                  className="min-h-[88px] w-full rounded-md border bg-background px-2 py-2 font-mono text-xs"
                  placeholder={"Beli Roti\tRp333.500\nBeli Minuman\tRp50.000"}
                  value={massPasteText}
                  onChange={(e) => setMassPasteText(e.target.value)}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (text.includes("\t") || text.includes("\n")) {
                      e.preventDefault();
                      setMassPasteText(text);
                    }
                  }}
                />
              </Field>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Arah paste">
                  <select
                    className="h-10 rounded-md border bg-background px-2 text-sm"
                    value={massPasteDirection}
                    onChange={(e) =>
                      setMassPasteDirection(e.target.value as "in" | "out")
                    }
                  >
                    <option value="out">Keluar</option>
                    <option value="in">Masuk</option>
                  </select>
                </Field>
                <Button type="button" variant="outline" size="sm" onClick={applyMassPaste}>
                  Isi dari tempel
                </Button>
                <p className="text-xs text-muted-foreground">
                  Salin tanggal + keterangan + nominal (tab), atau keterangan + nominal saja
                  (pakai Tanggal default). Tempel berulang menambah baris. Maks {KAS_MAX_BATCH}{" "}
                  baris.
                </p>
              </div>
            </div>
          </div>
          {massRowsOpen ? (
          <div className="space-y-2 overflow-x-auto">
            {massRows.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(9rem,10rem)_minmax(12rem,1fr)_8rem_8rem_2.5rem]"
              >
                <KasDateField
                  value={row.txnDate}
                  onChange={(txnDate) => {
                    const next = [...massRows];
                    next[i] = { ...row, txnDate };
                    setMassRows(next);
                  }}
                />
                <Input
                  placeholder="Keterangan"
                  value={row.description}
                  onChange={(e) => {
                    const next = [...massRows];
                    next[i] = { ...row, description: e.target.value };
                    setMassRows(next);
                  }}
                />
                <select
                  className="h-10 rounded-md border bg-background px-1 text-sm"
                  value={row.direction}
                  onChange={(e) => {
                    const next = [...massRows];
                    next[i] = { ...row, direction: e.target.value as "in" | "out" };
                    setMassRows(next);
                  }}
                >
                  <option value="in">Masuk</option>
                  <option value="out">Keluar</option>
                </select>
                <Input
                  type="number"
                  placeholder="Nominal"
                  value={row.amount}
                  onChange={(e) => {
                    const next = [...massRows];
                    next[i] = { ...row, amount: e.target.value };
                    setMassRows(next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setMassRows(massRows.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setMassRows([...massRows, emptyMassRow(massDate)])
              }
            >
              + Baris
            </Button>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
            <p className="text-xs text-muted-foreground">
              Total{" "}
              {
                massRows.filter((r) => r.description.trim() && Number(r.amount) > 0)
                  .length
              }{" "}
              baris (maks {KAS_MAX_BATCH})
            </p>
            <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setMassOpen(false)}>
              Batal
            </Button>
            <Button type="button" className="bg-inkai-red hover:bg-inkai-red/90" onClick={() => void handleMass()}>
              Simpan semua
            </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InkaiConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
        title="Hapus baris kas?"
        description="Hanya baris manual yang dihapus. Jurnal otomatis tidak bisa dihapus dari sini."
        confirmLabel="Hapus"
        onConfirm={() => void handleDelete()}
      />

      <InkaiConfirmDialog
        open={batchDeleteOpen}
        onOpenChange={(o) => {
          if (!o) setBatchDeleteOpen(false);
        }}
        title={`Hapus ${selectedIds.length} baris manual?`}
        description="Baris terpilih akan dihapus permanen dari buku ini. Jurnal otomatis tidak ikut."
        confirmLabel="Hapus"
        onConfirm={() => void handleBatchDelete()}
      />
    </div>
  );
}

function Kpi({
  label,
  caption,
  value,
  tone,
}: {
  label: string;
  caption?: string;
  value: string;
  tone: "in" | "out" | "saldo" | "negative";
}) {
  const box =
    tone === "in"
      ? "border-teal-700/40 bg-teal-50 dark:bg-teal-950/20"
      : tone === "out"
        ? "border-inkai-red/40 bg-red-50 dark:bg-red-950/20"
        : tone === "negative"
          ? "border-inkai-red/40 bg-red-50 dark:bg-red-950/20"
          : "border-green-700/40 bg-green-50 dark:bg-green-950/20";
  const amount =
    tone === "in"
      ? "text-teal-800 dark:text-teal-300"
      : tone === "out" || tone === "negative"
        ? "text-inkai-red"
        : "text-green-800 dark:text-green-300";
  return (
    <div className={`rounded-lg border p-3 ${box}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      {caption ? <p className="text-[11px] text-muted-foreground">{caption}</p> : null}
      <p className={`text-lg font-semibold ${amount}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

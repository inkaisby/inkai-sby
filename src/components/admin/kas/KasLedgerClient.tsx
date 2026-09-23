"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  GripVertical,
  Lock,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Share2,
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
  aggregateKasByDojo,
  firstOfMonthWib,
  formatKasDateId,
  formatRecapDojoTextForWa,
  getKasBaseKegiatan,
  groupKasTable,
  kasGroupKegiatanNames,
  KAS_MAX_BATCH,
  mergeMassPasteRows,
  parseKasImportTsv,
  parseKasMassPaste,
  visibleKasTableRows,
  ymdWib,
  type DojoKasSummary,
  type KasLedgerRow,
  type KasTableRow,
} from "@/lib/kas";
import { kasUktDepositDisplay, matchKasDojoId } from "@/lib/kas-ukt-deposit";
import type { UktDepositRecord } from "@/lib/ukt";
import { printKasDocument } from "@/lib/kas-print-html";
import { KasDateField } from "@/components/admin/kas/KasDateField";
import { KasInlineCell } from "@/components/admin/kas/KasInlineCell";
import {
  KasChartSwotPanel,
  type KasSwotAnalysisResult,
} from "@/components/admin/kas/KasChartSwotPanel";
import { cn } from "@/lib/utils";

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
  const searchParams = useSearchParams();
  const initialScopeKey = useMemo(() => {
    const type = searchParams.get("scopeType");
    const id = searchParams.get("scopeId");
    if (type && id) return `${type}:${id}`;
    return "";
  }, [searchParams]);

  const [swotData, setSwotData] = useState<KasSwotAnalysisResult | undefined>(undefined);
  const [chartSelectedKegiatan, setChartSelectedKegiatan] = useState<string[]>([]);

  const [fromYmd, setFromYmd] = useState(() => {
    const f = searchParams.get("from");
    return f && isValidYmd(f) ? f : firstOfMonthWib();
  });
  const [toYmd, setToYmd] = useState(() => {
    const t = searchParams.get("to");
    return t && isValidYmd(t) ? t : ymdWib();
  });
  const [kegiatan, setKegiatan] = useState(() => searchParams.get("kegiatan") || "");
  const [source, setSource] = useState(() => searchParams.get("source") || "all");
  const [recon, setRecon] = useState(() => searchParams.get("recon") || "all");
  const [direction, setDirection] = useState<"all" | "in" | "out">("all");
  const [collapsedKegiatan, setCollapsedKegiatan] = useState<string[]>([]);
  const [massRowsOpen, setMassRowsOpen] = useState(true);
  const [data, setData] = useState<KasPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [massOpen, setMassOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [scopeKey, setScopeKey] = useState(initialScopeKey);
  const [moveScopeKey, setMoveScopeKey] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [transferKegiatan, setTransferKegiatan] = useState<string | null>(null);
  const [transferKegiatanTarget, setTransferKegiatanTarget] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchTransferOpen, setBatchTransferOpen] = useState(false);
  const [batchTarget, setBatchTarget] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameOldKegiatan, setRenameOldKegiatan] = useState("");
  const [renameNewKegiatan, setRenameNewKegiatan] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [batchKegiatanOpen, setBatchKegiatanOpen] = useState(false);
  const [batchKegiatanName, setBatchKegiatanName] = useState("");
  const [batchKegiatanLoading, setBatchKegiatanLoading] = useState(false);
  const [deleteKegiatanOpen, setDeleteKegiatanOpen] = useState(false);
  const [deleteKegiatanName, setDeleteKegiatanName] = useState("");
  const [deleteKegiatanCount, setDeleteKegiatanCount] = useState(0);
  const [deleteKegiatanTotalIn, setDeleteKegiatanTotalIn] = useState(0);
  const [deleteKegiatanTotalOut, setDeleteKegiatanTotalOut] = useState(0);
  const [deleteKegiatanConfirmInput, setDeleteKegiatanConfirmInput] = useState("");
  const [deleteKegiatanLoading, setDeleteKegiatanLoading] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [recapDojoOpen, setRecapDojoOpen] = useState(false);
  const [uktDepositMap, setUktDepositMap] = useState<Record<
    string,
    UktDepositRecord
  > | null>(null);
  const [uktDepositPeriod, setUktDepositPeriod] = useState<{
    id: string;
    title: string;
    semester: string;
    year: number;
  } | null>(null);
  const [uktDepositUrl, setUktDepositUrl] = useState<string | null>(null);
  const [uktDepositAmbiguous, setUktDepositAmbiguous] = useState(false);
  const [uktDepositLoadError, setUktDepositLoadError] = useState(false);
  const [uktDepositLoading, setUktDepositLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"buku" | "laporan">("laporan");
  const [printOptionModalOpen, setPrintOptionModalOpen] = useState(false);
  const [printDocType, setPrintDocType] = useState<"buku" | "laporan">("buku");
  const [printPaper, setPrintPaper] = useState<"A4" | "F4">("A4");
  const [printOrientation, setPrintOrientation] = useState<"portrait" | "landscape">("portrait");
  const [printOnlySelected, setPrintOnlySelected] = useState(false);
  const [tableFullscreen, setTableFullscreen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<{
    type: "group" | "entry";
    key: string;
  } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  async function handleDropReorder(
    source: { type: "group" | "entry"; key: string },
    target: { type: "group" | "entry"; key: string },
  ) {
    if (!data?.rows || (source.type === target.type && source.key === target.key)) return;

    const currentRows = [...data.rows];

    // Extract source entries to move
    let sourceEntries: KasLedgerRow[] = [];
    if (source.type === "group") {
      sourceEntries = currentRows.filter(
        (r) => getKasBaseKegiatan(r.kegiatan, r.sourceType) === source.key || r.kegiatan === source.key,
      );
    } else {
      const found = currentRows.find((r) => r.id === source.key);
      if (found) sourceEntries = [found];
    }

    if (sourceEntries.length === 0) return;

    // Do nothing if dropping group onto one of its own entries
    if (
      source.type === "group" &&
      target.type === "entry" &&
      sourceEntries.some((r) => r.id === target.key)
    ) {
      return;
    }

    // Filter out source entries from remaining rows
    const sourceIdSet = new Set(sourceEntries.map((r) => r.id));
    const remainingRows = currentRows.filter((r) => !sourceIdSet.has(r.id));

    // Determine target insertion index in remainingRows
    let targetIndex = -1;
    if (target.type === "group") {
      targetIndex = remainingRows.findIndex(
        (r) => getKasBaseKegiatan(r.kegiatan, r.sourceType) === target.key || r.kegiatan === target.key,
      );
    } else {
      targetIndex = remainingRows.findIndex((r) => r.id === target.key);
    }

    if (targetIndex < 0) {
      targetIndex = remainingRows.length;
    }

    // Insert source entries into remainingRows at targetIndex
    remainingRows.splice(targetIndex, 0, ...sourceEntries);

    // Recalculate no & running saldo optimistically
    let saldo = data.kpis.opening ?? 0;
    const reorderedRows = remainingRows.map((row, i) => {
      saldo += row.amountIn - row.amountOut;
      return { ...row, no: i + 1, saldo };
    });

    const orderedIds = reorderedRows.map((r) => r.id);

    // Optimistically update data state
    setData((prev) =>
      prev
        ? {
            ...prev,
            rows: reorderedRows,
            groups: groupKasTable(reorderedRows),
          }
        : prev,
    );

    try {
      const res = await fetch("/api/admin/kas/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kas-scope-type": data.scope.type,
          "x-kas-scope-id": data.scope.id,
        },
        body: JSON.stringify({ orderedIds }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal menyimpan urutan baris/kegiatan");
        await load();
        return;
      }
      toast.success(
        source.type === "group"
          ? `Urutan kegiatan "${source.key}" berhasil diperbarui`
          : "Urutan baris kas diperbarui",
      );
    } catch {
      toast.error("Gagal menyimpan urutan");
      await load();
    }
  }
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
  const [recapSearchQuery, setRecapSearchQuery] = useState("");
  const collapseSeedQsRef = useRef<string | null>(null);

  const officialDojoList = useMemo(() => {
    if (!data?.scopes) return [] as Array<{ id: string; name: string }>;
    const list: Array<{ id: string; name: string }> = [];
    for (const s of data.scopes) {
      if (s.type === "dojo" && s.id) {
        const clean = (s.label || "").replace(/^Ranting\s+/i, "").trim();
        list.push({ id: s.id, name: clean || s.label || s.id });
      }
    }
    return list;
  }, [data?.scopes]);

  const dojoSummaries = useMemo(() => {
    const base = aggregateKasByDojo(data?.rows ?? [], officialDojoList);
    return base.map((item) => {
      const dojoId =
        item.dojoId ||
        matchKasDojoId(item.dojoName, officialDojoList) ||
        null;
      const display = kasUktDepositDisplay(
        dojoId,
        uktDepositMap,
        uktDepositLoadError,
      );
      return {
        ...item,
        dojoId,
        uktDepositLabel: display.label,
      } satisfies DojoKasSummary;
    });
  }, [data?.rows, officialDojoList, uktDepositMap, uktDepositLoadError]);

  const officialDojoCount = useMemo(() => {
    return dojoSummaries.filter((d) => d.isOfficialDojo).length;
  }, [dojoSummaries]);

  const grandUkt = useMemo(
    () => dojoSummaries.reduce((s, d) => s + d.totalUkt, 0),
    [dojoSummaries],
  );
  const grandKomisiUkt = useMemo(
    () => dojoSummaries.reduce((s, d) => s + d.totalKomisiUkt, 0),
    [dojoSummaries],
  );
  const grandLatber = useMemo(
    () => dojoSummaries.reduce((s, d) => s + d.totalLatber, 0),
    [dojoSummaries],
  );
  const grandKomisiLatber = useMemo(
    () => dojoSummaries.reduce((s, d) => s + d.totalKomisiLatber, 0),
    [dojoSummaries],
  );
  const grandIuran = useMemo(
    () => dojoSummaries.reduce((s, d) => s + d.totalIuran, 0),
    [dojoSummaries],
  );
  const grandLainnya = useMemo(
    () => dojoSummaries.reduce((s, d) => s + d.totalLainnya, 0),
    [dojoSummaries],
  );
  const grandTotal = useMemo(
    () => dojoSummaries.reduce((s, d) => s + d.totalMasuk, 0),
    [dojoSummaries],
  );

  const filteredDojoSummaries = useMemo(() => {
    if (!recapSearchQuery.trim()) return dojoSummaries;
    const q = recapSearchQuery.toLowerCase();
    return dojoSummaries.filter((d) => d.dojoName.toLowerCase().includes(q));
  }, [dojoSummaries, recapSearchQuery]);

  const grandNetCabang = useMemo(
    () => grandTotal - (grandKomisiUkt + grandKomisiLatber),
    [grandTotal, grandKomisiUkt, grandKomisiLatber],
  );

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = qs ? `?${qs}` : window.location.pathname;
      window.history.replaceState(null, "", url);
    }
  }, [qs]);

  useEffect(() => {
    if (!recapDojoOpen) return;
    let cancelled = false;
    setUktDepositLoading(true);
    const params = new URLSearchParams();
    if (fromYmd) params.set("from", fromYmd);
    if (toYmd) params.set("to", toYmd);
    void fetch(`/api/admin/kas/ukt-deposit?${params}`)
      .then(async (res) => {
        const data = (await res.json()) as {
          period?: {
            id: string;
            title: string;
            semester: string;
            year: number;
          } | null;
          periodUrl?: string | null;
          ambiguous?: boolean;
          depositMap?: Record<string, UktDepositRecord>;
          loadError?: boolean;
        };
        if (cancelled) return;
        setUktDepositPeriod(data.period ?? null);
        setUktDepositUrl(data.periodUrl ?? null);
        setUktDepositAmbiguous(Boolean(data.ambiguous));
        setUktDepositLoadError(Boolean(data.loadError) || !res.ok);
        setUktDepositMap(data.depositMap ?? {});
      })
      .catch(() => {
        if (cancelled) return;
        setUktDepositLoadError(true);
        setUktDepositMap({});
        setUktDepositPeriod(null);
        setUktDepositUrl(null);
      })
      .finally(() => {
        if (!cancelled) setUktDepositLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recapDojoOpen, fromYmd, toYmd]);

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
      setScopeKey(nextScopeKey);
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

  useEffect(() => {
    if (!data?.rows) return;
    const validIds = new Set(data.rows.map((r) => r.id));
    setSelectedIds((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [data?.rows]);

  useEffect(() => {
    if (!tableFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setTableFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [tableFullscreen]);

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

  function countRowsForKegiatan(kegiatanName: string) {
    return (data?.rows ?? []).filter(
      (r) => r.kegiatan === kegiatanName,
    ).length;
  }

  function openTransferKegiatan(kegiatanName: string) {
    const n = countRowsForKegiatan(kegiatanName);
    if (n === 0) {
      toast.error("Tidak ada baris untuk dipindahkan");
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

  function openDeleteKegiatan(
    kegiatanName: string,
    count: number,
    totalIn: number,
    totalOut: number,
  ) {
    setDeleteKegiatanName(kegiatanName);
    setDeleteKegiatanCount(count);
    setDeleteKegiatanTotalIn(totalIn);
    setDeleteKegiatanTotalOut(totalOut);
    setDeleteKegiatanConfirmInput("");
    setDeleteKegiatanOpen(true);
  }

  async function handleDeleteKegiatan() {
    if (!deleteKegiatanName || !data?.scope) return;
    const isHighRisk =
      deleteKegiatanCount > 5 || deleteKegiatanTotalIn + deleteKegiatanTotalOut > 1000000;
    if (
      isHighRisk &&
      deleteKegiatanConfirmInput.trim().toLowerCase() !== deleteKegiatanName.trim().toLowerCase()
    ) {
      toast.error(
        `Ketik "${deleteKegiatanName}" secara presisi untuk mengonfirmasi`,
      );
      return;
    }
    setDeleteKegiatanLoading(true);
    try {
      const res = await fetch("/api/admin/kas/delete-kegiatan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kas-scope-type": data.scope.type,
          "x-kas-scope-id": data.scope.id,
        },
        body: JSON.stringify({ kegiatan: deleteKegiatanName }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal menghapus kegiatan");
        return;
      }
      toast.success(
        `Kegiatan "${deleteKegiatanName}" beserta ${json.deleted} item terhapus`,
      );
      setDeleteKegiatanOpen(false);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus kegiatan",
      );
    } finally {
      setDeleteKegiatanLoading(false);
    }
  }

  function handleCopyKegiatanDetails() {
    const rows = (data?.rows ?? []).filter(
      (r) => r.kegiatan === deleteKegiatanName,
    );
    if (rows.length === 0) {
      toast.error("Tidak ada baris transaksi untuk disalin");
      return;
    }
    const lines = [
      `*📋 RINCIAN TRANSAKSI KEGIATAN: ${deleteKegiatanName}*`,
      `*Total Item:* ${rows.length} Transaksi`,
      `*Total Masuk:* ${formatRp(deleteKegiatanTotalIn)}`,
      `*Total Keluar:* ${formatRp(deleteKegiatanTotalOut)}`,
      `----------------------------------------`,
      ...rows.map(
        (r) =>
          `• [${r.amountIn > 0 ? "MASUK" : "KELUAR"}] ${formatRp(
            r.amountIn || r.amountOut,
          )} - ${r.description} (${formatKasDateId(r.txnDate)})`,
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(
      () => toast.success("Rincian kegiatan berhasil disalin ke clipboard!"),
      () => toast.error("Gagal menyalin rincian"),
    );
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

  function openRenameKegiatan(kegiatanName: string) {
    setRenameOldKegiatan(kegiatanName);
    setRenameNewKegiatan(kegiatanName);
    setRenameOpen(true);
  }

  async function handleRenameKegiatan() {
    if (!renameOldKegiatan.trim() || !renameNewKegiatan.trim()) {
      toast.error("Nama kegiatan wajib diisi");
      return;
    }
    setRenameLoading(true);
    try {
      const res = await fetch("/api/admin/kas/rename-kegiatan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kas-scope-type": data?.scope.type ?? "",
          "x-kas-scope-id": data?.scope.id ?? "",
        },
        body: JSON.stringify({
          oldKegiatan: renameOldKegiatan,
          newKegiatan: renameNewKegiatan,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal mengubah nama kegiatan");
        return;
      }
      toast.success(`Nama kegiatan diperbarui (${json.updated ?? 0} baris)`);
      setRenameOpen(false);
      expandKegiatan(renameNewKegiatan);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah nama kegiatan");
    } finally {
      setRenameLoading(false);
    }
  }

  async function handleBatchKegiatan() {
    if (!batchKegiatanName.trim()) {
      toast.error("Nama kategori / kegiatan wajib diisi");
      return;
    }
    if (selectedIds.length === 0) return;
    setBatchKegiatanLoading(true);
    try {
      const res = await fetch("/api/admin/kas/batch-kegiatan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kas-scope-type": data?.scope.type ?? "",
          "x-kas-scope-id": data?.scope.id ?? "",
        },
        body: JSON.stringify({
          ids: selectedIds,
          kegiatan: batchKegiatanName.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal memperbarui kategori");
        return;
      }
      toast.success(`${json.updated ?? selectedIds.length} baris digabungkan ke "${batchKegiatanName.trim()}"`);
      setBatchKegiatanOpen(false);
      expandKegiatan(batchKegiatanName.trim());
      setSelectedIds([]);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui kategori");
    } finally {
      setBatchKegiatanLoading(false);
    }
  }

  function monthLocked(ymd: string) {
    return Boolean(data?.lockedMonths.includes(ymd.slice(0, 7)));
  }

  function canInlineEdit(row: KasLedgerRow) {
    return Boolean(data?.canWrite && !monthLocked(row.txnDate));
  }

  async function handleInlinePatch(
    row: KasLedgerRow,
    patch: {
      txnDate?: string;
      description?: string;
      kegiatan?: string;
      direction?: "in" | "out";
      amount?: number;
    },
  ): Promise<boolean> {
    const res = await fetch(`/api/admin/kas/${row.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-kas-scope-type": data?.scope.type ?? "",
        "x-kas-scope-id": data?.scope.id ?? "",
      },
      body: JSON.stringify(patch),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(
        typeof json.error === "string" ? json.error : "Gagal mengubah",
      );
      return false;
    }
    toast.success("Tersimpan");
    await load();
    return true;
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
    setSelectedIds((prev) => prev.filter((id) => id !== deleteId));
    setDeleteId(null);
    await load();
  }

  async function handleBatchDelete() {
    if (!data?.scope || selectedIds.length === 0) return;
    if (selectedIds.length > 5000) {
      toast.error("Maksimal 5000 baris per penghapusan");
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

  async function exportExcel() {
    if (!data?.rows || data.rows.length === 0) {
      toast.error("Tidak ada data kas untuk diekspor");
      return;
    }

    try {
      toast.loading("Menyiapkan file Excel...", { id: "export-excel" });
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "INKAI Surabaya";
      wb.created = new Date();

      const sheet = wb.addWorksheet("Laporan Kas", {
        pageSetup: { orientation: "landscape", fitToPage: true },
      });

      // Header judul Laporan
      sheet.mergeCells("A1:H1");
      const titleCell = sheet.getCell("A1");
      titleCell.value = "LAPORAN KEUANGAN KAS — INKAI SURABAYA";
      titleCell.font = { bold: true, size: 13, name: "Calibri", color: { argb: "FFB91C1C" } };
      titleCell.alignment = { vertical: "middle", horizontal: "left" };

      sheet.mergeCells("A2:H2");
      const subCell = sheet.getCell("A2");
      subCell.value = `Buku Kas: ${activeScopeLabel} | Periode: ${periodCaption} | Dicetak: ${new Date().toLocaleDateString("id-ID")} WIB`;
      subCell.font = { italic: true, size: 9, name: "Calibri", color: { argb: "FF475569" } };
      subCell.alignment = { vertical: "middle", horizontal: "left" };

      sheet.addRow([]); // Baris 3 kosong

      // Header Tabel (Baris 4)
      const headerRow = sheet.addRow([
        "No",
        "Tanggal",
        "Keterangan",
        "Masuk (Rp)",
        "Keluar (Rp)",
        "Saldo (Rp)",
        "Kegiatan",
        "Sumber",
      ]);

      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFB91C1C" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin", color: { argb: "FF991B1B" } },
          left: { style: "thin", color: { argb: "FF991B1B" } },
          bottom: { style: "thin", color: { argb: "FF991B1B" } },
          right: { style: "thin", color: { argb: "FF991B1B" } },
        };
      });

      let totalIn = 0;
      let totalOut = 0;

      data.rows.forEach((r) => {
        totalIn += r.amountIn || 0;
        totalOut += r.amountOut || 0;

        const row = sheet.addRow([
          r.no,
          r.txnDate ? formatKasDateId(r.txnDate) : "—",
          r.description,
          r.amountIn || 0,
          r.amountOut || 0,
          r.saldo || 0,
          r.kegiatan || "—",
          r.sourceType || "manual",
        ]);

        row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(3).alignment = { horizontal: "left", vertical: "middle" };

        row.getCell(4).numFmt = "#,##0";
        row.getCell(4).alignment = { horizontal: "right", vertical: "middle" };
        row.getCell(5).numFmt = "#,##0";
        row.getCell(5).alignment = { horizontal: "right", vertical: "middle" };
        row.getCell(6).numFmt = "#,##0";
        row.getCell(6).alignment = { horizontal: "right", vertical: "middle" };

        row.getCell(7).alignment = { horizontal: "left", vertical: "middle" };
        row.getCell(8).alignment = { horizontal: "center", vertical: "middle" };

        row.eachCell((cell) => {
          cell.font = { name: "Calibri", size: 10 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });
      });

      // Total Row
      const lastSaldo = data.rows.length > 0 ? data.rows[data.rows.length - 1].saldo : 0;
      const summaryRow = sheet.addRow([
        "",
        "",
        "TOTAL KESELURUHAN",
        totalIn,
        totalOut,
        lastSaldo,
        "",
        "",
      ]);

      summaryRow.height = 22;
      summaryRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, size: 10, name: "Calibri" };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1F5F9" },
        };
        if (colNumber === 4 || colNumber === 5 || colNumber === 6) {
          cell.numFmt = "#,##0";
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else if (colNumber === 3) {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
        cell.border = {
          top: { style: "medium", color: { argb: "FF334155" } },
          bottom: { style: "double", color: { argb: "FF334155" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });

      sheet.getColumn(1).width = 8;
      sheet.getColumn(2).width = 16;
      sheet.getColumn(3).width = 40;
      sheet.getColumn(4).width = 18;
      sheet.getColumn(5).width = 18;
      sheet.getColumn(6).width = 20;
      sheet.getColumn(7).width = 28;
      sheet.getColumn(8).width = 14;

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const filename =
        fromYmd || toYmd ? `kas-${fromYmd || "awal"}_${toYmd || "akhir"}.xlsx` : "laporan-kas-semua.xlsx";

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);

      toast.success("File Excel (.xlsx) berhasil diunduh!", { id: "export-excel" });
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengekspor file Excel", { id: "export-excel" });
    }
  }

  function handleCopyWa() {
    if (!data) {
      toast.error("Data kas belum dimuat");
      return;
    }
    const currentScope = (data.scopes ?? []).find(
      (s) => `${s.type}:${s.id}` === scopeKey,
    );
    const scopeName = currentScope?.label ?? scopeLabel;

    const opening = data.kpis.opening ?? 0;
    const totalIn = data.kpis.totalIn ?? 0;
    const totalOut = data.kpis.totalOut ?? 0;
    const netto = totalIn - totalOut;
    const saldoAkhir = data.kpis.saldoAkhir ?? 0;

    const lines: string[] = [
      `*📌 LAPORAN KEUANGAN KAS — INKAI SURABAYA*`,
      `*Buku Kas:* ${scopeName}`,
      `*Periode:* ${periodCaption}`,
      ``,
      `----------------------------------------`,
      `💵 *Saldo Bawaan (Awal):* ${formatRp(opening)}`,
      `📈 *Total Masuk (+):* ${formatRp(totalIn)}`,
      `📉 *Total Keluar (-):* ${formatRp(totalOut)}`,
      `⚖️ *Surplus / Defisit Periode:* ${netto >= 0 ? "+" : ""}${formatRp(netto)}`,
      `💰 *Saldo Akhir:* ${formatRp(saldoAkhir)}`,
      `----------------------------------------`,
    ];

    if (data.rows.length > 0) {
      const inRows = data.rows.filter((r) => r.amountIn > 0);
      const outRows = data.rows.filter((r) => r.amountOut > 0);

      lines.push(``, `*📋 Ringkasan Mutasi (${data.rows.length} Transaksi):*`);

      if (inRows.length > 0) {
        lines.push(``, `📥 *Pemasukan (Total ${formatRp(totalIn)}):*`);
        inRows.slice(0, 8).forEach((r) => {
          lines.push(
            `• [MASUK] ${formatRp(r.amountIn)} - ${r.description} (${formatKasDateId(r.txnDate)})`,
          );
        });
        if (inRows.length > 8) {
          lines.push(`  _...dan ${inRows.length - 8} transaksi masuk lainnya_`);
        }
      }

      if (outRows.length > 0) {
        lines.push(``, `📤 *Pengeluaran (Total ${formatRp(totalOut)}):*`);
        outRows.slice(0, 8).forEach((r) => {
          lines.push(
            `• [KELUAR] ${formatRp(r.amountOut)} - ${r.description} (${formatKasDateId(r.txnDate)})`,
          );
        });
        if (outRows.length > 8) {
          lines.push(`  _...dan ${outRows.length - 8} transaksi keluar lainnya_`);
        }
      }
    } else {
      lines.push(``, `_Belum ada mutasi transaksi pada periode ini._`);
    }

    lines.push(
      ``,
      `_Diunduh/Dicetak pada: ${new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })} WIB_`,
      `_Portal Resmi INKAI Surabaya — https://inkai-sby.vercel.app_`,
    );

    const waText = lines.join("\n");
    navigator.clipboard.writeText(waText).then(
      () => toast.success("Laporan Kas WA berhasil disalin ke clipboard!"),
      () => toast.error("Gagal menyalin laporan ke clipboard"),
    );
  }

  function handleCopyWaSelected() {
    if (selectedRows.length === 0) {
      toast.error("Belum ada transaksi yang dipilih");
      return;
    }
    const totalIn = selectedRows.reduce((acc, r) => acc + (r.amountIn || 0), 0);
    const totalOut = selectedRows.reduce((acc, r) => acc + (r.amountOut || 0), 0);
    const netto = totalIn - totalOut;

    const currentScope = (data?.scopes ?? []).find(
      (s) => `${s.type}:${s.id}` === scopeKey,
    );
    const scopeName = currentScope?.label ?? scopeLabel;

    const lines: string[] = [
      `*📌 RINCIAN MUTASI TERPILIH — INKAI SURABAYA*`,
      `*Buku Kas:* ${scopeName}`,
      `*Total Terpilih:* ${selectedRows.length} Transaksi`,
      ``,
      `----------------------------------------`,
      `📈 *Total Masuk (+):* ${formatRp(totalIn)}`,
      `📉 *Total Keluar (-):* ${formatRp(totalOut)}`,
      `⚖️ *Netto Terpilih:* ${netto >= 0 ? "+" : ""}${formatRp(netto)}`,
      `----------------------------------------`,
      ``,
      `*📋 Rincian Mutasi (${selectedRows.length} transaksi):*`,
    ];

    selectedRows.forEach((r) => {
      const isIn = r.amountIn > 0;
      const nominal = isIn ? formatRp(r.amountIn) : formatRp(r.amountOut);
      const badge = isIn ? "[MASUK]" : "[KELUAR]";
      lines.push(`• ${badge} ${nominal} - ${r.description} (${formatKasDateId(r.txnDate)})`);
    });

    lines.push(
      ``,
      `_Diunduh/Dicetak pada: ${new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })} WIB_`,
      `_Portal Resmi INKAI Surabaya — https://inkai-sby.vercel.app_`,
    );

    const waText = lines.join("\n");
    navigator.clipboard.writeText(waText).then(
      () => toast.success(`${selectedRows.length} transaksi terpilih berhasil disalin ke format WA!`),
      () => toast.error("Gagal menyalin transaksi ke clipboard"),
    );
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
  const isFiltered = Boolean(
    fromYmd ||
      toYmd ||
      kegiatan ||
      source !== "all" ||
      recon !== "all" ||
      direction !== "all",
  );

  function resetAllFilters() {
    setFromYmd("");
    setToYmd("");
    setKegiatan("");
    setSource("all");
    setRecon("all");
    setDirection("all");
    toast.info("Seluruh filter telah dibersihkan");
  }

  const extraFilterOn =
    Boolean(kegiatan) || source !== "all" || recon !== "all" || direction !== "all";
  const activeScopeLabel =
    data?.scopes?.find((scope) => scope.type === data.scope.type && scope.id === data.scope.id)
      ?.label ?? scopeLabel;

  function handlePrint() {
    setPrintOnlySelected(selectedIds.length > 0);
    setPrintOptionModalOpen(true);
  }

  function handleExecutePrint(
    overrideDocType?: "laporan" | "buku",
    overridePaper?: "A4" | "F4",
    overrideOrientation?: "portrait" | "landscape",
  ) {
    const docType = overrideDocType ?? printDocType;
    const paper = overridePaper ?? printPaper;
    const orientation = overrideOrientation ?? printOrientation;
    setPrintOptionModalOpen(false);

    const useSelected = printOnlySelected && selectedRows.length > 0;
    const printRows = useSelected ? selectedRows : (data?.rows ?? []);
    const printSaldo = useSelected
      ? selectedRows[selectedRows.length - 1].saldo
      : (data?.kpis.saldoAkhir ?? 0);
    const printPeriod = useSelected
      ? `${periodCaption} (${selectedRows.length} Transaksi Terpilih)`
      : periodCaption;

    printKasDocument({
      origin: window.location.origin,
      scopeLabel: activeScopeLabel,
      periodLabel: printPeriod,
      printedAt: `${ymdWib()} WIB`,
      saldoAkhir: printSaldo,
      rows: printRows,
      swotAnalysis: swotData,
      selectedKegiatanList: chartSelectedKegiatan,
      docType,
      paper,
      orientation,
    });
  }

  const filteredLaporanRows = useMemo(() => {
    const base = data?.rows ?? [];
    if (direction === "all") return base;
    if (direction === "in") return base.filter((r) => r.amountIn > 0);
    return base.filter((r) => r.amountOut > 0);
  }, [data?.rows, direction]);

  const visibleSelectableLaporanIds = useMemo(() => {
    return filteredLaporanRows
      .filter((r) => !monthLocked(r.txnDate))
      .map((r) => r.id);
  }, [filteredLaporanRows, data?.lockedMonths]);

  const allLaporanSelected =
    visibleSelectableLaporanIds.length > 0 &&
    visibleSelectableLaporanIds.every((id) => selectedIds.includes(id));

  const selectedRows = useMemo(() => {
    if (!data?.rows || selectedIds.length === 0) return [];
    const set = new Set(selectedIds);
    return data.rows.filter((r) => set.has(r.id));
  }, [data?.rows, selectedIds]);

  const selectedSubtotals = useMemo(() => {
    if (selectedRows.length === 0) {
      return { count: 0, totalIn: 0, totalOut: 0, net: 0, unmatchedCount: 0, matchedCount: 0 };
    }
    let totalIn = 0;
    let totalOut = 0;
    let unmatchedCount = 0;
    let matchedCount = 0;
    for (const r of selectedRows) {
      totalIn += r.amountIn;
      totalOut += r.amountOut;
      if (r.reconStatus === "matched") {
        matchedCount += 1;
      } else {
        unmatchedCount += 1;
      }
    }
    return {
      count: selectedRows.length,
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      unmatchedCount,
      matchedCount,
    };
  }, [selectedRows]);

  async function handleBatchRecon(targetStatus: "matched" | "open") {
    if (selectedIds.length === 0) return;
    const label = targetStatus === "matched" ? "Cocok rekening" : "Belum rekon";
    try {
      const res = await fetch("/api/admin/kas/batch-recon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kas-scope-type": data?.scope.type ?? "",
          "x-kas-scope-id": data?.scope.id ?? "",
        },
        body: JSON.stringify({
          ids: selectedIds,
          reconStatus: targetStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || `Gagal memperbarui status ${label}`);
        return;
      }
      toast.success(`${json.updated} transaksi ditandai '${label}'`);
      await load();
    } catch (err) {
      toast.error(`Gagal memperbarui status ${label}`);
    }
  }

  const singleDeleteRow = useMemo(() => {
    if (!data?.rows || !deleteId) return null;
    return data.rows.find((r) => r.id === deleteId) ?? null;
  }, [data?.rows, deleteId]);

  function toggleSelectAllLaporan() {
    if (allLaporanSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !visibleSelectableLaporanIds.includes(id)),
      );
      return;
    }
    setSelectedIds((prev) => [
      ...new Set([...prev, ...visibleSelectableLaporanIds]),
    ]);
  }

  const groups = visibleKasTableRows(data?.groups ?? [], collapsedKegiatan);
  const canSelect = Boolean(data?.canWrite);
  const visibleSelectableIds = groups
    .filter(
      (row): row is Extract<KasTableRow, { kind: "entry" }> =>
        row.kind === "entry" && !monthLocked(row.txnDate),
    )
    .map((row) => row.id);
  const allVisibleSelected =
    visibleSelectableIds.length > 0 &&
    visibleSelectableIds.every((id) => selectedIds.includes(id));
  const colSpan = canSelect ? 9 : 8;

  function pruneSelectedIds(groups: KasTableRow[], collapsed: string[]) {
    const visible = new Set(
      visibleKasTableRows(groups, collapsed)
        .filter(
          (row): row is Extract<KasTableRow, { kind: "entry" }> =>
            row.kind === "entry" && !monthLocked(row.txnDate),
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
      setSelectedIds((prev) => prev.filter((id) => !visibleSelectableIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...visibleSelectableIds])]);
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

        <div className={`${summaryOpen ? "block" : "hidden"} space-y-1.5 md:block`}>
          <div className="grid gap-2 sm:grid-cols-3">
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
          <p className="text-[11px] text-muted-foreground">
            Saldo bawa sebelum periode {formatRp(data?.kpis.opening ?? 0)} ·{" "}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 px-1.5 py-0.5 font-semibold transition-colors"
              onClick={() => {
                setRecon("open");
                toast.info("Memfilter transaksi kas yang belum direkon");
              }}
              title="Klik untuk memfilter kas belum direkon"
            >
              Belum rekon {data?.kpis.unmatched ?? 0}
            </button>
            {locked ? ` · Buku ${lockMonth} dikunci` : ""}
            {extraFilterOn
              ? " · Saldo bawa dihitung dari seluruh buku, bukan filter kegiatan/sumber/rekon/arah."
              : ""}
          </p>

          {/* Interactive Charts & SWOT Analysis Panel */}
          <div className="pt-2">
            <KasChartSwotPanel
              rows={data?.rows ?? []}
              kpis={data?.kpis ?? { totalIn: 0, totalOut: 0, saldoAkhir: 0, opening: 0, unmatched: 0 }}
              periodCaption={periodCaption}
              scopeLabel={activeScopeLabel}
              onSwotCalculated={(swot, selectedList) => {
                setSwotData(swot);
                setChartSelectedKegiatan(selectedList);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-8 shrink-0 overflow-hidden rounded-md border text-xs">
                <button
                  type="button"
                  className={`px-2.5 font-medium ${
                    viewMode === "laporan"
                      ? "bg-inkai-red text-white"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setViewMode("laporan")}
                >
                  Laporan Detail
                </button>
                <button
                  type="button"
                  className={`border-l px-2.5 font-medium ${
                    viewMode === "buku"
                      ? "bg-inkai-red text-white"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setViewMode("buku")}
                >
                  Buku
                </button>
              </div>
              <Field label="Periode awal">
                <KasDateField allowEmpty value={fromYmd} onChange={setFromYmd} />
              </Field>
              <Field label="Periode akhir">
                <KasDateField allowEmpty value={toYmd} onChange={setToYmd} />
              </Field>
              {!isRanting && (data?.scopes?.length ?? 0) > 1 ? (
                <Field label="Buku kas">
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
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
                className="h-8 shrink-0 text-xs px-2.5 mt-auto"
                onClick={() => {
                  setFromYmd("");
                  setToYmd("");
                }}
              >
                Semua tanggal
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs px-2.5" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5 mr-1" />
                Cetak
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs px-2.5" onClick={exportExcel}>
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs px-2.5 border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30 font-medium"
                onClick={handleCopyWa}
              >
                <Share2 className="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                Salin WA
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs px-2.5 border-teal-600/40 text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/30 font-medium"
                onClick={() => setRecapDojoOpen(true)}
              >
                Rekap Per Ranting
              </Button>
              {data?.canWrite ? (
                <>
                  <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border px-2.5 text-xs hover:bg-accent">
                    <Upload className="h-3.5 w-3.5" />
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
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs px-2.5" onClick={openMassDialog}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Tambah massal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 bg-inkai-red text-xs px-3 hover:bg-inkai-red/90"
                    onClick={openAddDialog}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Tambah
                  </Button>
                </>
              ) : null}
              {data?.canLock ? (
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs px-2.5" onClick={() => void toggleLock()}>
                  {locked ? <Unlock className="h-3.5 w-3.5 mr-1" /> : <Lock className="h-3.5 w-3.5 mr-1" />}
                  {locked ? "Buka buku" : "Tutup buku"}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-8 shrink-0 rounded-md border bg-background px-2 text-xs"
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
              className="h-8 shrink-0 rounded-md border bg-background px-2 text-xs"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="all">Semua sumber</option>
              <option value="manual">Manual</option>
              <option value="iuran">Iuran</option>
              <option value="ukt">UKT</option>
              <option value="latber">Latber</option>
              <option value="event">Event / Kegiatan</option>
              <option value="kwitansi">Kwitansi</option>
            </select>
            <select
              className="h-8 shrink-0 rounded-md border bg-background px-2 text-xs"
              value={recon}
              onChange={(e) => setRecon(e.target.value)}
            >
              <option value="all">Rekon semua</option>
              <option value="open">Belum rekon</option>
              <option value="matched">Cocok rekening</option>
            </select>
            <select
              className="h-8 shrink-0 rounded-md border bg-background px-2 text-xs"
              value={direction}
              onChange={(e) => setDirection(e.target.value as "all" | "in" | "out")}
            >
              <option value="all">Semua arah mutasi</option>
              <option value="in">Masuk saja (+)</option>
              <option value="out">Keluar saja (-)</option>
            </select>
            {isFiltered ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 text-xs px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={resetAllFilters}
                title="Reset semua filter"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                Reset filter
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {viewMode === "laporan" ? (
        <div
          className={
            tableFullscreen
              ? "fixed inset-0 z-50 flex flex-col bg-background p-3 md:p-4"
              : "relative w-full"
          }
        >
          <div className={cn("rounded-lg border bg-card shadow-sm", tableFullscreen && "flex h-full min-h-0 flex-col overflow-hidden")}>
            <div className="shrink-0 border-b px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold tracking-wide md:text-lg">
                    LAPORAN KEUANGAN DETAIL
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {periodCaption}
                    {scopeKey
                      ? ` · ${(data?.scopes ?? []).find((s) => `${s.type}:${s.id}` === scopeKey)?.label ?? scopeLabel}`
                      : ` · ${scopeLabel}`}
                    {data?.canWrite
                      ? " · Klik sel untuk ubah"
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {tableFullscreen ? (
                    <KasFullscreenPeriodPrint
                      fromYmd={fromYmd}
                      toYmd={toYmd}
                      loading={loading}
                      onFromChange={setFromYmd}
                      onToChange={setToYmd}
                      onRefresh={() => void load()}
                      onPrint={handlePrint}
                    />
                  ) : null}
                  <div
                    className={`flex flex-col items-end rounded-md border-2 px-3 py-1 text-right text-xs md:text-sm font-bold ${
                      (data?.kpis.saldoAkhir ?? 0) < 0
                        ? "border-red-600 text-red-700 dark:text-red-400"
                        : "border-green-700 text-green-800 dark:text-green-400"
                    }`}
                  >
                    <div>Saldo akhir {formatRp(data?.kpis.saldoAkhir ?? 0)}</div>
                    {filteredLaporanRows.length === 0 && (fromYmd || toYmd) ? (
                      <div className="text-[10px] font-normal opacity-80">
                        (per {formatKasDateId(toYmd || fromYmd)})
                      </div>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 shrink-0"
                    aria-label={
                      tableFullscreen
                        ? "Keluar full halaman"
                        : "Perbesar tabel full halaman"
                    }
                    title={
                      tableFullscreen
                        ? "Keluar full halaman (Esc)"
                        : "Full halaman"
                    }
                    onClick={() => setTableFullscreen((v) => !v)}
                  >
                    {tableFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <datalist id="kas-kegiatan-inline">
              {(data?.kegiatanOptions ?? []).map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
            <div className={cn(tableFullscreen ? "min-h-0 flex-1 overflow-auto" : "overflow-x-auto border-t")}>
              <table className="w-full min-w-[880px] border-collapse text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 border-b bg-muted/95 text-left text-muted-foreground backdrop-blur">
                    {data?.canWrite ? (
                      <th className="w-8 p-2 text-center" title="Geser baris untuk mengubah urutan (Drag & Drop)"></th>
                    ) : null}
                    {data?.canWrite ? (
                      <th className="w-10 p-2 text-center">
                        <input
                          type="checkbox"
                          checked={allLaporanSelected}
                          disabled={visibleSelectableLaporanIds.length === 0}
                          aria-label="Pilih semua baris"
                          onChange={toggleSelectAllLaporan}
                        />
                      </th>
                    ) : null}
                    <th className="w-12 p-2 text-center">No</th>
                    <th className="p-2">Tanggal</th>
                    <th className="p-2">Keterangan</th>
                    <th className="p-2 text-right">Masuk</th>
                    <th className="p-2 text-right">Keluar</th>
                    <th className="p-2 text-right">Saldo</th>
                    <th className="p-2">Kegiatan</th>
                    {data?.canWrite ? <th className="w-12 p-2 text-center">Aksi</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={data?.canWrite ? 10 : 8} className="p-6 text-center text-muted-foreground">
                        Memuat…
                      </td>
                    </tr>
                  ) : filteredLaporanRows.length === 0 ? (
                    <tr>
                      <td colSpan={data?.canWrite ? 10 : 8} className="p-6 text-center text-muted-foreground">
                        <div className="space-y-1.5">
                          <p className="font-medium text-foreground">
                            {isFiltered
                              ? "Tidak ada mutasi yang cocok dengan filter yang dipilih."
                              : "Belum ada mutasi pada periode ini."}
                          </p>
                          {data?.kpis?.saldoAkhir !== undefined && (fromYmd || toYmd) ? (
                            <p className="text-xs text-muted-foreground">
                              Saldo kas berjalan per{" "}
                              <span className="font-semibold text-foreground">
                                {formatKasDateId(toYmd || fromYmd)}
                              </span>{" "}
                              tercatat sebesar{" "}
                              <span className="font-semibold text-foreground">
                                {formatRp(data.kpis.saldoAkhir)}
                              </span>{" "}
                              (akumulasi transaksi sebelumnya, tanpa mutasi baru pada rentang filter ini).
                            </p>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLaporanRows.map((row) => {
                      const editable = canInlineEdit(row);
                      const isDeletable = !monthLocked(row.txnDate);
                      const isSelected = selectedIds.includes(row.id);
                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            "group border-b hover:bg-muted/20 transition-colors",
                            isSelected && "bg-muted/40 font-medium",
                            draggedItem?.type === "entry" && draggedItem.key === row.id && "opacity-40 bg-muted/40",
                            dragOverKey === row.id && "border-t-2 border-primary bg-primary/5",
                          )}
                          draggable={Boolean(data?.canWrite && !monthLocked(row.txnDate))}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("application/json", JSON.stringify({ type: "entry", key: row.id }));
                            e.dataTransfer.effectAllowed = "move";
                            setDraggedItem({ type: "entry", key: row.id });
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (dragOverKey !== row.id) {
                              setDragOverKey(row.id);
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverKey === row.id) {
                              setDragOverKey(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverKey(null);
                            let payload = draggedItem;
                            try {
                              const raw = e.dataTransfer.getData("application/json");
                              if (raw) payload = JSON.parse(raw);
                            } catch {}
                            setDraggedItem(null);
                            if (payload) void handleDropReorder(payload, { type: "entry", key: row.id });
                          }}
                          onDragEnd={() => {
                            setDraggedItem(null);
                            setDragOverKey(null);
                          }}
                        >
                          {data?.canWrite ? (
                            <td className="w-8 p-2 text-center text-muted-foreground cursor-grab active:cursor-grabbing hover:text-foreground">
                              <span title="Geser baris (Drag & Drop)">
                                <GripVertical className="h-4 w-4 inline-block text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
                              </span>
                            </td>
                          ) : null}
                          {data?.canWrite ? (
                            <td className="p-2 text-center">
                              {isDeletable ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  aria-label={`Pilih baris ${row.no}`}
                                  onChange={() => toggleSelectId(row.id)}
                                />
                              ) : null}
                            </td>
                          ) : null}
                          <td className="p-2 text-center tabular-nums">{row.no}</td>
                          <KasInlineCell
                            editable={editable}
                            kind="date"
                            display={formatKasDateId(row.txnDate)}
                            initialValue={row.txnDate}
                            className="whitespace-nowrap"
                            onCommit={(next) =>
                              handleInlinePatch(row, { txnDate: next })
                            }
                          />
                          <KasInlineCell
                            editable={editable}
                            kind="text"
                            display={
                              <div>
                                <div>{row.description}</div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px]">
                                  {row.sourceHref ? (
                                    <Link
                                      href={row.sourceHref}
                                      className="inline-flex items-center gap-0.5 font-semibold text-inkai-red hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span>{row.sourceType}</span>
                                    </Link>
                                  ) : (
                                    <span
                                      className={cn(
                                        "rounded px-1 py-0.2 font-medium text-[10px]",
                                        row.sourceType === "manual"
                                          ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                          : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                      )}
                                    >
                                      {row.sourceType === "manual" ? "manual" : `otomatis: ${row.sourceType}`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            }
                            initialValue={row.description}
                            onCommit={(next) =>
                              handleInlinePatch(row, { description: next })
                            }
                          />
                          <KasInlineCell
                            editable={editable}
                            kind="money"
                            align="right"
                            display={row.amountIn ? formatRp(row.amountIn) : "—"}
                            initialValue={row.amountIn ? String(row.amountIn) : ""}
                            onCommit={async (next) => {
                              if (!next) {
                                if (row.amountOut > 0) return true;
                                toast.error("Isi Masuk atau Keluar");
                                return false;
                              }
                              return handleInlinePatch(row, {
                                direction: "in",
                                amount: Number(next),
                              });
                            }}
                          />
                          <KasInlineCell
                            editable={editable}
                            kind="money"
                            align="right"
                            display={row.amountOut ? formatRp(row.amountOut) : "—"}
                            initialValue={row.amountOut ? String(row.amountOut) : ""}
                            onCommit={async (next) => {
                              if (!next) {
                                if (row.amountIn > 0) return true;
                                toast.error("Isi Masuk atau Keluar");
                                return false;
                              }
                              return handleInlinePatch(row, {
                                direction: "out",
                                amount: Number(next),
                              });
                            }}
                          />
                          <td className="p-2 text-right tabular-nums">
                            {formatRp(row.saldo)}
                          </td>
                          <KasInlineCell
                            editable={editable}
                            kind="text"
                            listId="kas-kegiatan-inline"
                            display={row.kegiatan || "—"}
                            initialValue={row.kegiatan}
                            onCommit={(next) =>
                              handleInlinePatch(row, { kegiatan: next })
                            }
                          />
                          {data?.canWrite ? (
                            <td className="p-1 text-center">
                              {isDeletable ? (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                  aria-label="Hapus"
                                  title="Hapus baris transaksi kas"
                                  onClick={() => setDeleteId(row.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {data?.canWrite && selectedIds.length > 0 ? (
            <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 print:hidden">
              <div className="pointer-events-auto inline-flex max-w-[min(100vw-1.5rem,56rem)] flex-wrap items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background/95 p-2 px-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3">
                <div className="flex items-center gap-1.5 rounded-md bg-muted/70 px-2.5 py-1 text-xs font-semibold text-foreground">
                  <span>{selectedSubtotals.count} dipilih</span>
                  <span className="text-muted-foreground">•</span>
                  <span
                    className={
                      selectedSubtotals.net >= 0
                        ? "text-emerald-600 dark:text-emerald-400 font-bold"
                        : "text-rose-600 dark:text-rose-400 font-bold"
                    }
                    title={`Total Masuk: ${formatRp(selectedSubtotals.totalIn)} | Total Keluar: ${formatRp(selectedSubtotals.totalOut)}`}
                  >
                    Net: {selectedSubtotals.net >= 0 ? "+" : ""}{formatRp(selectedSubtotals.net)}
                  </span>
                </div>

                <Button
                  type="button"
                  size="sm"
                  className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 text-xs font-semibold shadow-2xs"
                  onClick={() => handleBatchRecon("matched")}
                  title="Tandai seluruh transaksi terpilih sebagai 'Cocok rekening'"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Cocok rekening ({selectedIds.length})
                </Button>

                {selectedSubtotals.matchedCount > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-amber-600/50 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30 px-2 text-xs font-medium"
                    onClick={() => handleBatchRecon("open")}
                    title="Kembalikan transaksi terpilih menjadi 'Belum rekon'"
                  >
                    <Unlock className="h-3.5 w-3.5 mr-1 text-amber-600 dark:text-amber-400" />
                    Buka rekon ({selectedSubtotals.matchedCount})
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30 px-2 text-xs font-medium"
                  onClick={handleCopyWaSelected}
                  title="Salin rincian transaksi terpilih ke WhatsApp"
                >
                  <Share2 className="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                  Salin WA
                </Button>

                {data?.canWrite ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-blue-600/40 text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/30 px-2 text-xs font-medium"
                    onClick={() => setBatchKegiatanOpen(true)}
                    title="Gabungkan / Set Kategori Kegiatan untuk transaksi terpilih"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1 text-blue-600 dark:text-blue-400" />
                    Kelompokkan kegiatan ({selectedIds.length})
                  </Button>
                ) : null}

                {data?.canTransfer && !isRanting ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-amber-600/40 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30 px-2 text-xs font-medium"
                    onClick={openBatchTransfer}
                  >
                    Pindah lokasi
                  </Button>
                ) : null}

                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-7 bg-inkai-red text-white hover:bg-inkai-red/90 px-2.5 text-xs font-medium"
                  onClick={() => setBatchDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1 text-white" />
                  Hapus ({selectedIds.length})
                </Button>

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
      ) : (
      <div
        className={
          tableFullscreen
            ? "fixed inset-0 z-50 flex flex-col bg-background p-3 md:p-4"
            : "relative w-full"
        }
      >
        <div className={cn("rounded-lg border bg-card shadow-sm", tableFullscreen && "flex h-full min-h-0 flex-col overflow-hidden")}>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-b px-3 py-2">
            {tableFullscreen ? (
              <KasFullscreenPeriodPrint
                fromYmd={fromYmd}
                toYmd={toYmd}
                loading={loading}
                onFromChange={setFromYmd}
                onToChange={setToYmd}
                onRefresh={() => void load()}
                onPrint={handlePrint}
              />
            ) : null}
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              aria-label={
                tableFullscreen
                  ? "Keluar full halaman"
                  : "Perbesar tabel full halaman"
              }
              title={
                tableFullscreen ? "Keluar full halaman (Esc)" : "Full halaman"
              }
              onClick={() => setTableFullscreen((v) => !v)}
            >
              {tableFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className={cn(tableFullscreen ? "min-h-0 flex-1 overflow-auto" : "overflow-x-auto border-t")}>
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b bg-muted/95 text-left text-muted-foreground backdrop-blur">
                {data?.canWrite ? (
                  <th className="w-8 p-3 text-center" title="Geser baris untuk mengubah urutan (Drag & Drop)"></th>
                ) : null}
                {canSelect ? (
                  <th className="w-10 p-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={visibleSelectableIds.length === 0}
                      aria-label="Pilih semua baris tampil"
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
                <td colSpan={colSpan + (data?.canWrite ? 1 : 0)} className="p-6 text-center text-muted-foreground">
                  Memuat…
                </td>
              </tr>
            ) : groups.length === 0 ? (
              <tr>
                <td colSpan={colSpan + (data?.canWrite ? 1 : 0)} className="p-6 text-center text-muted-foreground">
                  <div className="space-y-1.5">
                    <p className="font-medium text-foreground">
                      Belum ada mutasi pada periode ini.
                    </p>
                    <p className="text-xs">
                      {isRanting
                        ? "Ranting melihat iuran lunas di ranting, Komisi UKT ranting (Rp 50.000/peserta), dan CASHBACK Latber (Rp 5.000/peserta). "
                        : ""}
                      Gunakan Tambah, Tambah massal, atau tunggu verifikasi. Isi Saldo awal sekali jika pindah dari Excel.
                    </p>
                    {data?.kpis?.saldoAkhir !== undefined && (fromYmd || toYmd) ? (
                      <p className="text-xs text-muted-foreground">
                        Saldo kas berjalan per{" "}
                        <span className="font-semibold text-foreground">
                          {formatKasDateId(toYmd || fromYmd)}
                        </span>{" "}
                        tercatat sebesar{" "}
                        <span className="font-semibold text-foreground">
                          {formatRp(data.kpis.saldoAkhir)}
                        </span>{" "}
                        (akumulasi saldo dari periode sebelumnya).
                      </p>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              groups.map((row, idx) =>
                row.kind === "group" ? (
                  <tr
                    key={`g-${row.kegiatan}-${idx}`}
                    className={cn(
                      "bg-muted/50 font-medium transition-colors",
                      draggedItem?.type === "group" && draggedItem.key === row.kegiatan && "opacity-40 bg-muted/40",
                      dragOverKey === `g-${row.kegiatan}` && "border-t-2 border-primary bg-primary/5",
                    )}
                    draggable={Boolean(data?.canWrite)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/json", JSON.stringify({ type: "group", key: row.kegiatan }));
                      e.dataTransfer.effectAllowed = "move";
                      setDraggedItem({ type: "group", key: row.kegiatan });
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      const key = `g-${row.kegiatan}`;
                      if (dragOverKey !== key) {
                        setDragOverKey(key);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverKey === `g-${row.kegiatan}`) {
                        setDragOverKey(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverKey(null);
                      let payload = draggedItem;
                      try {
                        const raw = e.dataTransfer.getData("application/json");
                        if (raw) payload = JSON.parse(raw);
                      } catch {}
                      setDraggedItem(null);
                      if (payload) void handleDropReorder(payload, { type: "group", key: row.kegiatan });
                    }}
                    onDragEnd={() => {
                      setDraggedItem(null);
                      setDragOverKey(null);
                    }}
                  >
                    {data?.canWrite ? (
                      <td className="w-8 p-3 text-center text-muted-foreground cursor-grab active:cursor-grabbing hover:text-foreground">
                        <span title="Geser grup kegiatan ini (Drag & Drop)">
                          <GripVertical className="h-4 w-4 inline-block text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
                        </span>
                      </td>
                    ) : null}
                    <td colSpan={canSelect ? 4 : 3} className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-left font-semibold text-foreground hover:text-primary transition-colors"
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
                        {row.count ? (
                          <span className="inline-flex items-center rounded-full bg-slate-200/90 dark:bg-slate-700/90 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 shadow-xs">
                            {row.count} item
                          </span>
                        ) : null}
                        {(() => {
                          const netKegiatan = row.totalIn - row.totalOut;
                          if (netKegiatan === 0) return null;
                          const isSurplus = netKegiatan >= 0;
                          return (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-xs border",
                                isSurplus
                                  ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-300/60 dark:border-emerald-800"
                                  : "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border-amber-300/60 dark:border-amber-800",
                              )}
                              title={`Net Pemasukan/Pengeluaran bersih kegiatan "${row.kegiatan}": Total Masuk (${formatRp(row.totalIn)}) - Total Keluar (${formatRp(row.totalOut)})`}
                            >
                              {isSurplus ? `Net Kegiatan: +${formatRp(netKegiatan)}` : `Net Kegiatan: -${formatRp(Math.abs(netKegiatan))}`}
                            </span>
                          );
                        })()}
                        {data?.canWrite ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Ubah nama kategori kegiatan ini"
                            onClick={() => openRenameKegiatan(row.kegiatan)}
                          >
                            <Pencil className="h-3 w-3 mr-1 text-slate-500 dark:text-slate-400" />
                            Ubah nama
                          </Button>
                        ) : null}
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
                        {data?.canWrite ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/50"
                            title={`Hapus kegiatan "${row.kegiatan}" beserta seluruh ${row.count} item di dalamnya`}
                            onClick={() =>
                              openDeleteKegiatan(
                                row.kegiatan,
                                row.count ?? 0,
                                row.totalIn,
                                row.totalOut,
                              )
                            }
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Hapus kegiatan
                          </Button>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3 text-right">{formatRp(row.totalIn)}</td>
                    <td className="p-3 text-right">{formatRp(row.totalOut)}</td>
                    <td className="p-3 text-right font-medium tabular-nums">
                      {row.lastSaldo !== undefined ? formatRp(row.lastSaldo) : "—"}
                    </td>
                    <td colSpan={2} />
                  </tr>
                ) : (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b transition-colors",
                      draggedItem?.type === "entry" && draggedItem.key === row.id && "opacity-40 bg-muted/40",
                      dragOverKey === row.id && "border-t-2 border-primary bg-primary/5",
                    )}
                    draggable={Boolean(data?.canWrite && !monthLocked(row.txnDate))}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/json", JSON.stringify({ type: "entry", key: row.id }));
                      e.dataTransfer.effectAllowed = "move";
                      setDraggedItem({ type: "entry", key: row.id });
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverKey !== row.id) {
                        setDragOverKey(row.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverKey === row.id) {
                        setDragOverKey(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverKey(null);
                      let payload = draggedItem;
                      try {
                        const raw = e.dataTransfer.getData("application/json");
                        if (raw) payload = JSON.parse(raw);
                      } catch {}
                      setDraggedItem(null);
                      if (payload) void handleDropReorder(payload, { type: "entry", key: row.id });
                    }}
                    onDragEnd={() => {
                      setDraggedItem(null);
                      setDragOverKey(null);
                    }}
                  >
                    {data?.canWrite ? (
                      <td className="w-8 p-3 text-center text-muted-foreground cursor-grab active:cursor-grabbing hover:text-foreground">
                        <span title="Geser baris (Drag & Drop)">
                          <GripVertical className="h-4 w-4 inline-block text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
                        </span>
                      </td>
                    ) : null}
                    {canSelect ? (
                      <td className="p-3">
                        {!monthLocked(row.txnDate) ? (
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
                        {data?.canWrite && !monthLocked(row.txnDate) ? (
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
                              className="h-8 w-8 text-destructive hover:text-destructive"
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
        </div>
        {canSelect && selectedIds.length > 0 ? (
          <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 print:hidden">
            <div className="pointer-events-auto inline-flex max-w-[min(100vw-1.5rem,56rem)] flex-wrap items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background/95 p-2 px-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3">
              <div className="flex items-center gap-1.5 rounded-md bg-muted/70 px-2.5 py-1 text-xs font-semibold text-foreground">
                <span>{selectedSubtotals.count} dipilih</span>
                <span className="text-muted-foreground">•</span>
                <span
                  className={
                    selectedSubtotals.net >= 0
                      ? "text-emerald-600 dark:text-emerald-400 font-bold"
                      : "text-rose-600 dark:text-rose-400 font-bold"
                  }
                  title={`Total Masuk: ${formatRp(selectedSubtotals.totalIn)} | Total Keluar: ${formatRp(selectedSubtotals.totalOut)}`}
                >
                  Net: {selectedSubtotals.net >= 0 ? "+" : ""}{formatRp(selectedSubtotals.net)}
                </span>
              </div>

              <Button
                type="button"
                size="sm"
                className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 text-xs font-semibold shadow-2xs"
                onClick={() => handleBatchRecon("matched")}
                title="Tandai seluruh transaksi terpilih sebagai 'Cocok rekening'"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Cocok rekening ({selectedIds.length})
              </Button>

              {selectedSubtotals.matchedCount > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 border-amber-600/50 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30 px-2 text-xs font-medium"
                  onClick={() => handleBatchRecon("open")}
                  title="Kembalikan transaksi terpilih menjadi 'Belum rekon'"
                >
                  <Unlock className="h-3.5 w-3.5 mr-1 text-amber-600 dark:text-amber-400" />
                  Buka rekon ({selectedSubtotals.matchedCount})
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30 px-2 text-xs font-medium"
                onClick={handleCopyWaSelected}
                title="Salin rincian transaksi terpilih ke WhatsApp"
              >
                <Share2 className="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                Salin WA
              </Button>

              {data?.canWrite ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 border-blue-600/40 text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/30 px-2 text-xs font-medium"
                  onClick={() => setBatchKegiatanOpen(true)}
                  title="Gabungkan / Set Kategori Kegiatan untuk transaksi terpilih"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1 text-blue-600 dark:text-blue-400" />
                  Kelompokkan kegiatan ({selectedIds.length})
                </Button>
              ) : null}

              {data?.canTransfer && !isRanting ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 border-amber-600/40 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30 px-2 text-xs font-medium"
                  onClick={openBatchTransfer}
                >
                  Pindah lokasi
                </Button>
              ) : null}

              {data?.canWrite ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 bg-inkai-red text-white hover:bg-inkai-red/90 px-2.5 text-xs font-medium"
                  onClick={() => setBatchDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1 text-white" />
                  Hapus ({selectedIds.length})
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
      )}

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
            {!editId && dojoSummaries.length > 0 ? (
              <div className="sm:col-span-2 rounded-lg border border-teal-300/80 bg-teal-50/70 p-2.5 dark:border-teal-800/80 dark:bg-teal-950/40">
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                  <span className="text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1">
                    ⚡ Ambil dari Total Tagihan / Setoran Ranting
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Pilih untuk auto-fill form
                  </span>
                </div>
                <select
                  className="h-9 w-full rounded-md border border-teal-300 bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-teal-700"
                  defaultValue=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    const [dojoName, type, amountStr] = val.split("::");
                    const amount = Number(amountStr) || 0;
                    let desc = `Setoran Ranting ${dojoName}`;
                    if (type === "ukt") desc = `Setoran UKT Ranting ${dojoName}`;
                    else if (type === "latber") desc = `Setoran Latber Ranting ${dojoName}`;
                    else if (type === "iuran") desc = `Setoran Iuran Ranting ${dojoName}`;

                    setForm({
                      txnDate: form.txnDate || ymdWib(),
                      direction: "in",
                      description: desc,
                      kegiatan: dojoName,
                      amount: amount > 0 ? String(amount) : "",
                    });
                    toast.success(`Form terisi dari total tagihan ${dojoName} (${formatRp(amount)})`);
                    e.target.value = "";
                  }}
                >
                  <option value="">-- Pilih Ranting / Event untuk Auto-Fill Nominal Tagihan --</option>
                  {dojoSummaries.map((d) => (
                    <optgroup key={d.dojoName} label={`Ranting ${d.dojoName}`}>
                      {d.totalMasuk > 0 ? (
                        <option value={`${d.dojoName}::total::${d.totalMasuk}`}>
                          {d.dojoName} — Total Setoran: {formatRp(d.totalMasuk)}
                        </option>
                      ) : null}
                      {d.totalUkt > 0 ? (
                        <option value={`${d.dojoName}::ukt::${d.totalUkt}`}>
                          {d.dojoName} — Setoran UKT (Lunas): {formatRp(d.totalUkt)}
                        </option>
                      ) : null}
                      {d.totalLatber > 0 ? (
                        <option value={`${d.dojoName}::latber::${d.totalLatber}`}>
                          {d.dojoName} — Setoran Latber (Lunas): {formatRp(d.totalLatber)}
                        </option>
                      ) : null}
                      {d.totalIuran > 0 ? (
                        <option value={`${d.dojoName}::iuran::${d.totalIuran}`}>
                          {d.dojoName} — Setoran Iuran (Lunas): {formatRp(d.totalIuran)}
                        </option>
                      ) : null}
                      {d.totalMasuk === 0 && d.totalUkt === 0 && d.totalLatber === 0 ? (
                        <option value={`${d.dojoName}::total::0`}>
                          {d.dojoName} — Belum ada setoran lunas (Rp 0)
                        </option>
                      ) : null}
                    </optgroup>
                  ))}
                </select>
              </div>
            ) : null}
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
              Memindahkan {selectedIds.length} baris ke buku tujuan.
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
                Memindahkan {countRowsForKegiatan(transferKegiatan)} baris
                kegiatan {transferKegiatan}.
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

      <Dialog open={recapDojoOpen} onOpenChange={setRecapDojoOpen}>
        <DialogContent className="w-[95vw] sm:max-w-5xl md:max-w-6xl max-h-[90vh] flex flex-col p-4 sm:p-6 gap-3 overflow-hidden">
          <DialogHeader className="shrink-0 pr-6">
            <DialogTitle className="text-base font-bold sm:text-lg flex flex-wrap items-center justify-between gap-2">
              <span>Rekapitulasi Setoran Masuk Per Ranting</span>
              <span className="text-xs font-normal text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                Transaksi Kas Lunas / Terverifikasi
              </span>
            </DialogTitle>
            {uktDepositPeriod ? (
              <p className="text-xs text-muted-foreground">
                Status setor UKT merujuk{" "}
                <span className="font-medium text-foreground">
                  {uktDepositPeriod.title}
                </span>
                {uktDepositAmbiguous
                  ? " (rentang tanggal lintas semester — memakai tengah periode)"
                  : ""}
                {uktDepositUrl ? (
                  <>
                    {" · "}
                    <Link
                      href={uktDepositUrl}
                      className="text-inkai-red underline-offset-2 hover:underline"
                    >
                      Buka UKT
                    </Link>
                  </>
                ) : null}
                {uktDepositLoading ? " · memuat status…" : null}
              </p>
            ) : uktDepositLoadError ? (
              <p className="text-xs text-amber-700">
                Status setor UKT tidak tersedia.
              </p>
            ) : null}
          </DialogHeader>
          <div className="flex flex-col min-h-0 flex-1 gap-3 overflow-hidden">
            {/* KPI Summary Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs shrink-0">
              <div className="rounded-lg border bg-muted/40 p-2.5">
                <span className="text-muted-foreground block text-[11px]">Ranting Mengikuti</span>
                <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {officialDojoCount} Ranting
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  ({dojoSummaries.filter(d => d.totalUkt > 0).length} UKT, {dojoSummaries.filter(d => d.totalLatber > 0).length} Latber)
                </span>
              </div>
              <div className="rounded-lg border bg-muted/40 p-2.5">
                <span className="text-muted-foreground block text-[11px]">Setoran UKT (Lunas)</span>
                <span className="text-base font-bold text-teal-700 dark:text-teal-400">
                  {formatRp(grandUkt)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  CASHBACK: {formatRp(grandKomisiUkt)}
                </span>
              </div>
              <div className="rounded-lg border bg-muted/40 p-2.5">
                <span className="text-muted-foreground block text-[11px]">Setoran Latber (Lunas)</span>
                <span className="text-base font-bold text-teal-700 dark:text-teal-400">
                  {formatRp(grandLatber)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  CASHBACK: {formatRp(grandKomisiLatber)}
                </span>
              </div>
              <div className="rounded-lg border bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 p-2.5">
                <span className="text-teal-700 dark:text-teal-300 block text-[11px] font-medium">Setoran Masuk Net Cabang</span>
                <span className="text-base font-extrabold text-teal-900 dark:text-teal-100">
                  {formatRp(grandNetCabang)}
                </span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 block">
                  (Setoran Kotor − CASHBACK)
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
              <p className="text-xs text-muted-foreground">
                Periode: {periodCaption} · Total {officialDojoCount} Ranting Mengikuti
              </p>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  placeholder="🔍 Cari ranting..."
                  value={recapSearchQuery}
                  onChange={(e) => setRecapSearchQuery(e.target.value)}
                  className="h-8 text-xs w-full sm:w-48"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-md border">
              <table className="w-full text-left text-xs sm:text-sm min-w-[860px]">
                <thead className="sticky top-0 z-10 border-b bg-muted font-medium text-muted-foreground">
                  <tr>
                    <th className="p-2 sm:p-2.5 w-12">No</th>
                    <th className="p-2 sm:p-2.5 min-w-[200px]">Ranting / Dojo</th>
                    <th className="p-2 sm:p-2.5 text-right">UKT (Lunas)</th>
                    <th className="p-2 sm:p-2.5 text-right">CASHBACK UKT</th>
                    <th className="p-2 sm:p-2.5 text-right">Latber (Lunas)</th>
                    <th className="p-2 sm:p-2.5 text-right">CASHBACK Latber</th>
                    <th className="p-2 sm:p-2.5 text-right font-bold">Total Masuk</th>
                    <th className="p-2 sm:p-2.5 whitespace-nowrap">Status setor UKT</th>
                    <th className="p-2 sm:p-2.5 text-center whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredDojoSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-4 text-center text-muted-foreground">
                        {recapSearchQuery ? "Ranting tidak ditemukan." : "Tidak ada transaksi kas masuk pada periode ini."}
                      </td>
                    </tr>
                  ) : (
                    filteredDojoSummaries.map((item, idx) => (
                      <tr
                        key={item.dojoName}
                        className="hover:bg-muted/50 cursor-pointer transition-colors"
                        title={`Klik untuk memfilter transaksi ${item.dojoName}`}
                        onClick={() => {
                          setKegiatan(item.dojoName);
                          setRecapDojoOpen(false);
                          toast.info(`Memfilter kas untuk ranting: ${item.dojoName}`);
                        }}
                      >
                        <td className="p-2 sm:p-2.5 text-muted-foreground">{idx + 1}</td>
                        <td className="p-2 sm:p-2.5 font-semibold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{item.dojoName}</span>
                            {item.totalUkt > 0 && item.totalLatber > 0 ? (
                              <span className="rounded bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 px-1.5 py-0.5 text-[10px] font-medium">
                                UKT + Latber
                              </span>
                            ) : item.totalUkt > 0 ? (
                              <span className="rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 text-[10px] font-medium">
                                UKT
                              </span>
                            ) : (
                              <span className="rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 text-[10px] font-medium">
                                Latber
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 sm:p-2.5 text-right whitespace-nowrap">
                          {item.totalUkt > 0 ? formatRp(item.totalUkt) : "-"}
                        </td>
                        <td className="p-2 sm:p-2.5 text-right whitespace-nowrap">
                          {item.totalKomisiUkt > 0 ? formatRp(item.totalKomisiUkt) : "-"}
                        </td>
                        <td className="p-2 sm:p-2.5 text-right whitespace-nowrap">
                          {item.totalLatber > 0 ? formatRp(item.totalLatber) : "-"}
                        </td>
                        <td className="p-2 sm:p-2.5 text-right whitespace-nowrap">
                          {item.totalKomisiLatber > 0 ? formatRp(item.totalKomisiLatber) : "-"}
                        </td>
                        <td className="p-2 sm:p-2.5 text-right font-bold text-teal-800 dark:text-teal-300 whitespace-nowrap">
                          {formatRp(item.totalMasuk)}
                        </td>
                        <td className="p-2 sm:p-2.5 whitespace-nowrap">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-medium",
                              item.uktDepositLabel === "Setoran diterima"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                                : item.uktDepositLabel === "Belum setor"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {item.uktDepositLabel || "—"}
                          </span>
                        </td>
                        <td className="p-2 sm:p-2.5 text-center whitespace-nowrap">
                          {data?.canWrite ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px] border-teal-600/40 text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/40 font-medium px-2"
                              title="Ambil nominal setoran tagihan & masukan ke Kas"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRecapDojoOpen(false);
                                setPostScopeKey(scopeKey || `${data?.scope.type}:${data?.scope.id}`);
                                setEditId(null);
                                setForm({
                                  txnDate: ymdWib(),
                                  direction: "in",
                                  description: `Setoran Ranting ${item.dojoName}`,
                                  kegiatan: item.dojoName,
                                  amount: item.totalMasuk > 0 ? String(item.totalMasuk) : "",
                                });
                                setAddOpen(true);
                                toast.success(`Form Tambah Mutasi terisi dari setoran ${item.dojoName}`);
                              }}
                            >
                              ⚡ Ambil ke Kas
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {dojoSummaries.length > 0 ? (
                  <tfoot className="sticky bottom-0 z-10 border-t bg-muted/95 font-bold">
                    <tr>
                      <td colSpan={2} className="p-2 sm:p-2.5 text-right">
                        TOTAL KESELURUHAN (LUNAS):
                      </td>
                      <td className="p-2 sm:p-2.5 text-right text-teal-800 dark:text-teal-300 whitespace-nowrap">
                        {formatRp(grandUkt)}
                      </td>
                      <td className="p-2 sm:p-2.5 text-right text-teal-800 dark:text-teal-300 whitespace-nowrap">
                        {formatRp(grandKomisiUkt)}
                      </td>
                      <td className="p-2 sm:p-2.5 text-right text-teal-800 dark:text-teal-300 whitespace-nowrap">
                        {formatRp(grandLatber)}
                      </td>
                      <td className="p-2 sm:p-2.5 text-right text-teal-800 dark:text-teal-300 whitespace-nowrap">
                        {formatRp(grandKomisiLatber)}
                      </td>
                      <td className="p-2 sm:p-2.5 text-right text-sm sm:text-base text-teal-900 dark:text-teal-200 whitespace-nowrap">
                        {formatRp(grandTotal)}
                      </td>
                      <td className="p-2 sm:p-2.5" />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t flex flex-row justify-between gap-2 sm:justify-between items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const text = formatRecapDojoTextForWa(dojoSummaries, periodCaption, formatRp);
                navigator.clipboard.writeText(text);
                toast.success("Rekap ranting berhasil disalin dengan format WA!");
              }}
            >
              Salin Teks (WA)
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setRecapDojoOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InkaiConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
        title="Hapus baris transaksi kas?"
        description="Baris transaksi kas terpilih akan dihapus permanen dari buku ini:"
        confirmLabel="Hapus"
        onConfirm={() => void handleDelete()}
      >
        {singleDeleteRow ? (
          <div className="rounded-md border bg-muted/40 p-2.5 text-xs">
            <p className="font-semibold text-foreground">{singleDeleteRow.description}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {formatKasDateId(singleDeleteRow.txnDate)} · {singleDeleteRow.kegiatan || singleDeleteRow.sourceType}
            </p>
            <p className={`font-bold mt-1 text-xs ${singleDeleteRow.amountIn ? "text-teal-700 dark:text-teal-400" : "text-inkai-red"}`}>
              {singleDeleteRow.amountIn ? `+${formatRp(singleDeleteRow.amountIn)}` : `-${formatRp(singleDeleteRow.amountOut)}`}
            </p>
          </div>
        ) : null}
      </InkaiConfirmDialog>

      <InkaiConfirmDialog
        open={batchDeleteOpen}
        onOpenChange={(o) => {
          if (!o) setBatchDeleteOpen(false);
        }}
        title={`Hapus ${selectedIds.length} baris transaksi kas terpilih?`}
        description={`Sebanyak ${selectedIds.length} baris transaksi kas terpilih akan dihapus permanen dari buku ini:`}
        confirmLabel="Hapus"
        onConfirm={() => void handleBatchDelete()}
      >
        <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/40 p-2 text-xs space-y-1.5">
          {selectedRows.slice(0, 15).map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-2 border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate">{r.description}</p>
                <p className="text-[10px] text-muted-foreground">{formatKasDateId(r.txnDate)} · {r.kegiatan || r.sourceType}</p>
              </div>
              <span className={`font-bold shrink-0 text-xs ${r.amountIn ? "text-teal-700 dark:text-teal-400" : "text-inkai-red"}`}>
                {r.amountIn ? `+${formatRp(r.amountIn)}` : `-${formatRp(r.amountOut)}`}
              </span>
            </div>
          ))}
          {selectedRows.length > 15 ? (
            <p className="text-[11px] text-muted-foreground text-center pt-1 italic font-medium">
              ...dan {selectedRows.length - 15} transaksi lainnya
            </p>
          ) : null}
        </div>
      </InkaiConfirmDialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Pencil className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Ubah Nama Kategori / Kegiatan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Seluruh baris transaksi di dalam kategori <strong className="text-foreground">{renameOldKegiatan}</strong> akan diperbarui dengan nama kategori baru ini.
            </p>
            <div className="space-y-1">
              <Label htmlFor="rename-new-kegiatan" className="text-xs font-medium">
                Nama Kategori / Kegiatan Baru
              </Label>
              <Input
                id="rename-new-kegiatan"
                value={renameNewKegiatan}
                placeholder="Misal: Bayar Latber Persiapan UKT"
                className="h-9 text-sm"
                onChange={(e) => setRenameNewKegiatan(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleRenameKegiatan();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRenameOpen(false)}
              disabled={renameLoading}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              onClick={() => void handleRenameKegiatan()}
              disabled={renameLoading || !renameNewKegiatan.trim()}
            >
              {renameLoading ? "Menyimpan…" : "Simpan Nama Baru"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchKegiatanOpen} onOpenChange={setBatchKegiatanOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Pencil className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Gabungkan / Set Kategori ({selectedIds.length} Baris)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Sebanyak <strong className="text-foreground">{selectedIds.length} baris transaksi</strong> yang Anda centang akan digabungkan ke dalam nama kategori / kegiatan di bawah ini:
            </p>
            <div className="space-y-1">
              <Label htmlFor="batch-kegiatan-name" className="text-xs font-medium">
                Nama Kategori / Kegiatan Baru
              </Label>
              <Input
                id="batch-kegiatan-name"
                value={batchKegiatanName}
                placeholder="Misal: DONASI SS LINDA"
                className="h-9 text-sm"
                onChange={(e) => setBatchKegiatanName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleBatchKegiatan();
                  }
                }}
              />
            </div>
            {data?.kegiatanOptions && data.kegiatanOptions.length > 0 ? (
              <div className="space-y-1 pt-1">
                <Label className="text-[11px] text-muted-foreground">Atau pilih dari kegiatan existing:</Label>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {data.kegiatanOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className="rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 transition-colors"
                      onClick={() => setBatchKegiatanName(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBatchKegiatanOpen(false)}
              disabled={batchKegiatanLoading}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
              onClick={() => void handleBatchKegiatan()}
              disabled={batchKegiatanLoading || !batchKegiatanName.trim()}
            >
              {batchKegiatanLoading ? "Menyimpan…" : `Gabungkan (${selectedIds.length} Baris)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteKegiatanOpen} onOpenChange={setDeleteKegiatanOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-red-600 dark:text-red-400">
              <Trash2 className="h-5 w-5 shrink-0" />
              Hapus Kegiatan "{deleteKegiatanName}"
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs text-foreground">
            <div className="rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-red-900 dark:text-red-200 space-y-1.5">
              <p className="font-semibold text-sm">⚠️ Konfirmasi Penghapusan Massal</p>
              <p>
                Tindakan ini akan menghapus seluruh{" "}
                <strong>{deleteKegiatanCount} item transaksi kas</strong> yang berada di bawah kegiatan{" "}
                <strong>"{deleteKegiatanName}"</strong> secara permanen dari Buku Kas.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-md border p-2.5 bg-muted/30">
              <div>
                <span className="text-muted-foreground block text-[11px]">Total Masuk (+):</span>
                <span className="font-semibold text-teal-700 dark:text-teal-400 text-sm">
                  {formatRp(deleteKegiatanTotalIn)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Total Keluar (-):</span>
                <span className="font-semibold text-red-600 dark:text-red-400 text-sm">
                  {formatRp(deleteKegiatanTotalOut)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              💡 <em>Penghapusan ini murni menghapus catatan pembukuan Kas. Data pendaftaran & status LUNAS peserta di menu UKT/Latber tetap 100% aman dan tidak terpengaruh.</em>
            </p>

            {(deleteKegiatanCount > 5 || deleteKegiatanTotalIn + deleteKegiatanTotalOut > 1000000) ? (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="delete-kegiatan-confirm" className="text-xs font-semibold text-red-700 dark:text-red-300">
                  Ketik nama kegiatan secara presisi untuk mengonfirmasi:
                </Label>
                <div className="text-[11px] font-mono select-all bg-muted px-2 py-1 rounded border">
                  {deleteKegiatanName}
                </div>
                <Input
                  id="delete-kegiatan-confirm"
                  value={deleteKegiatanConfirmInput}
                  placeholder={`Ketik "${deleteKegiatanName}"`}
                  className="h-9 text-xs"
                  onChange={(e) => setDeleteKegiatanConfirmInput(e.target.value)}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 flex-wrap sm:flex-nowrap justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs shrink-0"
              onClick={handleCopyKegiatanDetails}
              title="Salin rincian transaksi kegiatan ini ke clipboard sebelum dihapus"
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Salin WA Rincian
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setDeleteKegiatanOpen(false)}
                disabled={deleteKegiatanLoading}
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="text-xs bg-red-600 hover:bg-red-700 text-white"
                onClick={() => void handleDeleteKegiatan()}
                disabled={
                  deleteKegiatanLoading ||
                  ((deleteKegiatanCount > 5 || deleteKegiatanTotalIn + deleteKegiatanTotalOut > 1000000) &&
                    deleteKegiatanConfirmInput.trim().toLowerCase() !== deleteKegiatanName.trim().toLowerCase())
                }
              >
                {deleteKegiatanLoading
                  ? "Menghapus…"
                  : `Hapus (${deleteKegiatanCount} item)`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={printOptionModalOpen} onOpenChange={setPrintOptionModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Printer className="h-5 w-5 text-red-600 dark:text-red-400" />
              Pilih Format Cetak Dokumen Kas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Konfigurasi format cetak dokumen kas untuk periode{" "}
              <strong className="text-foreground">{periodCaption}</strong>:
            </p>

            {/* Section 1: Jenis Dokumen */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                1. Pilih Jenis Dokumen Kas
              </Label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-all focus:outline-none",
                    printDocType === "buku"
                      ? "border-red-600 bg-red-50/60 dark:bg-red-950/30 dark:border-red-500 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-background",
                  )}
                  onClick={() => {
                    setPrintDocType("buku");
                    setPrintOrientation("portrait");
                  }}
                >
                  <div className={cn(
                    "rounded-md p-2 shrink-0 mt-0.5",
                    printDocType === "buku" ? "bg-red-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  )}>
                    <Printer className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                      <span>📖 Buku Kas Umum (Buku Kas Klasik)</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Format akuntansi klasik dengan Saldo Bawaan (Awal), Debet (Pemasukan), Kredit (Pengeluaran), dan Saldo Berjalan.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-all focus:outline-none",
                    printDocType === "laporan"
                      ? "border-red-600 bg-red-50/60 dark:bg-red-950/30 dark:border-red-500 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-background",
                  )}
                  onClick={() => {
                    setPrintDocType("laporan");
                    setPrintOrientation("landscape");
                  }}
                >
                  <div className={cn(
                    "rounded-md p-2 shrink-0 mt-0.5",
                    printDocType === "laporan" ? "bg-red-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  )}>
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                      <span>📄 Laporan Detail (Grafik & SWOT)</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Format visual komprehensif dilengkapi grafik mutasi bulanan, analisis SWOT 4-kuadran, & rincian mutasi.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Section 2: Ukuran Kertas (A4 / F4) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                2. Pilih Ukuran Kertas
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    "flex flex-col items-center justify-center rounded-md border py-2 px-3 text-xs font-medium transition-all",
                    printPaper === "A4"
                      ? "border-red-600 bg-red-600 text-white shadow-sm"
                      : "border-slate-200 dark:border-slate-800 bg-background hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200",
                  )}
                  onClick={() => setPrintPaper("A4")}
                >
                  <span className="font-semibold">A4</span>
                  <span className={cn("text-[10px]", printPaper === "A4" ? "text-red-100" : "text-muted-foreground")}>
                    210 × 297 mm
                  </span>
                </button>

                <button
                  type="button"
                  className={cn(
                    "flex flex-col items-center justify-center rounded-md border py-2 px-3 text-xs font-medium transition-all",
                    printPaper === "F4"
                      ? "border-red-600 bg-red-600 text-white shadow-sm"
                      : "border-slate-200 dark:border-slate-800 bg-background hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200",
                  )}
                  onClick={() => setPrintPaper("F4")}
                >
                  <span className="font-semibold">F4 / Folio</span>
                  <span className={cn("text-[10px]", printPaper === "F4" ? "text-red-100" : "text-muted-foreground")}>
                    215 × 330 mm
                  </span>
                </button>
              </div>
            </div>

            {/* Section 3: Orientasi Kertas (Portrait / Landscape) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                3. Pilih Orientasi Cetak
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    "flex flex-col items-center justify-center rounded-md border py-2 px-3 text-xs font-medium transition-all",
                    printOrientation === "portrait"
                      ? "border-red-600 bg-red-600 text-white shadow-sm"
                      : "border-slate-200 dark:border-slate-800 bg-background hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200",
                  )}
                  onClick={() => setPrintOrientation("portrait")}
                >
                  <span className="font-semibold">📱 Portrait (Tegak)</span>
                  <span className={cn("text-[10px]", printOrientation === "portrait" ? "text-red-100" : "text-muted-foreground")}>
                    Rekomendasi Buku Kas
                  </span>
                </button>

                <button
                  type="button"
                  className={cn(
                    "flex flex-col items-center justify-center rounded-md border py-2 px-3 text-xs font-medium transition-all",
                    printOrientation === "landscape"
                      ? "border-red-600 bg-red-600 text-white shadow-sm"
                      : "border-slate-200 dark:border-slate-800 bg-background hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200",
                  )}
                  onClick={() => setPrintOrientation("landscape")}
                >
                  <span className="font-semibold">🖥️ Landscape (Mendatar)</span>
                  <span className={cn("text-[10px]", printOrientation === "landscape" ? "text-red-100" : "text-muted-foreground")}>
                    Rekomendasi Laporan Detail
                  </span>
                </button>
              </div>
            </div>

            {/* Section 4: Filter Transaksi (Bila ada yang dicentang) */}
            {selectedRows.length > 0 ? (
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>4. Filter Baris Transaksi Cetak</span>
                  <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200 dark:border-red-900/60">
                    {selectedRows.length} item dicentang
                  </span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={cn(
                      "flex flex-col items-center justify-center rounded-md border py-2 px-3 text-xs font-medium transition-all",
                      !printOnlySelected
                        ? "border-red-600 bg-red-600 text-white shadow-sm"
                        : "border-slate-200 dark:border-slate-800 bg-background hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200",
                    )}
                    onClick={() => setPrintOnlySelected(false)}
                  >
                    <span className="font-semibold">Semua Transaksi</span>
                    <span className={cn("text-[10px]", !printOnlySelected ? "text-red-100" : "text-muted-foreground")}>
                      {data?.rows?.length ?? 0} item di periode ini
                    </span>
                  </button>

                  <button
                    type="button"
                    className={cn(
                      "flex flex-col items-center justify-center rounded-md border py-2 px-3 text-xs font-medium transition-all",
                      printOnlySelected
                        ? "border-red-600 bg-red-600 text-white shadow-sm"
                        : "border-slate-200 dark:border-slate-800 bg-background hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200",
                    )}
                    onClick={() => setPrintOnlySelected(true)}
                  >
                    <span className="font-semibold">Transaksi Terpilih</span>
                    <span className={cn("text-[10px]", printOnlySelected ? "text-red-100" : "text-muted-foreground")}>
                      {selectedRows.length} item dicentang saja
                    </span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 justify-between items-center">
            <span className="text-[11px] text-muted-foreground font-mono">
              Format: {printDocType === "buku" ? "Buku Kas" : "Laporan"} ({printPaper}, {printOrientation})
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPrintOptionModalOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-medium"
                onClick={() => handleExecutePrint()}
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Cetak Dokumen
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function KasFullscreenPeriodPrint({
  fromYmd,
  toYmd,
  loading,
  onFromChange,
  onToChange,
  onRefresh,
  onPrint,
}: {
  fromYmd: string;
  toYmd: string;
  loading: boolean;
  onFromChange: (ymd: string) => void;
  onToChange: (ymd: string) => void;
  onRefresh: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-9 w-9 shrink-0"
        aria-label="Muat ulang"
        title="Muat ulang"
        disabled={loading}
        onClick={onRefresh}
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      </Button>
      <div className="grid gap-0.5">
        <span className="text-[10px] leading-none text-muted-foreground">
          Dari
        </span>
        <div className="w-[11.5rem] [&_>div]:min-w-0 [&_>div]:flex-none">
          <KasDateField allowEmpty value={fromYmd} onChange={onFromChange} />
        </div>
      </div>
      <div className="grid gap-0.5">
        <span className="text-[10px] leading-none text-muted-foreground">
          Sampai
        </span>
        <div className="w-[11.5rem] [&_>div]:min-w-0 [&_>div]:flex-none">
          <KasDateField allowEmpty value={toYmd} onChange={onToChange} />
        </div>
      </div>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-9 w-9 shrink-0"
        aria-label="Cetak laporan"
        title="Cetak"
        onClick={onPrint}
      >
        <Printer className="h-4 w-4" />
      </Button>
    </div>
  );
}

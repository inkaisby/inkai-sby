"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePadField } from "@/components/admin/SignaturePadField";
import {
  KwitansiMemberPicker,
  type KwitansiMemberSuggestItem,
} from "@/components/admin/kwitansi/KwitansiMemberPicker";
import {
  KwitansiPreview,
  type KwitansiPreviewData,
} from "@/components/admin/kwitansi/KwitansiPreview";
import { KwitansiBulkNotaItemDialog } from "@/components/admin/kwitansi/KwitansiBulkNotaItemDialog";
import { formatRp } from "@/lib/terbilang";
import { toast } from "sonner";
import {
  printKwitansi,
  printKwitansiBatch,
  printNotaPengeluaran,
  printNotaPengeluaranBatch,
  formatTanggalId,
  type KwitansiPrintData,
  type NotaPengeluaranPrintData,
} from "@/lib/kwitansi-print-html";

export type NotaItemRow = {
  id: string;
  deskripsi: string;
  jumlah: number;
  harga: number;
  petugas: string;
  petugasMemberId?: string | null;
};

type Props = {
  noNota: string;
  tanggal: string;
  pajakPersen: number;
  items: NotaItemRow[];
  eventLabel?: string;
  bidangUjianRole?: string;
  bidangUjianName: string;
  bidangUjianMemberId: string | null;
  bidangUjianSignUrl: string | null;
  bendaharaRole?: string;
  bendaharaName: string;
  bendaharaMemberId: string | null;
  bendaharaSignUrl: string | null;
  onNoNotaChange: (v: string) => void;
  onTanggalChange: (v: string) => void;
  onPajakPersenChange: (v: number) => void;
  onItemsChange: (items: NotaItemRow[]) => void;
  onBidangUjianRoleChange?: (v: string) => void;
  onBidangUjianName: (v: string) => void;
  onBidangUjianMemberId: (v: string | null) => void;
  onBidangUjianSignUrl: (v: string | null) => void;
  onBendaharaRoleChange?: (v: string) => void;
  onBendaharaName: (v: string) => void;
  onBendaharaMemberId: (v: string | null) => void;
  onBendaharaSignUrl: (v: string | null) => void;
  onPrint: () => void;
  onPdf: () => void;
  onSaveArsip?: () => void;
};

function newId() {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatNumberWithDots(val: string | number): string {
  const digits = String(val).replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10);
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("id-ID").format(num);
}

export function NotaItemTable({
  noNota,
  tanggal,
  pajakPersen,
  items,
  eventLabel,
  bidangUjianRole = "Ketua Panitia / Penanggung Jawab",
  bidangUjianName,
  bidangUjianMemberId,
  bidangUjianSignUrl,
  bendaharaRole = "Bendahara",
  bendaharaName,
  bendaharaMemberId,
  bendaharaSignUrl,
  onNoNotaChange,
  onTanggalChange,
  onPajakPersenChange,
  onItemsChange,
  onBidangUjianRoleChange,
  onBidangUjianName,
  onBidangUjianMemberId,
  onBidangUjianSignUrl,
  onBendaharaRoleChange,
  onBendaharaName,
  onBendaharaMemberId,
  onBendaharaSignUrl,
  onPrint,
  onPdf,
  onSaveArsip,
}: Props) {
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [mailMergeOpen, setMailMergeOpen] = useState(false);
  const [mailMergeIndex, setMailMergeIndex] = useState(0);
  const [mailMergeFormat, setMailMergeFormat] = useState<"kwitansi" | "nota">("kwitansi");
  const [mailMergeView, setMailMergeView] = useState<"single" | "all">("single");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deskripsi, setDeskripsi] = useState("");
  const [jumlah, setJumlah] = useState("1");
  const [harga, setHarga] = useState("");
  const [petugas, setPetugas] = useState("");
  const [petugasMemberId, setPetugasMemberId] = useState<string | null>(null);

  const subTotal = items.reduce(
    (s, r) => s + (Number(r.jumlah) || 0) * (Number(r.harga) || 0),
    0,
  );
  const pajakAmount = Math.round((subTotal * (pajakPersen || 0)) / 100);
  const grandTotal = subTotal + pajakAmount;

  const getOrigin = () =>
    typeof window !== "undefined" ? window.location.origin : "";

  const buildRowKwitansiData = (
    row: NotaItemRow,
    index: number,
  ): KwitansiPrintData => {
    const numJm = Math.max(1, Number(row.jumlah) || 1);
    const numHg = Number(row.harga) || 0;
    const total = numJm * numHg;
    const docNo = noNota
      ? `${noNota.replace(/^NP/, "KW")}-${index + 1}`
      : `KW/${new Date().getFullYear()}/${index + 1}`;
    const docTgl = tanggal
      ? formatTanggalId(tanggal)
      : formatTanggalId(new Date().toISOString().slice(0, 10));

    const itemDesc = `${row.deskripsi.trim()}${
      numJm > 1 ? ` (${numJm} x ${formatRp(numHg)})` : ""
    }`;
    const ev = (eventLabel || "").trim();
    const untukPembayaran =
      itemDesc && ev && !itemDesc.toLowerCase().includes(ev.toLowerCase())
        ? `${itemDesc}, ${ev}`
        : itemDesc || ev || "—";

    return {
      no: docNo,
      tanggal: docTgl,
      terimaDari: bendaharaName || "Bendahara INKAI Kota Surabaya",
      jumlah: total,
      untukPembayaran,
      penerimaRole: "Penerima",
      penyetorRole: bendaharaRole || "Bendahara",
      penerimaName: row.petugas.trim() || bidangUjianName || "Penerima",
      penyetorName: bendaharaName || "Bendahara Cabang",
      penerimaSignUrl: null,
      penyetorSignUrl: bendaharaSignUrl || null,
      origin: getOrigin(),
      draft: false,
    };
  };

  const buildRowNotaData = (
    row: NotaItemRow,
    index: number,
  ): NotaPengeluaranPrintData => {
    const numJm = Math.max(1, Number(row.jumlah) || 1);
    const numHg = Number(row.harga) || 0;
    const total = numJm * numHg;
    const docNo = noNota
      ? `${noNota}-${index + 1}`
      : `NP/${new Date().getFullYear()}/${index + 1}`;
    const docTgl = tanggal
      ? formatTanggalId(tanggal)
      : formatTanggalId(new Date().toISOString().slice(0, 10));

    return {
      noNota: docNo,
      tanggal: docTgl,
      items: [
        {
          no: 1,
          deskripsi: row.deskripsi.trim(),
          jumlah: numJm,
          harga: numHg,
          total,
          petugas: row.petugas.trim() || "—",
        },
      ],
      subTotal: total,
      pajakPersen: 0,
      pajakAmount: 0,
      grandTotal: total,
      bidangUjianRole: bidangUjianRole || "Ketua Panitia / Penanggung Jawab",
      bidangUjianName: bidangUjianName || row.petugas.trim(),
      bendaharaRole: bendaharaRole || "Bendahara",
      bendaharaName: bendaharaName || "Bendahara Cabang",
      bidangUjianSignUrl: bidangUjianSignUrl || null,
      bendaharaSignUrl: bendaharaSignUrl || null,
      origin: getOrigin(),
      draft: false,
    };
  };

  const buildTotalKwitansiData = (): KwitansiPrintData => {
    const docNo = noNota ? noNota.replace(/^NP/, "KW") : "KW-TOTAL";
    const docTgl = tanggal
      ? formatTanggalId(tanggal)
      : formatTanggalId(new Date().toISOString().slice(0, 10));

    return {
      no: docNo,
      tanggal: docTgl,
      terimaDari: bendaharaName || "Bendahara INKAI Kota Surabaya",
      jumlah: grandTotal,
      untukPembayaran: `Pengeluaran ${noNota || "Nota"}${
        items.length > 0
          ? ` (${items.length} item: ${items
              .map((it) => it.deskripsi)
              .filter(Boolean)
              .slice(0, 3)
              .join(", ")}${items.length > 3 ? "…" : ""})`
          : ""
      }`,
      penerimaRole: bidangUjianRole || "Penerima",
      penyetorRole: bendaharaRole || "Bendahara",
      penerimaName: bidangUjianName || "Penanggung Jawab",
      penyetorName: bendaharaName || "Bendahara Cabang",
      penerimaSignUrl: bidangUjianSignUrl || null,
      penyetorSignUrl: bendaharaSignUrl || null,
      origin: getOrigin(),
      draft: false,
    };
  };

  const handleDuplicateRow = (id: string) => {
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const target = items[idx];
    const cloned: NotaItemRow = {
      ...target,
      id: newId(),
    };
    const next = [...items];
    next.splice(idx + 1, 0, cloned);
    onItemsChange(next);
  };

  const currentMailMergeItem = items[mailMergeIndex] ?? null;

  const handleOpenMailMerge = (
    index: number = 0,
    format: "kwitansi" | "nota" = "kwitansi",
    view: "single" | "all" = "single",
  ) => {
    if (items.length === 0) {
      toast.error("Tambahkan minimal 1 item terlebih dahulu");
      return;
    }
    setMailMergeFormat(format);
    setMailMergeView(view);
    setMailMergeIndex(Math.max(0, Math.min(index, items.length - 1)));
    setMailMergeOpen(true);
  };

  const handlePrevMailMerge = () => {
    setMailMergeIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextMailMerge = () => {
    setMailMergeIndex((prev) => Math.min(items.length - 1, prev + 1));
  };

  const currentPreviewData: KwitansiPreviewData | null = currentMailMergeItem
    ? {
        no: noNota
          ? `${noNota.replace(/^NP/, "KW")}-${mailMergeIndex + 1}`
          : `KW/${new Date().getFullYear()}/${mailMergeIndex + 1}`,
        tanggal: tanggal
          ? formatTanggalId(tanggal)
          : formatTanggalId(new Date().toISOString().slice(0, 10)),
        terimaDari: bendaharaName || "Bendahara INKAI Kota Surabaya",
        jumlah:
          (Number(currentMailMergeItem.jumlah) || 1) *
          (Number(currentMailMergeItem.harga) || 0),
        untukPembayaran: (() => {
          const itemDesc = `${currentMailMergeItem.deskripsi.trim()}${
            (Number(currentMailMergeItem.jumlah) || 1) > 1
              ? ` (${currentMailMergeItem.jumlah} x ${formatRp(currentMailMergeItem.harga)})`
              : ""
          }`;
          const ev = (eventLabel || "").trim();
          return itemDesc && ev && !itemDesc.toLowerCase().includes(ev.toLowerCase())
            ? `${itemDesc}, ${ev}`
            : itemDesc || ev || "—";
        })(),
        eventLabel,
        penerimaName:
          currentMailMergeItem.petugas.trim() ||
          bidangUjianName ||
          "Penerima",
        penyetorName: bendaharaName || "Bendahara Cabang",
        penerimaSignUrl: null,
        penyetorSignUrl: bendaharaSignUrl || null,
        penerimaLabel: "Penerima",
      }
    : null;

  const reset = () => {
    setEditingId(null);
    setDeskripsi("");
    setJumlah("1");
    setHarga("");
    setPetugas("");
    setPetugasMemberId(null);
  };

  const save = () => {
    const j = Math.max(0, Number(jumlah) || 0);
    const h = Math.floor(Number(String(harga).replace(/\D/g, "")) || 0);
    if (!deskripsi.trim()) return;
    if (editingId) {
      onItemsChange(
        items.map((r) =>
          r.id === editingId
            ? {
                ...r,
                deskripsi: deskripsi.trim(),
                jumlah: j,
                harga: h,
                petugas: petugas.trim(),
                petugasMemberId,
              }
            : r,
        ),
      );
    } else {
      onItemsChange([
        ...items,
        {
          id: newId(),
          deskripsi: deskripsi.trim(),
          jumlah: j,
          harga: h,
          petugas: petugas.trim(),
          petugasMemberId,
        },
      ]);
    }
    setOpen(false);
    reset();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");

      // Shortcut inside dialog: Ctrl + Enter or Enter in inputs submit form
      if (open) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          if (deskripsi.trim()) save();
          return;
        }
        return;
      }

      // Shortcut outside dialog:
      // Alt + Shift + A -> Open Input Massal
      if (!isInput && e.altKey && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setBulkOpen(true);
        return;
      }
      // Alt + A or Alt + N -> Open "+ Tambah rincian / item"
      if (!isInput && e.altKey && (e.key.toLowerCase() === "a" || e.key.toLowerCase() === "n")) {
        e.preventDefault();
        reset();
        setOpen(true);
        return;
      }
      // Alt + S -> Simpan ke Arsip
      if (!isInput && e.altKey && e.key.toLowerCase() === "s" && onSaveArsip) {
        e.preventDefault();
        onSaveArsip();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, deskripsi, jumlah, harga, petugas, editingId, items, onSaveArsip]);

  useEffect(() => {
    if (!mailMergeOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setMailMergeIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setMailMergeIndex((prev) => Math.min(items.length - 1, prev + 1));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        if (currentMailMergeItem) {
          if (mailMergeFormat === "kwitansi") {
            printKwitansi(buildRowKwitansiData(currentMailMergeItem, mailMergeIndex));
          } else {
            printNotaPengeluaran(buildRowNotaData(currentMailMergeItem, mailMergeIndex));
          }
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mailMergeOpen, mailMergeIndex, mailMergeFormat, items, currentMailMergeItem]);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Rincian Pengeluaran / Nota</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleOpenMailMerge(0, "nota", "single")}
            title="Pratinjau & Cetak Nota Pengeluaran (Mail Merge)"
          >
            <Receipt className="mr-1 h-3.5 w-3.5 text-rose-600" />
            Cetak nota
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs"
                disabled={items.length === 0}
                title="Cetak format Kwitansi Pembayaran resmi INKAI (A4 Landscape dengan stub/bonggol)"
              >
                <FileText className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                Cetak kwitansi
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs">
                Opsi Format Kwitansi INKAI
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => handleOpenMailMerge(0, "kwitansi", "single")}
                className="text-xs cursor-pointer font-medium text-emerald-700 dark:text-emerald-400"
              >
                <FileText className="mr-2 h-4 w-4 text-emerald-600" />
                <div>
                  <div className="font-semibold">Pratinjau Mail Merge (Per Item)</div>
                  <div className="text-[10px] text-muted-foreground">
                    Lihat slip kwitansi satu per satu & cetak
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleOpenMailMerge(0, "kwitansi", "all")}
                className="text-xs cursor-pointer"
              >
                <FileText className="mr-2 h-4 w-4 text-emerald-600" />
                <div>
                  <div className="font-medium">Kwitansi Total Pengeluaran</div>
                  <div className="text-[10px] text-muted-foreground">
                    1 lembar kwitansi untuk total {formatRp(grandTotal)}
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  const valid = items.filter((r) => r.deskripsi.trim().length > 0);
                  if (valid.length === 0) return;
                  printKwitansiBatch(valid.map((r, i) => buildRowKwitansiData(r, i)));
                }}
                className="text-xs cursor-pointer"
              >
                <Printer className="mr-2 h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium">Semua Lembar Kwitansi ({items.length})</div>
                  <div className="text-[10px] text-muted-foreground">
                    Tiap baris jadi 1 lembar kwitansi terpisah
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const valid = items.filter((r) => r.deskripsi.trim().length > 0);
                  if (valid.length === 0) return;
                  printNotaPengeluaranBatch(valid.map((r, i) => buildRowNotaData(r, i)));
                }}
                className="text-xs cursor-pointer"
              >
                <Receipt className="mr-2 h-4 w-4 text-rose-600" />
                <div>
                  <div className="font-medium">Semua Lembar Nota ({items.length})</div>
                  <div className="text-[10px] text-muted-foreground">
                    Tiap baris jadi 1 lembar nota terpisah
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" size="sm" variant="outline" onClick={onPdf}>
            PDF nota
          </Button>
          {onSaveArsip ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onSaveArsip}
              title="Shortcut: Alt + S"
              className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-medium"
            >
              Simpan ke Arsip
              <span className="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-mono text-emerald-800">Alt+S</span>
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            title="Shortcut: Alt + A atau Alt + N"
            onClick={() => {
              reset();
              setOpen(true);
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Tambah rincian
            <span className="ml-1 rounded bg-white/20 px-1 py-0.5 text-[10px] font-mono">Alt+A</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setBulkOpen(true)}
            title="Shortcut: Alt + Shift + A"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Input massal
            <span className="ml-1 rounded bg-white/20 px-1 py-0.5 text-[10px] font-mono">Alt+Shift+A</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>No. Nota</Label>
          <Input value={noNota} onChange={(e) => onNoNotaChange(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Tanggal</Label>
          <Input
            type="date"
            value={tanggal}
            onChange={(e) => onTanggalChange(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="w-12 p-2">No.</th>
              <th className="p-2">Deskripsi</th>
              <th className="p-2 text-right">Jumlah</th>
              <th className="p-2 text-right">Harga</th>
              <th className="p-2 text-right">Total</th>
              <th className="p-2">Petugas</th>
              <th className="w-32 p-2 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Belum ada item — Tambah item
                </td>
              </tr>
            ) : (
              items.map((row, idx) => {
                const total = (row.jumlah || 0) * (row.harga || 0);
                return (
                  <tr key={row.id} className="border-b">
                    <td className="p-2">{idx + 1}</td>
                    <td className="p-2">{row.deskripsi}</td>
                    <td className="p-2 text-right">{row.jumlah}</td>
                    <td className="p-2 text-right">{formatRp(row.harga)}</td>
                    <td className="p-2 text-right">{formatRp(total)}</td>
                    <td className="p-2">{row.petugas || "—"}</td>
                    <td className="p-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Pratinjau & Cetak Kwitansi Mail Merge"
                          className="h-7 w-7 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                          onClick={() => handleOpenMailMerge(idx)}
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span className="sr-only">Pratinjau & Cetak Mail Merge</span>
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title="Pilihan cetak lainnya"
                              className="h-7 w-5 px-0 text-muted-foreground hover:text-foreground"
                            >
                              <span className="text-[10px] leading-none">▾</span>
                              <span className="sr-only">Menu cetak</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="text-xs">
                              Cetak Item #{idx + 1}
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => handleOpenMailMerge(idx)}
                              className="text-xs cursor-pointer font-medium text-emerald-700 dark:text-emerald-400"
                            >
                              <FileText className="mr-2 h-4 w-4 text-emerald-600" />
                              <div>
                                <div className="font-semibold">Pratinjau Mail Merge</div>
                                <div className="text-[10px] text-muted-foreground">
                                  Buka modal navigasi & cetak
                                </div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => printKwitansi(buildRowKwitansiData(row, idx))}
                              className="text-xs cursor-pointer"
                            >
                              <Printer className="mr-2 h-4 w-4 text-primary" />
                              <div>
                                <div className="font-medium">Cetak Langsung Kwitansi</div>
                                <div className="text-[10px] text-muted-foreground">
                                  Format kwitansi resmi (A4 Landscape)
                                </div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => printNotaPengeluaran(buildRowNotaData(row, idx))}
                              className="text-xs cursor-pointer"
                            >
                              <Receipt className="mr-2 h-4 w-4 text-rose-600" />
                              <div>
                                <div className="font-medium">Cetak Langsung Nota</div>
                                <div className="text-[10px] text-muted-foreground">
                                  Format nota resmi (A4 Portrait)
                                </div>
                              </div>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Duplikat baris"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handleDuplicateRow(row.id)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span className="sr-only">Duplikat baris</span>
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Edit baris"
                          onClick={() => {
                            setEditingId(row.id);
                            setDeskripsi(row.deskripsi);
                            setJumlah(String(row.jumlah));
                            setHarga(row.harga ? formatNumberWithDots(row.harga) : "");
                            setPetugas(row.petugas);
                            setPetugasMemberId(row.petugasMemberId ?? null);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit baris</span>
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          title="Hapus baris"
                          onClick={() =>
                            onItemsChange(items.filter((r) => r.id !== row.id))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Hapus baris</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="border-t">
              <td colSpan={4} className="p-2 text-right">
                Sub Total
              </td>
              <td className="p-2 text-right font-medium">{formatRp(subTotal)}</td>
              <td colSpan={2}></td>
            </tr>
            <tr>
              <td colSpan={4} className="p-2 text-right">
                <span className="mr-2">Pajak</span>
                <Input
                  className="inline-flex h-8 w-16"
                  type="number"
                  min={0}
                  max={100}
                  value={pajakPersen}
                  onChange={(e) =>
                    onPajakPersenChange(Math.max(0, Number(e.target.value) || 0))
                  }
                />
                <span className="ml-1">%</span>
              </td>
              <td className="p-2 text-right">{formatRp(pajakAmount)}</td>
              <td colSpan={2}></td>
            </tr>
            <tr className="font-semibold">
              <td colSpan={4} className="p-2 text-right">
                TOTAL
              </td>
              <td className="p-2 text-right">{formatRp(grandTotal)}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Jabatan / Peran Penandatangan</Label>
              <div className="flex flex-wrap gap-1 text-[11px]">
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[11px] bg-muted hover:bg-muted/80 text-foreground transition-colors"
                  onClick={() => onBidangUjianRoleChange?.("Ketua Panitia")}
                >
                  Panitia
                </button>
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[11px] bg-muted hover:bg-muted/80 text-foreground transition-colors"
                  onClick={() => onBidangUjianRoleChange?.("Bidang Ujian")}
                >
                  Ujian
                </button>
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[11px] bg-muted hover:bg-muted/80 text-foreground transition-colors"
                  onClick={() => onBidangUjianRoleChange?.("Koordinator Kegiatan")}
                >
                  Koordinator
                </button>
              </div>
            </div>
            <Input
              value={bidangUjianRole}
              onChange={(e) => onBidangUjianRoleChange?.(e.target.value)}
              placeholder="Contoh: Ketua Panitia / Penanggung Jawab"
              className="h-8 text-xs font-medium"
            />
            <p className="text-[11px] text-muted-foreground">
              Bisa diedit bebas untuk semua kegiatan (Ujian, Kejuaraan, Pelatihan, Operasional, dll).
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Nama Pejabat / Anggota (dari keanggotaan)</Label>
            <KwitansiMemberPicker
              value={bidangUjianName}
              onChange={(v) => {
                onBidangUjianName(v);
                onBidangUjianMemberId(null);
              }}
              onPick={(item: KwitansiMemberSuggestItem) => {
                onBidangUjianName(item.fullName);
                onBidangUjianMemberId(item.id);
                if (item.signatureUrl) onBidangUjianSignUrl(item.signatureUrl);
              }}
              placeholder={`Cari nama ${bidangUjianRole || "pejabat"} (≥2 huruf)…`}
            />
            <p className="text-[11px] text-muted-foreground">
              Ketik ≥2 huruf untuk cari pejabat dari keanggotaan atau isi nama bebas.
            </p>
          </div>

          <SignaturePadField
            label={bidangUjianRole?.trim() || "Penanggung Jawab"}
            valueUrl={bidangUjianSignUrl}
            memberId={bidangUjianMemberId}
            onChange={onBidangUjianSignUrl}
          />
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Jabatan / Peran Bendahara</Label>
            <Input
              value={bendaharaRole}
              onChange={(e) => onBendaharaRoleChange?.(e.target.value)}
              placeholder="Bendahara"
              className="h-8 text-xs font-medium"
            />
            <p className="text-[11px] text-muted-foreground">
              Bisa disesuaikan jika perlu (misal: Bendahara Panitia / Cabang).
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Nama Bendahara (dari keanggotaan)</Label>
            <KwitansiMemberPicker
              value={bendaharaName}
              onChange={(v) => {
                onBendaharaName(v);
                onBendaharaMemberId(null);
              }}
              onPick={(item: KwitansiMemberSuggestItem) => {
                onBendaharaName(item.fullName);
                onBendaharaMemberId(item.id);
                if (item.signatureUrl) onBendaharaSignUrl(item.signatureUrl);
              }}
              placeholder="Cari Bendahara (≥2 huruf)…"
            />
            <p className="text-[11px] text-muted-foreground">
              Ketik ≥2 huruf untuk cari pejabat dari keanggotaan.
            </p>
          </div>

          <SignaturePadField
            label={bendaharaRole?.trim() || "Bendahara"}
            valueUrl={bendaharaSignUrl}
            memberId={bendaharaMemberId}
            onChange={onBendaharaSignUrl}
          />
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-visible">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (deskripsi.trim()) save();
            }}
          >
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit item" : "Tambah item"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Deskripsi</Label>
                <Input
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  placeholder="Konsumsi panitia"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Jumlah</Label>
                  <Input
                    type="number"
                    min={0}
                    value={jumlah}
                    onChange={(e) => setJumlah(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Harga</Label>
                  <Input
                    inputMode="numeric"
                    value={harga}
                    onChange={(e) => setHarga(formatNumberWithDots(e.target.value))}
                    placeholder="50.000"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Petugas</Label>
                <KwitansiMemberPicker
                  value={petugas}
                  onChange={(v) => {
                    setPetugas(v);
                    setPetugasMemberId(null);
                  }}
                  onPick={(item) => {
                    setPetugas(item.fullName);
                    setPetugasMemberId(item.id);
                  }}
                  placeholder="Cari nama anggota (≥2 huruf)…"
                />
                <p className="text-[11px] text-muted-foreground">
                  Ketik ≥2 huruf untuk autofill dari keanggotaan, atau nama bebas.
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={!deskripsi.trim()} title="Shortcut: Enter / Ctrl + Enter">
                Simpan <span className="ml-1 text-[10px] font-mono opacity-80">(Enter)</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <KwitansiBulkNotaItemDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        noNota={noNota}
        tanggal={tanggal}
        eventLabel={eventLabel}
        bidangUjianRole={bidangUjianRole}
        bidangUjianName={bidangUjianName}
        bendaharaRole={bendaharaRole}
        bendaharaName={bendaharaName}
        bidangUjianSignUrl={bidangUjianSignUrl}
        bendaharaSignUrl={bendaharaSignUrl}
        onAddBulk={(newRows) => {
          const formattedRows: NotaItemRow[] = newRows.map((r) => ({
            ...r,
            id: newId(),
          }));
          onItemsChange([...items, ...formattedRows]);
        }}
      />

      <Dialog open={mailMergeOpen} onOpenChange={setMailMergeOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[94vh] w-[96vw] max-w-5xl sm:max-w-5xl flex-col gap-0 p-0 overflow-hidden rounded-xl border bg-card shadow-2xl"
        >
          {/* Header Tier 1: Title, Subtitle, Badges, and Close Button */}
          <div className="flex items-center justify-between border-b px-5 py-3.5 bg-muted/20">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  mailMergeFormat === "nota"
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                }`}
              >
                {mailMergeFormat === "nota" ? (
                  <Receipt className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold leading-tight flex flex-wrap items-center gap-2">
                  <span>
                    {mailMergeFormat === "nota"
                      ? "Pratinjau Nota Pengeluaran"
                      : "Pratinjau Kwitansi Pembayaran"}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground border">
                    {mailMergeView === "single" ? "Mail Merge (Per Item)" : "Dokumen Utuh"}
                  </span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {mailMergeView === "single" ? (
                    <>
                      Lembar ke-{items.length > 0 ? mailMergeIndex + 1 : 0} dari {items.length} item
                      {currentMailMergeItem?.deskripsi ? (
                        <>
                          {" "}·{" "}
                          <span className="font-medium text-foreground">
                            {currentMailMergeItem.deskripsi}
                          </span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      Rekap dokumen lengkap · {items.length} item pengeluaran · Total {formatRp(grandTotal)}
                    </>
                  )}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setMailMergeOpen(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Tutup</span>
            </Button>
          </div>

          {/* Header Tier 2: Controls Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-5 py-2.5 text-xs">
            {/* Left: Navigation or Status */}
            <div className="flex items-center gap-2 min-w-0">
              {mailMergeView === "single" ? (
                <div className="flex items-center gap-1.5 bg-background border rounded-lg p-1 shadow-2xs">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs gap-1 font-medium"
                    disabled={mailMergeIndex <= 0}
                    onClick={handlePrevMailMerge}
                    title="Lembar sebelumnya (←)"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Sebelumnya</span>
                  </Button>
                  <span className="text-xs font-semibold px-2 text-muted-foreground min-w-[65px] text-center tabular-nums">
                    {items.length > 0 ? mailMergeIndex + 1 : 0} / {items.length}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs gap-1 font-medium"
                    disabled={mailMergeIndex >= items.length - 1}
                    onClick={handleNextMailMerge}
                    title="Lembar berikutnya (→)"
                  >
                    <span className="hidden sm:inline">Berikutnya</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Menampilkan seluruh {items.length} rincian pengeluaran sekaligus
                </div>
              )}
            </div>

            {/* Right: Format and View Toggles */}
            <div className="flex items-center gap-2">
              {/* Format Toggle */}
              <div className="flex items-center rounded-lg border bg-background p-0.5 shadow-2xs">
                <button
                  type="button"
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                    mailMergeFormat === "nota"
                      ? "bg-rose-600 text-white shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setMailMergeFormat("nota")}
                >
                  Nota
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                    mailMergeFormat === "kwitansi"
                      ? "bg-emerald-600 text-white shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setMailMergeFormat("kwitansi")}
                >
                  Kwitansi
                </button>
              </div>

              {/* View Toggle */}
              <div className="flex items-center rounded-lg border bg-background p-0.5 shadow-2xs">
                <button
                  type="button"
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                    mailMergeView === "single"
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setMailMergeView("single")}
                  title="Tampilkan lembar per item rincian (Mail Merge)"
                >
                  Per Item
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                    mailMergeView === "all"
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setMailMergeView("all")}
                  title="Tampilkan lembar rekap utuh"
                >
                  Dokumen Utuh
                </button>
              </div>
            </div>
          </div>

          {/* Canvas Preview Area */}
          <div className="flex-1 overflow-y-auto overflow-x-auto bg-zinc-100/90 dark:bg-zinc-950/60 p-4 sm:p-6 flex items-center justify-center min-h-[460px]">
            {mailMergeView === "all" && mailMergeFormat === "nota" ? (
              <div className="w-full max-w-2xl shadow-md rounded-lg bg-white p-6 sm:p-8 text-zinc-900 border border-zinc-200">
                <div className="flex justify-between items-start border-b pb-3 mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-rose-700 tracking-wide">NOTA PENGELUARAN</h4>
                    <p className="text-xs font-semibold text-zinc-600">
                      INSTITUT KARATE-DO INDONESIA (INKAI) PENGURUS KOTA SURABAYA
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p>
                      No. Nota: <strong>{noNota || "—"}</strong>
                    </p>
                    <p>Tanggal: {tanggal ? formatTanggalId(tanggal) : "—"}</p>
                  </div>
                </div>
                <table className="w-full text-xs border-collapse mb-4">
                  <thead>
                    <tr className="bg-rose-700 text-white">
                      <th className="p-1.5 text-center w-8">No</th>
                      <th className="p-1.5 text-left">Deskripsi</th>
                      <th className="p-1.5 text-center w-14">Jml</th>
                      <th className="p-1.5 text-right w-24">Harga</th>
                      <th className="p-1.5 text-right w-24">Total</th>
                      <th className="p-1.5 text-left w-28">Petugas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-muted-foreground">
                          Belum ada item rincian
                        </td>
                      </tr>
                    ) : (
                      items.map((it, i) => (
                        <tr key={it.id || i} className="border-b">
                          <td className="p-1.5 text-center text-muted-foreground">{i + 1}</td>
                          <td className="p-1.5 font-medium">{it.deskripsi}</td>
                          <td className="p-1.5 text-center">{it.jumlah}</td>
                          <td className="p-1.5 text-right">{formatRp(it.harga)}</td>
                          <td className="p-1.5 text-right font-medium">
                            {formatRp((Number(it.jumlah) || 1) * (Number(it.harga) || 0))}
                          </td>
                          <td className="p-1.5 text-muted-foreground">{it.petugas || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t">
                      <td colSpan={4} className="p-1.5 text-right font-medium">
                        Sub Total
                      </td>
                      <td className="p-1.5 text-right font-semibold">{formatRp(subTotal)}</td>
                      <td></td>
                    </tr>
                    {pajakPersen > 0 ? (
                      <tr>
                        <td colSpan={4} className="p-1.5 text-right font-medium">
                          Pajak {pajakPersen}%
                        </td>
                        <td className="p-1.5 text-right font-semibold">{formatRp(pajakAmount)}</td>
                        <td></td>
                      </tr>
                    ) : null}
                    <tr className="border-t font-bold">
                      <td colSpan={4} className="p-1.5 text-right">
                        TOTAL
                      </td>
                      <td className="p-1.5 text-right text-rose-700">{formatRp(grandTotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
                <div className="flex justify-between text-xs pt-4 border-t">
                  <div className="text-center w-40">
                    <p className="text-[11px] text-muted-foreground mb-1">
                      {bidangUjianRole?.trim() || "Penanggung Jawab"}:
                    </p>
                    <div className="h-16 flex items-end justify-center font-semibold border-b pb-1">
                      {bidangUjianSignUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={bidangUjianSignUrl}
                          alt="TTD"
                          className="max-h-14 max-w-[140px] object-contain"
                        />
                      ) : (
                        bidangUjianName || "………………"
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{bidangUjianName || ""}</p>
                  </div>
                  <div className="text-center w-40">
                    <p className="text-[11px] text-muted-foreground mb-1">
                      {bendaharaRole?.trim() || "Bendahara"}:
                    </p>
                    <div className="h-16 flex items-end justify-center font-semibold border-b pb-1">
                      {bendaharaSignUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={bendaharaSignUrl}
                          alt="TTD"
                          className="max-h-14 max-w-[140px] object-contain"
                        />
                      ) : (
                        bendaharaName || "………………"
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{bendaharaName || ""}</p>
                  </div>
                </div>
              </div>
            ) : mailMergeView === "all" && mailMergeFormat === "kwitansi" ? (
              <div className="w-full max-w-4xl shadow-md rounded-lg overflow-hidden bg-white border border-zinc-200">
                <KwitansiPreview
                  data={{
                    no: noNota ? noNota.replace(/^NP/, "KW") : "KW-TOTAL",
                    tanggal: tanggal ? formatTanggalId(tanggal) : "—",
                    terimaDari: bendaharaName || "Bendahara INKAI Kota Surabaya",
                    jumlah: grandTotal,
                    untukPembayaran: (() => {
                      const desc = `Pengeluaran ${noNota || "Nota"}${
                        items.length > 0
                          ? ` (${items.length} item: ${items
                              .map((it) => it.deskripsi)
                              .filter(Boolean)
                              .slice(0, 3)
                              .join(", ")}${items.length > 3 ? "…" : ""})`
                          : ""
                      }`;
                      const ev = (eventLabel || "").trim();
                      return desc && ev && !desc.toLowerCase().includes(ev.toLowerCase())
                        ? `${desc}, ${ev}`
                        : desc || ev || "—";
                    })(),
                    eventLabel,
                    penerimaName: bidangUjianName || "Penanggung Jawab",
                    penyetorName: bendaharaName || "Bendahara Cabang",
                    penerimaSignUrl: bidangUjianSignUrl || null,
                    penyetorSignUrl: bendaharaSignUrl || null,
                    penerimaLabel: bidangUjianRole || "Penerima",
                  }}
                />
              </div>
            ) : currentPreviewData && mailMergeFormat === "kwitansi" ? (
              <div className="w-full max-w-4xl shadow-md rounded-lg overflow-hidden bg-white border border-zinc-200">
                <KwitansiPreview data={currentPreviewData} />
              </div>
            ) : currentMailMergeItem ? (
              <div className="w-full max-w-xl shadow-md rounded-lg bg-white p-6 sm:p-8 text-zinc-900 border border-zinc-200">
                <div className="flex justify-between items-start border-b pb-3 mb-4">
                  <div>
                    <h4 className="text-base font-bold text-rose-700">NOTA PENGELUARAN</h4>
                    <p className="text-xs text-muted-foreground">INSTITUT KARATE-DO INDONESIA (INKAI)</p>
                  </div>
                  <div className="text-right text-xs">
                    <p>
                      No:{" "}
                      <strong>
                        {noNota ? `${noNota}-${mailMergeIndex + 1}` : `NP-${mailMergeIndex + 1}`}
                      </strong>
                    </p>
                    <p>Tanggal: {tanggal ? formatTanggalId(tanggal) : "—"}</p>
                  </div>
                </div>
                <table className="w-full text-xs border-collapse mb-4">
                  <thead>
                    <tr className="bg-rose-700 text-white">
                      <th className="p-1.5 text-left">Deskripsi</th>
                      <th className="p-1.5 text-center w-16">Jumlah</th>
                      <th className="p-1.5 text-right w-28">Harga</th>
                      <th className="p-1.5 text-right w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2 font-medium">{currentMailMergeItem.deskripsi}</td>
                      <td className="p-2 text-center">{currentMailMergeItem.jumlah}</td>
                      <td className="p-2 text-right">{formatRp(currentMailMergeItem.harga)}</td>
                      <td className="p-2 text-right font-bold">
                        {formatRp(
                          (Number(currentMailMergeItem.jumlah) || 1) *
                            (Number(currentMailMergeItem.harga) || 0),
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex justify-between text-xs pt-4 border-t">
                  <div className="text-center w-36">
                    <p className="text-[11px] text-muted-foreground">
                      {bidangUjianRole?.trim() || "Penanggung Jawab"}:
                    </p>
                    <div className="h-12 flex items-end justify-center font-semibold">
                      {currentMailMergeItem.petugas || bidangUjianName || "………………"}
                    </div>
                  </div>
                  <div className="text-center w-36">
                    <p className="text-[11px] text-muted-foreground">
                      {bendaharaRole?.trim() || "Bendahara"}:
                    </p>
                    <div className="h-12 flex items-end justify-center font-semibold">
                      {bendaharaName || "………………"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">
                Belum ada data item untuk dipratinjau.
              </p>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="flex flex-row items-center justify-between border-t bg-background px-5 py-3 gap-2">
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              {mailMergeView === "single" ? (
                <>
                  Navigasi: <kbd className="rounded border bg-muted px-1">←</kbd>{" "}
                  <kbd className="rounded border bg-muted px-1">→</kbd> · Cetak:{" "}
                  <kbd className="rounded border bg-muted px-1">Ctrl+P</kbd>
                </>
              ) : (
                "Mode Dokumen Lengkap (Seluruh Rincian Tabel)"
              )}
            </p>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMailMergeOpen(false)}
              >
                Tutup
              </Button>
              {mailMergeView === "all" && mailMergeFormat === "nota" ? (
                <Button type="button" variant="outline" size="sm" onClick={onPdf}>
                  PDF Nota
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={items.length === 0}
                onClick={() => {
                  const valid = items.filter((r) => r.deskripsi.trim().length > 0);
                  if (valid.length === 0) return;
                  if (mailMergeFormat === "kwitansi") {
                    printKwitansiBatch(valid.map((r, i) => buildRowKwitansiData(r, i)));
                  } else {
                    printNotaPengeluaranBatch(valid.map((r, i) => buildRowNotaData(r, i)));
                  }
                }}
                title="Cetak semua lembar satu per satu (Mail Merge Batch)"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Cetak Semua ({items.length})
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                disabled={items.length === 0}
                onClick={() => {
                  if (mailMergeView === "all") {
                    if (mailMergeFormat === "nota") {
                      onPrint();
                    } else {
                      printKwitansi(buildTotalKwitansiData());
                    }
                  } else {
                    if (!currentMailMergeItem) return;
                    if (mailMergeFormat === "kwitansi") {
                      printKwitansi(buildRowKwitansiData(currentMailMergeItem, mailMergeIndex));
                    } else {
                      printNotaPengeluaran(buildRowNotaData(currentMailMergeItem, mailMergeIndex));
                    }
                  }
                }}
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                {mailMergeView === "all" ? "Cetak Dokumen Ini" : "Cetak Lembar Ini"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

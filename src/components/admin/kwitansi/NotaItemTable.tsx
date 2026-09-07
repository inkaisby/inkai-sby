"use client";

import { useState, useEffect } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePadField } from "@/components/admin/SignaturePadField";
import {
  KwitansiMemberPicker,
  type KwitansiMemberSuggestItem,
} from "@/components/admin/kwitansi/KwitansiMemberPicker";
import { KwitansiBulkNotaItemDialog } from "@/components/admin/kwitansi/KwitansiBulkNotaItemDialog";
import { formatRp } from "@/lib/terbilang";

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
  bidangUjianName: string;
  bidangUjianMemberId: string | null;
  bidangUjianSignUrl: string | null;
  bendaharaName: string;
  bendaharaMemberId: string | null;
  bendaharaSignUrl: string | null;
  onNoNotaChange: (v: string) => void;
  onTanggalChange: (v: string) => void;
  onPajakPersenChange: (v: number) => void;
  onItemsChange: (items: NotaItemRow[]) => void;
  onBidangUjianName: (v: string) => void;
  onBidangUjianMemberId: (v: string | null) => void;
  onBidangUjianSignUrl: (v: string | null) => void;
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
  bidangUjianName,
  bidangUjianMemberId,
  bidangUjianSignUrl,
  bendaharaName,
  bendaharaMemberId,
  bendaharaSignUrl,
  onNoNotaChange,
  onTanggalChange,
  onPajakPersenChange,
  onItemsChange,
  onBidangUjianName,
  onBidangUjianMemberId,
  onBidangUjianSignUrl,
  onBendaharaName,
  onBendaharaMemberId,
  onBendaharaSignUrl,
  onPrint,
  onPdf,
  onSaveArsip,
}: Props) {
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
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

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Rincian Pengeluaran / Nota</h3>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onPrint}>
            Cetak nota
          </Button>
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
              <th className="w-24 p-2">Aksi</th>
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
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"

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
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() =>
                            onItemsChange(items.filter((r) => r.id !== row.id))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
        <div className="space-y-2 rounded-md border p-3">
          <Label>Bidang Ujian (dari keanggotaan)</Label>
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
            placeholder="Cari Bidang Ujian (≥2 huruf)…"
          />
          <p className="text-[11px] text-muted-foreground">
            Ketik ≥2 huruf untuk cari pejabat dari keanggotaan.
          </p>
          <SignaturePadField
            label="Bidang Ujian"
            valueUrl={bidangUjianSignUrl}
            memberId={bidangUjianMemberId}
            onChange={onBidangUjianSignUrl}
          />
        </div>
        <div className="space-y-2 rounded-md border p-3">
          <Label>Bendahara (dari keanggotaan)</Label>
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
          <SignaturePadField
            label="Bendahara"
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
        onAddBulk={(newRows) => {
          const formattedRows: NotaItemRow[] = newRows.map((r) => ({
            ...r,
            id: newId(),
          }));
          onItemsChange([...items, ...formattedRows]);
        }}
      />
    </div>
  );
}

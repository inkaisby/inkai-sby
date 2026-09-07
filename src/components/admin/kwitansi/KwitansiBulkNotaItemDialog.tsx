"use client";

import React, { useState } from "react";
import { Plus, Trash2, Clipboard, Table, Check } from "lucide-react";
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
import { KwitansiMemberPicker } from "@/components/admin/kwitansi/KwitansiMemberPicker";
import { NotaItemRow } from "@/components/admin/kwitansi/NotaItemTable";
import { formatRp } from "@/lib/terbilang";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddBulk: (newRows: Omit<NotaItemRow, "id">[]) => void;
};

type BulkItem = {
  key: string;
  deskripsi: string;
  jumlah: string;
  harga: string;
  petugas: string;
  petugasMemberId?: string | null;
};

function formatNumberWithDots(val: string | number): string {
  const digits = String(val).replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10);
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("id-ID").format(num);
}

function parseNumber(val: string): number {
  const digits = String(val).replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function createEmptyRow(): BulkItem {
  return {
    key: `bulk-nota-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    deskripsi: "",
    jumlah: "1",
    harga: "",
    petugas: "",
    petugasMemberId: null,
  };
}

export function KwitansiBulkNotaItemDialog({
  open,
  onOpenChange,
  onAddBulk,
}: Props) {
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [defaultJumlah, setDefaultJumlah] = useState("1");
  const [defaultPetugas, setDefaultPetugas] = useState("");

  const [items, setItems] = useState<BulkItem[]>(() => [
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
  ]);

  const handleParsePaste = () => {
    if (!pasteText.trim()) return;

    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const parsedItems: BulkItem[] = lines.map((line) => {
      let parts: string[] = [];
      if (line.includes("\t")) {
        parts = line.split("\t");
      } else if (line.includes("|")) {
        parts = line.split("|");
      } else if (line.includes(";")) {
        parts = line.split(";");
      } else if (line.includes(",") && !line.match(/^\d+,\d+$/)) {
        parts = line.split(",");
      } else {
        parts = [line];
      }

      const desk = (parts[0] || "").trim();
      const jmRaw = (parts[1] || "").trim() || defaultJumlah || "1";
      const hgRaw = (parts[2] || "").trim();
      const ptg = (parts[3] || "").trim() || defaultPetugas.trim();

      const numJm = parseNumber(jmRaw) || 1;
      const numHg = parseNumber(hgRaw);

      return {
        key: `bulk-nota-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        deskripsi: desk,
        jumlah: String(numJm),
        harga: numHg > 0 ? formatNumberWithDots(numHg) : "",
        petugas: ptg,
      };
    });

    if (parsedItems.length > 0) {
      setItems(parsedItems);
      setShowPaste(false);
      setPasteText("");
    }
  };

  const handleAddRow = () => {
    setItems((prev) => [...prev, createEmptyRow()]);
  };

  const handleRemoveRow = (key: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev));
  };

  const handleRowChange = (key: string, field: keyof BulkItem, value: any) => {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, [field]: value } : i)),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validRows = items
      .map((i) => ({
        deskripsi: i.deskripsi.trim(),
        jumlah: Math.max(1, parseNumber(i.jumlah) || 1),
        harga: parseNumber(i.harga),
        petugas: i.petugas.trim(),
        petugasMemberId: i.petugasMemberId ?? null,
      }))
      .filter((i) => i.deskripsi.length > 0);

    if (validRows.length === 0) return;

    onAddBulk(validRows);
    onOpenChange(false);
    // Reset to default empty rows
    setItems([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
    setPasteText("");
    setShowPaste(false);
  };

  const validCount = items.filter((i) => i.deskripsi.trim().length > 0).length;
  const totalNominal = items.reduce(
    (sum, i) =>
      sum +
      (i.deskripsi.trim().length > 0
        ? (parseNumber(i.jumlah) || 1) * parseNumber(i.harga)
        : 0),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-2 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>Input Massal Rincian Pengeluaran Event</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPaste(!showPaste)}
              className="text-xs h-8"
            >
              {showPaste ? (
                <>
                  <Table className="mr-1.5 h-3.5 w-3.5" /> Table Input
                </>
              ) : (
                <>
                  <Clipboard className="mr-1.5 h-3.5 w-3.5" /> Tempel dari Excel
                </>
              )}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4 pt-3">
          {showPaste ? (
            <div className="flex-1 flex flex-col space-y-3 min-h-0">
              <div className="bg-muted/50 p-3 rounded-md border text-xs space-y-2 shrink-0">
                <p className="font-semibold text-foreground">
                  Petunjuk Tempel Excel / Teks Multi-baris:
                </p>
                <p className="text-muted-foreground">
                  Format per baris (pisah TAB / Koma / Pipe / Titik Koma):
                  <br />
                  <code className="bg-background px-1 py-0.5 rounded font-mono text-[11px] text-foreground">
                    Deskripsi [TAB] Jumlah [TAB] Harga [TAB] Petugas
                  </code>
                </p>
                <div className="flex flex-wrap gap-4 pt-1 border-t">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-[11px]">Default Jumlah:</Label>
                    <Input
                      className="h-7 w-16 text-xs"
                      value={defaultJumlah}
                      onChange={(e) => setDefaultJumlah(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-[11px]">Default Petugas:</Label>
                    <Input
                      className="h-7 w-36 text-xs"
                      placeholder="mis. Panitia / Seksi Konsumsi"
                      value={defaultPetugas}
                      onChange={(e) => setDefaultPetugas(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-[160px]">
                <textarea
                  className="w-full h-full min-h-[160px] p-3 text-xs font-mono border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={`Contoh Excel:
Sewa Lapangan Latber	1	1500000	Budi
Konsumsi Panitia	10	25000	Siti
Banner & Spanduk	2	150000	Agus`}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
              </div>

              <div className="flex justify-end shrink-0 pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleParsePaste}
                  disabled={!pasteText.trim()}
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Terapkan Teks Ke Tabel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              <p className="text-xs text-muted-foreground shrink-0">
                Isi baris rincian item pengeluaran event di bawah ini. Baris tanpa deskripsi akan diabaikan.
              </p>

              <div className="flex-1 overflow-auto border rounded-md min-h-[220px] p-2 space-y-2">
                <table className="w-full text-xs min-w-[680px]">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-1.5 w-10 text-center">No</th>
                      <th className="p-1.5 min-w-[220px]">Deskripsi Item</th>
                      <th className="p-1.5 w-20 text-center">Jumlah</th>
                      <th className="p-1.5 w-36">Harga (Rp)</th>
                      <th className="p-1.5 w-48 sm:w-56">Petugas (Opsional)</th>
                      <th className="p-1.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((row, index) => (
                      <tr key={row.key} className="hover:bg-muted/30">
                        <td className="p-1.5 text-muted-foreground">{index + 1}</td>
                        <td className="p-1.5">
                          <Input
                            className="h-8 text-xs"
                            placeholder="Deskripsi pengeluaran..."
                            value={row.deskripsi}
                            onChange={(e) =>
                              handleRowChange(row.key, "deskripsi", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            className="h-8 text-xs text-center font-medium"
                            type="number"
                            min="1"
                            value={row.jumlah}
                            onChange={(e) =>
                              handleRowChange(row.key, "jumlah", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            className="h-8 text-xs font-medium"
                            placeholder="150.000"
                            value={row.harga}
                            onChange={(e) =>
                              handleRowChange(
                                row.key,
                                "harga",
                                formatNumberWithDots(e.target.value),
                              )
                            }
                          />
                        </td>
                        <td className="p-1.5">
                          <KwitansiMemberPicker
                            value={row.petugas}
                            onChange={(v) => {
                              handleRowChange(row.key, "petugas", v);
                              handleRowChange(row.key, "petugasMemberId", null);
                            }}
                            onPick={(item) => {
                              handleRowChange(row.key, "petugas", item.fullName);
                              handleRowChange(
                                row.key,
                                "petugasMemberId",
                                item.id,
                              );
                            }}
                            placeholder="Nama / Cari anggota..."
                          />
                        </td>
                        <td className="p-1.5 text-center">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveRow(row.key)}
                            disabled={items.length <= 1}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between shrink-0 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddRow}
                  className="text-xs h-8"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Baris
                </Button>
                <div className="text-right text-xs">
                  <span className="text-muted-foreground">Total {validCount} item valid: </span>
                  <span className="font-bold text-foreground">{formatRp(totalNominal)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0 pt-3 border-t gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={validCount === 0}>
              Tambahkan {validCount > 0 ? `(${validCount} Item)` : ""} Ke Nota
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

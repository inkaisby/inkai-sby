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
import { PenerimaRow } from "@/components/admin/kwitansi/KwitansiPenerimaTable";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleColumnLabel: string;
  onAddBulk: (newRows: Omit<PenerimaRow, "id" | "selected">[]) => void;
};

type BulkItem = {
  key: string;
  namaLengkap: string;
  jabatan: string;
  nominal: string;
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
    key: `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    namaLengkap: "",
    jabatan: "",
    nominal: "",
  };
}

export function KwitansiBulkPenerimaDialog({
  open,
  onOpenChange,
  roleColumnLabel,
  onAddBulk,
}: Props) {
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [defaultJabatan, setDefaultJabatan] = useState("");
  const [defaultNominal, setDefaultNominal] = useState("");

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

      const nama = (parts[0] || "").trim();
      const jab = (parts[1] || "").trim() || defaultJabatan.trim();
      const nomRaw = (parts[2] || "").trim() || defaultNominal;

      return {
        key: `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        namaLengkap: nama,
        jabatan: jab,
        nominal: nomRaw ? formatNumberWithDots(nomRaw) : "",
      };
    });

    if (parsedItems.length > 0) {
      setItems(parsedItems);
      setPasteText("");
      setShowPaste(false);
    }
  };

  const updateItem = (key: string, field: keyof BulkItem, value: string) => {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)),
    );
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  const addEmptyRows = (count = 3) => {
    const newRows: BulkItem[] = [];
    for (let i = 0; i < count; i++) {
      newRows.push(createEmptyRow());
    }
    setItems((prev) => [...prev, ...newRows]);
  };

  const applyDefaultsToEmpty = () => {
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        jabatan: it.jabatan.trim() ? it.jabatan : defaultJabatan.trim(),
        nominal: it.nominal.trim()
          ? it.nominal
          : defaultNominal
          ? formatNumberWithDots(defaultNominal)
          : "",
      })),
    );
  };

  const validItems = items.filter((it) => it.namaLengkap.trim().length > 0);

  const handleSaveAll = () => {
    if (validItems.length === 0) return;

    const formattedRows = validItems.map((it) => ({
      namaLengkap: it.namaLengkap.trim(),
      jabatan: it.jabatan.trim() || defaultJabatan.trim(),
      nominal: parseNumber(it.nominal) || parseNumber(defaultNominal),
      signUrl: null,
      memberId: null,
    }));

    onAddBulk(formattedRows);
    onOpenChange(false);
    // Reset modal
    setItems([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
    setPasteText("");
    setShowPaste(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Table className="h-5 w-5 text-inkai-red" />
            Input Massal Penerima
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-sm">
          {/* Quick Defaults Bar */}
          <div className="rounded-md bg-muted/50 p-3 space-y-2 border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Nilai Default (Opsional - untuk baris kosong)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">{roleColumnLabel} Default</Label>
                <Input
                  className="h-8 text-xs bg-background"
                  placeholder="mis. Juara 1 Kumite / Panitia"
                  value={defaultJabatan}
                  onChange={(e) => setDefaultJabatan(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Nominal Default (Rp)</Label>
                <Input
                  className="h-8 text-xs bg-background"
                  placeholder="100.000"
                  inputMode="numeric"
                  value={defaultNominal}
                  onChange={(e) =>
                    setDefaultNominal(formatNumberWithDots(e.target.value))
                  }
                />
              </div>
              <div className="flex items-end gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs w-full"
                  onClick={applyDefaultsToEmpty}
                >
                  <Check className="mr-1 h-3 w-3" />
                  Terapkan ke baris
                </Button>
              </div>
            </div>
          </div>

          {/* Paste Section Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Salin & Tempel dari Excel / Spreadsheet:
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary"
                onClick={() => setShowPaste(!showPaste)}
              >
                <Clipboard className="mr-1 h-3 w-3" />
                {showPaste ? "Sembunyikan Kotak Tempel" : "Buka Kotak Tempel (Excel)"}
              </Button>
            </div>

            {showPaste && (
              <div className="space-y-2 rounded-md border p-3 bg-muted/20">
                <textarea
                  rows={4}
                  className="w-full rounded-md border border-input p-2 font-mono text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder={`Tempel teks dari Excel/Spreadsheet di sini...\nContoh:\nAchmad Muhri\tJuara 1 Kumite\t100000\nMarcella Cantya\tJuara 1 Kata\t100000\n\natau pisahkan dengan tanda garislurus (|) / koma:`}
                  value={pasteText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPasteText(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleParsePaste}
                    disabled={!pasteText.trim()}
                  >
                    Proses & Masukkan ke Tabel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Grid Table */}
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-xs min-w-[550px]">
              <thead>
                <tr className="bg-muted/70 text-left font-semibold border-b">
                  <th className="w-10 p-2 text-center">No</th>
                  <th className="p-2">Nama Lengkap *</th>
                  <th className="p-2 w-48">{roleColumnLabel}</th>
                  <th className="p-2 w-36 text-right">Nominal (Rp)</th>
                  <th className="w-10 p-2 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((it, idx) => (
                  <tr key={it.key} className="hover:bg-muted/30">
                    <td className="p-2 text-center text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="p-1">
                      <Input
                        className="h-8 text-xs"
                        placeholder="Nama penerima..."
                        value={it.namaLengkap}
                        onChange={(e) =>
                          updateItem(it.key, "namaLengkap", e.target.value)
                        }
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        className="h-8 text-xs"
                        placeholder={defaultJabatan || "Sebagai / Peran"}
                        value={it.jabatan}
                        onChange={(e) =>
                          updateItem(it.key, "jabatan", e.target.value)
                        }
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        className="h-8 text-xs text-right font-mono"
                        placeholder={defaultNominal || "0"}
                        inputMode="numeric"
                        value={it.nominal}
                        onChange={(e) =>
                          updateItem(
                            it.key,
                            "nominal",
                            formatNumberWithDots(e.target.value)
                          )
                        }
                      />
                    </td>
                    <td className="p-1 text-center">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(it.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addEmptyRows(3)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              + 3 Baris Kosong
            </Button>
            <span className="text-xs text-muted-foreground">
              {validItems.length} baris siap dimasukkan
            </span>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSaveAll}
            disabled={validItems.length === 0}
          >
            Tambahkan {validItems.length > 0 ? `${validItems.length} Penerima` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

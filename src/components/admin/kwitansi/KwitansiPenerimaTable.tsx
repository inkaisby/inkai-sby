"use client";

import { useState } from "react";
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
import { formatRp } from "@/lib/terbilang";

export type PenerimaRow = {
  id: string;
  memberId?: string | null;
  namaLengkap: string;
  jabatan: string;
  nominal: number;
  signUrl?: string | null;
  selected: boolean;
};

type Props = {
  rows: PenerimaRow[];
  roleColumnLabel: string;
  onChange: (rows: PenerimaRow[]) => void;
  onPrint: () => void;
  onPdf: () => void;
  onFillFromSelected?: () => void;
  showBatchActions?: boolean;
  /** Mode A: tampilkan baris Total terpilih jika ada centang */
  showSelectedTotal?: boolean;
};

function newId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function KwitansiPenerimaTable({
  rows,
  roleColumnLabel,
  onChange,
  onPrint,
  onPdf,
  onFillFromSelected,
  showBatchActions,
  showSelectedTotal,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [jabatan, setJabatan] = useState("");
  const [nominal, setNominal] = useState("");
  const [signUrl, setSignUrl] = useState<string | null>(null);

  const total = rows.reduce((s, r) => s + (Number(r.nominal) || 0), 0);
  const selected = rows.filter((r) => r.selected);
  const selectedTotal = selected.reduce(
    (s, r) => s + (Number(r.nominal) || 0),
    0,
  );

  const resetForm = () => {
    setEditingId(null);
    setNama("");
    setMemberId(null);
    setJabatan("");
    setNominal("");
    setSignUrl(null);
  };

  const openAdd = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (row: PenerimaRow) => {
    setEditingId(row.id);
    setNama(row.namaLengkap);
    setMemberId(row.memberId ?? null);
    setJabatan(row.jabatan);
    setNominal(String(row.nominal || ""));
    setSignUrl(row.signUrl ?? null);
    setOpen(true);
  };

  const save = () => {
    const nom = Math.floor(Number(String(nominal).replace(/\D/g, "")) || 0);
    if (!nama.trim()) return;
    if (editingId) {
      onChange(
        rows.map((r) =>
          r.id === editingId
            ? {
                ...r,
                namaLengkap: nama.trim(),
                memberId,
                jabatan: jabatan.trim(),
                nominal: nom,
                signUrl,
              }
            : r,
        ),
      );
    } else {
      onChange([
        ...rows,
        {
          id: newId(),
          namaLengkap: nama.trim(),
          memberId,
          jabatan: jabatan.trim(),
          nominal: nom,
          signUrl,
          selected: false,
        },
      ]);
    }
    setOpen(false);
    resetForm();
  };

  const onPick = (item: KwitansiMemberSuggestItem) => {
    setNama(item.fullName);
    setMemberId(item.id);
    if (item.officerTitle) setJabatan(item.officerTitle);
    if (item.signatureUrl) setSignUrl(item.signatureUrl);
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Daftar Penerima</h3>
        <div className="flex flex-wrap gap-2">
          {showBatchActions && onFillFromSelected ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onFillFromSelected}
            >
              Isi / pratinjau dari terpilih
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={onPrint}>
            Cetak daftar
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onPdf}>
            PDF daftar
          </Button>
          <Button type="button" size="sm" onClick={openAdd}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Tambah penerima
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="w-10 p-2"></th>
              <th className="w-12 p-2">No.</th>
              <th className="p-2">Nama Lengkap</th>
              <th className="p-2">{roleColumnLabel}</th>
              <th className="p-2 text-right">Nominal</th>
              <th className="p-2">Tanda Tangan</th>
              <th className="w-24 p-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-muted-foreground"
                >
                  Belum ada penerima — Tambah penerima
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-inkai-red"
                      checked={row.selected}
                      onChange={(e) =>
                        onChange(
                          rows.map((r) =>
                            r.id === row.id
                              ? { ...r, selected: e.target.checked }
                              : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="p-2">{idx + 1}</td>
                  <td className="p-2 font-medium">{row.namaLengkap}</td>
                  <td className="p-2">{row.jabatan || "—"}</td>
                  <td className="p-2 text-right">{formatRp(row.nominal)}</td>
                  <td className="p-2">
                    <SignaturePadField
                      label={row.namaLengkap}
                      valueUrl={row.signUrl}
                      memberId={row.memberId}
                      previewSize="md"
                      onChange={(url) =>
                        onChange(
                          rows.map((r) =>
                            r.id === row.id ? { ...r, signUrl: url } : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() =>
                          onChange(rows.filter((r) => r.id !== row.id))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td colSpan={4} className="p-2 text-right">
                TOTAL
              </td>
              <td className="p-2 text-right">{formatRp(total)}</td>
              <td colSpan={2}></td>
            </tr>
            {showSelectedTotal && selected.length > 0 ? (
              <tr className="font-semibold text-inkai-red">
                <td colSpan={4} className="p-2 text-right">
                  Total terpilih ({selected.length})
                </td>
                <td className="p-2 text-right">{formatRp(selectedTotal)}</td>
                <td colSpan={2}></td>
              </tr>
            ) : null}
          </tfoot>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-visible">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit penerima" : "Tambah penerima"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nama Lengkap</Label>
              <KwitansiMemberPicker
                value={nama}
                onChange={(v) => {
                  setNama(v);
                  setMemberId(null);
                }}
                onPick={onPick}
                placeholder="Cari nama anggota (≥2 huruf)…"
              />
              <p className="text-[11px] text-muted-foreground">
                Ketik ≥2 huruf untuk cari anggota, atau nama bebas.
              </p>
            </div>
            <div className="space-y-1">
              <Label>{roleColumnLabel}</Label>
              <Input
                value={jabatan}
                onChange={(e) => setJabatan(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Nominal</Label>
              <Input
                inputMode="numeric"
                value={nominal}
                onChange={(e) => setNominal(e.target.value.replace(/\D/g, ""))}
                placeholder="1500000"
              />
            </div>
            <div className="space-y-1">
              <Label>Tanda Tangan</Label>
              <SignaturePadField
                label={nama || "Penerima"}
                valueUrl={signUrl}
                memberId={memberId}
                previewSize="md"
                onChange={setSignUrl}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button type="button" onClick={save} disabled={!nama.trim()}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

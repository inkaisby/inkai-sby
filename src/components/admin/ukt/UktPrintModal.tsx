"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getBeltGroup } from "@/lib/belt";
import {
  BELT_FEE_KEYS,
  buildNotaNumber,
  formatRupiahNota,
  type BeltFeeKey,
  type UktMemberRow,
  type UktSemester,
} from "@/lib/ukt";

type Props = {
  open: boolean;
  onClose: () => void;
  periodTitle: string;
  semester: UktSemester;
  year: number;
  rows: UktMemberRow[];
  dojos: { id: string; name: string }[];
  dojoFilter: string;
  beltFees: Record<BeltFeeKey, number>;
  isDojoAdmin: boolean;
};

type PrintConfig = {
  notaNo: string;
  semester: string;
  rusak: number;
  hilang: number;
  komisi: number;
  fees: Record<BeltFeeKey, number>;
};

function emptyCounts(): Record<BeltFeeKey, number> {
  return { PUTIH: 0, KUNING: 0, HIJAU: 0, BIRU: 0, COKELAT: 0 };
}

export function UktPrintModal({
  open,
  onClose,
  periodTitle,
  semester,
  year,
  rows,
  dojos,
  dojoFilter,
  beltFees,
  isDojoAdmin,
}: Props) {
  const dojoOptions = useMemo(() => {
    const names = new Set<string>();
    for (const r of rows) names.add(r.dojoName);
    const list = dojos.filter((d) => names.has(d.name));
    if (list.length > 0) return list;
    if (dojoFilter) {
      const match = dojos.find((d) => d.id === dojoFilter);
      if (match) return [match];
    }
    return dojos;
  }, [rows, dojos, dojoFilter]);

  const defaultDojoId = dojoFilter || dojoOptions[0]?.id || "";

  const [selectedDojoId, setSelectedDojoId] = useState(defaultDojoId);
  const [config, setConfig] = useState<PrintConfig>(() => {
    const dojoName = dojos.find((d) => d.id === defaultDojoId)?.name || dojoOptions[0]?.name || "";
    return {
      notaNo: buildNotaNumber(dojoName, semester, year),
      semester: `${semester} / ${year}`,
      rusak: 0,
      hilang: 0,
      komisi: 50000,
      fees: { ...beltFees },
    };
  });

  useEffect(() => {
    if (!open) return;
    const dojoName = dojos.find((d) => d.id === defaultDojoId)?.name || dojoOptions[0]?.name || "";
    setSelectedDojoId(defaultDojoId);
    setConfig({
      notaNo: buildNotaNumber(dojoName, semester, year),
      semester: `${semester} / ${year}`,
      rusak: 0,
      hilang: 0,
      komisi: 50000,
      fees: { ...beltFees },
    });
  }, [open, defaultDojoId, dojoOptions, dojos, semester, year, beltFees]);

  const selectedDojoName = dojos.find((d) => d.id === selectedDojoId)?.name || "";
  const list = useMemo(
    () => rows.filter((r) => r.dojoName === selectedDojoName),
    [rows, selectedDojoName],
  );

  const counts = useMemo(() => {
    const result = emptyCounts();
    list.forEach((r) => {
      const grp = getBeltGroup(r.kyuBaru || r.kyuLama);
      if (grp in result) result[grp as BeltFeeKey]++;
    });
    return result;
  }, [list]);

  const subtotalA = BELT_FEE_KEYS.reduce((sum, belt) => sum + counts[belt] * config.fees[belt], 0);
  const subtotalB = config.rusak * 15000 + config.hilang * 100000;
  const totalC = list.length * config.komisi;
  const grandTotal = subtotalA + subtotalB - totalC;

  const handleDojoChange = (dojoId: string) => {
    const dojoName = dojos.find((d) => d.id === dojoId)?.name || "";
    setSelectedDojoId(dojoId);
    setConfig((prev) => ({
      ...prev,
      notaNo: buildNotaNumber(dojoName, semester, year),
    }));
  };

  const updateConfig = (field: keyof Omit<PrintConfig, "fees">, value: string | number) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Cetak Nota Pembayaran UKT</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={handlePrint}>
                <Printer className="mr-1 h-4 w-4" />
                Print
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 rounded-lg border p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Ranting</label>
              <Select value={selectedDojoId} onValueChange={handleDojoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih ranting" />
                </SelectTrigger>
                <SelectContent>
                  {dojoOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Nota No.</label>
              <Input value={config.notaNo} onChange={(e) => updateConfig("notaNo", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Semester</label>
              <Input
                value={config.semester}
                onChange={(e) => updateConfig("semester", e.target.value)}
                disabled={isDojoAdmin}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Buku Rusak</label>
              <Input
                type="number"
                value={config.rusak}
                onChange={(e) => updateConfig("rusak", parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Buku Hilang</label>
              <Input
                type="number"
                value={config.hilang}
                onChange={(e) => updateConfig("hilang", parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Komisi Ranting/orang</label>
              <Input
                type="number"
                value={config.komisi}
                onChange={(e) => updateConfig("komisi", parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {BELT_FEE_KEYS.map((belt) => (
              <div key={belt} className="rounded-md border p-2">
                <p className="text-xs font-medium">
                  {belt} {formatRupiahNota(config.fees[belt])} × {counts[belt]} anggota
                </p>
                <Input
                  type="number"
                  className="mt-1 h-8 text-xs"
                  value={config.fees[belt]}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      fees: { ...prev.fees, [belt]: parseInt(e.target.value, 10) || 0 },
                    }))
                  }
                  disabled={isDojoAdmin}
                />
              </div>
            ))}
          </div>

          <div
            id="print-document-ukt"
            className="print-document bg-white p-8 font-mono text-xs leading-relaxed text-black"
          >
            <div className="mb-6 border-b-2 border-black pb-4 text-center">
              <div className="text-lg font-bold">INKAI — INSTITUT KARATE-DO INDONESIA</div>
              <div className="text-sm">KOTA SURABAYA</div>
            </div>

            <h4 className="mb-6 text-center text-sm font-bold uppercase tracking-wide">
              NOTA PEMBAYARAN UJIAN KENAIKAN TINGKAT
            </h4>

            <div className="mb-6 grid grid-cols-2 gap-2 text-sm">
              <div>Nota No. : {config.notaNo}</div>
              <div>SEMESTER : {config.semester}</div>
              <div className="col-span-2 font-bold uppercase">RANTING : {selectedDojoName}</div>
              <div className="col-span-2">Agenda : {periodTitle}</div>
            </div>

            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-black">
                  <th className="py-1 text-left">Sabuk</th>
                  <th className="py-1 text-right">Jumlah</th>
                  <th className="py-1 text-right">Biaya</th>
                  <th className="py-1 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {BELT_FEE_KEYS.map((belt) => (
                  <tr key={belt}>
                    <td className="py-0.5">{belt}</td>
                    <td className="py-0.5 text-right">{counts[belt]}</td>
                    <td className="py-0.5 text-right">{formatRupiahNota(config.fees[belt])}</td>
                    <td className="py-0.5 text-right">
                      {formatRupiahNota(counts[belt] * config.fees[belt])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal A (Biaya UKT)</span>
                <span>{formatRupiahNota(subtotalA)}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal B (Buku Rusak/Hilang)</span>
                <span>{formatRupiahNota(subtotalB)}</span>
              </div>
              <div className="flex justify-between">
                <span>
                  Komisi Ranting ({list.length} × {formatRupiahNota(config.komisi)})
                </span>
                <span>- {formatRupiahNota(totalC)}</span>
              </div>
              <div className="flex justify-between border-t border-black pt-2 text-base font-bold">
                <span>TOTAL</span>
                <span>{formatRupiahNota(grandTotal)}</span>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-8 text-center text-sm">
              <div>
                <div className="mb-16">Ketua Ranting</div>
                <div className="border-t border-black pt-1">( _________________ )</div>
              </div>
              <div>
                <div className="mb-16">Bendahara Cabang</div>
                <div className="border-t border-black pt-1">Habibur Rahman</div>
              </div>
            </div>

            <div className="mt-4 text-center text-xs text-gray-500">
              {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
          @media print {
            body * { visibility: hidden !important; }
            .print-document, .print-document * { visibility: visible !important; }
            .print-document {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
            }
          }
        `,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

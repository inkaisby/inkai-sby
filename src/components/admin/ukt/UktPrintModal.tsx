"use client";

import { useMemo, useState } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getBeltGroup } from "@/lib/belt";
import { DEFAULT_BELT_FEES, buildNotaNumber, type UktMemberRow, type UktSemester } from "@/lib/ukt";

type Props = {
  open: boolean;
  onClose: () => void;
  periodTitle: string;
  semester: UktSemester;
  year: number;
  rows: UktMemberRow[];
  dojos: { id: string; name: string }[];
  dojoFilter: string;
};

type PrintConfig = {
  notaNo: string;
  semester: string;
  rusak: number;
  hilang: number;
  komisi: number;
  fees: Record<string, number>;
};

export function UktPrintModal({ open, onClose, periodTitle, semester, year, rows, dojos, dojoFilter }: Props) {
  const dojoGroups = useMemo(() => {
    const groups: Record<string, UktMemberRow[]> = {};
    for (const r of rows) {
      const key = r.dojoName;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    if (dojoFilter) {
      const name = dojos.find((d) => d.id === dojoFilter)?.name;
      if (name && groups[name]) return { [name]: groups[name] };
    }
    return groups;
  }, [rows, dojoFilter, dojos]);

  const [configs, setConfigs] = useState<Record<string, PrintConfig>>(() => {
    const init: Record<string, PrintConfig> = {};
    Object.keys(dojoGroups).forEach((dojoName) => {
      init[dojoName] = {
        notaNo: buildNotaNumber(dojoName, semester, year),
        semester: `${semester} / ${year}`,
        rusak: 0,
        hilang: 0,
        komisi: 50000,
        fees: { ...DEFAULT_BELT_FEES },
      };
    });
    return init;
  });

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

        <div className="space-y-6">
          {Object.entries(dojoGroups).map(([dojoName, list]) => {
            const config = configs[dojoName];
            if (!config) return null;

            const counts = { PUTIH: 0, KUNING: 0, HIJAU: 0, BIRU: 0, COKELAT: 0 };
            list.forEach((r) => {
              const grp = getBeltGroup(r.kyuBaru || r.kyuLama);
              if (grp in counts) counts[grp as keyof typeof counts]++;
            });

            const subtotalA =
              counts.PUTIH * config.fees.PUTIH +
              counts.KUNING * config.fees.KUNING +
              counts.HIJAU * config.fees.HIJAU +
              counts.BIRU * config.fees.BIRU +
              counts.COKELAT * config.fees.COKELAT;
            const subtotalB = config.rusak * 15000 + config.hilang * 100000;
            const totalC = list.length * config.komisi;
            const grandTotal = subtotalA + subtotalB - totalC;

            const updateConfig = (field: string, value: string | number) => {
              setConfigs((prev) => ({
                ...prev,
                [dojoName]: { ...prev[dojoName], [field]: value },
              }));
            };

            return (
              <div key={dojoName} className="space-y-4 rounded-lg border p-4">
                <h3 className="font-bold uppercase">{dojoName}</h3>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <label className="text-xs text-muted-foreground">Nota No.</label>
                    <Input
                      value={config.notaNo}
                      onChange={(e) => updateConfig("notaNo", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Semester</label>
                    <Input
                      value={config.semester}
                      onChange={(e) => updateConfig("semester", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Buku Rusak</label>
                    <Input
                      type="number"
                      value={config.rusak}
                      onChange={(e) => updateConfig("rusak", parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Buku Hilang</label>
                    <Input
                      type="number"
                      value={config.hilang}
                      onChange={(e) => updateConfig("hilang", parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Komisi Ranting/orang</label>
                    <Input
                      type="number"
                      value={config.komisi}
                      onChange={(e) => updateConfig("komisi", parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2 text-xs">
                  {Object.entries(config.fees).map(([belt, fee]) => (
                    <div key={belt}>
                      <label className="text-muted-foreground">{belt}</label>
                      <Input
                        type="number"
                        value={fee}
                        onChange={(e) =>
                          setConfigs((prev) => ({
                            ...prev,
                            [dojoName]: {
                              ...prev[dojoName],
                              fees: { ...prev[dojoName].fees, [belt]: parseInt(e.target.value) || 0 },
                            },
                          }))
                        }
                      />
                      <span className="text-muted-foreground">× {counts[belt as keyof typeof counts]}</span>
                    </div>
                  ))}
                </div>

                {/* Print preview */}
                <div
                  id={`print-document-${dojoName}`}
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
                    <div className="col-span-2 font-bold uppercase">RANTING : {dojoName}</div>
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
                      {Object.entries(counts).map(([belt, count]) =>
                        count > 0 ? (
                          <tr key={belt}>
                            <td className="py-0.5">{belt}</td>
                            <td className="py-0.5 text-right">{count}</td>
                            <td className="py-0.5 text-right">
                              Rp {config.fees[belt].toLocaleString("id-ID")}
                            </td>
                            <td className="py-0.5 text-right">
                              Rp {(count * config.fees[belt]).toLocaleString("id-ID")}
                            </td>
                          </tr>
                        ) : null,
                      )}
                    </tbody>
                  </table>

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal A (Biaya UKT)</span>
                      <span>Rp {subtotalA.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Subtotal B (Buku Rusak/Hilang)</span>
                      <span>Rp {subtotalB.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Komisi Ranting ({list.length} × Rp {config.komisi.toLocaleString("id-ID")})</span>
                      <span>- Rp {totalC.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between border-t border-black pt-2 text-base font-bold">
                      <span>TOTAL</span>
                      <span>Rp {grandTotal.toLocaleString("id-ID")}</span>
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
            );
          })}
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden !important; }
            .print-document, .print-document * { visibility: visible !important; }
            .print-document {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              page-break-after: always;
            }
          }
        `}} />
      </DialogContent>
    </Dialog>
  );
}

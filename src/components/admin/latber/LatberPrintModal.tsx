"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  formatLatberCurrency,
  formatLatberRank,
  type LatberMemberRow,
} from "@/lib/latber";

type LatberPrintModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodTitle: string;
  rows: LatberMemberRow[];
  feeAmount: number;
  komisiRanting: number;
  totals: {
    paidCount: number;
    subtotal: number;
    komisiTotal: number;
    grandTotal: number;
  };
};

export function LatberPrintModal({
  open,
  onOpenChange,
  periodTitle,
  rows,
  feeAmount,
  komisiRanting,
  totals,
}: LatberPrintModalProps) {
  function handlePrint() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto print:max-w-none">
        <DialogHeader>
          <DialogTitle>Nota Latber — {periodTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm print:text-black" id="latber-nota-print">
          <p className="text-muted-foreground print:text-gray-600">
            Rincian setor ke cabang (peserta lunas × {formatLatberCurrency(feeAmount)} − komisi{" "}
            {formatLatberCurrency(komisiRanting)}/peserta)
          </p>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-2">No</th>
                <th className="py-2 pr-2">NIA</th>
                <th className="py-2 pr-2">Nama</th>
                <th className="py-2 pr-2">Sabuk</th>
                <th className="py-2 text-right">Biaya</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.registrationId ?? r.memberId} className="border-b border-border/40">
                  <td className="py-1.5 pr-2">{i + 1}</td>
                  <td className="py-1.5 pr-2">{r.nia || "—"}</td>
                  <td className="py-1.5 pr-2">{r.fullName}</td>
                  <td className="py-1.5 pr-2">{formatLatberRank(r)}</td>
                  <td className="py-1.5 text-right">{formatLatberCurrency(feeAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-1 border-t pt-3">
            <div className="flex justify-between">
              <span>Peserta lunas</span>
              <span>{totals.paidCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatLatberCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-amber-800">
              <span>Komisi ranting</span>
              <span>− {formatLatberCurrency(totals.komisiTotal)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Setor cabang</span>
              <span>{formatLatberCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button type="button" onClick={handlePrint}>
            Cetak
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

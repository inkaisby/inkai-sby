"use client";

import { useMemo } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatLatberCurrency,
  formatLatberRank,
  type LatberMemberRow,
} from "@/lib/latber";
import { printLatberNotaDocument } from "@/lib/latber-print-html";

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
  orgProfile?: {
    address?: string;
    bendaharaCabangName?: string;
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
  orgProfile,
}: LatberPrintModalProps) {
  const printedAt = useMemo(
    () =>
      new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [open],
  );

  function handlePrint() {
    printLatberNotaDocument({
      periodTitle,
      rows: rows.map((r, i) => ({
        no: i + 1,
        nia: r.nia || "—",
        nama: r.fullName,
        sabuk: formatLatberRank(r),
        biaya: formatLatberCurrency(feeAmount),
      })),
      paidCount: totals.paidCount,
      subtotal: formatLatberCurrency(totals.subtotal),
      komisiTotal: formatLatberCurrency(totals.komisiTotal),
      grandTotal: formatLatberCurrency(totals.grandTotal),
      origin: window.location.origin,
      printedAt,
      sekretariatAddress: orgProfile?.address,
      bendaharaCabangName: orgProfile?.bendaharaCabangName,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nota Latihan Bersama — {periodTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Rincian setor ke cabang (peserta lunas × {formatLatberCurrency(feeAmount)} −
            komisi {formatLatberCurrency(komisiRanting)}/peserta)
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
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    Belum ada peserta lunas
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr
                    key={r.registrationId ?? r.memberId}
                    className="border-b border-border/40"
                  >
                    <td className="py-1.5 pr-2">{i + 1}</td>
                    <td className="py-1.5 pr-2">{r.nia || "—"}</td>
                    <td className="py-1.5 pr-2">{r.fullName}</td>
                    <td className="py-1.5 pr-2">{formatLatberRank(r)}</td>
                    <td className="py-1.5 text-right">{formatLatberCurrency(feeAmount)}</td>
                  </tr>
                ))
              )}
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
          <p className="text-xs text-muted-foreground">
            Cetak menghasilkan dokumen terpisah dengan kop INKAI, logo, dan blok tanda tangan
            bendahara cabang.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button type="button" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Cetak
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

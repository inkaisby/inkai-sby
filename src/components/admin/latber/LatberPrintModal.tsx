"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatLatberCurrency,
  formatLatberRank,
  latberDisplayStatusLabel,
  resolveLatberDisplayStatus,
  type LatberMemberRow,
} from "@/lib/latber";
import { printLatberNotaDocument } from "@/lib/latber-print-html";

type LatberPrintModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodTitle: string;
  rows: LatberMemberRow[];
  dojos?: Array<{ id: string; name: string }>;
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
  dojos = [],
  feeAmount,
  komisiRanting: initialKomisiRanting,
  orgProfile,
}: LatberPrintModalProps) {
  // Extract unique dojo names/ids present in rows or provided in dojos prop
  const dojoOptions = useMemo(() => {
    const names = new Set<string>();
    for (const r of rows) {
      if (r.dojoName) names.add(r.dojoName);
    }
    let list = dojos.filter((d) => names.has(d.name));
    if (list.length > 0) {
      return list.sort((a, b) => a.name.localeCompare(b.name, "id"));
    }
    const map = new Map<string, string>();
    for (const r of rows) {
      const key = r.dojoId || r.dojoName || "unknown";
      if (!map.has(key)) {
        map.set(key, r.dojoName || "Ranting");
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [rows, dojos]);

  const [selectedDojoIds, setSelectedDojoIds] = useState<Set<string>>(() => new Set());
  const [customKomisiRanting, setCustomKomisiRanting] = useState<number>(initialKomisiRanting);
  const [printBusy, setPrintBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedDojoIds(new Set(dojoOptions.map((d) => d.id)));
    setCustomKomisiRanting(initialKomisiRanting);
  }, [open, dojoOptions, initialKomisiRanting]);

  const selectedNames = useMemo(() => {
    return dojoOptions
      .filter((d) => selectedDojoIds.has(d.id))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, "id"));
  }, [selectedDojoIds, dojoOptions]);

  const displayDojoName = useMemo(() => {
    if (selectedNames.length === 0) return "";
    if (selectedNames.length === 1) return selectedNames[0];
    return `GABUNGAN (${selectedNames.join(", ")})`;
  }, [selectedNames]);

  // Filter rows based on selected dojos
  const filteredRows = useMemo(() => {
    if (dojoOptions.length === 0) return rows;
    return rows.filter((r) => {
      const key = r.dojoId || r.dojoName || "unknown";
      return selectedDojoIds.has(key) || (Boolean(r.dojoName) && selectedDojoIds.has(r.dojoName!));
    });
  }, [rows, selectedDojoIds, dojoOptions]);

  const paidCount = filteredRows.length;
  const subtotal = paidCount * feeAmount;
  const komisiTotal = paidCount * customKomisiRanting;
  const grandTotal = subtotal - komisiTotal;

  const allSelected = dojoOptions.length > 0 && selectedDojoIds.size === dojoOptions.length;
  const canPrint = selectedDojoIds.size > 0 && paidCount > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedDojoIds(new Set());
    } else {
      setSelectedDojoIds(new Set(dojoOptions.map((d) => d.id)));
    }
  };

  const toggleDojo = (id: string) => {
    const next = new Set(selectedDojoIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDojoIds(next);
  };

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
    if (!canPrint || printBusy) return;
    setPrintBusy(true);
    try {
      printLatberNotaDocument({
        periodTitle,
        dojoName: displayDojoName,
        komisiPerPerson: formatLatberCurrency(customKomisiRanting),
        rows: filteredRows.map((r, i) => ({
          no: i + 1,
          nia: r.nia || "—",
          nama: r.fullName,
          sabuk: formatLatberRank(r),
          status: latberDisplayStatusLabel(resolveLatberDisplayStatus(r)),
          biaya: formatLatberCurrency(feeAmount),
        })),
        paidCount,
        subtotal: formatLatberCurrency(subtotal),
        komisiTotal: formatLatberCurrency(komisiTotal),
        grandTotal: formatLatberCurrency(grandTotal),
        origin: window.location.origin,
        printedAt,
        sekretariatAddress: orgProfile?.address,
        bendaharaCabangName: orgProfile?.bendaharaCabangName,
      });
    } finally {
      setTimeout(() => setPrintBusy(false), 1500);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>Nota Latihan Bersama — {periodTitle}</span>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              disabled={!canPrint || printBusy}
            >
              <Printer className="mr-2 h-4 w-4" />
              {printBusy ? "Mencetak…" : "Cetak"}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 rounded-lg border p-4 text-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Left: Dojo Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-muted-foreground">Pilih Ranting</label>
                {dojoOptions.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={toggleAll} className="h-6 text-xs px-2">
                    {allSelected ? "Hapus semua" : "Pilih semua"}
                  </Button>
                )}
              </div>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border p-2 bg-background">
                {dojoOptions.length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">Belum ada peserta lunas.</p>
                ) : (
                  dojoOptions.map((d) => {
                    const count = rows.filter(
                      (r) => r.dojoId === d.id || r.dojoName === d.name,
                    ).length;
                    return (
                      <label
                        key={d.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/60"
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-inkai-red rounded border-gray-300"
                          checked={selectedDojoIds.has(d.id)}
                          onChange={() => toggleDojo(d.id)}
                        />
                        <span className="flex-1 font-medium">{d.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {count} peserta
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              {selectedDojoIds.size === 0 && (
                <p className="text-xs text-destructive">Pilih minimal satu ranting.</p>
              )}
            </div>

            {/* Right: Fee & Commission Controls */}
            <div className="space-y-3 rounded-md border bg-muted/20 p-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Biaya Peserta</label>
                <div className="mt-1 text-sm font-semibold">{formatLatberCurrency(feeAmount)} / orang</div>
              </div>
              <div>
                <label htmlFor="latber-komisi-input" className="text-xs font-semibold text-muted-foreground">
                  Komisi Ranting per Peserta (Rp)
                </label>
                <Input
                  id="latber-komisi-input"
                  type="number"
                  min={0}
                  step={500}
                  className="mt-1 h-8 text-sm"
                  value={customKomisiRanting}
                  onChange={(e) => setCustomKomisiRanting(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
              </div>
              <div className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Peserta Lunas Filtered:</span>
                  <span className="font-semibold">{paidCount} orang</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal Biaya:</span>
                  <span>{formatLatberCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-amber-700">
                  <span>Total Komisi Ranting:</span>
                  <span>− {formatLatberCurrency(komisiTotal)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-semibold text-foreground">
                  <span>Setor ke Cabang:</span>
                  <span>{formatLatberCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Paper Document Preview */}
        <div
          id="print-document-latber"
          className="mt-2 rounded-lg border bg-white p-6 font-mono text-xs leading-relaxed text-black shadow-sm"
        >
          <div className="mb-4 flex items-center justify-center gap-3 border-b-2 border-black pb-3">
            <img
              src="/logo-inkai.png"
              alt="Logo INKAI"
              width={56}
              height={56}
              className="h-12 w-12 shrink-0 object-contain"
            />
            <div className="text-center">
              <div className="text-base font-bold">INKAI — INSTITUT KARATE-DO INDONESIA</div>
              <div className="text-xs font-semibold">KOTA SURABAYA</div>
              <div className="text-[10px]">
                {orgProfile?.address?.trim() || "Sekretariat: Jl. Raya Kertajaya Indah No. 77 Surabaya"}
              </div>
            </div>
          </div>

          <h4 className="mb-4 text-center text-xs font-bold uppercase tracking-wide">
            NOTA LATIHAN BERSAMA
          </h4>

          <div className="mb-4 grid grid-cols-2 gap-1 text-xs">
            <div className="col-span-2 font-bold uppercase">AGENDA : {periodTitle}</div>
            {displayDojoName && (
              <div className="col-span-2 font-bold uppercase">RANTING : {displayDojoName}</div>
            )}
            <div className="col-span-2">PESERTA LUNAS : {paidCount} orang</div>
          </div>

          <table className="mb-4 w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1 w-8 text-center">No</th>
                <th className="py-1">NIA</th>
                <th className="py-1">Nama</th>
                <th className="py-1">Sabuk</th>
                <th className="py-1">Status</th>
                <th className="py-1 w-10 text-center">Hadir</th>
                <th className="py-1 text-right">Biaya</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-muted-foreground">
                    Belum ada peserta lunas
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, i) => (
                  <tr key={r.registrationId ?? r.memberId} className="border-b border-gray-200">
                    <td className="py-1 text-center">{i + 1}</td>
                    <td className="py-1">{r.nia || "—"}</td>
                    <td className="py-1 break-words">{r.fullName}</td>
                    <td className="py-1">{formatLatberRank(r)}</td>
                    <td className="py-1">
                      {latberDisplayStatusLabel(resolveLatberDisplayStatus(r))}
                    </td>
                    <td className="py-1 text-center text-sm">☐</td>
                    <td className="py-1 text-right">{formatLatberCurrency(feeAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="space-y-1 text-xs border-t border-black pt-2">
            <div className="flex justify-between">
              <span>Subtotal Biaya ({paidCount} × {formatLatberCurrency(feeAmount)})</span>
              <span>{formatLatberCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Komisi Ranting ({paidCount} × {formatLatberCurrency(customKomisiRanting)})</span>
              <span>- {formatLatberCurrency(komisiTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-black pt-1 font-bold text-sm">
              <span>SETOR CABANG</span>
              <span>{formatLatberCurrency(grandTotal)}</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6 text-center text-xs">
            <div>
              <div className="mb-10">Ketua Ranting</div>
              <div className="border-t border-black pt-1">( _________________ )</div>
            </div>
            <div>
              <div className="mb-10">Bendahara Cabang</div>
              <div className="border-t border-black pt-1">
                {orgProfile?.bendaharaCabangName?.trim() || "Habibur Rahman"}
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-[10px] text-gray-500">
            {printedAt}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button type="button" onClick={handlePrint} disabled={!canPrint || printBusy}>
            <Printer className="mr-2 h-4 w-4" />
            {printBusy ? "Mencetak…" : "Cetak"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  buildNotaBeltLines,
  buildNotaNumber,
  formatRupiahNota,
  rowMatchesNotaDojoSelection,
  type BeltFeeKey,
  type UktMemberRow,
  type UktSemester,
} from "@/lib/ukt";
import { printUktNotaDocument } from "@/lib/ukt-print-html";

/** Sentinel default — pilih semua ranting di modal. */
export const UKT_NOTA_GABUNGAN_ID = "gabungan";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodTitle: string;
  semester: UktSemester;
  year: number;
  rows: UktMemberRow[];
  dojos: { id: string; name: string }[];
  /** UUID ranting atau `gabungan` untuk pilihan awal. */
  dojoFilter: string;
  beltFees: Record<BeltFeeKey, number>;
  komisiRanting: number;
  isDojoAdmin: boolean;
  orgProfile?: {
    address?: string;
    bidangUjianName?: string;
    bendaharaCabangName?: string;
  };
};

type PrintConfig = {
  notaNo: string;
  semester: string;
  rusak: number;
  hilang: number;
};

function isGabunganFilter(id: string): boolean {
  return id === UKT_NOTA_GABUNGAN_ID;
}

function resolveNotaSlug(
  selectedIds: Set<string>,
  dojoOptions: { id: string; name: string }[],
): string {
  if (selectedIds.size === 0) return "";
  if (selectedIds.size === 1) {
    const id = [...selectedIds][0];
    return dojoOptions.find((d) => d.id === id)?.name || "";
  }
  return "GABUNGAN";
}

function resolveSelectedNames(
  selectedIds: Set<string>,
  dojoOptions: { id: string; name: string }[],
): string[] {
  return dojoOptions
    .filter((d) => selectedIds.has(d.id))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, "id"));
}

export function UktPrintModal({
  open,
  onOpenChange,
  periodTitle,
  semester,
  year,
  rows,
  dojos,
  dojoFilter,
  beltFees,
  komisiRanting,
  isDojoAdmin,
  orgProfile,
}: Props) {
  const dojoOptions = useMemo(() => {
    const names = new Set<string>();
    for (const r of rows) names.add(r.dojoName);
    let list = dojos.filter((d) => names.has(d.name));
    if (list.length > 0) {
      return list.sort((a, b) => a.name.localeCompare(b.name, "id"));
    }
    if (dojoFilter && !isGabunganFilter(dojoFilter)) {
      const match = dojos.find((d) => d.id === dojoFilter);
      if (match) return [match];
    }
    return [...dojos].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [rows, dojos, dojoFilter]);

  const lockSingleDojo = dojoOptions.length === 1;

  const resolveDefaultSelectedIds = (): Set<string> => {
    if (
      dojoFilter &&
      !isGabunganFilter(dojoFilter) &&
      dojoOptions.some((d) => d.id === dojoFilter)
    ) {
      return new Set([dojoFilter]);
    }
    return new Set(dojoOptions.map((d) => d.id));
  };

  const buildInitialConfig = (selectedIds: Set<string>): PrintConfig => {
    const notaSlug = resolveNotaSlug(selectedIds, dojoOptions);
    return {
      notaNo: notaSlug ? buildNotaNumber(notaSlug, semester, year) : "",
      semester: `${semester} / ${year}`,
      rusak: 0,
      hilang: 0,
    };
  };

  const [selectedDojoIds, setSelectedDojoIds] = useState<Set<string>>(
    () => resolveDefaultSelectedIds(),
  );
  const [printBusy, setPrintBusy] = useState(false);
  const [config, setConfig] = useState<PrintConfig>(() =>
    buildInitialConfig(resolveDefaultSelectedIds()),
  );

  useEffect(() => {
    if (!open) return;
    const defaults = resolveDefaultSelectedIds();
    setSelectedDojoIds(defaults);
    setConfig(buildInitialConfig(defaults));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset saat modal dibuka
  }, [open, dojoFilter, dojoOptions, semester, year]);

  const selectedNames = useMemo(
    () => resolveSelectedNames(selectedDojoIds, dojoOptions),
    [selectedDojoIds, dojoOptions],
  );

  const displayDojoName = useMemo(() => {
    if (selectedNames.length === 0) return "";
    if (selectedNames.length === 1) return selectedNames[0];
    return `GABUNGAN (${selectedNames.join(", ")})`;
  }, [selectedNames]);

  const list = useMemo(
    () =>
      rows.filter((r) =>
        rowMatchesNotaDojoSelection(r, selectedDojoIds, dojoOptions),
      ),
    [rows, selectedDojoIds, dojoOptions],
  );

  const notaBuild = useMemo(
    () => buildNotaBeltLines(list, beltFees),
    [list, beltFees],
  );
  const { lines, subtotalA, registeredCount, unpaidCount, unpaidAmount } =
    notaBuild;

  const subtotalB = config.rusak * 15000 + config.hilang * 100000;
  const totalC = registeredCount * komisiRanting;
  const grandTotal = subtotalA + subtotalB - totalC;

  const allSelected =
    dojoOptions.length > 0 && selectedDojoIds.size === dojoOptions.length;

  const canPrint = selectedDojoIds.size > 0 && registeredCount > 0;

  const syncNotaNo = (nextIds: Set<string>) => {
    const notaSlug = resolveNotaSlug(nextIds, dojoOptions);
    if (!notaSlug) return;
    setConfig((prev) => ({
      ...prev,
      notaNo: buildNotaNumber(notaSlug, semester, year),
    }));
  };

  const toggleDojo = (id: string) => {
    if (lockSingleDojo) return;
    const next = new Set(selectedDojoIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDojoIds(next);
    syncNotaNo(next);
  };

  const toggleAll = () => {
    if (lockSingleDojo) return;
    const next = allSelected
      ? new Set<string>()
      : new Set(dojoOptions.map((d) => d.id));
    setSelectedDojoIds(next);
    syncNotaNo(next);
  };

  const updateConfig = (field: keyof PrintConfig, value: string | number) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const countForDojo = (dojoId: string, dojoName: string) =>
    rows.filter((r) =>
      rowMatchesNotaDojoSelection(r, new Set([dojoId]), [
        { id: dojoId, name: dojoName },
      ]),
    ).length;

  const notaPayload = () => ({
    notaNo: config.notaNo,
    semester: config.semester,
    dojoName: displayDojoName,
    periodTitle,
    registeredCount,
    lines,
    komisiRanting,
    rusak: config.rusak,
    hilang: config.hilang,
    subtotalA,
    subtotalB,
    totalC,
    grandTotal,
    unpaidCount,
    unpaidAmount,
    origin: window.location.origin,
    printedAt: new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    sekretariatAddress: orgProfile?.address,
    bendaharaCabangName: orgProfile?.bendaharaCabangName,
  });

  const handlePrint = () => {
    if (!canPrint || printBusy) return;
    setPrintBusy(true);
    try {
      printUktNotaDocument(notaPayload());
    } finally {
      setTimeout(() => setPrintBusy(false), 1500);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && printBusy) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="ukt-print-dialog max-h-[90vh] max-w-4xl overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="no-print pr-8">
          <DialogTitle>Cetak Nota Pembayaran UKT</DialogTitle>
        </DialogHeader>

        <div className="no-print space-y-4 rounded-lg border p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs text-muted-foreground">Ranting</label>
                {!lockSingleDojo && dojoOptions.length > 0 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
                    {allSelected ? "Hapus semua" : "Pilih semua"}
                  </Button>
                ) : null}
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {dojoOptions.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">
                    Belum ada peserta terdaftar.
                  </p>
                ) : (
                  dojoOptions.map((d) => {
                    const count = countForDojo(d.id, d.name);
                    return (
                      <label
                        key={d.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-inkai-red"
                          checked={selectedDojoIds.has(d.id)}
                          disabled={lockSingleDojo}
                          onChange={() => toggleDojo(d.id)}
                        />
                        <span className="flex-1">{d.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {count} peserta
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              {selectedDojoIds.size === 0 ? (
                <p className="text-xs text-destructive">Pilih minimal satu ranting.</p>
              ) : null}
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
            <div className="col-span-2 space-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <div>
                Peserta nota:{" "}
                <span className="font-medium text-foreground">
                  {registeredCount} anggota
                </span>{" "}
                (semua terdaftar)
                {" · "}
                CASHBACK:{" "}
                <span className="font-medium text-foreground">
                  {formatRupiahNota(komisiRanting)} / orang
                </span>
                {isDojoAdmin && " (diatur cabang)"}
              </div>
              {unpaidCount > 0 ? (
                <div className="text-amber-800">
                  Termasuk {unpaidCount} Belum Bayar ({formatRupiahNota(unpaidAmount)})
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          id="print-document-ukt"
          className="mt-4 rounded-lg border bg-white p-6 font-mono text-xs leading-relaxed text-black"
        >
            <div className="mb-6 flex items-center justify-center gap-3 border-b-2 border-black pb-4">
              <img
                src="/logo-inkai.png"
                alt="Logo INKAI"
                width={64}
                height={64}
                className="h-14 w-14 shrink-0 object-contain"
              />
              <div className="text-center">
                <div className="text-lg font-bold">INKAI — INSTITUT KARATE-DO INDONESIA</div>
                <div className="text-sm">KOTA SURABAYA</div>
                <div className="text-xs">Sekretariat: Jl. Raya Kertajaya Indah No. 77 Surabaya</div>
              </div>
            </div>

            <h4 className="mb-6 text-center text-sm font-bold uppercase tracking-wide">
              NOTA PEMBAYARAN UJIAN KENAIKAN TINGKAT
            </h4>

            <div className="mb-6 grid grid-cols-2 gap-2 text-sm">
              <div>Nota No. : {config.notaNo}</div>
              <div>SEMESTER : {config.semester}</div>
              <div className="col-span-2 font-bold uppercase">RANTING : {displayDojoName || "—"}</div>
              <div className="col-span-2">Agenda : {periodTitle}</div>
              <div className="col-span-2">Jumlah Peserta : {registeredCount} anggota</div>
              {unpaidCount > 0 ? (
                <div className="col-span-2 text-xs">
                  Termasuk {unpaidCount} Belum Bayar ({formatRupiahNota(unpaidAmount)})
                </div>
              ) : null}
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
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-2 text-center text-muted-foreground">
                      Belum ada peserta terdaftar
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => (
                    <tr key={`${line.belt}-${line.unitFee}`}>
                      <td className="py-0.5">{line.belt}</td>
                      <td className="py-0.5 text-right">{line.count}</td>
                      <td className="py-0.5 text-right">{formatRupiahNota(line.unitFee)}</td>
                      <td className="py-0.5 text-right">
                        {formatRupiahNota(line.subtotal)}
                      </td>
                    </tr>
                  ))
                )}
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
                  CASHBACK Ranting ({registeredCount} × {formatRupiahNota(komisiRanting)})
                </span>
                <span>- {formatRupiahNota(totalC)}</span>
              </div>
              <div className="flex justify-between border-t border-black pt-2 text-base font-bold">
                <span>TOTAL</span>
                <span>{formatRupiahNota(grandTotal)}</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-6 text-center text-sm ukt-signature-block">
              <div>
                <div className="mb-12 ukt-signature-space">Ketua Ranting</div>
                <div className="border-t border-black pt-1">( _________________ )</div>
              </div>
              <div>
                <div className="mb-12 ukt-signature-space">Bendahara Cabang</div>
                <div className="border-t border-black pt-1">
                  {orgProfile?.bendaharaCabangName?.trim() || "Habibur Rahman"}
                </div>
              </div>
            </div>

            <div className="mt-4 text-center text-xs text-gray-500">
              {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
            </div>
        </div>

        <div className="no-print flex justify-end gap-2 pt-2">
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

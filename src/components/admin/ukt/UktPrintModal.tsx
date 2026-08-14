"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
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
import {
  BELT_FEE_KEYS,
  buildNotaNumber,
  countNotaBeltGroups,
  formatRupiahNota,
  type BeltFeeKey,
  type UktMemberRow,
  type UktSemester,
} from "@/lib/ukt";
import {
  downloadUktNotaPdf,
  printUktNotaDocument,
} from "@/lib/ukt-print-html";
import { showError, showSuccess } from "@/lib/client-toast";

/** Sentinel Select — bukan UUID ranting. */
export const UKT_NOTA_GABUNGAN_ID = "gabungan";

type Props = {
  open: boolean;
  onClose: () => void;
  periodTitle: string;
  semester: UktSemester;
  year: number;
  rows: UktMemberRow[];
  dojos: { id: string; name: string }[];
  /** UUID ranting atau `gabungan` untuk default Select. */
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

function isGabunganSelection(id: string): boolean {
  return id === UKT_NOTA_GABUNGAN_ID;
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
  komisiRanting,
  isDojoAdmin,
  orgProfile,
}: Props) {
  const dojoOptions = useMemo(() => {
    const names = new Set<string>();
    for (const r of rows) names.add(r.dojoName);
    const list = dojos.filter((d) => names.has(d.name));
    if (list.length > 0) return list;
    if (dojoFilter && !isGabunganSelection(dojoFilter)) {
      const match = dojos.find((d) => d.id === dojoFilter);
      if (match) return [match];
    }
    return dojos;
  }, [rows, dojos, dojoFilter]);

  const showGabunganOption = dojoOptions.length > 1;

  const resolveDefaultSelection = (): string => {
    if (showGabunganOption && isGabunganSelection(dojoFilter)) {
      return UKT_NOTA_GABUNGAN_ID;
    }
    if (dojoFilter && !isGabunganSelection(dojoFilter)) {
      return dojoFilter;
    }
    return dojoOptions[0]?.id || "";
  };

  const defaultSelection = resolveDefaultSelection();

  const gabunganNames = useMemo(
    () =>
      [...dojoOptions]
        .map((d) => d.name)
        .sort((a, b) => a.localeCompare(b, "id")),
    [dojoOptions],
  );

  const gabunganSelectLabel = isDojoAdmin
    ? `Gabungan ${gabunganNames.join(", ")}`
    : "Gabungan (semua ranting)";

  const buildInitialConfig = (selection: string): PrintConfig => {
    const notaSlug = isGabunganSelection(selection)
      ? "GABUNGAN"
      : dojos.find((d) => d.id === selection)?.name ||
        dojoOptions[0]?.name ||
        "";
    return {
      notaNo: buildNotaNumber(notaSlug, semester, year),
      semester: `${semester} / ${year}`,
      rusak: 0,
      hilang: 0,
    };
  };

  const [selectedDojoId, setSelectedDojoId] = useState(defaultSelection);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [config, setConfig] = useState<PrintConfig>(() =>
    buildInitialConfig(defaultSelection),
  );

  useEffect(() => {
    if (!open) return;
    const selection = resolveDefaultSelection();
    setSelectedDojoId(selection);
    setConfig(buildInitialConfig(selection));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset saat modal dibuka
  }, [open, dojoFilter, dojoOptions, semester, year]);

  const dojoOptionIds = useMemo(
    () => new Set(dojoOptions.map((d) => d.id)),
    [dojoOptions],
  );

  const list = useMemo(() => {
    if (isGabunganSelection(selectedDojoId)) {
      return rows.filter((r) => dojoOptionIds.has(r.dojoId));
    }
    const selectedDojoName =
      dojos.find((d) => d.id === selectedDojoId)?.name || "";
    return rows.filter((r) => r.dojoName === selectedDojoName);
  }, [rows, selectedDojoId, dojos, dojoOptionIds]);

  const displayDojoName = useMemo(() => {
    if (isGabunganSelection(selectedDojoId)) {
      return `GABUNGAN (${gabunganNames.join(", ")})`;
    }
    return dojos.find((d) => d.id === selectedDojoId)?.name || "";
  }, [selectedDojoId, dojos, gabunganNames]);

  const counts = useMemo(() => countNotaBeltGroups(list, beltFees), [list, beltFees]);
  const registeredCount = list.length;

  const subtotalA = BELT_FEE_KEYS.reduce(
    (sum, belt) => sum + counts[belt] * beltFees[belt],
    0,
  );
  const subtotalB = config.rusak * 15000 + config.hilang * 100000;
  const totalC = registeredCount * komisiRanting;
  const grandTotal = subtotalA + subtotalB - totalC;

  const handleDojoChange = (dojoId: string) => {
    setSelectedDojoId(dojoId);
    const notaSlug = isGabunganSelection(dojoId)
      ? "GABUNGAN"
      : dojos.find((d) => d.id === dojoId)?.name || "";
    setConfig((prev) => ({
      ...prev,
      notaNo: buildNotaNumber(notaSlug, semester, year),
    }));
  };

  const updateConfig = (field: keyof PrintConfig, value: string | number) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const notaPayload = () => ({
    notaNo: config.notaNo,
    semester: config.semester,
    dojoName: displayDojoName,
    periodTitle,
    registeredCount,
    counts,
    beltFees,
    komisiRanting,
    rusak: config.rusak,
    hilang: config.hilang,
    subtotalA,
    subtotalB,
    totalC,
    grandTotal,
    origin: window.location.origin,
    printedAt: new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    sekretariatAddress: orgProfile?.address,
    bendaharaCabangName: orgProfile?.bendaharaCabangName,
  });

  const pdfFilename = isGabunganSelection(selectedDojoId)
    ? "nota-ukt-gabungan.pdf"
    : `nota-ukt-${displayDojoName.replace(/\s+/g, "-").toLowerCase()}.pdf`;

  const handlePrint = () => {
    printUktNotaDocument(notaPayload());
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      await downloadUktNotaPdf(notaPayload(), pdfFilename);
      showSuccess("PDF nota diunduh");
    } catch {
      showError("Gagal membuat PDF. Coba Print / Save as PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  const beltRows = BELT_FEE_KEYS.filter((belt) => counts[belt] > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="ukt-print-dialog max-h-[90vh] max-w-4xl overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="no-print pr-8">
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>Cetak Nota Pembayaran UKT</span>
            <span className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleDownloadPdf()}
                disabled={pdfLoading}
              >
                <Download className="mr-1 h-4 w-4" />
                {pdfLoading ? "PDF…" : "Unduh PDF"}
              </Button>
              <Button size="sm" onClick={handlePrint}>
                <Printer className="mr-1 h-4 w-4" />
                Print
              </Button>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="no-print space-y-4 rounded-lg border p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Ranting</label>
              <Select value={selectedDojoId} onValueChange={handleDojoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih ranting" />
                </SelectTrigger>
                <SelectContent>
                  {showGabunganOption ? (
                    <SelectItem value={UKT_NOTA_GABUNGAN_ID}>
                      {gabunganSelectLabel}
                    </SelectItem>
                  ) : null}
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
            <div className="col-span-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Terdaftar: <span className="font-medium text-foreground">{registeredCount} anggota</span>
              {" · "}
              Komisi: <span className="font-medium text-foreground">{formatRupiahNota(komisiRanting)} / orang</span>
              {isDojoAdmin && " (diatur cabang)"}
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
              <div className="col-span-2 font-bold uppercase">RANTING : {displayDojoName}</div>
              <div className="col-span-2">Agenda : {periodTitle}</div>
              <div className="col-span-2">Jumlah Peserta : {registeredCount} anggota</div>
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
                {beltRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-2 text-center text-muted-foreground">
                      Belum ada peserta terdaftar
                    </td>
                  </tr>
                ) : (
                  beltRows.map((belt) => (
                    <tr key={belt}>
                      <td className="py-0.5">{belt}</td>
                      <td className="py-0.5 text-right">{counts[belt]}</td>
                      <td className="py-0.5 text-right">{formatRupiahNota(beltFees[belt])}</td>
                      <td className="py-0.5 text-right">
                        {formatRupiahNota(counts[belt] * beltFees[belt])}
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
                  Komisi Ranting ({registeredCount} × {formatRupiahNota(komisiRanting)})
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
      </DialogContent>
    </Dialog>
  );
}

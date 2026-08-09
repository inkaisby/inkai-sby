"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BELT_FEE_KEYS,
  BELT_FEE_LABELS,
  DEFAULT_UKT_PENGPROV_BANK_FOOTER,
  UKT_BUKU_HILANG_RUSAK_FEE,
  UKT_SALAH_PENULISAN_FEE,
  countNotaBeltGroups,
  formatRupiahNota,
  isUktBillingPaid,
  resolveUktPengprovBeltFees,
  type BeltFeeKey,
  type UktMemberRow,
  type UktPeriodMeta,
  type UktSemester,
} from "@/lib/ukt";
import {
  downloadUktAdminReportPdf,
  printUktAdminReportDocument,
  type UktAdminReportPrintData,
} from "@/lib/ukt-admin-report-html";
import { showError, showSuccess } from "@/lib/client-toast";

type Props = {
  open: boolean;
  onClose: () => void;
  eventId: string;
  semester: UktSemester;
  year: number;
  /** Semua peserta periode (tanpa filter ranting UI). */
  rows: UktMemberRow[];
  /** beltFees Nota — dipakai hanya untuk grouping sabuk. */
  notaBeltFees: Record<BeltFeeKey, number>;
  periodMeta?: UktPeriodMeta | null;
  examAt?: string | null;
  examLocation?: string | null;
  sekretariatAddress?: string;
  onPengprovFeesSaved?: (fees: Record<BeltFeeKey, number>) => void;
};

function formatIdDate(isoOrEmpty: string | null | undefined): string {
  const d = isoOrEmpty ? new Date(isoOrEmpty) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  }
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function UktAdminReportModal({
  open,
  onClose,
  eventId,
  semester,
  year,
  rows,
  notaBeltFees,
  periodMeta,
  examAt,
  examLocation,
  sekretariatAddress,
  onPengprovFeesSaved,
}: Props) {
  const paidRows = useMemo(
    () => rows.filter((r) => r.registrationId && isUktBillingPaid(r)),
    [rows],
  );

  const counts = useMemo(
    () => countNotaBeltGroups(paidRows, notaBeltFees),
    [paidRows, notaBeltFees],
  );

  const [pengprovFees, setPengprovFees] = useState<Record<BeltFeeKey, number>>(() =>
    resolveUktPengprovBeltFees(periodMeta),
  );
  const [tanggal, setTanggal] = useState(() => formatIdDate(examAt ?? periodMeta?.examAt));
  const [tempat, setTempat] = useState(
    () => examLocation?.trim() || periodMeta?.examLocation?.trim() || "",
  );
  const [salahPenulisanQty, setSalahPenulisanQty] = useState(0);
  const [hilangRusakQty, setHilangRusakQty] = useState(0);
  const [pengujiCount, setPengujiCount] = useState(0);
  const [pengujiTotal, setPengujiTotal] = useState(0);
  const [bankFooter, setBankFooter] = useState(DEFAULT_UKT_PENGPROV_BANK_FOOTER);
  const [bukuBaru, setBukuBaru] = useState("");
  const [bukuDipakai, setBukuDipakai] = useState("");
  const [bukuSisa, setBukuSisa] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [savingFees, setSavingFees] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPengprovFees(resolveUktPengprovBeltFees(periodMeta));
    setTanggal(formatIdDate(examAt ?? periodMeta?.examAt));
    setTempat(examLocation?.trim() || periodMeta?.examLocation?.trim() || "");
    setSalahPenulisanQty(0);
    setHilangRusakQty(0);
    setPengujiCount(0);
    setPengujiTotal(0);
    setBankFooter(DEFAULT_UKT_PENGPROV_BANK_FOOTER);
    setBukuBaru("");
    setBukuDipakai("");
    setBukuSisa("");
  }, [open, periodMeta, examAt, examLocation]);

  const sectionITotal = BELT_FEE_KEYS.reduce(
    (sum, belt) => sum + counts[belt] * pengprovFees[belt],
    0,
  );
  const participantTotal = paidRows.length;
  const sectionIITotal =
    salahPenulisanQty * UKT_SALAH_PENULISAN_FEE +
    hilangRusakQty * UKT_BUKU_HILANG_RUSAK_FEE;
  const setorPengprov = sectionITotal + sectionIITotal;
  const jumlahBersih = setorPengprov - pengujiTotal;

  const buildPayload = (): UktAdminReportPrintData => ({
    semester,
    year,
    tanggal,
    tempat:
      tempat.trim() ||
      "Gedung Prasarana Olahraga Dispora Jatim, Jl. Kertajaya Indah 77 Surabaya",
    counts,
    pengprovFees,
    sectionITotal,
    participantTotal,
    salahPenulisanQty,
    salahPenulisanFee: UKT_SALAH_PENULISAN_FEE,
    hilangRusakQty,
    hilangRusakFee: UKT_BUKU_HILANG_RUSAK_FEE,
    sectionIITotal,
    setorPengprov,
    pengujiCount,
    pengujiTotal,
    jumlahBersih,
    bankFooter: bankFooter.trim() || DEFAULT_UKT_PENGPROV_BANK_FOOTER,
    bukuBaru,
    bukuDipakai,
    bukuSisa,
    origin: typeof window !== "undefined" ? window.location.origin : "",
    sekretariatAddress,
  });

  const persistPengprovFees = async (): Promise<boolean> => {
    if (!eventId) {
      showError("Periode belum dipilih");
      return false;
    }
    setSavingFees(true);
    try {
      const res = await fetch("/api/admin/ukt/period-meta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          pengprovBeltFees: pengprovFees,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        showError(data.error || "Gagal menyimpan tarif Pengprov");
        return false;
      }
      onPengprovFeesSaved?.(pengprovFees);
      return true;
    } catch {
      showError("Gagal menyimpan tarif Pengprov");
      return false;
    } finally {
      setSavingFees(false);
    }
  };

  const handleSaveFees = async () => {
    const ok = await persistPengprovFees();
    if (ok) showSuccess("Tarif Pengprov disimpan ke periode");
  };

  const handlePrint = async () => {
    await persistPengprovFees();
    printUktAdminReportDocument(buildPayload());
  };

  const handlePdf = async () => {
    setPdfLoading(true);
    try {
      await persistPengprovFees();
      await downloadUktAdminReportPdf(
        buildPayload(),
        `perincian-administrasi-ukt-${semester}-${year}.pdf`,
      );
      showSuccess("PDF diunduh");
    } catch {
      showError("Gagal mengunduh PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const updateFee = (belt: BeltFeeKey, value: string) => {
    const n = parseInt(value, 10);
    setPengprovFees((prev) => ({
      ...prev,
      [belt]: Number.isFinite(n) && n >= 0 ? n : 0,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span>Buat Laporan UKT</span>
            <span className="no-print flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleSaveFees()}
                disabled={savingFees}
              >
                <Save className="mr-1 h-4 w-4" />
                {savingFees ? "Simpan…" : "Simpan Tarif"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handlePdf()}
                disabled={pdfLoading}
              >
                <Download className="mr-1 h-4 w-4" />
                {pdfLoading ? "PDF…" : "Unduh PDF"}
              </Button>
              <Button size="sm" onClick={() => void handlePrint()}>
                <Printer className="mr-1 h-4 w-4" />
                Print
              </Button>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="no-print space-y-3 rounded-lg border p-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Peserta lunas (semua ranting):{" "}
              <span className="font-medium text-foreground">{participantTotal} orang</span>
              {" · "}
              Tarif di bawah = setor Pengprov (bukan biaya Nota)
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BELT_FEE_KEYS.map((belt) => (
                <div key={belt}>
                  <label className="text-xs text-muted-foreground">
                    {BELT_FEE_LABELS[belt]} ({counts[belt]} org)
                  </label>
                  <Input
                    type="number"
                    value={pengprovFees[belt]}
                    onChange={(e) => updateFee(belt, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Tanggal</label>
                <Input value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tempat</label>
                <Input value={tempat} onChange={(e) => setTempat(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Salah penulisan (buku)</label>
                <Input
                  type="number"
                  value={salahPenulisanQty}
                  onChange={(e) =>
                    setSalahPenulisanQty(parseInt(e.target.value, 10) || 0)
                  }
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Hilang/rusak (buku)</label>
                <Input
                  type="number"
                  value={hilangRusakQty}
                  onChange={(e) =>
                    setHilangRusakQty(parseInt(e.target.value, 10) || 0)
                  }
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Jumlah penguji</label>
                <Input
                  type="number"
                  value={pengujiCount}
                  onChange={(e) =>
                    setPengujiCount(parseInt(e.target.value, 10) || 0)
                  }
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Total biaya penguji (Rp)</label>
                <Input
                  type="number"
                  value={pengujiTotal}
                  onChange={(e) =>
                    setPengujiTotal(parseInt(e.target.value, 10) || 0)
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Footer rekening</label>
                <Input
                  value={bankFooter}
                  onChange={(e) => setBankFooter(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Buku Baru</label>
                <Input value={bukuBaru} onChange={(e) => setBukuBaru(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Dipakai</label>
                <Input
                  value={bukuDipakai}
                  onChange={(e) => setBukuDipakai(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sisa</label>
                <Input value={bukuSisa} onChange={(e) => setBukuSisa(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-5 font-serif text-xs text-black">
            <h4 className="mb-3 text-center text-sm font-bold uppercase">
              PERINCIAN ADMINISTRASI UJIAN SEMESTER {semester} TAHUN {year}
            </h4>
            <div className="mb-3 space-y-0.5">
              <div>Cabang : KOTA SURABAYA</div>
              <div>Tanggal : {tanggal}</div>
              <div>Tempat : {tempat || "—"}</div>
            </div>

            <div className="mb-1 font-bold">I. BIAYA UJIAN</div>
            <table className="mb-3 w-full">
              <tbody>
                {BELT_FEE_KEYS.map((belt) => (
                  <tr key={belt}>
                    <td className="py-0.5">
                      {["a", "b", "c", "d", "e"][BELT_FEE_KEYS.indexOf(belt)]}. Sabuk{" "}
                      {BELT_FEE_LABELS[belt]}
                    </td>
                    <td className="py-0.5 text-right">{counts[belt]} Orang</td>
                    <td className="py-0.5 text-right">
                      x {formatRupiahNota(pengprovFees[belt])}
                    </td>
                    <td className="py-0.5 text-right">
                      = {formatRupiahNota(counts[belt] * pengprovFees[belt])}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-black font-bold">
                  <td className="pt-1">Jumlah</td>
                  <td className="pt-1 text-right">{participantTotal} Orang</td>
                  <td />
                  <td className="pt-1 text-right">{formatRupiahNota(sectionITotal)}</td>
                </tr>
              </tbody>
            </table>

            <div className="mb-1 font-bold">II. BUKU UJIAN</div>
            <div className="mb-2 space-y-0.5">
              <div className="flex justify-between gap-2">
                <span>Biaya Salah Penulisan ({salahPenulisanQty} × {formatRupiahNota(UKT_SALAH_PENULISAN_FEE)})</span>
                <span>
                  {formatRupiahNota(salahPenulisanQty * UKT_SALAH_PENULISAN_FEE)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>
                  Buku Baru Hilang/Rusak ({hilangRusakQty} ×{" "}
                  {formatRupiahNota(UKT_BUKU_HILANG_RUSAK_FEE)})
                </span>
                <span>
                  {formatRupiahNota(hilangRusakQty * UKT_BUKU_HILANG_RUSAK_FEE)}
                </span>
              </div>
            </div>

            <div className="mb-3 flex justify-between border-t border-black pt-2 font-bold">
              <span>JUMLAH YANG DISETOR KE PENGPROV (I + II)</span>
              <span>{formatRupiahNota(setorPengprov)}</span>
            </div>

            <div className="mb-1 font-bold">PERINCIAN UNTUK PENGPROV</div>
            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span>1. Jumlah Penerimaan</span>
                <span>{formatRupiahNota(setorPengprov)}</span>
              </div>
              <div className="flex justify-between">
                <span>2. Biaya Penguji ({pengujiCount} orang)</span>
                <span>- {formatRupiahNota(pengujiTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-black pt-2 font-bold">
                <span>JUMLAH BERSIH DISETOR</span>
                <span>{formatRupiahNota(jumlahBersih)}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

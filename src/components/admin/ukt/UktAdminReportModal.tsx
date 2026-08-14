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
  open?: boolean;
  onClose?: () => void;
  /** Tanpa Dialog — dipakai di hub Laporan. */
  embedded?: boolean;
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

/** Ambil angka dari input IDR: "7.250.000" / "7250000" / "" → number. */
function parseIdrInput(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

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

function feesToDraft(fees: Record<BeltFeeKey, number>): Record<BeltFeeKey, string> {
  const out = {} as Record<BeltFeeKey, string>;
  for (const k of BELT_FEE_KEYS) out[k] = String(fees[k] ?? 0);
  return out;
}

export function UktAdminReportModal({
  open = true,
  onClose,
  embedded = false,
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

  const [feeDrafts, setFeeDrafts] = useState<Record<BeltFeeKey, string>>(() =>
    feesToDraft(resolveUktPengprovBeltFees(periodMeta)),
  );
  const [tanggal, setTanggal] = useState(() => formatIdDate(examAt ?? periodMeta?.examAt));
  const [tempat, setTempat] = useState(
    () => examLocation?.trim() || periodMeta?.examLocation?.trim() || "",
  );
  const [salahPenulisanDraft, setSalahPenulisanDraft] = useState("");
  const [hilangRusakDraft, setHilangRusakDraft] = useState("");
  const [pengujiCountDraft, setPengujiCountDraft] = useState("");
  const [pengujiTotalDraft, setPengujiTotalDraft] = useState("");
  const [bankFooter, setBankFooter] = useState(DEFAULT_UKT_PENGPROV_BANK_FOOTER);
  const [bukuBaru, setBukuBaru] = useState("");
  const [bukuDipakai, setBukuDipakai] = useState("");
  const [bukuSisa, setBukuSisa] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [savingFees, setSavingFees] = useState(false);

  useEffect(() => {
    if (!embedded && !open) return;
    setFeeDrafts(feesToDraft(resolveUktPengprovBeltFees(periodMeta)));
    setTanggal(formatIdDate(examAt ?? periodMeta?.examAt));
    setTempat(examLocation?.trim() || periodMeta?.examLocation?.trim() || "");
    setSalahPenulisanDraft("");
    setHilangRusakDraft("");
    setPengujiCountDraft("");
    setPengujiTotalDraft("");
    setBankFooter(DEFAULT_UKT_PENGPROV_BANK_FOOTER);
    setBukuBaru("");
    setBukuDipakai("");
    setBukuSisa("");
  }, [open, embedded, periodMeta, examAt, examLocation]);

  const pengprovFees = useMemo(() => {
    const fees = {} as Record<BeltFeeKey, number>;
    for (const k of BELT_FEE_KEYS) fees[k] = parseIdrInput(feeDrafts[k] ?? "");
    return fees;
  }, [feeDrafts]);

  const salahPenulisanQty = parseIdrInput(salahPenulisanDraft);
  const hilangRusakQty = parseIdrInput(hilangRusakDraft);
  const pengujiCount = parseIdrInput(pengujiCountDraft);
  const pengujiTotal = parseIdrInput(pengujiTotalDraft);

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

  const headerActions = (
    <div className="no-print grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => void handleSaveFees()}
        disabled={savingFees}
      >
        <Save className="mr-1 h-4 w-4" />
        {savingFees ? "Simpan…" : "Simpan Tarif"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => void handlePdf()}
        disabled={pdfLoading}
      >
        <Download className="mr-1 h-4 w-4" />
        {pdfLoading ? "PDF…" : "Unduh PDF"}
      </Button>
      <Button size="sm" className="w-full" onClick={() => void handlePrint()}>
        <Printer className="mr-1 h-4 w-4" />
        Print
      </Button>
    </div>
  );

  const scrollBody = (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3 sm:p-4">
          <div className="no-print space-y-3 rounded-lg border p-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Peserta lunas (semua ranting):{" "}
              <span className="font-medium text-foreground">{participantTotal} orang</span>
              {" · "}
              Tarif di bawah = setor Pengprov (bukan biaya Nota)
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {BELT_FEE_KEYS.map((belt) => (
                <div key={belt} className="min-w-0">
                  <label className="text-xs text-muted-foreground">
                    {BELT_FEE_LABELS[belt]} ({counts[belt]} org)
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={feeDrafts[belt]}
                    onChange={(e) =>
                      setFeeDrafts((prev) => ({ ...prev, [belt]: e.target.value }))
                    }
                    onBlur={() =>
                      setFeeDrafts((prev) => ({
                        ...prev,
                        [belt]: String(parseIdrInput(prev[belt])),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="min-w-0">
                <label className="text-xs text-muted-foreground">Tanggal</label>
                <Input value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>
              <div className="min-w-0 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Tempat</label>
                <Input value={tempat} onChange={(e) => setTempat(e.target.value)} />
              </div>
              <div className="min-w-0">
                <label className="text-xs text-muted-foreground">Salah penulisan (buku)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={salahPenulisanDraft}
                  onChange={(e) => setSalahPenulisanDraft(e.target.value)}
                />
              </div>
              <div className="min-w-0">
                <label className="text-xs text-muted-foreground">Hilang/rusak (buku)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={hilangRusakDraft}
                  onChange={(e) => setHilangRusakDraft(e.target.value)}
                />
              </div>
              <div className="min-w-0">
                <label className="text-xs text-muted-foreground">Jumlah penguji</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={pengujiCountDraft}
                  onChange={(e) => setPengujiCountDraft(e.target.value)}
                />
              </div>
              <div className="min-w-0">
                <label className="text-xs text-muted-foreground">Total biaya penguji (Rp)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={pengujiTotalDraft}
                  onChange={(e) => setPengujiTotalDraft(e.target.value)}
                  onBlur={() => {
                    const n = parseIdrInput(pengujiTotalDraft);
                    setPengujiTotalDraft(n > 0 ? n.toLocaleString("id-ID") : "");
                  }}
                />
              </div>
              <div className="min-w-0 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Footer rekening</label>
                <Input
                  value={bankFooter}
                  onChange={(e) => setBankFooter(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="min-w-0">
                <label className="text-xs text-muted-foreground">Buku Baru</label>
                <Input value={bukuBaru} onChange={(e) => setBukuBaru(e.target.value)} />
              </div>
              <div className="min-w-0">
                <label className="text-xs text-muted-foreground">Dipakai</label>
                <Input
                  value={bukuDipakai}
                  onChange={(e) => setBukuDipakai(e.target.value)}
                />
              </div>
              <div className="min-w-0">
                <label className="text-xs text-muted-foreground">Sisa</label>
                <Input value={bukuSisa} onChange={(e) => setBukuSisa(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="min-w-0 overflow-x-auto rounded-lg border bg-white p-3 font-serif text-[11px] text-black sm:p-5 sm:text-xs">
            <h4 className="mb-3 break-words text-center text-sm font-bold uppercase">
              PERINCIAN ADMINISTRASI UJIAN SEMESTER {semester} TAHUN {year}
            </h4>
            <div className="mb-3 space-y-0.5 break-words">
              <div>Cabang : KOTA SURABAYA</div>
              <div>Tanggal : {tanggal}</div>
              <div>Tempat : {tempat || "—"}</div>
            </div>

            <div className="mb-1 font-bold">I. BIAYA UJIAN</div>
            <table className="mb-3 w-full min-w-[280px]">
              <tbody>
                {BELT_FEE_KEYS.map((belt) => (
                  <tr key={belt}>
                    <td className="py-0.5">
                      {["a", "b", "c", "d", "e"][BELT_FEE_KEYS.indexOf(belt)]}. Sabuk{" "}
                      {BELT_FEE_LABELS[belt]}
                    </td>
                    <td className="whitespace-nowrap py-0.5 text-right">
                      {counts[belt]} Orang
                    </td>
                    <td className="whitespace-nowrap py-0.5 text-right">
                      x {formatRupiahNota(pengprovFees[belt])}
                    </td>
                    <td className="whitespace-nowrap py-0.5 text-right">
                      = {formatRupiahNota(counts[belt] * pengprovFees[belt])}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-black font-bold">
                  <td className="pt-1">Jumlah</td>
                  <td className="whitespace-nowrap pt-1 text-right">
                    {participantTotal} Orang
                  </td>
                  <td />
                  <td className="whitespace-nowrap pt-1 text-right">
                    {formatRupiahNota(sectionITotal)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mb-1 font-bold">II. BUKU UJIAN</div>
            <div className="mb-2 space-y-1">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-2">
                <span className="break-words">
                  Biaya Salah Penulisan ({salahPenulisanQty} ×{" "}
                  {formatRupiahNota(UKT_SALAH_PENULISAN_FEE)})
                </span>
                <span className="shrink-0 whitespace-nowrap">
                  {formatRupiahNota(salahPenulisanQty * UKT_SALAH_PENULISAN_FEE)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-2">
                <span className="break-words">
                  Buku Baru Hilang/Rusak ({hilangRusakQty} ×{" "}
                  {formatRupiahNota(UKT_BUKU_HILANG_RUSAK_FEE)})
                </span>
                <span className="shrink-0 whitespace-nowrap">
                  {formatRupiahNota(hilangRusakQty * UKT_BUKU_HILANG_RUSAK_FEE)}
                </span>
              </div>
            </div>

            <div className="mb-3 flex flex-col gap-1 border-t border-black pt-2 font-bold sm:flex-row sm:justify-between sm:gap-2">
              <span className="break-words">JUMLAH YANG DISETOR KE PENGPROV (I + II)</span>
              <span className="shrink-0 whitespace-nowrap">
                {formatRupiahNota(setorPengprov)}
              </span>
            </div>

            <div className="mb-1 font-bold">PERINCIAN UNTUK PENGPROV</div>
            <div className="space-y-1">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                <span>1. Jumlah Penerimaan</span>
                <span className="whitespace-nowrap">{formatRupiahNota(setorPengprov)}</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                <span>2. Biaya Penguji ({pengujiCount} orang)</span>
                <span className="whitespace-nowrap">- {formatRupiahNota(pengujiTotal)}</span>
              </div>
              <div className="flex flex-col gap-1 border-t border-black pt-2 font-bold sm:flex-row sm:justify-between">
                <span>JUMLAH BERSIH DISETOR</span>
                <span className="whitespace-nowrap">{formatRupiahNota(jumlahBersih)}</span>
              </div>
            </div>
          </div>
        </div>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        {headerActions}
        {scrollBody}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-xl">
        <DialogHeader className="sticky top-0 z-10 shrink-0 space-y-3 border-b bg-popover px-3 py-3 sm:px-4">
          <DialogTitle className="text-base">Buat Laporan UKT</DialogTitle>
          {headerActions}
        </DialogHeader>
        {scrollBody}
      </DialogContent>
    </Dialog>
  );
}

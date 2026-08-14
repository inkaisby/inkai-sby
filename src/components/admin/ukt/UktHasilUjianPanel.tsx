"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Plus,
  Printer,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildUktHasilUjianFilename,
  buildUktHasilUjianRecapRows,
  collectUktExportDataIssues,
  hasUktHasilUjianRecap,
  rowHasUktHasilUjianKyuBaru,
  type UktMemberRow,
  type UktPeriodMeta,
  type UktSemester,
} from "@/lib/ukt";
import {
  downloadUktHasilUjianPdf,
  printUktHasilUjianDocument,
} from "@/lib/ukt-hasil-ujian-html";
import { parseApiJson } from "@/lib/api-client";
import {
  padPengujiSlots,
  resolveUktTtdOfficers,
  UKT_TTD_DEFAULT_PENGUJI_SLOTS,
  type UktTtdResolvedOfficers,
  type UktTtdTemplate,
} from "@/lib/ukt-ttd";
import { UktTtdMemberPicker } from "@/components/admin/ukt/UktTtdMemberPicker";
import { UktSignaturePad } from "@/components/admin/ukt/UktSignaturePad";

type Props = {
  eventId: string;
  semester: UktSemester;
  year: number;
  rows: UktMemberRow[];
  periodMeta?: UktPeriodMeta | null;
  isCabang: boolean;
  orgKetuaCabangName?: string | null;
  strukturKetuaName?: string | null;
  pengprovHeadName?: string | null;
  orgBidangUjianName?: string | null;
  examAt?: string | null;
  onMetaSaved?: (meta: UktPeriodMeta) => void;
};

type Draft = UktTtdResolvedOfficers;

function draftFromResolved(r: UktTtdResolvedOfficers): Draft {
  return {
    ...r,
    pengujiNames: padPengujiSlots(
      r.pengujiNames,
      Math.max(UKT_TTD_DEFAULT_PENGUJI_SLOTS, r.pengujiNames.length),
    ),
    pengujiSignUrls: padPengujiSlots(
      r.pengujiSignUrls,
      Math.max(UKT_TTD_DEFAULT_PENGUJI_SLOTS, r.pengujiNames.length),
    ),
  };
}

export function UktHasilUjianPanel({
  eventId,
  semester,
  year,
  rows,
  periodMeta,
  isCabang,
  orgKetuaCabangName,
  strukturKetuaName,
  pengprovHeadName,
  orgBidangUjianName,
  examAt,
  onMetaSaved,
}: Props) {
  const [template, setTemplate] = useState<UktTtdTemplate | null>(null);
  const [draft, setDraft] = useState<Draft>(() =>
    draftFromResolved(
      resolveUktTtdOfficers({
        meta: periodMeta,
        pengprovHeadName,
        orgKetuaCabangName,
        strukturKetuaName,
        orgBidangUjianName,
      }),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isCabang) return;
    void fetch("/api/admin/ukt/ttd-template")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await parseApiJson<{ data?: UktTtdTemplate }>(res);
        setTemplate(data.data ?? null);
      })
      .catch(() => undefined);
  }, [isCabang]);

  useEffect(() => {
    setDraft(
      draftFromResolved(
        resolveUktTtdOfficers({
          meta: periodMeta,
          template,
          pengprovHeadName,
          orgKetuaCabangName,
          strukturKetuaName,
          orgBidangUjianName,
        }),
      ),
    );
  }, [
    periodMeta,
    template,
    pengprovHeadName,
    orgKetuaCabangName,
    strukturKetuaName,
    orgBidangUjianName,
  ]);

  const canRecap = hasUktHasilUjianRecap(rows);
  const recapRows = useMemo(
    () => (canRecap ? buildUktHasilUjianRecapRows(rows) : []),
    [canRecap, rows],
  );

  const persistMeta = async (): Promise<boolean> => {
    if (!isCabang) return true;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ukt/period-meta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          pengdaKetua: draft.pengdaKetua || null,
          pengdaKetuaTitle: draft.pengdaKetuaTitle || null,
          mshKetua: draft.mshKetua || null,
          mshKetuaTitle: draft.mshKetuaTitle || null,
          ketuaCabangName: draft.ketuaCabangName || null,
          bidangUjianName: draft.bidangUjianName || null,
          pengujiNames: draft.pengujiNames.map((n) => n.trim()).filter(Boolean),
          pengdaKetuaSignUrl: draft.pengdaKetuaSignUrl || null,
          mshKetuaSignUrl: draft.mshKetuaSignUrl || null,
          ketuaCabangSignUrl: draft.ketuaCabangSignUrl || null,
          bidangUjianSignUrl: draft.bidangUjianSignUrl || null,
          pengujiSignUrls: draft.pengujiSignUrls,
        }),
      });
      const data = await parseApiJson<{
        error?: string;
        data?: UktPeriodMeta;
        message?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan pejabat TTD");
      if (data.data) onMetaSaved?.(data.data);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async () => {
    setSavingTpl(true);
    try {
      const res = await fetch("/api/admin/ukt/ttd-template", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pengdaKetua: draft.pengdaKetua || null,
          pengdaKetuaTitle: draft.pengdaKetuaTitle || null,
          mshKetua: draft.mshKetua || null,
          mshKetuaTitle: draft.mshKetuaTitle || null,
          ketuaCabangName: draft.ketuaCabangName || null,
          bidangUjianName: draft.bidangUjianName || null,
          pengujiNames: draft.pengujiNames.map((n) => n.trim()).filter(Boolean),
          pengdaKetuaSignUrl: draft.pengdaKetuaSignUrl || null,
          mshKetuaSignUrl: draft.mshKetuaSignUrl || null,
          ketuaCabangSignUrl: draft.ketuaCabangSignUrl || null,
          bidangUjianSignUrl: draft.bidangUjianSignUrl || null,
          pengujiSignUrls: draft.pengujiSignUrls,
        }),
      });
      const data = await parseApiJson<{
        error?: string;
        data?: UktTtdTemplate;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan template");
      setTemplate(data.data ?? null);
      toast.success("Template TTD disimpan untuk periode berikutnya");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan template");
    } finally {
      setSavingTpl(false);
    }
  };

  const ensureRecap = (mode: "excel" | "pdf" | "print") => {
    if (recapRows.length === 0) {
      toast.error("Belum ada peserta dengan Kyu Baru untuk direkap");
      return null;
    }
    const issues = collectUktExportDataIssues(
      rows.filter(rowHasUktHasilUjianKyuBaru),
    );
    if (issues.length > 0) {
      toast.message(
        mode === "print"
          ? `${issues.length} peserta punya data kurang (NIA/TTL/alamat/JK) — cek pratinjau`
          : `${issues.length} peserta punya data kurang — tetap diunduh`,
      );
    }
    return recapRows;
  };

  const payload = (recap: typeof recapRows) => ({
    semester,
    year,
    examAt: examAt ?? periodMeta?.examAt ?? null,
    ketuaCabangName: draft.ketuaCabangName,
    bidangUjianName: draft.bidangUjianName,
    pengdaKetua: draft.pengdaKetua,
    pengdaKetuaTitle: draft.pengdaKetuaTitle,
    mshKetua: draft.mshKetua,
    mshKetuaTitle: draft.mshKetuaTitle,
    pengujiNames: draft.pengujiNames.map((n) => n.trim()).filter(Boolean),
    pengdaKetuaSignUrl: draft.pengdaKetuaSignUrl || null,
    mshKetuaSignUrl: draft.mshKetuaSignUrl || null,
    ketuaCabangSignUrl: draft.ketuaCabangSignUrl || null,
    bidangUjianSignUrl: draft.bidangUjianSignUrl || null,
    pengujiSignUrls: draft.pengujiSignUrls,
    origin: window.location.origin,
    rows: recap,
  });

  const runExcel = async () => {
    const recap = ensureRecap("excel");
    if (!recap) return;
    setBusy(true);
    try {
      await persistMeta();
      const res = await fetch("/api/admin/ukt/rekap-hasil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(recap)),
      });
      if (!res.ok) {
        const data = await parseApiJson<{ error?: string }>(res);
        throw new Error(data.error || "Gagal membuat rekap Excel");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildUktHasilUjianFilename(
        semester,
        year,
        examAt ?? periodMeta?.examAt,
      );
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${recap.length} peserta direkap ke Excel`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunduh rekap");
    } finally {
      setBusy(false);
    }
  };

  const runPdf = async () => {
    const recap = ensureRecap("pdf");
    if (!recap) return;
    setBusy(true);
    try {
      await persistMeta();
      await downloadUktHasilUjianPdf(
        payload(recap),
        buildUktHasilUjianFilename(
          semester,
          year,
          examAt ?? periodMeta?.examAt,
          "pdf",
        ),
      );
      toast.success(`${recap.length} peserta diunduh sebagai PDF`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat PDF");
    } finally {
      setBusy(false);
    }
  };

  const runPrint = async () => {
    const recap = ensureRecap("print");
    if (!recap) return;
    await persistMeta();
    printUktHasilUjianDocument(payload(recap));
    toast.success(`${recap.length} peserta siap dicetak`);
  };

  const setPenguji = (idx: number, name: string) => {
    setDraft((d) => {
      const pengujiNames = [...d.pengujiNames];
      pengujiNames[idx] = name;
      return { ...d, pengujiNames };
    });
  };

  const setPengujiSign = (idx: number, url: string | null) => {
    setDraft((d) => {
      const pengujiSignUrls = [...d.pengujiSignUrls];
      while (pengujiSignUrls.length <= idx) pengujiSignUrls.push("");
      pengujiSignUrls[idx] = url || "";
      return { ...d, pengujiSignUrls };
    });
  };

  return (
    <div className="space-y-4">
      {!canRecap ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Belum ada peserta dengan Kyu Baru — isi hasil ujian dulu sebelum
          mencetak rekap Pengda.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {recapRows.length} peserta siap direkap (format Pengda).
        </p>
      )}

      {isCabang ? (
        <div className="space-y-4 rounded-lg border p-3">
          <p className="text-sm font-medium">Pejabat lembar TTD</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Ketua Umum Pengda</Label>
              <UktTtdMemberPicker
                value={draft.pengdaKetua}
                onChange={(v) => setDraft((d) => ({ ...d, pengdaKetua: v }))}
                onPick={(item) =>
                  setDraft((d) => ({
                    ...d,
                    pengdaKetua: item.fullName,
                    pengdaKetuaTitle: item.officerTitle || d.pengdaKetuaTitle,
                  }))
                }
              />
              <Input
                className="mt-1"
                value={draft.pengdaKetuaTitle}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, pengdaKetuaTitle: e.target.value }))
                }
                placeholder="DAN … MSH NO. …"
              />
              <UktSignaturePad
                label="Ketua Umum Pengda"
                valueUrl={draft.pengdaKetuaSignUrl}
                onChange={(url) =>
                  setDraft((d) => ({ ...d, pengdaKetuaSignUrl: url || "" }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Ketua MSH</Label>
              <UktTtdMemberPicker
                value={draft.mshKetua}
                onChange={(v) => setDraft((d) => ({ ...d, mshKetua: v }))}
                onPick={(item) =>
                  setDraft((d) => ({
                    ...d,
                    mshKetua: item.fullName,
                    mshKetuaTitle: item.officerTitle || d.mshKetuaTitle,
                  }))
                }
              />
              <Input
                className="mt-1"
                value={draft.mshKetuaTitle}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, mshKetuaTitle: e.target.value }))
                }
                placeholder="DAN … MSH NO. …"
              />
              <UktSignaturePad
                label="Ketua MSH"
                valueUrl={draft.mshKetuaSignUrl}
                onChange={(url) =>
                  setDraft((d) => ({ ...d, mshKetuaSignUrl: url || "" }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Ketua Cabang Surabaya</Label>
              <UktTtdMemberPicker
                value={draft.ketuaCabangName}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, ketuaCabangName: v }))
                }
                onPick={(item) =>
                  setDraft((d) => ({ ...d, ketuaCabangName: item.fullName }))
                }
              />
              <UktSignaturePad
                label="Ketua Cabang"
                valueUrl={draft.ketuaCabangSignUrl}
                onChange={(url) =>
                  setDraft((d) => ({ ...d, ketuaCabangSignUrl: url || "" }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Koordinator Penguji</Label>
              <UktTtdMemberPicker
                value={draft.bidangUjianName}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, bidangUjianName: v }))
                }
                onPick={(item) =>
                  setDraft((d) => ({ ...d, bidangUjianName: item.fullName }))
                }
              />
              <UktSignaturePad
                label="Koordinator Penguji"
                valueUrl={draft.bidangUjianSignUrl}
                onChange={(url) =>
                  setDraft((d) => ({ ...d, bidangUjianSignUrl: url || "" }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Nama-nama penguji</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    pengujiNames: [...d.pengujiNames, ""],
                    pengujiSignUrls: [...d.pengujiSignUrls, ""],
                  }))
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Tambah
              </Button>
            </div>
            {draft.pengujiNames.map((name, idx) => (
              <div
                key={idx}
                className="grid gap-2 rounded-md border p-2 sm:grid-cols-[auto_1fr_auto]"
              >
                <span className="pt-2 text-sm text-muted-foreground">
                  {idx + 1}.
                </span>
                <div className="space-y-1">
                  <UktTtdMemberPicker
                    value={name}
                    onChange={(v) => setPenguji(idx, v)}
                    onPick={(item) => setPenguji(idx, item.fullName)}
                    placeholder="Nama penguji"
                  />
                  <UktSignaturePad
                    label={`Penguji ${idx + 1}`}
                    valueUrl={draft.pengujiSignUrls[idx]}
                    onChange={(url) => setPengujiSign(idx, url)}
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  disabled={draft.pengujiNames.length <= 1}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      pengujiNames: d.pengujiNames.filter((_, i) => i !== idx),
                      pengujiSignUrls: d.pengujiSignUrls.filter(
                        (_, i) => i !== idx,
                      ),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() =>
                void persistMeta().then((ok) => {
                  if (ok) toast.success("Pejabat & penguji disimpan ke periode");
                })
              }
            >
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Menyimpan…" : "Simpan ke periode"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingTpl}
              onClick={() => void saveTemplate()}
            >
              <Save className="mr-1 h-4 w-4" />
              {savingTpl ? "Template…" : "Simpan sebagai template"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Pejabat & penguji diisi oleh cabang. Ranting dapat mengunduh rekap
          sesuai data yang sudah tersimpan.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!canRecap || busy}
          onClick={() => void runExcel()}
        >
          <FileSpreadsheet className="mr-1 h-4 w-4" />
          Excel
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!canRecap || busy}
          onClick={() => void runPdf()}
        >
          <Download className="mr-1 h-4 w-4" />
          Unduh PDF
        </Button>
        <Button
          type="button"
          className="bg-inkai-red hover:bg-inkai-red/90"
          disabled={!canRecap || busy}
          onClick={() => void runPrint()}
        >
          <Printer className="mr-1 h-4 w-4" />
          Print
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
import { printUktHasilUjianDocument } from "@/lib/ukt-hasil-ujian-html";
import { parseApiJson } from "@/lib/api-client";
import {
  collectUktTtdMemberIds,
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
  const slots = Math.max(UKT_TTD_DEFAULT_PENGUJI_SLOTS, r.pengujiNames.length);
  return {
    ...r,
    pengujiNames: padPengujiSlots(r.pengujiNames, slots),
    pengujiTitles: padPengujiSlots(r.pengujiTitles, slots),
    pengujiMemberIds: padPengujiSlots(r.pengujiMemberIds, slots),
    pengujiSignUrls: padPengujiSlots(r.pengujiSignUrls, slots),
  };
}

const TITLE_PLACEHOLDER = "DAN … INKAI MSH NO. …";

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

  const refreshTitlesFromMembers = async (current: Draft): Promise<Draft> => {
    if (!isCabang) return current;
    const memberIds = collectUktTtdMemberIds(current);
    if (memberIds.length === 0) return current;
    try {
      const res = await fetch("/api/admin/ukt/ttd-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds }),
      });
      if (!res.ok) return current;
      const data = await parseApiJson<{ titles?: Record<string, string> }>(res);
      const titles = data.titles ?? {};
      const apply = (memberId: string, fallback: string) => {
        const id = memberId.trim();
        if (!id) return fallback;
        return titles[id] || fallback;
      };
      return {
        ...current,
        pengdaKetuaTitle: apply(
          current.pengdaKetuaMemberId,
          current.pengdaKetuaTitle,
        ),
        mshKetuaTitle: apply(current.mshKetuaMemberId, current.mshKetuaTitle),
        ketuaCabangTitle: apply(
          current.ketuaCabangMemberId,
          current.ketuaCabangTitle,
        ),
        bidangUjianTitle: apply(
          current.bidangUjianMemberId,
          current.bidangUjianTitle,
        ),
        pengujiTitles: current.pengujiNames.map((_, i) =>
          apply(current.pengujiMemberIds[i] ?? "", current.pengujiTitles[i] ?? ""),
        ),
      };
    } catch {
      return current;
    }
  };

  const metaBodyFromDraft = (d: Draft) => ({
    eventId,
    pengdaKetua: d.pengdaKetua || null,
    pengdaKetuaTitle: d.pengdaKetuaTitle || null,
    pengdaKetuaMemberId: d.pengdaKetuaMemberId || null,
    mshKetua: d.mshKetua || null,
    mshKetuaTitle: d.mshKetuaTitle || null,
    mshKetuaMemberId: d.mshKetuaMemberId || null,
    ketuaCabangName: d.ketuaCabangName || null,
    ketuaCabangTitle: d.ketuaCabangTitle || null,
    ketuaCabangMemberId: d.ketuaCabangMemberId || null,
    bidangUjianName: d.bidangUjianName || null,
    bidangUjianTitle: d.bidangUjianTitle || null,
    bidangUjianMemberId: d.bidangUjianMemberId || null,
    pengujiNames: d.pengujiNames.map((n) => n.trim()).filter(Boolean),
    pengujiTitles: d.pengujiTitles,
    pengujiMemberIds: d.pengujiMemberIds,
    pengdaKetuaSignUrl: d.pengdaKetuaSignUrl || null,
    mshKetuaSignUrl: d.mshKetuaSignUrl || null,
    ketuaCabangSignUrl: d.ketuaCabangSignUrl || null,
    bidangUjianSignUrl: d.bidangUjianSignUrl || null,
    pengujiSignUrls: d.pengujiSignUrls,
  });

  const persistMeta = async (source?: Draft): Promise<Draft | null> => {
    if (!isCabang) return source ?? draft;
    setSaving(true);
    try {
      let next = source ?? draft;
      next = await refreshTitlesFromMembers(next);
      setDraft(next);
      const res = await fetch("/api/admin/ukt/period-meta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metaBodyFromDraft(next)),
      });
      const data = await parseApiJson<{
        error?: string;
        data?: UktPeriodMeta;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan pejabat TTD");
      if (data.data) onMetaSaved?.(data.data);
      return next;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async () => {
    setSavingTpl(true);
    try {
      const refreshed = await refreshTitlesFromMembers(draft);
      setDraft(refreshed);
      const res = await fetch("/api/admin/ukt/ttd-template", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pengdaKetua: refreshed.pengdaKetua || null,
          pengdaKetuaTitle: refreshed.pengdaKetuaTitle || null,
          pengdaKetuaMemberId: refreshed.pengdaKetuaMemberId || null,
          mshKetua: refreshed.mshKetua || null,
          mshKetuaTitle: refreshed.mshKetuaTitle || null,
          mshKetuaMemberId: refreshed.mshKetuaMemberId || null,
          ketuaCabangName: refreshed.ketuaCabangName || null,
          ketuaCabangTitle: refreshed.ketuaCabangTitle || null,
          ketuaCabangMemberId: refreshed.ketuaCabangMemberId || null,
          bidangUjianName: refreshed.bidangUjianName || null,
          bidangUjianTitle: refreshed.bidangUjianTitle || null,
          bidangUjianMemberId: refreshed.bidangUjianMemberId || null,
          pengujiNames: refreshed.pengujiNames.map((n) => n.trim()).filter(Boolean),
          pengujiTitles: refreshed.pengujiTitles,
          pengujiMemberIds: refreshed.pengujiMemberIds,
          pengdaKetuaSignUrl: refreshed.pengdaKetuaSignUrl || null,
          mshKetuaSignUrl: refreshed.mshKetuaSignUrl || null,
          ketuaCabangSignUrl: refreshed.ketuaCabangSignUrl || null,
          bidangUjianSignUrl: refreshed.bidangUjianSignUrl || null,
          pengujiSignUrls: refreshed.pengujiSignUrls,
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

  const payload = (recap: typeof recapRows, d: Draft) => ({
    semester,
    year,
    examAt: examAt ?? periodMeta?.examAt ?? null,
    ketuaCabangName: d.ketuaCabangName,
    ketuaCabangTitle: d.ketuaCabangTitle,
    bidangUjianName: d.bidangUjianName,
    bidangUjianTitle: d.bidangUjianTitle,
    pengdaKetua: d.pengdaKetua,
    pengdaKetuaTitle: d.pengdaKetuaTitle,
    mshKetua: d.mshKetua,
    mshKetuaTitle: d.mshKetuaTitle,
    pengujiNames: d.pengujiNames.map((n) => n.trim()).filter(Boolean),
    pengujiTitles: d.pengujiTitles,
    pengdaKetuaSignUrl: d.pengdaKetuaSignUrl || null,
    mshKetuaSignUrl: d.mshKetuaSignUrl || null,
    ketuaCabangSignUrl: d.ketuaCabangSignUrl || null,
    bidangUjianSignUrl: d.bidangUjianSignUrl || null,
    pengujiSignUrls: d.pengujiSignUrls,
    origin: window.location.origin,
    rows: recap,
  });

  const runExcel = async () => {
    const recap = ensureRecap("excel");
    if (!recap) return;
    setBusy(true);
    try {
      const saved = await persistMeta();
      if (!saved && isCabang) return;
      const d = saved ?? draft;
      const res = await fetch("/api/admin/ukt/rekap-hasil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(recap, d)),
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

  const runPrint = async () => {
    const recap = ensureRecap("print");
    if (!recap) return;
    const saved = await persistMeta();
    if (!saved && isCabang) return;
    const d = saved ?? draft;
    printUktHasilUjianDocument(payload(recap, d));
    toast.success(`${recap.length} peserta siap dicetak`);
  };

  const clearMemberOnType = (
    field: keyof Draft,
    memberField: keyof Draft,
    value: string,
  ) => {
    setDraft((d) => ({
      ...d,
      [field]: value,
      [memberField]: "",
    }));
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
                onChange={(v) =>
                  clearMemberOnType("pengdaKetua", "pengdaKetuaMemberId", v)
                }
                onPick={(item) =>
                  setDraft((d) => ({
                    ...d,
                    pengdaKetua: item.fullName,
                    pengdaKetuaTitle: item.officerTitle || d.pengdaKetuaTitle,
                    pengdaKetuaMemberId: item.id,
                    pengdaKetuaSignUrl:
                      item.signatureUrl || d.pengdaKetuaSignUrl,
                  }))
                }
              />
              <Input
                className="mt-1"
                value={draft.pengdaKetuaTitle}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, pengdaKetuaTitle: e.target.value }))
                }
                placeholder={TITLE_PLACEHOLDER}
              />
              <UktSignaturePad
                label="Ketua Umum Pengda"
                valueUrl={draft.pengdaKetuaSignUrl}
                memberId={draft.pengdaKetuaMemberId || null}
                onChange={(url) =>
                  setDraft((d) => ({ ...d, pengdaKetuaSignUrl: url || "" }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Ketua MSH</Label>
              <UktTtdMemberPicker
                value={draft.mshKetua}
                onChange={(v) =>
                  clearMemberOnType("mshKetua", "mshKetuaMemberId", v)
                }
                onPick={(item) =>
                  setDraft((d) => ({
                    ...d,
                    mshKetua: item.fullName,
                    mshKetuaTitle: item.officerTitle || d.mshKetuaTitle,
                    mshKetuaMemberId: item.id,
                    mshKetuaSignUrl: item.signatureUrl || d.mshKetuaSignUrl,
                  }))
                }
              />
              <Input
                className="mt-1"
                value={draft.mshKetuaTitle}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, mshKetuaTitle: e.target.value }))
                }
                placeholder={TITLE_PLACEHOLDER}
              />
              <UktSignaturePad
                label="Ketua MSH"
                valueUrl={draft.mshKetuaSignUrl}
                memberId={draft.mshKetuaMemberId || null}
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
                  clearMemberOnType("ketuaCabangName", "ketuaCabangMemberId", v)
                }
                onPick={(item) =>
                  setDraft((d) => ({
                    ...d,
                    ketuaCabangName: item.fullName,
                    ketuaCabangTitle: item.officerTitle || d.ketuaCabangTitle,
                    ketuaCabangMemberId: item.id,
                    ketuaCabangSignUrl:
                      item.signatureUrl || d.ketuaCabangSignUrl,
                  }))
                }
              />
              <Input
                className="mt-1"
                value={draft.ketuaCabangTitle}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, ketuaCabangTitle: e.target.value }))
                }
                placeholder={TITLE_PLACEHOLDER}
              />
              <UktSignaturePad
                label="Ketua Cabang"
                valueUrl={draft.ketuaCabangSignUrl}
                memberId={draft.ketuaCabangMemberId || null}
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
                  clearMemberOnType("bidangUjianName", "bidangUjianMemberId", v)
                }
                onPick={(item) =>
                  setDraft((d) => ({
                    ...d,
                    bidangUjianName: item.fullName,
                    bidangUjianTitle: item.officerTitle || d.bidangUjianTitle,
                    bidangUjianMemberId: item.id,
                    bidangUjianSignUrl:
                      item.signatureUrl || d.bidangUjianSignUrl,
                  }))
                }
              />
              <Input
                className="mt-1"
                value={draft.bidangUjianTitle}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, bidangUjianTitle: e.target.value }))
                }
                placeholder={TITLE_PLACEHOLDER}
              />
              <UktSignaturePad
                label="Koordinator Penguji"
                valueUrl={draft.bidangUjianSignUrl}
                memberId={draft.bidangUjianMemberId || null}
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
                    pengujiTitles: [...d.pengujiTitles, ""],
                    pengujiMemberIds: [...d.pengujiMemberIds, ""],
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
                    onChange={(v) =>
                      setDraft((d) => {
                        const pengujiNames = [...d.pengujiNames];
                        const pengujiMemberIds = [...d.pengujiMemberIds];
                        pengujiNames[idx] = v;
                        pengujiMemberIds[idx] = "";
                        return { ...d, pengujiNames, pengujiMemberIds };
                      })
                    }
                    onPick={(item) =>
                      setDraft((d) => {
                        const pengujiNames = [...d.pengujiNames];
                        const pengujiTitles = [...d.pengujiTitles];
                        const pengujiMemberIds = [...d.pengujiMemberIds];
                        const pengujiSignUrls = [...d.pengujiSignUrls];
                        while (pengujiTitles.length <= idx) pengujiTitles.push("");
                        while (pengujiMemberIds.length <= idx)
                          pengujiMemberIds.push("");
                        while (pengujiSignUrls.length <= idx)
                          pengujiSignUrls.push("");
                        pengujiNames[idx] = item.fullName;
                        pengujiTitles[idx] =
                          item.officerTitle || pengujiTitles[idx] || "";
                        pengujiMemberIds[idx] = item.id;
                        if (item.signatureUrl) {
                          pengujiSignUrls[idx] = item.signatureUrl;
                        }
                        return {
                          ...d,
                          pengujiNames,
                          pengujiTitles,
                          pengujiMemberIds,
                          pengujiSignUrls,
                        };
                      })
                    }
                    placeholder="Nama penguji"
                  />
                  <Input
                    value={draft.pengujiTitles[idx] ?? ""}
                    onChange={(e) =>
                      setDraft((d) => {
                        const pengujiTitles = [...d.pengujiTitles];
                        while (pengujiTitles.length <= idx) pengujiTitles.push("");
                        pengujiTitles[idx] = e.target.value;
                        return { ...d, pengujiTitles };
                      })
                    }
                    placeholder={TITLE_PLACEHOLDER}
                  />
                  <UktSignaturePad
                    label={`Penguji ${idx + 1}`}
                    valueUrl={draft.pengujiSignUrls[idx]}
                    memberId={draft.pengujiMemberIds[idx] || null}
                    onChange={(url) =>
                      setDraft((d) => {
                        const pengujiSignUrls = [...d.pengujiSignUrls];
                        while (pengujiSignUrls.length <= idx)
                          pengujiSignUrls.push("");
                        pengujiSignUrls[idx] = url || "";
                        return { ...d, pengujiSignUrls };
                      })
                    }
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
                      pengujiTitles: d.pengujiTitles.filter((_, i) => i !== idx),
                      pengujiMemberIds: d.pengujiMemberIds.filter(
                        (_, i) => i !== idx,
                      ),
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

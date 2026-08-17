"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SITE_BRANCH_NAME } from "@/lib/site";
import {
  buildUktPesertaCsv,
  buildUktPesertaExportRows,
  buildUktPesertaTitle,
  collectUktExportDataIssues,
  triggerCsvDownload,
  type UktMemberRow,
  type UktSemester,
} from "@/lib/ukt";
import { printUktPesertaDocument } from "@/lib/ukt-print-html";

type DojoOption = { id: string; name: string };

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Tanpa Dialog wrapper — dipakai di hub Laporan. */
  embedded?: boolean;
  rows: UktMemberRow[];
  dojos: DojoOption[];
  semester: UktSemester;
  year: number;
  /** Preselect ranting dari filter tabel (jika ada). */
  initialDojoId?: string;
  /** Kunci ranting (admin ranting). */
  lockDojoId?: string;
  bidangUjianName?: string;
  sekretariatAddress?: string;
};

const ISSUE_LABEL: Record<string, string> = {
  nia: "NIA",
  ttl: "TTL",
  alamat: "Alamat",
  kyu: "Kyu",
  jk: "JK",
};

function formatPrintedPlaceDate(d = new Date()): string {
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `Surabaya, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function UktExportDialog({
  open = true,
  onOpenChange,
  embedded = false,
  rows,
  dojos,
  semester,
  year,
  initialDojoId,
  lockDojoId,
  bidangUjianName = "SETIA BASUKI",
  sekretariatAddress,
}: Props) {
  const [printBusy, setPrintBusy] = useState(false);

  const registered = useMemo(
    () => rows.filter((r) => r.registrationId),
    [rows],
  );

  const availableDojos = useMemo(() => {
    const withPeserta = new Set(registered.map((r) => r.dojoId));
    let listed = dojos.filter((d) => withPeserta.has(d.id));
    const known = new Set(listed.map((d) => d.id));
    for (const r of registered) {
      if (!known.has(r.dojoId)) {
        listed.push({ id: r.dojoId, name: r.dojoName || "Ranting" });
        known.add(r.dojoId);
      }
    }
    if (lockDojoId) {
      listed = listed.filter((d) => d.id === lockDojoId);
    }
    return listed.sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [dojos, registered, lockDojoId]);

  const [selectedDojoIds, setSelectedDojoIds] = useState<Set<string>>(new Set());

  const panelActive = embedded || open;

  useEffect(() => {
    if (!panelActive) return;
    if (lockDojoId && availableDojos.some((d) => d.id === lockDojoId)) {
      setSelectedDojoIds(new Set([lockDojoId]));
    } else if (initialDojoId && availableDojos.some((d) => d.id === initialDojoId)) {
      setSelectedDojoIds(new Set([initialDojoId]));
    } else {
      setSelectedDojoIds(new Set(availableDojos.map((d) => d.id)));
    }
  }, [panelActive, initialDojoId, lockDojoId, availableDojos]);

  const filteredRows = useMemo(() => {
    if (selectedDojoIds.size === 0) return [];
    return registered.filter((r) => selectedDojoIds.has(r.dojoId));
  }, [registered, selectedDojoIds]);

  const exportRows = useMemo(
    () => buildUktPesertaExportRows(filteredRows),
    [filteredRows],
  );
  const issues = useMemo(
    () => collectUktExportDataIssues(filteredRows),
    [filteredRows],
  );
  const previewRows = exportRows.slice(0, 5);

  const allSelected =
    availableDojos.length > 0 && selectedDojoIds.size === availableDojos.length;

  const toggleDojo = (id: string) => {
    setSelectedDojoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelectedDojoIds(new Set());
    else setSelectedDojoIds(new Set(availableDojos.map((d) => d.id)));
  };

  const title = buildUktPesertaTitle(semester, year);

  const ensureRows = () => {
    if (selectedDojoIds.size === 0) {
      toast.error("Pilih minimal satu ranting");
      return null;
    }
    if (filteredRows.length === 0) {
      toast.error("Tidak ada peserta terdaftar untuk ranting terpilih");
      return null;
    }
    return filteredRows;
  };

  const handleCsv = () => {
    const data = ensureRows();
    if (!data) return;
    if (issues.length > 0) {
      toast.message(`${issues.length} peserta punya data kurang — tetap diekspor`);
    }
    const csv = buildUktPesertaCsv(data);
    triggerCsvDownload(`ukt-peserta-S${semester}-${year}.csv`, csv);
    toast.success(`${data.length} peserta diekspor ke CSV`);
  };

  const handlePrint = () => {
    const data = ensureRows();
    if (!data) return;
    if (issues.length > 0) {
      toast.message(`${issues.length} peserta punya data kurang — cek pratinjau`);
    }
    setPrintBusy(true);
    try {
      printUktPesertaDocument({
        title,
        branchLabel: `CABANG : ${SITE_BRANCH_NAME}`,
        rows: buildUktPesertaExportRows(data),
        origin: window.location.origin,
        printedPlaceDate: formatPrintedPlaceDate(),
        signatoryTitle: "Bidang Ujian",
        signatoryName: bidangUjianName || "SETIA BASUKI",
        sekretariatAddress,
      });
      toast.success(
        `${data.length} peserta siap — di dialog cetak pilih printer atau Save as PDF`,
      );
    } finally {
      // Dialog print browser memblok; setelah Cancel/Print, izinkan klik lagi.
      setTimeout(() => setPrintBusy(false), 1500);
    }
  };

  const body = (
    <>
        {!embedded ? (
          <DialogHeader>
            <DialogTitle>Export daftar peserta</DialogTitle>
            <DialogDescription>
              Format formulir cabang. Pilih ranting, cek pratinjau, lalu Print
              (termasuk Save as PDF) atau CSV.
              {initialDojoId
                ? " Filter ranting tabel diterapkan sebagai pilihan awal."
                : " Default: semua ranting yang punya peserta."}
            </DialogDescription>
          </DialogHeader>
        ) : (
          <p className="text-sm text-muted-foreground">
            Format formulir cabang. Pilih ranting, lalu CSV / Print.
          </p>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Ranting</p>
            {!lockDojoId ? (
              <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
                {allSelected ? "Hapus semua" : "Pilih semua"}
              </Button>
            ) : null}
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
            {availableDojos.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">
                Belum ada peserta terdaftar.
              </p>
            ) : (
              availableDojos.map((d) => {
                const count = registered.filter((r) => r.dojoId === d.id).length;
                return (
                  <label
                    key={d.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-inkai-red"
                      checked={selectedDojoIds.has(d.id)}
                      disabled={Boolean(lockDojoId)}
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

          {issues.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="mb-1 flex items-center gap-1 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                {issues.length} peserta data kurang
              </p>
              <ul className="max-h-20 space-y-0.5 overflow-y-auto">
                {issues.slice(0, 8).map((i) => (
                  <li key={i.memberId}>
                    {i.fullName}:{" "}
                    {i.missing.map((m) => ISSUE_LABEL[m] || m).join(", ")}
                  </li>
                ))}
                {issues.length > 8 && (
                  <li>…dan {issues.length - 8} lainnya</li>
                )}
              </ul>
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="rounded-md border p-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Pratinjau 5 baris pertama
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-1 pr-1">No</th>
                      <th className="py-1 pr-1">NIA</th>
                      <th className="py-1 pr-1">Nama</th>
                      <th className="py-1 pr-1">Kyu</th>
                      <th className="py-1">Ranting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r) => (
                      <tr key={r.no} className="border-b border-muted/50">
                        <td className="py-0.5 pr-1">{r.no}</td>
                        <td className="py-0.5 pr-1">{r.nia || "—"}</td>
                        <td className="max-w-[8rem] truncate py-0.5 pr-1">
                          {r.nama}
                        </td>
                        <td className="py-0.5 pr-1">{r.kyu || "—"}</td>
                        <td className="max-w-[6rem] truncate py-0.5">
                          {r.ranting}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {filteredRows.length} peserta · {title}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleCsv}
            disabled={filteredRows.length === 0}
          >
            <FileSpreadsheet className="mr-1 h-4 w-4" />
            CSV
          </Button>
          <Button
            type="button"
            className="bg-inkai-red hover:bg-inkai-red/90"
            onClick={handlePrint}
            disabled={filteredRows.length === 0 || printBusy}
          >
            <Printer className="mr-1 h-4 w-4" />
            Print
          </Button>
        </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{body}</div>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {body}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BELT_RANK_OPTIONS,
  DEFAULT_MEMBER_RANK,
  formatRankLabel,
  normalizeGenderStorage,
} from "@/lib/belt";
import {
  parseBirthPlaceAndDate,
  parseFlexibleBirthDate,
} from "@/lib/parse-birth-date";
import { showError, showSuccess } from "@/lib/client-toast";
import type { AddMemberDojoOption } from "@/components/admin/AddMemberDialog";
import { triggerCsvDownload } from "@/lib/ukt";

type BulkRow = {
  key: string;
  nia: string;
  fullName: string;
  /** Teks bebas — dinormalisasi ke L/P saat simpan. */
  gender: string;
  /** Gabungan tempat + tanggal, mis. "SURABAYA, 28 MARET 2015". */
  birthPlaceDate: string;
  address: string;
  nik: string;
  phoneNumber: string;
  currentRank: string;
  dojoId: string;
  error?: string;
  ok?: boolean;
};

const COLUMNS = [
  "NIA",
  "Nama Lengkap",
  "Jenis Kelamin",
  "Tempat & Tanggal Lahir",
  "Alamat",
  "NIK",
  "Telepon",
  "Kyu saat ini",
  "Ranting",
] as const;

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyRow(dojoId = "", currentRank = DEFAULT_MEMBER_RANK): BulkRow {
  return {
    key: newKey(),
    nia: "",
    fullName: "",
    gender: "",
    birthPlaceDate: "",
    address: "",
    nik: "",
    phoneNumber: "",
    currentRank,
    dojoId,
  };
}

function upper(value: string) {
  return value.toUpperCase();
}

function resolveDojoId(
  raw: string,
  dojos: AddMemberDojoOption[],
  fallback: string,
): string {
  const t = raw.trim();
  if (!t) return fallback;
  if (dojos.some((d) => d.id === t)) return t;
  const byName = dojos.find(
    (d) => d.name.trim().toLowerCase() === t.toLowerCase(),
  );
  return byName?.id || fallback;
}

function formatBirthCombined(place: string, dateRaw: string): string {
  const placePart = place.trim();
  const datePart = dateRaw.trim();
  if (placePart && datePart) return `${upper(placePart)}, ${datePart}`;
  return upper(placePart) || datePart;
}

/**
 * Parse baris paste.
 * Format baru (9 kolom): NIA, Nama, JK, Tempat&Tgl, Alamat, NIK, Telp, Kyu, Ranting
 * Format lama (10 kolom): NIA, Nama, JK, Tempat, Tgl, Alamat, NIK, Telp, Kyu, Ranting
 */
function parsePasteLines(
  text: string,
  dojos: AddMemberDojoOption[],
  defaultDojoId: string,
): BulkRow[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const sep = lines[0]!.includes("\t")
    ? "\t"
    : lines[0]!.includes(";")
      ? ";"
      : ",";

  const rows: BulkRow[] = [];
  for (const line of lines) {
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const head0 = cells[0]?.toLowerCase() || "";
    const head1 = cells[1]?.toLowerCase() || "";
    if (head0 === "nia" || head1.includes("nama")) continue;

    if (!cells.some((c) => c.trim())) continue;

    let nia = "";
    let fullName = "";
    let genderRaw = "";
    let birthPlaceDate = "";
    let address = "";
    let nik = "";
    let phoneNumber = "";
    let rankRaw = "";
    let rantingRaw = "";

    if (cells.length >= 10) {
      // Format lama: tempat + tanggal terpisah
      const [
        c0 = "",
        c1 = "",
        c2 = "",
        place = "",
        dateRaw = "",
        c5 = "",
        c6 = "",
        c7 = "",
        c8 = "",
        c9 = "",
      ] = cells;
      nia = c0;
      fullName = c1;
      genderRaw = c2;
      birthPlaceDate = formatBirthCombined(place, dateRaw);
      address = c5;
      nik = c6;
      phoneNumber = c7;
      rankRaw = c8;
      rantingRaw = c9;
    } else {
      const [
        c0 = "",
        c1 = "",
        c2 = "",
        c3 = "",
        c4 = "",
        c5 = "",
        c6 = "",
        c7 = "",
        c8 = "",
      ] = cells;
      nia = c0;
      fullName = c1;
      genderRaw = c2;
      birthPlaceDate = c3;
      address = c4;
      nik = c5;
      phoneNumber = c6;
      rankRaw = c7;
      rantingRaw = c8;
    }

    if (!fullName.trim() && !nia.trim() && !nik.trim()) continue;

    const gender =
      normalizeGenderStorage(genderRaw) ||
      genderRaw.trim().toUpperCase() ||
      "";
    const currentRank =
      formatRankLabel(rankRaw) || rankRaw.trim() || DEFAULT_MEMBER_RANK;

    rows.push({
      key: newKey(),
      nia: upper(nia),
      fullName: upper(fullName),
      gender,
      birthPlaceDate: birthPlaceDate.trim(),
      address: upper(address),
      nik: nik.replace(/\D/g, "").slice(0, 16),
      phoneNumber: phoneNumber.trim(),
      currentRank,
      dojoId: resolveDojoId(rantingRaw, dojos, defaultDojoId),
    });
  }
  return rows;
}

const cellClass =
  "h-8 w-full min-w-[7rem] rounded border border-input bg-background px-1.5 text-xs text-foreground";

export function AddMembersBulkDialog({
  open,
  onOpenChange,
  dojos = [],
  defaultDojoId = "",
  lockDojo = false,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dojos?: AddMemberDojoOption[];
  defaultDojoId?: string;
  lockDojo?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [bulkDojoId, setBulkDojoId] = useState(defaultDojoId);
  const [rows, setRows] = useState<BulkRow[]>(() =>
    Array.from({ length: 5 }, () => emptyRow(defaultDojoId)),
  );
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBulkDojoId(defaultDojoId);
      setRows(Array.from({ length: 5 }, () => emptyRow(defaultDojoId)));
      setProgress(null);
      setLoading(false);
    }
  }, [open, defaultDojoId]);

  const filledCount = useMemo(
    () => rows.filter((r) => r.fullName.trim().length >= 2).length,
    [rows],
  );

  const updateRow = useCallback((key: string, patch: Partial<BulkRow>) => {
    setRows((prev) =>
      prev.map((r) =>
        r.key === key
          ? { ...r, ...patch, error: undefined, ok: undefined }
          : r,
      ),
    );
  }, []);

  function applyDojoToAll(dojoId: string) {
    setBulkDojoId(dojoId);
    setRows((prev) => prev.map((r) => ({ ...r, dojoId })));
  }

  function addRows(n = 5) {
    const dojo = bulkDojoId || defaultDojoId;
    setRows((prev) => [
      ...prev,
      ...Array.from({ length: n }, () => emptyRow(dojo)),
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((r) => r.key !== key),
    );
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return;
    const fallbackDojo = bulkDojoId || defaultDojoId;
    const parsed = parsePasteLines(text, dojos, fallbackDojo);
    if (parsed.length === 0) return;
    e.preventDefault();
    setRows((prev) => {
      const kept = prev.filter((r) => r.fullName.trim());
      return [...kept, ...parsed].slice(0, 50);
    });
    showSuccess(`${parsed.length} baris ditempel dari clipboard`);
  }

  function downloadTemplate() {
    const sampleDojo =
      dojos.find((d) => d.id === (bulkDojoId || defaultDojoId))?.name ||
      dojos[0]?.name ||
      "AIRLANGGA";
    const header = COLUMNS.join(",");
    const sample = [
      "25.00001",
      "BUDI SANTOSO",
      "L",
      "SURABAYA, 28 Februari 2011",
      "JL CONTOH 1",
      "",
      "081234567890",
      "Putih (Kyu 10)",
      sampleDojo,
    ].join(",");
    triggerCsvDownload(
      "template-tambah-anggota.csv",
      `\uFEFF${header}\n${sample}\n`,
    );
  }

  async function handleSave() {
    const payloadRows = rows.filter((r) => r.fullName.trim().length >= 2);
    if (payloadRows.length === 0) {
      showError("Isi minimal satu baris dengan nama lengkap");
      return;
    }
    if (payloadRows.length > 50) {
      showError("Maksimal 50 baris per simpan");
      return;
    }

    for (const r of payloadRows) {
      const dojoId = r.dojoId || bulkDojoId || defaultDojoId;
      if (!lockDojo && dojos.length > 1 && !dojoId) {
        showError(`Pilih ranting untuk ${r.fullName}`);
        return;
      }
      if (r.nik && r.nik.length !== 16) {
        showError(`NIK ${r.fullName} harus kosong atau 16 digit`);
        return;
      }
    }

    setLoading(true);
    setProgress(`Menyimpan 0/${payloadRows.length}…`);
    try {
      const members = payloadRows.map((r) => {
        const parsedBirth = parseBirthPlaceAndDate(r.birthPlaceDate);
        const birthDate =
          parsedBirth.birthDate ||
          parseFlexibleBirthDate(r.birthPlaceDate) ||
          undefined;
        return {
          fullName: r.fullName.trim().toUpperCase(),
          gender: (normalizeGenderStorage(r.gender) || undefined) as
            | "L"
            | "P"
            | undefined,
          birthPlace: parsedBirth.birthPlace || undefined,
          birthDate,
          address: r.address.trim()
            ? r.address.trim().toUpperCase()
            : undefined,
          nik: r.nik.trim() || undefined,
          phoneNumber: r.phoneNumber.trim() || undefined,
          nia: r.nia.trim() ? r.nia.trim().toUpperCase() : undefined,
          currentRank:
            formatRankLabel(r.currentRank) ||
            r.currentRank.trim() ||
            DEFAULT_MEMBER_RANK,
          dojoId: r.dojoId || bulkDojoId || defaultDojoId || undefined,
        };
      });

      setProgress(`Menyimpan ${members.length} anggota…`);
      const res = await fetch("/api/admin/members/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        okCount?: number;
        failCount?: number;
        results?: Array<{
          index: number;
          fullName: string;
          ok: boolean;
          error?: string;
        }>;
      };

      if (!res.ok && !data.results) {
        showError(data.error || "Gagal menyimpan massal");
        return;
      }

      const byIndex = new Map(
        (data.results ?? []).map((r) => [r.index, r] as const),
      );
      setRows((prev) => {
        let filledIdx = 0;
        return prev.map((row) => {
          if (row.fullName.trim().length < 2) return row;
          const result = byIndex.get(filledIdx++);
          if (!result) return row;
          return {
            ...row,
            ok: result.ok,
            error: result.ok ? undefined : result.error,
          };
        });
      });

      if ((data.failCount ?? 0) === 0) {
        showSuccess(data.message || "Semua anggota berhasil ditambahkan");
        onOpenChange(false);
        onSuccess?.();
        router.refresh();
      } else {
        showError(
          data.message ||
            `${data.okCount ?? 0} berhasil, ${data.failCount} gagal — periksa baris merah`,
        );
        if ((data.okCount ?? 0) > 0) {
          onSuccess?.();
          router.refresh();
        }
      }
    } catch {
      showError("Gagal menyimpan massal");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-full max-w-6xl flex-col gap-3 sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Input Massal Anggota</DialogTitle>
          <DialogDescription>
            NIA &amp; NIK opsional. Jenis kelamin &amp; Kyu teks (bisa paste).
            Tempat &amp; tanggal lahir digabung, mis.{" "}
            <span className="font-medium text-foreground">
              Surabaya, 28 Maret 2015
            </span>
            . Tempel dari Excel sesuai header. Maks 50 baris.
          </DialogDescription>
        </DialogHeader>

        <datalist id="bulk-kyu-options">
          {BELT_RANK_OPTIONS.map((rank) => (
            <option key={rank} value={rank} />
          ))}
        </datalist>

        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            disabled={loading}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Template CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addRows(5)}
            disabled={loading || rows.length >= 50}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Tambah 5 baris
          </Button>

          {!lockDojo || dojos.length > 1 ? (
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">
                Isi semua ranting
              </label>
              <select
                className="h-8 min-w-[160px] rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                value={bulkDojoId}
                onChange={(e) => applyDojoToAll(e.target.value)}
                disabled={loading}
              >
                <option value="">Pilih ranting…</option>
                {dojos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ranting:{" "}
              <span className="font-medium text-foreground">
                {dojos[0]?.name || "—"}
              </span>
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            {filledCount} baris terisi · {rows.length} baris tabel
            {progress ? ` · ${progress}` : ""}
          </p>
        </div>

        <div
          className="min-h-0 flex-1 overflow-auto rounded-lg border"
          onPaste={handlePaste}
        >
          <table className="w-max min-w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th className="border-b px-2 py-2 font-medium">No</th>
                {COLUMNS.map((c) => (
                  <th
                    key={c}
                    className="border-b px-2 py-2 font-medium whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
                <th className="border-b px-2 py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.key}
                  className={
                    row.error
                      ? "bg-destructive/10"
                      : row.ok
                        ? "bg-emerald-500/10"
                        : undefined
                  }
                >
                  <td className="border-b px-2 py-1 tabular-nums text-muted-foreground">
                    {idx + 1}
                  </td>
                  <td className="border-b px-1 py-1">
                    <input
                      className={cellClass}
                      value={row.nia}
                      placeholder="opsional"
                      onChange={(e) =>
                        updateRow(row.key, { nia: upper(e.target.value) })
                      }
                      disabled={loading}
                    />
                  </td>
                  <td className="border-b px-1 py-1">
                    <input
                      className={`${cellClass} min-w-[10rem]`}
                      value={row.fullName}
                      placeholder="WAJIB"
                      onChange={(e) =>
                        updateRow(row.key, {
                          fullName: upper(e.target.value),
                        })
                      }
                      disabled={loading}
                    />
                  </td>
                  <td className="border-b px-1 py-1">
                    <input
                      className={`${cellClass} min-w-[5rem]`}
                      value={row.gender}
                      placeholder="L / P"
                      onChange={(e) =>
                        updateRow(row.key, { gender: e.target.value })
                      }
                      onBlur={(e) => {
                        const g = normalizeGenderStorage(e.target.value);
                        if (g) updateRow(row.key, { gender: g });
                      }}
                      disabled={loading}
                    />
                  </td>
                  <td className="border-b px-1 py-1">
                    <input
                      className={`${cellClass} min-w-[14rem]`}
                      value={row.birthPlaceDate}
                      placeholder="Surabaya, 28 Maret 2015"
                      onChange={(e) =>
                        updateRow(row.key, {
                          birthPlaceDate: e.target.value,
                        })
                      }
                      onBlur={(e) => {
                        const parsed = parseBirthPlaceAndDate(e.target.value);
                        if (parsed.birthPlace || parsed.birthDate) {
                          const display = parsed.birthDate
                            ? `${parsed.birthPlace || ""}${parsed.birthPlace ? ", " : ""}${parsed.birthDate}`
                            : parsed.birthPlace;
                          if (display) {
                            updateRow(row.key, { birthPlaceDate: display });
                          }
                        }
                      }}
                      disabled={loading}
                    />
                  </td>
                  <td className="border-b px-1 py-1">
                    <input
                      className={`${cellClass} min-w-[12rem]`}
                      value={row.address}
                      onChange={(e) =>
                        updateRow(row.key, {
                          address: upper(e.target.value),
                        })
                      }
                      disabled={loading}
                    />
                  </td>
                  <td className="border-b px-1 py-1">
                    <input
                      className={`${cellClass} min-w-[9rem]`}
                      value={row.nik}
                      placeholder="16 digit"
                      inputMode="numeric"
                      maxLength={16}
                      onChange={(e) =>
                        updateRow(row.key, {
                          nik: e.target.value.replace(/\D/g, "").slice(0, 16),
                        })
                      }
                      disabled={loading}
                    />
                  </td>
                  <td className="border-b px-1 py-1">
                    <input
                      className={cellClass}
                      value={row.phoneNumber}
                      onChange={(e) =>
                        updateRow(row.key, {
                          phoneNumber: e.target.value,
                        })
                      }
                      disabled={loading}
                    />
                  </td>
                  <td className="border-b px-1 py-1">
                    <input
                      className={`${cellClass} min-w-[9rem]`}
                      value={row.currentRank}
                      placeholder="Putih (Kyu 10)"
                      list="bulk-kyu-options"
                      onChange={(e) =>
                        updateRow(row.key, { currentRank: e.target.value })
                      }
                      onBlur={(e) => {
                        const formatted =
                          formatRankLabel(e.target.value) ||
                          e.target.value.trim();
                        if (formatted) {
                          updateRow(row.key, { currentRank: formatted });
                        }
                      }}
                      disabled={loading}
                    />
                  </td>
                  <td className="border-b px-1 py-1">
                    {lockDojo && dojos.length === 1 ? (
                      <span className="block max-w-[10rem] truncate px-1.5 py-1.5 text-xs">
                        {dojos[0]?.name}
                      </span>
                    ) : (
                      <select
                        className={`${cellClass} min-w-[9rem]`}
                        value={row.dojoId}
                        onChange={(e) =>
                          updateRow(row.key, { dojoId: e.target.value })
                        }
                        disabled={loading || lockDojo}
                      >
                        <option value="">Pilih</option>
                        {dojos.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="border-b px-1 py-1">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded border text-muted-foreground hover:bg-muted"
                      onClick={() => removeRow(row.key)}
                      disabled={loading || rows.length <= 1}
                      aria-label="Hapus baris"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.some((r) => r.error) ? (
          <ul className="max-h-24 overflow-auto text-xs text-destructive">
            {rows
              .filter((r) => r.error)
              .map((r) => (
                <li key={r.key}>
                  {r.fullName || "(tanpa nama)"}: {r.error}
                </li>
              ))}
          </ul>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <p className="self-center text-xs text-muted-foreground">
            Tip: pilih &quot;Isi semua ranting&quot; dulu, lalu tempel Excel
            (Ctrl+V).
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              type="button"
              className="bg-inkai-red"
              onClick={() => void handleSave()}
              disabled={loading || filledCount === 0}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {loading
                ? progress || "Menyimpan…"
                : `Simpan ${filledCount} anggota`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

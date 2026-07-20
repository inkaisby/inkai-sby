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
import { postBulkCreateChunked } from "@/lib/member-bulk-client";
import { InkaiLogoLoader } from "@/components/ui/InkaiLogoLoader";

type BulkRow = {
  key: string;
  nia: string;
  fullName: string;
  /** Teks bebas — dinormalisasi ke L/P saat simpan. */
  gender: string;
  /** Gabungan tempat + tanggal, mis. "SURABAYA, 28 MARET 2015". */
  birthPlaceDate: string;
  address: string;
  currentRank: string;
  dojoId: string;
  error?: string;
  ok?: boolean;
};

const COLUMNS = [
  "NIA",
  "Nama Lengkap",
  "Tempat & Tanggal Lahir",
  "Jenis Kelamin",
  "Alamat",
  "Kyu saat ini",
  "Ranting",
] as const;

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyRow(dojoId = "", currentRank = ""): BulkRow {
  return {
    key: newKey(),
    nia: "",
    fullName: "",
    gender: "",
    birthPlaceDate: "",
    address: "",
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

function looksLikeGender(raw: string): boolean {
  return Boolean(normalizeGenderStorage(raw));
}

function looksLikeBirthPlaceDate(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (looksLikeGender(t)) return false;
  if (/,/.test(t)) return true;
  if (parseFlexibleBirthDate(t)) return true;
  if (parseBirthPlaceAndDate(t).birthDate) return true;
  return /(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i.test(
    t,
  );
}

/**
 * Parse baris paste.
 * Format baru (7 kolom): NIA, Nama, Tempat&Tgl, JK, Alamat, Kyu, Ranting
 * Format lama (7 kolom): NIA, Nama, JK, Tempat&Tgl, Alamat, Kyu, Ranting
 * Format lama (9 kolom): … Alamat, NIK, Tel, Kyu, Ranting (NIK/Tel diabaikan)
 * Format lama (10 kolom): … Tempat, Tgl, Alamat, NIK, Tel, Kyu, Ranting
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
    let rankRaw = "";
    let rantingRaw = "";

    if (cells.length >= 10) {
      // Lama: NIA, Nama, JK, Tempat, Tgl, Alamat, NIK, Tel, Kyu, Ranting
      const [
        c0 = "",
        c1 = "",
        c2 = "",
        place = "",
        dateRaw = "",
        c5 = "",
        ,
        ,
        c8 = "",
        c9 = "",
      ] = cells;
      nia = c0;
      fullName = c1;
      genderRaw = c2;
      birthPlaceDate = formatBirthCombined(place, dateRaw);
      address = c5;
      rankRaw = c8;
      rantingRaw = c9;
    } else if (cells.length >= 9) {
      // Lama: NIA, Nama, JK, Tempat&Tgl, Alamat, NIK, Tel, Kyu, Ranting
      const [
        c0 = "",
        c1 = "",
        c2 = "",
        c3 = "",
        c4 = "",
        ,
        ,
        c7 = "",
        c8 = "",
      ] = cells;
      nia = c0;
      fullName = c1;
      genderRaw = c2;
      birthPlaceDate = c3;
      address = c4;
      rankRaw = c7;
      rantingRaw = c8;
    } else {
      const [
        c0 = "",
        c1 = "",
        c2 = "",
        c3 = "",
        c4 = "",
        c5 = "",
        c6 = "",
      ] = cells;
      nia = c0;
      fullName = c1;
      // Baru: Tempat&Tgl lalu JK — deteksi jika kolom ke-3 tampak lahir / kolom ke-4 tampak JK.
      if (
        looksLikeBirthPlaceDate(c2) ||
        (looksLikeGender(c3) && !looksLikeGender(c2))
      ) {
        birthPlaceDate = c2;
        genderRaw = c3;
        address = c4;
        rankRaw = c5;
        rantingRaw = c6;
      } else {
        // Lama 7 kolom: JK lalu Tempat&Tgl
        genderRaw = c2;
        birthPlaceDate = c3;
        address = c4;
        rankRaw = c5;
        rantingRaw = c6;
      }
    }

    if (!fullName.trim() && !nia.trim()) continue;

    const gender =
      normalizeGenderStorage(genderRaw) ||
      genderRaw.trim().toUpperCase() ||
      "";
    const currentRank =
      formatRankLabel(rankRaw) || rankRaw.trim() || "";

    rows.push({
      key: newKey(),
      nia: upper(nia),
      fullName: upper(fullName),
      gender,
      birthPlaceDate: birthPlaceDate.trim(),
      address: upper(address),
      currentRank,
      dojoId: resolveDojoId(rantingRaw, dojos, defaultDojoId),
    });
  }
  return rows;
}

const cellClass =
  "h-8 w-full rounded border border-input bg-background px-1.5 text-xs text-foreground";

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
  const [bulkRank, setBulkRank] = useState("");
  const [rows, setRows] = useState<BulkRow[]>(() =>
    Array.from({ length: 5 }, () => emptyRow(defaultDojoId)),
  );
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);

  useEffect(() => {
    if (open) {
      setBulkDojoId(defaultDojoId);
      setBulkRank("");
      setRows(Array.from({ length: 5 }, () => emptyRow(defaultDojoId)));
      setProgress(null);
      setProgressPercent(0);
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

  function applyRankToAll(rankRaw: string) {
    const trimmed = rankRaw.trim();
    if (!trimmed) {
      setBulkRank("");
      return;
    }
    const formatted = formatRankLabel(trimmed) || trimmed;
    setBulkRank(formatted);
    setRows((prev) => prev.map((r) => ({ ...r, currentRank: formatted })));
  }

  function addRows(n = 5) {
    const dojo = bulkDojoId || defaultDojoId;
    const rank = formatRankLabel(bulkRank) || bulkRank.trim() || "";
    setRows((prev) => [
      ...prev,
      ...Array.from({ length: n }, () => emptyRow(dojo, rank)),
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((r) => r.key !== key),
    );
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text");
    if (!text) return;

    // Excel paste 1 sel sering bawa \n di ujung — jangan anggap multi-baris.
    const lines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const isTabular = text.includes("\t") || lines.length > 1;

    const target = e.target as HTMLElement | null;
    const inField =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;

    // Paste ke dalam sel (Kyu, Nama, dll): biarkan native jika bukan tabel.
    if (inField && !isTabular) return;
    if (!isTabular) return;

    const fallbackDojo = bulkDojoId || defaultDojoId;
    const fallbackRank =
      formatRankLabel(bulkRank) || bulkRank.trim() || "";
    const parsed = parsePasteLines(text, dojos, fallbackDojo).map((row) => ({
      ...row,
      // Jika paste tanpa kolom Kyu, pakai "Isi semua Kyu/DAN" — jangan default Putih.
      currentRank: row.currentRank.trim() || fallbackRank,
    }));
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
      "SURABAYA, 28 Februari 2011",
      "L",
      "JL CONTOH 1",
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
    }

    setLoading(true);
    setProgressPercent(0);
    setProgress(`Menyimpan 0/${payloadRows.length} (0%)`);
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
          nia: r.nia.trim() ? r.nia.trim().toUpperCase() : undefined,
          currentRank:
            formatRankLabel(r.currentRank) ||
            r.currentRank.trim() ||
            formatRankLabel(bulkRank) ||
            bulkRank.trim() ||
            DEFAULT_MEMBER_RANK,
          dojoId: r.dojoId || bulkDojoId || defaultDojoId || undefined,
        };
      });

      const data = await postBulkCreateChunked(members, {
        onProgress: (p) => {
          setProgressPercent(p.percent);
          setProgress(
            p.percent >= 100
              ? `Selesai ${p.done}/${p.total} (100%)`
              : `Menyimpan ${p.done}/${p.total} (${p.percent}%)`,
          );
        },
      });

      if (!data.results.length && !data.ok) {
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
      setProgressPercent(0);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-full max-w-6xl flex-col gap-3 sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Input Massal Anggota</DialogTitle>
          <DialogDescription>
            NIA opsional. Pilih{" "}
            <span className="font-medium text-foreground">Kyu atau DAN</span> di
            atas untuk mengisi semua baris. Jenis kelamin &amp; Kyu teks (bisa
            paste ke sel). Tempat &amp; tanggal lahir digabung, mis.{" "}
            <span className="font-medium text-foreground">
              Surabaya, 28 Maret 2015
            </span>
            . Tempel tabel dari Excel sesuai header. Maks 50 baris.
          </DialogDescription>
        </DialogHeader>

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

          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">
              Isi semua Kyu / DAN
            </label>
            <select
              className="h-8 min-w-[180px] rounded-lg border border-input bg-background px-2 text-sm text-foreground"
              value={bulkRank}
              onChange={(e) => applyRankToAll(e.target.value)}
              disabled={loading}
            >
              <option value="">Pilih Kyu / DAN…</option>
              {BELT_RANK_OPTIONS.map((rank) => (
                <option key={rank} value={rank}>
                  {rank}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-muted-foreground">
            {filledCount} baris terisi · {rows.length} baris tabel
            {progress ? ` · ${progress}` : ""}
          </p>
        </div>

        {loading ? (
          <div className="space-y-2 rounded-lg border border-inkai-red/30 bg-inkai-red/5 px-3 py-3">
            <div className="flex items-center gap-3">
              <InkaiLogoLoader size="sm" showDots={false} className="shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-foreground">
                    {progress || "Menyimpan…"}
                  </span>
                  <span className="tabular-nums font-semibold text-inkai-red">
                    {progressPercent}%
                  </span>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-inkai-red transition-[width] duration-200 ease-out"
                    style={{ width: `${Math.max(progressPercent, 2)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div
          className="min-h-0 flex-1 overflow-auto rounded-lg border"
          onPaste={handlePaste}
        >
          <table className="w-max min-w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th className="border-b px-1.5 py-2 font-medium">No</th>
                {COLUMNS.map((c) => (
                  <th
                    key={c}
                    className="border-b px-1.5 py-2 font-medium whitespace-nowrap"
                  >
                    {c === "Tempat & Tanggal Lahir"
                      ? "Tempat & Tgl Lahir"
                      : c === "Jenis Kelamin"
                        ? "JK"
                        : c}
                  </th>
                ))}
                <th className="border-b px-1 py-2 font-medium"> </th>
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
                  <td className="border-b px-1.5 py-1 tabular-nums text-muted-foreground">
                    {idx + 1}
                  </td>
                  <td className="border-b px-1 py-1">
                    <input
                      className={`${cellClass} w-[7rem]`}
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
                      className={`${cellClass} w-[14rem]`}
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
                      className={`${cellClass} w-[13rem]`}
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
                      className={`${cellClass} w-[3rem] text-center`}
                      value={row.gender}
                      placeholder="L/P"
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
                      className={`${cellClass} w-[16rem]`}
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
                      className={`${cellClass} w-[9rem]`}
                      value={row.currentRank}
                      placeholder={bulkRank || "boleh kosong"}
                      autoComplete="off"
                      onChange={(e) =>
                        updateRow(row.key, {
                          currentRank: e.target.value.replace(/\r?\n/g, " "),
                        })
                      }
                      onPaste={(e) => {
                        // Cegah \n dari Excel masuk ke value / memicu baris baru.
                        const raw = e.clipboardData.getData("text") || "";
                        const lines = raw
                          .replace(/\r\n/g, "\n")
                          .replace(/\r/g, "\n")
                          .split("\n")
                          .map((l) => l.trim())
                          .filter(Boolean);
                        if (raw.includes("\t") || lines.length > 1) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const pasted = (lines[0] || raw.trim()).replace(
                          /\r?\n/g,
                          " ",
                        );
                        const formatted =
                          formatRankLabel(pasted) || pasted;
                        updateRow(row.key, { currentRank: formatted });
                      }}
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        if (!raw) {
                          const fallback =
                            formatRankLabel(bulkRank) || bulkRank.trim();
                          if (fallback) {
                            updateRow(row.key, { currentRank: fallback });
                          }
                          return;
                        }
                        updateRow(row.key, {
                          currentRank: formatRankLabel(raw) || raw,
                        });
                      }}
                      disabled={loading}
                    />
                  </td>
                  <td className="border-b px-1 py-1">
                    {lockDojo && dojos.length === 1 ? (
                      <span className="block w-[11rem] truncate px-1.5 py-1.5 text-xs">
                        {dojos[0]?.name}
                      </span>
                    ) : (
                      <select
                        className={`${cellClass} w-[11rem]`}
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
            Tip: isi ranting &amp; Kyu/DAN dulu, lalu tempel Excel (Ctrl+V).
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
                ? progress || `Menyimpan… ${progressPercent}%`
                : `Simpan ${filledCount} anggota`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

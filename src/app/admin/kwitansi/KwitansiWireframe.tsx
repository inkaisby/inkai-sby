"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SignaturePadField } from "@/components/admin/SignaturePadField";
import { KwitansiPreview } from "@/components/admin/kwitansi/KwitansiPreview";
import {
  KwitansiPenerimaTable,
  type PenerimaRow,
} from "@/components/admin/kwitansi/KwitansiPenerimaTable";
import {
  NotaItemTable,
  type NotaItemRow,
} from "@/components/admin/kwitansi/NotaItemTable";
import { KwitansiMemberPicker } from "@/components/admin/kwitansi/KwitansiMemberPicker";
import { terbilangId } from "@/lib/terbilang";
import {
  downloadDaftarPenerimaPdf,
  downloadKwitansiPdf,
  downloadNotaPengeluaranPdf,
  printDaftarPenerima,
  printKwitansi,
  printNotaPengeluaran,
} from "@/lib/kwitansi-print-html";

export type KwitansiJenis =
  | "iuran"
  | "prestasi"
  | "pengeluaran"
  | "lainnya";

export type KwitansiMode = "a" | "b";

type Props = {
  scopeLabel: string;
  initialJenis?: KwitansiJenis;
  initialEventLabel?: string;
};

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function formatTanggalId(isoDate: string) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function nextKwNo() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const n = String(Math.floor(Math.random() * 900) + 100);
  return `KW/${y}/${m}/${n}`;
}

function nextNpNo() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const n = String(Math.floor(Math.random() * 900) + 100);
  return `NP/${y}/${m}/${n}`;
}

const JENIS_OPTIONS: Array<{ id: KwitansiJenis; label: string }> = [
  { id: "iuran", label: "Iuran/tagihan" },
  { id: "prestasi", label: "Prestasi/hadiah" },
  { id: "pengeluaran", label: "Pengeluaran event" },
  { id: "lainnya", label: "Lainnya" },
];

function roleColumnLabel(jenis: KwitansiJenis): string {
  return jenis === "prestasi" ? "Sebagai" : "Jabatan";
}

function defaultUntuk(jenis: KwitansiJenis): string {
  if (jenis === "iuran") return "Iuran anggota";
  if (jenis === "prestasi") return "Hadiah prestasi";
  if (jenis === "lainnya") return "";
  return "";
}

export function KwitansiWireframe({
  scopeLabel,
  initialJenis = "iuran",
  initialEventLabel = "",
}: Props) {
  const [jenis, setJenis] = useState<KwitansiJenis>(initialJenis);
  const [mode, setMode] = useState<KwitansiMode>("a");
  const [eventLabel, setEventLabel] = useState(initialEventLabel);

  const [no, setNo] = useState(nextKwNo);
  const [tanggal, setTanggal] = useState(todayInput);
  const [terimaDari, setTerimaDari] = useState("");
  const [penyetorName, setPenyetorName] = useState("");
  const [penyetorMemberId, setPenyetorMemberId] = useState<string | null>(null);
  const [penyetorSignUrl, setPenyetorSignUrl] = useState<string | null>(null);
  const [untukPembayaran, setUntukPembayaran] = useState(
    defaultUntuk(initialJenis),
  );
  const [penerima, setPenerima] = useState<PenerimaRow[]>([]);
  const [activePenerimaId, setActivePenerimaId] = useState<string | null>(null);

  const [noNota, setNoNota] = useState(nextNpNo);
  const [notaTanggal, setNotaTanggal] = useState(todayInput);
  const [pajakPersen, setPajakPersen] = useState(0);
  const [notaItems, setNotaItems] = useState<NotaItemRow[]>([]);
  const [bidangUjianName, setBidangUjianName] = useState("");
  const [bidangUjianMemberId, setBidangUjianMemberId] = useState<string | null>(
    null,
  );
  const [bidangUjianSignUrl, setBidangUjianSignUrl] = useState<string | null>(
    null,
  );
  const [bendaharaName, setBendaharaName] = useState("");
  const [bendaharaMemberId, setBendaharaMemberId] = useState<string | null>(
    null,
  );
  const [bendaharaSignUrl, setBendaharaSignUrl] = useState<string | null>(null);

  const isNota = jenis === "pengeluaran";
  const roleLabel = roleColumnLabel(jenis);

  const sumNominal = useMemo(
    () => penerima.reduce((s, r) => s + (Number(r.nominal) || 0), 0),
    [penerima],
  );

  const selectedRows = useMemo(
    () => penerima.filter((r) => r.selected),
    [penerima],
  );

  const activeRow = useMemo(() => {
    if (mode !== "b") return null;
    if (activePenerimaId) {
      return penerima.find((r) => r.id === activePenerimaId) ?? null;
    }
    return selectedRows[0] ?? null;
  }, [mode, activePenerimaId, penerima, selectedRows]);

  const jumlah =
    mode === "a" ? sumNominal : activeRow ? activeRow.nominal : 0;

  const previewTerimaDari =
    mode === "b" && activeRow
      ? activeRow.namaLengkap
      : terimaDari ||
        (mode === "a" && penerima.length > 1
          ? `Lihat Daftar Penerima (${penerima.length})`
          : penerima[0]?.namaLengkap || "");

  const previewPenerimaName =
    mode === "b" && activeRow
      ? activeRow.namaLengkap
      : mode === "a" && penerima.length > 1
        ? `Lihat Daftar Penerima (${penerima.length})`
        : penerima[0]?.namaLengkap || "";

  const previewPenerimaSign =
    mode === "b" && activeRow
      ? activeRow.signUrl
      : mode === "a" && penerima.length === 1
        ? penerima[0]?.signUrl
        : null;

  const changeJenis = (next: KwitansiJenis) => {
    if (next === jenis) return;
    const fromNota = jenis === "pengeluaran";
    const toNota = next === "pengeluaran";
    if (fromNota !== toNota) {
      const hasData =
        (fromNota && notaItems.length > 0) ||
        (!fromNota && penerima.length > 0);
      if (hasData) {
        const ok = window.confirm(
          "Mengganti jenis akan mengosongkan tabel (format berbeda). Lanjutkan?",
        );
        if (!ok) return;
      }
      if (toNota) {
        setPenerima([]);
        setNoNota(nextNpNo());
      } else {
        setNotaItems([]);
        setNo(nextKwNo());
      }
    }
    setJenis(next);
    if (next !== "pengeluaran") {
      setUntukPembayaran((prev) => prev || defaultUntuk(next));
    }
  };

  const resetBaru = () => {
    if (isNota) {
      setNoNota(nextNpNo());
      setNotaTanggal(todayInput());
      setPajakPersen(0);
      setBidangUjianSignUrl(null);
      setBendaharaSignUrl(null);
      toast.message("Nota baru — tabel item dipertahankan");
      return;
    }
    setNo(nextKwNo());
    setTanggal(todayInput());
    setTerimaDari("");
    setPenyetorSignUrl(null);
    setActivePenerimaId(null);
    toast.message("Kwitansi baru — daftar penerima dipertahankan");
  };

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  const buildKwData = (row?: PenerimaRow | null) => ({
    no,
    tanggal: formatTanggalId(tanggal),
    terimaDari:
      mode === "b" && row
        ? row.namaLengkap
        : previewTerimaDari,
    jumlah: mode === "b" && row ? row.nominal : jumlah,
    untukPembayaran:
      eventLabel && untukPembayaran
        ? `${untukPembayaran}${untukPembayaran.includes(eventLabel) ? "" : ` — ${eventLabel}`}`
        : untukPembayaran,
    penerimaName:
      mode === "b" && row
        ? row.namaLengkap
        : previewPenerimaName,
    penyetorName,
    penerimaSignUrl:
      mode === "b" && row ? row.signUrl : previewPenerimaSign,
    penyetorSignUrl,
    origin,
  });

  const validateKwitansiPrint = () => {
    if (mode === "a") {
      if (penerima.length === 0 || jumlah <= 0) {
        toast.error("Tambah penerima dengan nominal > 0 dulu");
        return false;
      }
      return true;
    }
    if (selectedRows.length === 0) {
      toast.error("Centang minimal satu penerima untuk batch");
      return false;
    }
    return true;
  };

  const onCetakKwitansi = () => {
    if (!validateKwitansiPrint()) return;
    try {
      if (mode === "a") {
        printKwitansi(buildKwData());
      } else {
        for (const row of selectedRows) {
          printKwitansi(buildKwData(row));
        }
      }
    } catch {
      toast.error("Popup cetak diblokir — izinkan pop-up untuk situs ini");
    }
  };

  const onPdfKwitansi = async () => {
    if (!validateKwitansiPrint()) return;
    try {
      if (mode === "a") {
        await downloadKwitansiPdf(buildKwData(), `kwitansi-${no}.pdf`);
      } else {
        for (const row of selectedRows) {
          await downloadKwitansiPdf(
            buildKwData(row),
            `kwitansi-${no}-${row.namaLengkap}.pdf`,
          );
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal unduh PDF");
    }
  };

  const daftarPrintData = () => ({
    title: "Daftar Penerima Kwitansi",
    subtitle: [JENIS_OPTIONS.find((j) => j.id === jenis)?.label, eventLabel]
      .filter(Boolean)
      .join(" · "),
    roleColumnLabel: roleLabel,
    rows: penerima.map((r, i) => ({
      no: i + 1,
      nama: r.namaLengkap,
      jabatan: r.jabatan,
      nominal: r.nominal,
      signUrl: r.signUrl,
    })),
    total: sumNominal,
    origin,
  });

  const onCetakDaftar = () => {
    if (mode === "b" && selectedRows.length === 0) {
      toast.error("Centang penerima yang ingin dicetak di daftar");
      return;
    }
    const data = daftarPrintData();
    if (mode === "b") {
      data.rows = selectedRows.map((r, i) => ({
        no: i + 1,
        nama: r.namaLengkap,
        jabatan: r.jabatan,
        nominal: r.nominal,
        signUrl: r.signUrl,
      }));
      data.total = selectedRows.reduce((s, r) => s + r.nominal, 0);
    }
    printDaftarPenerima(data);
  };

  const onPdfDaftar = async () => {
    if (mode === "b" && selectedRows.length === 0) {
      toast.error("Centang penerima yang ingin diunduh");
      return;
    }
    const data = daftarPrintData();
    if (mode === "b") {
      data.rows = selectedRows.map((r, i) => ({
        no: i + 1,
        nama: r.namaLengkap,
        jabatan: r.jabatan,
        nominal: r.nominal,
        signUrl: r.signUrl,
      }));
      data.total = selectedRows.reduce((s, r) => s + r.nominal, 0);
    }
    await downloadDaftarPenerimaPdf(data, `daftar-penerima-${no}.pdf`);
  };

  const fillFromSelected = () => {
    if (selectedRows.length === 0) {
      toast.error("Centang minimal satu penerima");
      return;
    }
    const first = selectedRows[0]!;
    setActivePenerimaId(first.id);
    setTerimaDari(first.namaLengkap);
    toast.success(
      selectedRows.length === 1
        ? `Pratinjau diisi dari ${first.namaLengkap}`
        : `Pratinjau aktif: ${first.namaLengkap} (${selectedRows.length} terpilih untuk cetak)`,
    );
  };

  const notaSubTotal = notaItems.reduce(
    (s, r) => s + (r.jumlah || 0) * (r.harga || 0),
    0,
  );
  const notaPajak = Math.round((notaSubTotal * pajakPersen) / 100);
  const notaGrand = notaSubTotal + notaPajak;

  const buildNotaData = () => ({
    noNota,
    tanggal: formatTanggalId(notaTanggal),
    items: notaItems.map((r, i) => ({
      no: i + 1,
      deskripsi: r.deskripsi,
      jumlah: r.jumlah,
      harga: r.harga,
      total: r.jumlah * r.harga,
      petugas: r.petugas,
    })),
    subTotal: notaSubTotal,
    pajakPersen,
    pajakAmount: notaPajak,
    grandTotal: notaGrand,
    bidangUjianName,
    bendaharaName,
    bidangUjianSignUrl,
    bendaharaSignUrl,
    origin,
  });

  const validateNota = () => {
    const ok = notaItems.some((r) => r.jumlah > 0 && r.harga > 0);
    if (!ok) {
      toast.error("Tambah minimal 1 item dengan Jumlah dan Harga > 0");
      return false;
    }
    return true;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{scopeLabel}</Badge>
          {!isNota ? (
            <div className="flex flex-wrap gap-1 rounded-md border p-1 text-xs">
              <button
                type="button"
                className={`rounded px-2 py-1 ${mode === "a" ? "bg-inkai-red text-white" : "hover:bg-muted"}`}
                onClick={() => setMode("a")}
              >
                Satu kwitansi + rincian
              </button>
              <button
                type="button"
                className={`rounded px-2 py-1 ${mode === "b" ? "bg-inkai-red text-white" : "hover:bg-muted"}`}
                onClick={() => setMode("b")}
              >
                Batch per penerima
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={resetBaru}>
            {isNota ? "Nota Baru" : "Kwitansi Baru"}
          </Button>
          <Button type="button" variant="outline" onClick={isNota ? () => {
            if (!validateNota()) return;
            printNotaPengeluaran(buildNotaData());
          } : onCetakKwitansi}>
            Cetak
          </Button>
          <Button
            type="button"
            className="bg-inkai-red hover:bg-inkai-red/90"
            onClick={() => {
              if (isNota) {
                if (!validateNota()) return;
                void downloadNotaPengeluaranPdf(
                  buildNotaData(),
                  `nota-${noNota}.pdf`,
                );
                return;
              }
              void onPdfKwitansi();
            }}
          >
            Unduh PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {JENIS_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`rounded-full border px-3 py-1 text-xs ${
              jenis === opt.id
                ? "border-inkai-red bg-inkai-red text-white"
                : "hover:bg-muted"
            }`}
            onClick={() => changeJenis(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        <Label>Event terkait (opsional)</Label>
        <Input
          value={eventLabel}
          onChange={(e) => setEventLabel(e.target.value)}
          placeholder="Cari / ketik nama event atau kegiatan…"
        />
      </div>

      {isNota ? (
        <>
          <div className="rounded-lg border p-3 text-sm text-muted-foreground">
            Riwayat (contoh — belum tersimpan). Simpan arsip nota = fase 2.
          </div>
          <NotaItemTable
            noNota={noNota}
            tanggal={notaTanggal}
            pajakPersen={pajakPersen}
            items={notaItems}
            bidangUjianName={bidangUjianName}
            bidangUjianMemberId={bidangUjianMemberId}
            bidangUjianSignUrl={bidangUjianSignUrl}
            bendaharaName={bendaharaName}
            bendaharaMemberId={bendaharaMemberId}
            bendaharaSignUrl={bendaharaSignUrl}
            onNoNotaChange={setNoNota}
            onTanggalChange={setNotaTanggal}
            onPajakPersenChange={setPajakPersen}
            onItemsChange={setNotaItems}
            onBidangUjianName={setBidangUjianName}
            onBidangUjianMemberId={setBidangUjianMemberId}
            onBidangUjianSignUrl={setBidangUjianSignUrl}
            onBendaharaName={setBendaharaName}
            onBendaharaMemberId={setBendaharaMemberId}
            onBendaharaSignUrl={setBendaharaSignUrl}
            onPrint={() => {
              if (!validateNota()) return;
              printNotaPengeluaran(buildNotaData());
            }}
            onPdf={() => {
              if (!validateNota()) return;
              void downloadNotaPengeluaranPdf(
                buildNotaData(),
                `nota-${noNota}.pdf`,
              );
            }}
          />
        </>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Data Kwitansi</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>No.</Label>
                  <Input value={no} onChange={(e) => setNo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Tanggal</Label>
                  <Input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Terima dari</Label>
                <Input
                  value={terimaDari}
                  onChange={(e) => setTerimaDari(e.target.value)}
                  placeholder={
                    mode === "a"
                      ? "Opsional — atau lihat rincian penerima"
                      : "Terisi dari baris terpilih"
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Jumlah (otomatis)</Label>
                <Input
                  readOnly
                  value={jumlah > 0 ? terbilangId(jumlah, false) : "—"}
                />
                <p className="text-xs text-muted-foreground">
                  {jumlah > 0
                    ? `${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(jumlah)} · ${mode === "a" ? "TOTAL semua baris" : "Nominal baris aktif"}`
                    : "Isi daftar penerima dulu"}
                </p>
              </div>
              <div className="space-y-1">
                <Label>Untuk pembayaran</Label>
                <Input
                  value={untukPembayaran}
                  onChange={(e) => setUntukPembayaran(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Penyetor</Label>
                <KwitansiMemberPicker
                  value={penyetorName}
                  onChange={(v) => {
                    setPenyetorName(v);
                    setPenyetorMemberId(null);
                  }}
                  onPick={(item) => {
                    setPenyetorName(item.fullName);
                    setPenyetorMemberId(item.id);
                    if (item.signatureUrl) setPenyetorSignUrl(item.signatureUrl);
                  }}
                  placeholder="Cari penyetor / bendahara…"
                />
                <SignaturePadField
                  label="Penyetor"
                  valueUrl={penyetorSignUrl}
                  memberId={penyetorMemberId}
                  onChange={setPenyetorSignUrl}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Pratinjau</h3>
              <KwitansiPreview
                data={{
                  no,
                  tanggal: formatTanggalId(tanggal),
                  terimaDari: previewTerimaDari,
                  jumlah,
                  untukPembayaran,
                  penerimaName: previewPenerimaName,
                  penyetorName,
                  penerimaSignUrl: previewPenerimaSign,
                  penyetorSignUrl,
                  penerimaLabel:
                    mode === "a" && penerima.length > 1
                      ? "Lihat rincian"
                      : "Penerima",
                }}
              />
            </div>
          </div>

          <div className="rounded-lg border p-3 text-sm text-muted-foreground">
            Riwayat kwitansi (contoh — belum tersimpan). Arsip server = fase 2.
          </div>

          <KwitansiPenerimaTable
            rows={penerima}
            roleColumnLabel={roleLabel}
            onChange={(rows) => {
              setPenerima(rows);
              if (mode === "b") {
                const still = rows.find((r) => r.id === activePenerimaId);
                if (!still) setActivePenerimaId(rows.find((r) => r.selected)?.id ?? null);
              }
            }}
            onPrint={onCetakDaftar}
            onPdf={() => void onPdfDaftar()}
            showBatchActions={mode === "b"}
            onFillFromSelected={fillFromSelected}
          />
        </>
      )}
    </div>
  );
}

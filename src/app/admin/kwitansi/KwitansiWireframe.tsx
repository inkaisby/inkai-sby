"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { parseToYmd } from "@/lib/kas";
import { ArrowDownLeft, ArrowUpRight, Ban, Landmark } from "lucide-react";
import {
  downloadDaftarPenerimaPdf,
  downloadKwitansiBatchPdf,
  downloadKwitansiPdf,
  downloadNotaPengeluaranPdf,
  printDaftarPenerima,
  printKwitansi,
  printKwitansiBatch,
  printNotaPengeluaran,
} from "@/lib/kwitansi-print-html";

export type KwitansiJenis =
  | "iuran"
  | "prestasi"
  | "pengeluaran"
  | "lainnya";

export type KwitansiMode = "a" | "b";
export type KasSyncMode = "in" | "out" | "none";

type Props = {
  scopeLabel: string;
  initialJenis?: KwitansiJenis;
  initialEventLabel?: string;
  initialNo?: string;
};

const DRAFT_KEY = "kwitansi-draft-v1";
const KW_SEQ_KEY = "kwitansi-kw-seq";
const NP_SEQ_KEY = "kwitansi-np-seq";
const DRAFT_MAX_CHARS = 1_800_000;

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

function ymPrefix() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return { y, m, key: `${y}-${m}` };
}

function nextLocalSeq(storageKey: string): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as { key?: string; n?: number }) : null;
    const { key } = ymPrefix();
    if (parsed?.key === key && typeof parsed.n === "number") {
      const n = parsed.n + 1;
      localStorage.setItem(storageKey, JSON.stringify({ key, n }));
      return n;
    }
    localStorage.setItem(storageKey, JSON.stringify({ key, n: 1 }));
    return 1;
  } catch {
    return Math.floor(Math.random() * 90) + 10;
  }
}

function nextKwNo() {
  const { y, m } = ymPrefix();
  const n = String(nextLocalSeq(KW_SEQ_KEY)).padStart(4, "0");
  return `KW/${y}/${m}/${n}`;
}

function nextNpNo() {
  const { y, m } = ymPrefix();
  const n = String(nextLocalSeq(NP_SEQ_KEY)).padStart(4, "0");
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
  return "";
}

type DraftShape = {
  jenis: KwitansiJenis;
  mode: KwitansiMode;
  kasSyncMode?: KasSyncMode;
  eventLabel: string;
  periodeNama: string;
  no: string;
  tanggal: string;
  terimaDari: string;
  penyetorName: string;
  penyetorMemberId: string | null;
  penyetorSignUrl: string | null;
  untukPembayaran: string;
  penerima: PenerimaRow[];
  activePenerimaId: string | null;
  noNota: string;
  notaTanggal: string;
  pajakPersen: number;
  notaItems: NotaItemRow[];
  bidangUjianName: string;
  bidangUjianMemberId: string | null;
  bidangUjianSignUrl: string | null;
  bendaharaName: string;
  bendaharaMemberId: string | null;
  bendaharaSignUrl: string | null;
};

function readDraft(): DraftShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY) || sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftShape;
  } catch {
    return null;
  }
}

export function KwitansiWireframe({
  scopeLabel,
  initialJenis = "iuran",
  initialEventLabel = "",
  initialNo = "",
}: Props) {
  const hydrated = useRef(false);

  const [jenis, setJenis] = useState<KwitansiJenis>(initialJenis);
  const [mode, setMode] = useState<KwitansiMode>("a");
  const [eventLabel, setEventLabel] = useState(initialEventLabel);
  const [periodeNama, setPeriodeNama] = useState("");

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

  const [kasSyncMode, setKasSyncMode] = useState<KasSyncMode>(
    initialJenis === "pengeluaran" ? "out" : "in",
  );

  const isNota = jenis === "pengeluaran";
  const roleLabel = roleColumnLabel(jenis);

  useEffect(() => {
    let loadedFromArsip = false;
    if (initialNo) {
      try {
        const savedRaw = localStorage.getItem("inkai_kwitansi_arsip_list");
        if (savedRaw) {
          const archiveList = JSON.parse(savedRaw);
          if (Array.isArray(archiveList)) {
            const found = archiveList.find(
              (item: { no?: string }) => item.no === initialNo,
            );
            if (found) {
              const isNp = found.no.startsWith("NP");
              if (isNp) {
                setJenis("pengeluaran");
                setNoNota(found.no);
              } else {
                setNo(found.no);
                if (found.jenis?.toLowerCase().includes("prestasi")) {
                  setJenis("prestasi");
                } else if (found.jenis?.toLowerCase().includes("lainnya")) {
                  setJenis("lainnya");
                } else {
                  setJenis("iuran");
                }
              }
              setPeriodeNama(found.periodeNama || "");
              setTerimaDari(found.terimaDari || "");
              setPenyetorName(found.penyetorName || "");
              setUntukPembayaran(found.untukPembayaran || "");
              const draftData = readDraft();
              if (Array.isArray(found.penerima) && found.penerima.length > 0) {
                setPenerima(found.penerima);
              } else if (
                draftData &&
                Array.isArray(draftData.penerima) &&
                draftData.penerima.length > 0 &&
                (draftData.no === initialNo ||
                  !found.penerimaName ||
                  found.penerimaName.startsWith("Lihat Daftar Penerima"))
              ) {
                setPenerima(draftData.penerima);
              } else if (
                found.penerimaName &&
                !isNp &&
                !found.penerimaName.startsWith("Lihat Daftar Penerima")
              ) {
                setPenerima([
                  {
                    id: `p-${Date.now()}`,
                    namaLengkap: found.penerimaName,
                    jabatan: "Penerima",
                    nominal: Number(found.total) || 0,
                    signUrl: found.penerimaSignUrl || null,
                    selected: true,
                  },
                ]);
              } else {
                setPenerima([]);
              }
              if (Array.isArray(found.notaItems) && found.notaItems.length > 0) {
                setNotaItems(found.notaItems);
              }
              if (typeof found.pajakPersen === "number") setPajakPersen(found.pajakPersen);
              if (found.bidangUjianName) setBidangUjianName(found.bidangUjianName);
              if (found.bendaharaName) setBendaharaName(found.bendaharaName);
              if (found.bidangUjianSignUrl) setBidangUjianSignUrl(found.bidangUjianSignUrl);
              if (found.bendaharaSignUrl) setBendaharaSignUrl(found.bendaharaSignUrl);
              if (found.penyetorSignUrl) setPenyetorSignUrl(found.penyetorSignUrl);
              if (found.kasSyncMode) {
                setKasSyncMode(found.kasSyncMode);
              } else {
                setKasSyncMode(isNp ? "out" : "in");
              }
              toast.info(`Memuat kwitansi ${found.no} dari Arsip`);
              loadedFromArsip = true;
            }
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (!loadedFromArsip) {
      const d = readDraft();
      if (d) {
        setJenis(d.jenis);
        setMode(d.mode);
        setKasSyncMode(
          d.kasSyncMode ?? (d.jenis === "pengeluaran" ? "out" : "in"),
        );
        setEventLabel(d.eventLabel || initialEventLabel);
        setPeriodeNama(d.periodeNama ?? "");
        setNo(d.no);
        setTanggal(d.tanggal);
        setTerimaDari(d.terimaDari);
        setPenyetorName(d.penyetorName);
        setPenyetorMemberId(d.penyetorMemberId);
        setPenyetorSignUrl(d.penyetorSignUrl);
        setUntukPembayaran(d.untukPembayaran);
        setPenerima(d.penerima ?? []);
        setActivePenerimaId(d.activePenerimaId);
        setNoNota(d.noNota);
        setNotaTanggal(d.notaTanggal);
        setPajakPersen(d.pajakPersen ?? 0);
        setNotaItems(d.notaItems ?? []);
        setBidangUjianName(d.bidangUjianName);
        setBidangUjianMemberId(d.bidangUjianMemberId);
        setBidangUjianSignUrl(d.bidangUjianSignUrl);
        setBendaharaName(d.bendaharaName);
        setBendaharaMemberId(d.bendaharaMemberId);
        setBendaharaSignUrl(d.bendaharaSignUrl);
      }
    }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate sekali saat mount
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => {
      const payload: DraftShape = {
        jenis,
        mode,
        kasSyncMode,
        eventLabel,
        periodeNama,
        no,
        tanggal,
        terimaDari,
        penyetorName,
        penyetorMemberId,
        penyetorSignUrl,
        untukPembayaran,
        penerima,
        activePenerimaId,
        noNota,
        notaTanggal,
        pajakPersen,
        notaItems,
        bidangUjianName,
        bidangUjianMemberId,
        bidangUjianSignUrl,
        bendaharaName,
        bendaharaMemberId,
        bendaharaSignUrl,
      };
      try {
        const raw = JSON.stringify(payload);
        if (raw.length > DRAFT_MAX_CHARS) return;
        localStorage.setItem(DRAFT_KEY, raw);
        sessionStorage.setItem(DRAFT_KEY, raw);
      } catch {
        /* quota / private mode */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [
    jenis,
    mode,
    kasSyncMode,
    eventLabel,
    periodeNama,
    no,
    tanggal,
    terimaDari,
    penyetorName,
    penyetorMemberId,
    penyetorSignUrl,
    untukPembayaran,
    penerima,
    activePenerimaId,
    noNota,
    notaTanggal,
    pajakPersen,
    notaItems,
    bidangUjianName,
    bidangUjianMemberId,
    bidangUjianSignUrl,
    bendaharaName,
    bendaharaMemberId,
    bendaharaSignUrl,
  ]);

  const handleSelectJenis = (next: KwitansiJenis) => {
    if (next === jenis) return;
    setJenis(next);
    setKasSyncMode(next === "pengeluaran" ? "out" : "in");
    if (next !== "pengeluaran") {
      setUntukPembayaran((prev) => prev || defaultUntuk(next));
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setJenis(initialJenis);
    setKasSyncMode(initialJenis === "pengeluaran" ? "out" : "in");
    setMode("a");
    setEventLabel(initialEventLabel);
    setPeriodeNama("");
    setNo(nextKwNo());
    setTanggal(todayInput());
    setTerimaDari("");
    setPenyetorName("");
    setPenyetorMemberId(null);
    setPenyetorSignUrl(null);
    setUntukPembayaran(defaultUntuk(initialJenis));
    setPenerima([]);
    setActivePenerimaId(null);
    setNoNota(nextNpNo());
    setNotaTanggal(todayInput());
    setPajakPersen(0);
    setNotaItems([]);
    setBidangUjianName("");
    setBidangUjianMemberId(null);
    setBidangUjianSignUrl(null);
    setBendaharaName("");
    setBendaharaMemberId(null);
    setBendaharaSignUrl(null);
    toast.message("Draft dibersihkan");
  };

  const sumNominal = useMemo(
    () => penerima.reduce((s, r) => s + (Number(r.nominal) || 0), 0),
    [penerima],
  );

  const selectedRows = useMemo(
    () => penerima.filter((r) => r.selected),
    [penerima],
  );

  const effectiveRowsA = useMemo(
    () =>
      mode === "a"
        ? selectedRows.length > 0
          ? selectedRows
          : penerima
        : penerima,
    [mode, selectedRows, penerima],
  );

  const effJumlahA = useMemo(
    () => effectiveRowsA.reduce((s, r) => s + (Number(r.nominal) || 0), 0),
    [effectiveRowsA],
  );

  const activeRow = useMemo(() => {
    if (mode !== "b") return null;
    if (activePenerimaId) {
      return penerima.find((r) => r.id === activePenerimaId) ?? null;
    }
    return selectedRows[0] ?? null;
  }, [mode, activePenerimaId, penerima, selectedRows]);

  const jumlah =
    mode === "a" ? effJumlahA : activeRow ? activeRow.nominal : 0;

  const hasSelectionA = mode === "a" && selectedRows.length > 0;

  const previewTerimaDari =
    mode === "b" && activeRow
      ? activeRow.namaLengkap
      : terimaDari ||
        (mode === "a" && effectiveRowsA.length > 1
          ? `Lihat Daftar Penerima (${effectiveRowsA.length})`
          : effectiveRowsA[0]?.namaLengkap || "");

  const previewPenerimaName =
    mode === "b" && activeRow
      ? activeRow.namaLengkap
      : mode === "a" && effectiveRowsA.length > 1
        ? `Lihat Daftar Penerima (${effectiveRowsA.length})`
        : effectiveRowsA[0]?.namaLengkap || "";

  const previewPenerimaSign =
    mode === "b" && activeRow
      ? activeRow.signUrl
      : mode === "a" && effectiveRowsA.length === 1
        ? effectiveRowsA[0]?.signUrl
        : null;


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

  const untukWithEvent = (() => {
    let base = untukPembayaran;
    if (!base.trim() && periodeNama.trim()) base = periodeNama.trim();
    if (eventLabel && base) {
      return base.includes(eventLabel) ? base : `${base} — ${eventLabel}`;
    }
    return base;
  })();

  const buildKwData = (row?: PenerimaRow | null) => ({
    no,
    tanggal: formatTanggalId(tanggal),
    terimaDari:
      mode === "b" && row ? row.namaLengkap : previewTerimaDari,
    jumlah: mode === "b" && row ? row.nominal : jumlah,
    untukPembayaran: untukWithEvent,
    penerimaName:
      mode === "b" && row ? row.namaLengkap : previewPenerimaName,
    penyetorName,
    penerimaSignUrl:
      mode === "b" && row ? row.signUrl : previewPenerimaSign,
    penyetorSignUrl,
    origin,
    draft: false,
  });

  const validateKwitansiPrint = () => {
    if (mode === "a") {
      if (effectiveRowsA.length === 0 || effJumlahA <= 0) {
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
        printKwitansiBatch(selectedRows.map((row) => buildKwData(row)));
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
        await downloadKwitansiBatchPdf(
          selectedRows.map((row) => buildKwData(row)),
          `kwitansi-batch-${no}.pdf`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal unduh PDF");
    }
  };

  const daftarRowsSource =
    mode === "a"
      ? effectiveRowsA
      : selectedRows.length > 0
        ? selectedRows
        : penerima;

  const daftarPrintData = () => ({
    title: "Daftar Penerima Kwitansi",
    subtitle: [
      JENIS_OPTIONS.find((j) => j.id === jenis)?.label,
      periodeNama.trim() || null,
      eventLabel || null,
    ]
      .filter(Boolean)
      .join(" · "),
    roleColumnLabel: roleLabel,
    rows: daftarRowsSource.map((r, i) => ({
      no: i + 1,
      nama: r.namaLengkap,
      jabatan: r.jabatan,
      nominal: r.nominal,
      signUrl: r.signUrl,
    })),
    total: daftarRowsSource.reduce((s, r) => s + (Number(r.nominal) || 0), 0),
    origin,
    draft: false,
  });

  const onCetakDaftar = () => {
    if (mode === "b" && selectedRows.length === 0) {
      toast.error("Centang penerima yang ingin dicetak di daftar");
      return;
    }
    printDaftarPenerima(daftarPrintData());
  };

  const onPdfDaftar = async () => {
    if (mode === "b" && selectedRows.length === 0) {
      toast.error("Centang penerima yang ingin diunduh");
      return;
    }
    await downloadDaftarPenerimaPdf(
      daftarPrintData(),
      `daftar-penerima-${no}.pdf`,
    );
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

  const onPenerimaChange = (rows: PenerimaRow[]) => {
    setPenerima(rows);
    if (activePenerimaId && !rows.some((r) => r.id === activePenerimaId)) {
      setActivePenerimaId(rows.find((r) => r.selected)?.id ?? null);
    }
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
    draft: false,
  });

  const validateNota = () => {
    const ok = notaItems.some((r) => r.jumlah > 0 && r.harga > 0);
    if (!ok) {
      toast.error("Tambah minimal 1 item dengan Jumlah dan Harga > 0");
      return false;
    }
    return true;
  };

  const handleSimpanArsip = async () => {
    try {
      const STORAGE_KEY = "inkai_kwitansi_arsip_list";
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      const existing = savedRaw ? JSON.parse(savedRaw) : [];
      const targetNo = isNota ? noNota : no;

      const existingIndex = Array.isArray(existing)
        ? existing.findIndex((item: { no: string }) => item.no === targetNo)
        : -1;

      let entryId: string;
      let updatedList: typeof existing;
      let isUpdate = false;

      if (existingIndex >= 0) {
        isUpdate = true;
        entryId = existing[existingIndex].id || `kw-${Date.now()}`;
        const updatedEntry = {
          ...existing[existingIndex],
          id: entryId,
          no: targetNo,
          periodeNama: periodeNama.trim() || (isNota ? "Nota Pengeluaran" : "Kwitansi Pembayaran"),
          jenis: JENIS_OPTIONS.find((j) => j.id === jenis)?.label || "Iuran/tagihan",
          kasSyncMode,
          tanggal: formatTanggalId(isNota ? notaTanggal : tanggal),
          terimaDari: previewTerimaDari,
          total: isNota ? notaGrand : jumlah,
          scope: scopeLabel,
          untukPembayaran: untukWithEvent,
          penerimaName: previewPenerimaName,
          penyetorName: penyetorName,
          penerimaSignUrl: previewPenerimaSign,
          penyetorSignUrl,
          notaItems: isNota ? notaItems : undefined,
          penerima: !isNota ? penerima : undefined,
          pajakPersen: isNota ? pajakPersen : undefined,
          bidangUjianName: isNota ? bidangUjianName : undefined,
          bendaharaName: isNota ? bendaharaName : undefined,
          bidangUjianSignUrl: isNota ? bidangUjianSignUrl : undefined,
          bendaharaSignUrl: isNota ? bendaharaSignUrl : undefined,
          updatedAt: new Date().toISOString(),
        };
        existing[existingIndex] = updatedEntry;
        updatedList = [...existing];
      } else {
        entryId = `kw-${Date.now()}`;
        const newEntry = {
          id: entryId,
          no: targetNo,
          periodeNama: periodeNama.trim() || (isNota ? "Nota Pengeluaran" : "Kwitansi Pembayaran"),
          jenis: JENIS_OPTIONS.find((j) => j.id === jenis)?.label || "Iuran/tagihan",
          kasSyncMode,
          tanggal: formatTanggalId(isNota ? notaTanggal : tanggal),
          terimaDari: previewTerimaDari,
          total: isNota ? notaGrand : jumlah,
          scope: scopeLabel,
          untukPembayaran: untukWithEvent,
          penerimaName: previewPenerimaName,
          penyetorName: penyetorName,
          penerimaSignUrl: previewPenerimaSign,
          penyetorSignUrl,
          notaItems: isNota ? notaItems : undefined,
          penerima: !isNota ? penerima : undefined,
          pajakPersen: isNota ? pajakPersen : undefined,
          bidangUjianName: isNota ? bidangUjianName : undefined,
          bendaharaName: isNota ? bendaharaName : undefined,
          bidangUjianSignUrl: isNota ? bidangUjianSignUrl : undefined,
          bendaharaSignUrl: isNota ? bendaharaSignUrl : undefined,
          createdAt: new Date().toISOString(),
        };
        updatedList = [newEntry, ...existing];
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));

      if (kasSyncMode !== "none") {
        const nominal = Math.round(isNota ? notaGrand : jumlah);
        if (nominal > 0) {
          const kasRes = await fetch("/api/admin/kas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceType: "kwitansi",
              sourceId: targetNo || entryId,
              entries: [
                {
                  txnDate: parseToYmd(isNota ? notaTanggal : tanggal),
                  description: `${targetNo} — ${untukWithEvent || periodeNama || "Kwitansi"}`,
                  kegiatan: periodeNama,
                  direction: kasSyncMode,
                  amount: nominal,
                },
              ],
            }),
          });
          if (!kasRes.ok) {
            const err = await kasRes.json().catch(() => ({}));
            toast.error(
              typeof err.error === "string"
                ? `Arsip tersimpan, kas: ${err.error}`
                : "Arsip tersimpan, jurnal kas gagal",
            );
          }
        }
      } else {
        await fetch(
          `/api/admin/kas?sourceType=kwitansi&sourceId=${encodeURIComponent(entryId)}`,
          { method: "DELETE" },
        ).catch(() => {});
      }
      toast.success(
        isUpdate
          ? `Kwitansi ${targetNo} berhasil diperbarui di Arsip!`
          : `Kwitansi ${targetNo} berhasil disimpan ke Arsip!`,
      );
    } catch {
      toast.error("Gagal menyimpan ke arsip");
    }
  };

  // Silent auto-save to archive when table or fields change (debounced 800ms)
  useEffect(() => {
    if (!hydrated.current) return;
    const targetNo = isNota ? noNota : no;
    if (!targetNo) return;
    const t = setTimeout(() => {
      try {
        const STORAGE_KEY = "inkai_kwitansi_arsip_list";
        const savedRaw = localStorage.getItem(STORAGE_KEY);
        const existing = savedRaw ? JSON.parse(savedRaw) : [];
        if (!Array.isArray(existing)) return;
        const existingIndex = existing.findIndex(
          (item: { no: string }) => item.no === targetNo,
        );
        if (existingIndex >= 0) {
          const entryId = existing[existingIndex].id || `kw-${Date.now()}`;
          const updatedEntry = {
            ...existing[existingIndex],
            id: entryId,
            no: targetNo,
            periodeNama:
              periodeNama.trim() ||
              (isNota ? "Nota Pengeluaran" : "Kwitansi Pembayaran"),
            jenis:
              JENIS_OPTIONS.find((j) => j.id === jenis)?.label ||
              "Iuran/tagihan",
            tanggal: formatTanggalId(isNota ? notaTanggal : tanggal),
            terimaDari: previewTerimaDari,
            total: isNota ? notaGrand : jumlah,
            scope: scopeLabel,
            untukPembayaran: untukWithEvent,
            penerimaName: previewPenerimaName,
            penyetorName: penyetorName,
            penerimaSignUrl: previewPenerimaSign,
            penyetorSignUrl,
            notaItems: isNota ? notaItems : undefined,
            penerima: !isNota ? penerima : undefined,
            pajakPersen: isNota ? pajakPersen : undefined,
            bidangUjianName: isNota ? bidangUjianName : undefined,
            bendaharaName: isNota ? bendaharaName : undefined,
            bidangUjianSignUrl: isNota ? bidangUjianSignUrl : undefined,
            bendaharaSignUrl: isNota ? bendaharaSignUrl : undefined,
            updatedAt: new Date().toISOString(),
          };
          existing[existingIndex] = updatedEntry;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
        }
      } catch {
        /* silent auto-save error ignore */
      }
    }, 800);
    return () => clearTimeout(t);
  }, [
    isNota,
    noNota,
    no,
    periodeNama,
    jenis,
    notaTanggal,
    tanggal,
    previewTerimaDari,
    notaGrand,
    jumlah,
    scopeLabel,
    untukWithEvent,
    previewPenerimaName,
    penyetorName,
    previewPenerimaSign,
    penyetorSignUrl,
    notaItems,
    penerima,
    pajakPersen,
    bidangUjianName,
    bendaharaName,
    bidangUjianSignUrl,
    bendaharaSignUrl,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{scopeLabel}</Badge>
          {!isNota ? (
            <div className="flex flex-wrap gap-1 rounded-md border p-1 text-xs">
              <button
                type="button"
                className={`rounded px-2.5 py-1 ${mode === "b" ? "bg-inkai-red text-white font-medium" : "hover:bg-muted"}`}
                onClick={() => setMode("b")}
                title="Cetak kwitansi terpisah untuk tiap penerima (Multi-halaman)"
              >
                Per Penerima (Multi-halaman)
              </button>
              <button
                type="button"
                className={`rounded px-2.5 py-1 ${mode === "a" ? "bg-inkai-red text-white font-medium" : "hover:bg-muted"}`}
                onClick={() => setMode("a")}
                title="Satu kwitansi rangkuman untuk semua penerima"
              >
                Rangkuman 1 Lembar
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={clearDraft}>
            Bersihkan draft
          </Button>
          <Button type="button" variant="outline" onClick={resetBaru}>
            {isNota ? "Nota Baru" : "Kwitansi Baru"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={
              isNota
                ? () => {
                    if (!validateNota()) return;
                    printNotaPengeluaran(buildNotaData());
                  }
                : onCetakKwitansi
            }
          >
            Cetak
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSimpanArsip}
            className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
          >
            Simpan ke Arsip
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
            onClick={() => handleSelectJenis(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Periode / Nama kwitansi</Label>
          <Input
            value={periodeNama}
            onChange={(e) => setPeriodeNama(e.target.value)}
            placeholder="Iuran Maret 2026 / Walikota Cup 2026"
          />
        </div>
        <div className="space-y-1">
          <Label>Event terkait (opsional)</Label>
          <Input
            value={eventLabel}
            onChange={(e) => setEventLabel(e.target.value)}
            placeholder="Cari / ketik nama event atau kegiatan…"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Landmark className="h-4 w-4 text-primary" />
              <span>Singkronisasi Jurnal Kas Admin (/admin/kas)</span>
            </Label>
            <span className="text-[11px] text-muted-foreground">
              Pilih perlakuan kas saat disimpan ke arsip
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg border p-1.5 bg-muted/20">
            <button
              type="button"
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                kasSyncMode === "in"
                  ? "bg-emerald-600 text-white shadow-sm font-semibold ring-2 ring-emerald-600/30"
                  : "bg-background hover:bg-muted text-muted-foreground border"
              }`}
              onClick={() => setKasSyncMode("in")}
            >
              <ArrowDownLeft className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>Kas Masuk (+ Masuk Kas)</span>
            </button>

            <button
              type="button"
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                kasSyncMode === "out"
                  ? "bg-rose-600 text-white shadow-sm font-semibold ring-2 ring-rose-600/30"
                  : "bg-background hover:bg-muted text-muted-foreground border"
              }`}
              onClick={() => setKasSyncMode("out")}
            >
              <ArrowUpRight className="h-4 w-4 shrink-0 text-rose-400" />
              <span>Kas Keluar (- Keluar Kas)</span>
            </button>

            <button
              type="button"
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                kasSyncMode === "none"
                  ? "bg-slate-700 text-white shadow-sm font-semibold ring-2 ring-slate-700/30"
                  : "bg-background hover:bg-muted text-muted-foreground border"
              }`}
              onClick={() => setKasSyncMode("none")}
            >
              <Ban className="h-4 w-4 shrink-0 text-slate-300" />
              <span>Tidak Catat di Kas</span>
            </button>
          </div>
        </div>
      </div>

      {isNota ? (
        <>
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
            onSaveArsip={handleSimpanArsip}
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
                  <div className="flex gap-2">
                    <Input value={no} onChange={(e) => setNo(e.target.value)} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setNo(nextKwNo())}
                    >
                      Regen
                    </Button>
                  </div>
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
                    ? `${new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      }).format(jumlah)} · ${
                        mode === "a"
                          ? hasSelectionA
                            ? "Total terpilih"
                            : "TOTAL semua baris"
                          : "Nominal baris aktif"
                      }`
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
                  placeholder="Cari nama anggota (≥2 huruf)…"
                />
                <p className="text-[11px] text-muted-foreground">
                  Ketik ≥2 huruf untuk cari anggota, atau nama bebas.
                </p>
                <SignaturePadField
                  label="Penyetor"
                  valueUrl={penyetorSignUrl}
                  memberId={penyetorMemberId}
                  onChange={setPenyetorSignUrl}
                  previewSize="md"
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
                  untukPembayaran: untukWithEvent,
                  penerimaName: previewPenerimaName,
                  penyetorName,
                  penerimaSignUrl: previewPenerimaSign,
                  penyetorSignUrl,
                  penerimaLabel:
                    mode === "a" && effectiveRowsA.length > 1
                      ? "Lihat rincian"
                      : "Penerima",
                }}
              />
            </div>
          </div>

          <KwitansiPenerimaTable
            rows={penerima}
            roleColumnLabel={roleLabel}
            onChange={onPenerimaChange}
            onPrint={onCetakDaftar}
            onPdf={() => void onPdfDaftar()}
            onSaveArsip={handleSimpanArsip}
            showBatchActions={mode === "b"}
            onFillFromSelected={fillFromSelected}
            showSelectedTotal={mode === "a"}
          />
        </>
      )}
    </div>
  );
}

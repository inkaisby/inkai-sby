"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRp } from "@/lib/terbilang";
import { printKwitansi, printNotaPengeluaran } from "@/lib/kwitansi-print-html";
import { InkaiConfirmDialog } from "@/components/ui/InkaiConfirmDialog";
import { Printer, Pencil, Trash2, Download, Search, Plus } from "lucide-react";
import { toast } from "sonner";

export type KwitansiArsipItem = {
  id: string;
  no: string;
  periodeNama: string;
  jenis: string;
  tanggal: string;
  terimaDari?: string;
  total: number;
  scope: string;
  untukPembayaran?: string;
  penerimaName?: string;
  penyetorName?: string;
  penerimaSignUrl?: string | null;
  penyetorSignUrl?: string | null;
  createdAt?: string;
};

const INITIAL_DUMMY_ARSIP: KwitansiArsipItem[] = [
  {
    id: "kw-001",
    no: "KW/2026/08/0001",
    periodeNama: "Iuran Agustus 2026",
    jenis: "Iuran/tagihan",
    tanggal: "10 Agustus 2026",
    terimaDari: "MOHAMMAD IQBAL",
    total: 1_500_000,
    scope: "Ranting Contoh",
    untukPembayaran: "Iuran Anggota Bulan Agustus 2026",
    penerimaName: "MOHAMMAD IQBAL",
    penyetorName: "Habibur Rahman",
  },
  {
    id: "kw-002",
    no: "KW/2026/08/0002",
    periodeNama: "Walikota Cup 2026",
    jenis: "Prestasi/hadiah",
    tanggal: "12 Agustus 2026",
    terimaDari: "Tim Kumite Cabang",
    total: 3_000_000,
    scope: "Cabang Surabaya",
    untukPembayaran: "Bonus Prestasi Kejuaraan Walikota Cup",
    penerimaName: "MOHAMMAD IQBAL",
    penyetorName: "Bendahara Cabang",
  },
  {
    id: "np-001",
    no: "NP/2026/08/0001",
    periodeNama: "Konsumsi panitia",
    jenis: "Pengeluaran event",
    tanggal: "14 Agustus 2026",
    terimaDari: "Konsumsi Panitia Latber",
    total: 750_000,
    scope: "Cabang Surabaya",
    untukPembayaran: "Pembelian Konsumsi Panitia Latber",
    penerimaName: "Seksi Konsumsi",
    penyetorName: "Bendahara Cabang",
  },
];

const STORAGE_KEY = "inkai_kwitansi_arsip_list";

export function KwitansiArsipTable() {
  const router = useRouter();
  const [items, setItems] = useState<KwitansiArsipItem[]>(INITIAL_DUMMY_ARSIP);
  const [search, setSearch] = useState("");
  const [filterJenis, setFilterJenis] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<KwitansiArsipItem | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as KwitansiArsipItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed);
        }
      }
    } catch {
      // Ignore parse error
    }
  }, []);

  // Save to localStorage when items change
  const updateItems = (newItems: KwitansiArsipItem[]) => {
    setItems(newItems);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
    } catch {
      // Ignore storage error
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        !search.trim() ||
        item.no.toLowerCase().includes(search.toLowerCase()) ||
        item.periodeNama.toLowerCase().includes(search.toLowerCase()) ||
        (item.terimaDari && item.terimaDari.toLowerCase().includes(search.toLowerCase())) ||
        item.jenis.toLowerCase().includes(search.toLowerCase());

      const matchJenis =
        filterJenis === "all" ||
        item.jenis.toLowerCase().includes(filterJenis.toLowerCase());

      return matchSearch && matchJenis;
    });
  }, [items, search, filterJenis]);

  const handleCetak = (row: KwitansiArsipItem) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (row.no.startsWith("NP")) {
      printNotaPengeluaran({
        noNota: row.no,
        tanggal: row.tanggal,
        items: [
          {
            no: 1,
            deskripsi: row.periodeNama || "Pengeluaran",
            jumlah: 1,
            harga: row.total,
            total: row.total,
            petugas: row.penyetorName || "Petugas",
          },
        ],
        subTotal: row.total,
        pajakPersen: 0,
        pajakAmount: 0,
        grandTotal: row.total,
        bidangUjianName: row.penerimaName,
        bendaharaName: row.penyetorName,
        origin,
        draft: false,
      });
    } else {
      printKwitansi({
        no: row.no,
        tanggal: row.tanggal,
        terimaDari: row.terimaDari || row.periodeNama,
        jumlah: row.total,
        untukPembayaran: row.untukPembayaran || row.periodeNama,
        penerimaName: row.penerimaName,
        penyetorName: row.penyetorName,
        penerimaSignUrl: row.penerimaSignUrl,
        penyetorSignUrl: row.penyetorSignUrl,
        origin,
        draft: false,
      });
    }
  };

  const handleEdit = (row: KwitansiArsipItem) => {
    toast.info(`Memuat kwitansi ${row.no} di editor`);
    router.push(`/admin/kwitansi?no=${encodeURIComponent(row.no)}`);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const next = items.filter((i) => i.id !== deleteTarget.id);
    updateItems(next);
    toast.success(`Arsip kwitansi ${deleteTarget.no} berhasil dihapus`);
    setDeleteTarget(null);
  };

  const exportCsv = () => {
    if (filteredItems.length === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }
    const headers = ["No Kwitansi", "Periode / Nama", "Jenis", "Tanggal", "Terima Dari", "Total (Rp)", "Scope"];
    const rows = filteredItems.map((r) => [
      `"${r.no}"`,
      `"${r.periodeNama}"`,
      `"${r.jenis}"`,
      `"${r.tanggal}"`,
      `"${r.terimaDari || ""}"`,
      r.total,
      `"${r.scope}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `arsip-kwitansi-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Rekap CSV arsip kwitansi berhasil diunduh");
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari No. Kwitansi / Nama / Periode…"
              className="pl-9 text-sm"
            />
          </div>
          <select
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">Semua Jenis Kwitansi</option>
            <option value="iuran">Iuran / Tagihan</option>
            <option value="prestasi">Prestasi / Hadiah</option>
            <option value="pengeluaran">Pengeluaran Event</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={exportCsv} className="gap-1.5 text-xs">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button asChild className="bg-inkai-red hover:bg-inkai-red/90 gap-1.5 text-xs">
            <Link href="/admin/kwitansi">
              <Plus className="h-4 w-4" />
              Buat Kwitansi
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
              <th className="p-3">No</th>
              <th className="p-3">Periode / Nama</th>
              <th className="p-3">Jenis</th>
              <th className="p-3">Tanggal</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3">Scope</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Tidak ada data kwitansi yang ditemukan.
                </td>
              </tr>
            ) : (
              filteredItems.map((row) => (
                <tr key={row.id} className="border-b transition-colors hover:bg-muted/30">
                  <td className="p-3 font-semibold text-foreground">{row.no}</td>
                  <td className="p-3">
                    <div className="font-medium">{row.periodeNama}</div>
                    {row.terimaDari ? (
                      <div className="text-xs text-muted-foreground">Dari: {row.terimaDari}</div>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium">
                      {row.jenis}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{row.tanggal}</td>
                  <td className="p-3 text-right font-semibold text-foreground whitespace-nowrap">
                    {formatRp(row.total)}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{row.scope}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => handleCetak(row)}
                        title="Cetak Kwitansi / PDF"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() => handleEdit(row)}
                        title="Edit Kwitansi"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(row)}
                        title="Hapus Arsip"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Confirm Delete Dialog */}
      <InkaiConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Hapus Arsip Kwitansi?"
        description={`Apakah Anda yakin ingin menghapus arsip kwitansi ${deleteTarget?.no ?? ""} (${deleteTarget?.periodeNama ?? ""})? Action ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

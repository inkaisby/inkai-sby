"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getBeltGroup,
  type BeltGroup,
} from "@/lib/belt";
import {
  isUktBillingPaid,
  type UktMemberRow,
  type UktSemester,
} from "@/lib/ukt";
import { openUktMatrixPrint } from "@/lib/ukt-matrix-print-html";
import { toast } from "sonner";
import { Printer, Copy, Download, Search, CheckCircle2, Users, Building2 } from "lucide-react";

type DojoOption = { id: string; name: string };

type Props = {
  rows: UktMemberRow[];
  dojos: DojoOption[];
  semester: UktSemester;
  year: number;
  sekretariatAddress?: string;
  bidangUjianName?: string;
  orgKetuaCabangName?: string | null;
  strukturKetuaName?: string | null;
  pengprovHeadName?: string | null;
};

type MatrixRow = {
  no: number;
  dojoId: string;
  dojoName: string;
  putih: number;
  kuning: number;
  hijau: number;
  biru: number;
  cokelat: number;
  total: number;
};

export function UktMatrixRecapPanel({
  rows,
  dojos,
  semester,
  year,
  sekretariatAddress,
  bidangUjianName,
  orgKetuaCabangName,
  strukturKetuaName,
  pengprovHeadName,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid">("all");

  const matrixData = useMemo(() => {
    // 1. Filter rows by registration and status filter
    const activeRows = rows.filter((r) => {
      if (!r.registrationId) return false;
      if (r.status === "CANCELLED" || r.status === "REJECTED") return false;
      if (statusFilter === "paid" && !isUktBillingPaid(r)) return false;
      return true;
    });

    // 2. Map per dojo
    const dojoMap = new Map<
      string,
      {
        dojoName: string;
        putih: number;
        kuning: number;
        hijau: number;
        biru: number;
        cokelat: number;
        total: number;
      }
    >();

    // Seed all known dojos
    for (const d of dojos) {
      dojoMap.set(d.id, {
        dojoName: d.name,
        putih: 0,
        kuning: 0,
        hijau: 0,
        biru: 0,
        cokelat: 0,
        total: 0,
      });
    }

    // Populate counts
    for (const r of activeRows) {
      const dojoId = r.dojoId || "__none__";
      let bucket = dojoMap.get(dojoId);
      if (!bucket) {
        bucket = {
          dojoName: r.dojoName || "TANPA RANTING",
          putih: 0,
          kuning: 0,
          hijau: 0,
          biru: 0,
          cokelat: 0,
          total: 0,
        };
        dojoMap.set(dojoId, bucket);
      }

      const rankRaw = (r.kyuLama || r.kyuBaru || r.memberCurrentRank || "").trim();
      const bg = getBeltGroup(rankRaw);

      if (bg === "PUTIH") bucket.putih += 1;
      else if (bg === "KUNING") bucket.kuning += 1;
      else if (bg === "HIJAU") bucket.hijau += 1;
      else if (bg === "BIRU") bucket.biru += 1;
      else if (bg === "COKELAT") bucket.cokelat += 1;

      bucket.total += 1;
    }

    // Convert to sorted list
    const list: MatrixRow[] = [];
    let idx = 1;
    const sortedEntries = Array.from(dojoMap.entries())
      .filter(([_, b]) => b.total > 0 || dojos.some((d) => d.id === _))
      .sort((a, b) => a[1].dojoName.localeCompare(b[1].dojoName, "id"));

    for (const [id, b] of sortedEntries) {
      // Filter by search query if any
      if (
        searchQuery.trim() &&
        !b.dojoName.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        continue;
      }
      list.push({
        no: idx++,
        dojoId: id,
        dojoName: b.dojoName,
        putih: b.putih,
        kuning: b.kuning,
        hijau: b.hijau,
        biru: b.biru,
        cokelat: b.cokelat,
        total: b.total,
      });
    }

    // Calculate Totals
    const totals = list.reduce(
      (acc, r) => {
        acc.putih += r.putih;
        acc.kuning += r.kuning;
        acc.hijau += r.hijau;
        acc.biru += r.biru;
        acc.cokelat += r.cokelat;
        acc.grandTotal += r.total;
        return acc;
      },
      { putih: 0, kuning: 0, hijau: 0, biru: 0, cokelat: 0, grandTotal: 0 },
    );

    const activeDojoCount = list.filter((r) => r.total > 0).length;
    const maxDojo = list.reduce<MatrixRow | null>(
      (max, r) => (!max || r.total > max.total ? r : max),
      null,
    );

    return {
      list,
      totals,
      activeDojoCount,
      maxDojo,
    };
  }, [rows, dojos, statusFilter, searchQuery]);

  const handlePrint = () => {
    const today = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    openUktMatrixPrint({
      semester,
      year,
      rows: matrixData.list,
      totalPutih: matrixData.totals.putih,
      totalKuning: matrixData.totals.kuning,
      totalHijau: matrixData.totals.hijau,
      totalBiru: matrixData.totals.biru,
      totalCokelat: matrixData.totals.cokelat,
      grandTotal: matrixData.totals.grandTotal,
      origin: typeof window !== "undefined" ? window.location.origin : "",
      printedAt: today,
      sekretariatAddress,
      bidangUjianName,
      orgKetuaCabangName,
      strukturKetuaName,
      pengprovHeadName,
    });
  };

  const handleCopyWa = () => {
    let text = `🥋 *REKAPITULASI PENDAFTARAN PESERTA UJIAN UKT*\n`;
    text += `*SEMESTER ${semester} TAHUN ${year}*\n\n`;
    text += `*NO | NAMA RANTING | P | K | H | B | C | JML*\n`;
    text += `-----------------------------------------------\n`;

    for (const r of matrixData.list) {
      if (r.total === 0) continue;
      text += `${r.no}. ${r.dojoName.toUpperCase()}: Putih(${r.putih}), Kuning(${r.kuning}), Hijau(${r.hijau}), Biru(${r.biru}), Coklat(${r.cokelat}) -> *TOTAL: ${r.total}*\n`;
    }

    text += `-----------------------------------------------\n`;
    text += `*TOTAL KESELURUHAN:* ${matrixData.totals.grandTotal} Peserta\n`;
    text += `(Putih: ${matrixData.totals.putih}, Kuning: ${matrixData.totals.kuning}, Hijau: ${matrixData.totals.hijau}, Biru: ${matrixData.totals.biru}, Coklat: ${matrixData.totals.cokelat})\n`;

    void navigator.clipboard.writeText(text);
    toast.success("Rekapitulasi Matrix disalin ke clipboard!");
  };

  const handleExportCsv = () => {
    let csv = `\uFEFFNO,NAMA RANTING,PUTIH,KUNING,HIJAU,BIRU,COKLAT,JUMLAH\n`;
    for (const r of matrixData.list) {
      const name = `"${r.dojoName.replace(/"/g, '""')}"`;
      csv += `${r.no},${name},${r.putih},${r.kuning},${r.hijau},${r.biru},${r.cokelat},${r.total}\n`;
    }
    csv += `TOTAL,JUMLAH,${matrixData.totals.putih},${matrixData.totals.kuning},${matrixData.totals.hijau},${matrixData.totals.biru},${matrixData.totals.cokelat},${matrixData.totals.grandTotal}\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rekapitulasi_UKT_Matrix_Semester_${semester}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File CSV Rekapitulasi Matrix berhasil diunduh!");
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari ranting..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center rounded-lg border bg-muted/30 p-1 text-xs">
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded px-2.5 py-1 font-medium transition-all ${
                statusFilter === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semua Pendaftar
            </button>
            <button
              onClick={() => setStatusFilter("paid")}
              className={`rounded px-2.5 py-1 font-medium transition-all ${
                statusFilter === "paid"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Hanya Lunas
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyWa}
            className="h-9 gap-1 text-xs"
          >
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Salin WA</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            className="h-9 gap-1 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-1 bg-inkai-red text-xs hover:bg-inkai-red/90"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Cetak PDF</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Card className="border-muted bg-slate-50/50 p-3 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-inkai-red" />
            <span className="text-xs text-muted-foreground">Total Peserta</span>
          </div>
          <p className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {matrixData.totals.grandTotal} <span className="text-xs font-normal text-muted-foreground">orang</span>
          </p>
        </Card>

        <Card className="border-muted bg-slate-50/50 p-3 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-muted-foreground">Ranting Terdaftar</span>
          </div>
          <p className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {matrixData.activeDojoCount} <span className="text-xs font-normal text-muted-foreground">ranting</span>
          </p>
        </Card>

        <Card className="col-span-2 border-muted bg-slate-50/50 p-3 sm:col-span-1 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-muted-foreground">Ranting Terbanyak</span>
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {matrixData.maxDojo && matrixData.maxDojo.total > 0
              ? `${matrixData.maxDojo.dojoName} (${matrixData.maxDojo.total})`
              : "—"}
          </p>
        </Card>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12 text-center font-bold">NO</TableHead>
              <TableHead className="min-w-[140px] font-bold">NAMA RANTING</TableHead>
              <TableHead className="w-20 text-center font-bold text-slate-700">PUTIH</TableHead>
              <TableHead className="w-20 text-center font-bold text-amber-700">KUNING</TableHead>
              <TableHead className="w-20 text-center font-bold text-emerald-700">HIJAU</TableHead>
              <TableHead className="w-20 text-center font-bold text-blue-700">BIRU</TableHead>
              <TableHead className="w-20 text-center font-bold text-orange-900">COKLAT</TableHead>
              <TableHead className="w-24 text-center font-bold text-inkai-red">JUMLAH</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matrixData.list.map((row) => (
              <TableRow
                key={row.dojoId}
                className={row.total === 0 ? "text-muted-foreground opacity-60" : undefined}
              >
                <TableCell className="text-center text-xs text-muted-foreground">
                  {row.no}
                </TableCell>
                <TableCell className="font-medium">{row.dojoName}</TableCell>
                <TableCell className="text-center font-medium text-slate-700">
                  {row.putih || "—"}
                </TableCell>
                <TableCell className="text-center font-medium text-amber-700">
                  {row.kuning || "—"}
                </TableCell>
                <TableCell className="text-center font-medium text-emerald-700">
                  {row.hijau || "—"}
                </TableCell>
                <TableCell className="text-center font-medium text-blue-700">
                  {row.biru || "—"}
                </TableCell>
                <TableCell className="text-center font-medium text-orange-900">
                  {row.cokelat || "—"}
                </TableCell>
                <TableCell className="bg-slate-50 text-center font-bold text-foreground dark:bg-slate-900/50">
                  {row.total}
                </TableCell>
              </TableRow>
            ))}

            {/* Totals Row */}
            <TableRow className="bg-slate-100/80 font-bold dark:bg-slate-800/80">
              <TableCell colSpan={2} className="text-center text-xs uppercase tracking-wider">
                JUMLAH / TOTAL
              </TableCell>
              <TableCell className="text-center text-slate-800">
                {matrixData.totals.putih}
              </TableCell>
              <TableCell className="text-center text-amber-800">
                {matrixData.totals.kuning}
              </TableCell>
              <TableCell className="text-center text-emerald-800">
                {matrixData.totals.hijau}
              </TableCell>
              <TableCell className="text-center text-blue-800">
                {matrixData.totals.biru}
              </TableCell>
              <TableCell className="text-center text-orange-950">
                {matrixData.totals.cokelat}
              </TableCell>
              <TableCell className="bg-red-50 text-center text-base font-extrabold text-inkai-red dark:bg-red-950/40">
                {matrixData.totals.grandTotal}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileSpreadsheet,
  Printer,
  Search,
  Users,
  CircleDollarSign,
  Wallet,
  GraduationCap,
  Swords,
  Trophy,
  ClipboardCheck,
  SlidersHorizontal,
  Download,
  Copy,
  RotateCcw,
  Sparkles,
  Calendar,
  FileText,
  ShieldCheck,
  ShoppingBag,
  History,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DojoContextSwitcher } from "@/components/admin/DojoContextSwitcher";
import { showSuccess } from "@/lib/client-toast";

type ColumnMeta = {
  key: string;
  label: string;
  defaultSelected: boolean;
  category: string;
};

type DomainItemMeta = {
  id: string;
  label: string;
  iconName: string;
  desc: string;
  category?: string;
  columnsMeta?: ColumnMeta[];
};

type UserScopeMeta = {
  role: string;
  scopeLabel: string;
  isDojoScoped: boolean;
  managedDojoId: string | null;
  managedBranchId: string | null;
};

type ReportResponse = {
  success: boolean;
  domain: string;
  totalCount: number;
  columnsMeta: ColumnMeta[];
  userScope?: UserScopeMeta;
  availableDomains?: DomainItemMeta[];
  data: Record<string, unknown>[];
};

const DEFAULT_DOMAINS: DomainItemMeta[] = [
  { id: "anggota", label: "Anggota", iconName: "Users", desc: "Data Anggota & Sabuk", category: "Keorganisasian" },
  { id: "kas", label: "Kas Keuangan", iconName: "CircleDollarSign", desc: "Buku Mutasi Kas", category: "Keuangan" },
  { id: "iuran", label: "Iuran Anggota", iconName: "Wallet", desc: "Status & Tunggakan Iuran", category: "Keuangan" },
  { id: "ukt", label: "UKT Ujian", iconName: "GraduationCap", desc: "Peserta & Kenaikan Sabuk", category: "Kegiatan & Event" },
  { id: "latber", label: "Latihan Bersama", iconName: "Swords", desc: "Walk-in & Tamu Latber", category: "Kegiatan & Event" },
  { id: "pertandingan", label: "Kejuaraan", iconName: "Trophy", desc: "Atlet, Kelas & Medali", category: "Kegiatan & Event" },
  { id: "absensi", label: "Absensi", iconName: "ClipboardCheck", desc: "Check-in GPS & Scan QR", category: "Kegiatan & Event" },
];

function renderDomainIcon(iconName: string) {
  switch (iconName) {
    case "Users":
      return <Users className="h-4 w-4 shrink-0" />;
    case "CircleDollarSign":
      return <CircleDollarSign className="h-4 w-4 shrink-0" />;
    case "Wallet":
      return <Wallet className="h-4 w-4 shrink-0" />;
    case "GraduationCap":
      return <GraduationCap className="h-4 w-4 shrink-0" />;
    case "Swords":
      return <Swords className="h-4 w-4 shrink-0" />;
    case "Trophy":
      return <Trophy className="h-4 w-4 shrink-0" />;
    case "ClipboardCheck":
      return <ClipboardCheck className="h-4 w-4 shrink-0" />;
    case "FileText":
      return <FileText className="h-4 w-4 shrink-0" />;
    case "ShieldCheck":
      return <ShieldCheck className="h-4 w-4 shrink-0" />;
    case "ShoppingBag":
      return <ShoppingBag className="h-4 w-4 shrink-0" />;
    case "History":
      return <History className="h-4 w-4 shrink-0" />;
    default:
      return <FileSpreadsheet className="h-4 w-4 shrink-0" />;
  }
}

export function LaporanClient() {
  const [domain, setDomain] = useState<string>("anggota");
  const [dojoId, setDojoId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [dojos, setDojos] = useState<{ id: string; name: string }[]>([]);
  const [domains, setDomains] = useState<DomainItemMeta[]>(DEFAULT_DOMAINS);
  const [userScope, setUserScope] = useState<UserScopeMeta | null>(null);

  useEffect(() => {
    void fetch("/api/public/dojos")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data.dojos)
          ? data.dojos
          : Array.isArray(data.data)
            ? data.data
            : [];
        setDojos(
          list.map((d: { id: string; name: string }) => ({
            id: String(d.id),
            name: String(d.name),
          })),
        );
      })
      .catch(() => {});
  }, []);

  const [loading, setLoading] = useState<boolean>(true);
  const [reportData, setReportData] = useState<ReportResponse | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [showColumnPicker, setShowColumnPicker] = useState<boolean>(false);

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("domain", domain);
      if (dojoId) params.set("dojoId", dojoId);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (search) params.set("q", search);

      const res = await fetch(`/api/admin/laporan?${params.toString()}`, {
        cache: "no-store",
      });
      const data: ReportResponse = await res.json();
      if (res.ok && data.success) {
        setReportData(data);

        if (data.userScope) {
          setUserScope(data.userScope);
          if (data.userScope.isDojoScoped && data.userScope.managedDojoId) {
            setDojoId(data.userScope.managedDojoId);
          }
        }

        // Auto-detect dynamic domain list if provided
        if (data.availableDomains && Array.isArray(data.availableDomains)) {
          setDomains(data.availableDomains);
        }

        // Initialize default selected columns if domain changed or empty
        const defaults = data.columnsMeta
          .filter((c) => c.defaultSelected)
          .map((c) => c.key);
        setSelectedColumns(defaults);
      }
    } catch (err) {
      console.error("[LaporanClient] Load error", err);
    } finally {
      setLoading(false);
    }
  }, [domain, dojoId, startDate, endDate, search]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const allColumns = reportData?.columnsMeta || [];

  // Group columns by category for Cathlab-style picker
  const columnsByCategory = useMemo(() => {
    const map: Record<string, ColumnMeta[]> = {};
    for (const col of allColumns) {
      const cat = col.category || "Lainnya";
      if (!map[cat]) map[cat] = [];
      map[cat].push(col);
    }
    return map;
  }, [allColumns]);

  const activeColumns = useMemo(() => {
    return allColumns.filter((col) => selectedColumns.includes(col.key));
  }, [allColumns, selectedColumns]);

  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const selectAllColumns = () => {
    setSelectedColumns(allColumns.map((c) => c.key));
  };

  const resetDefaultColumns = () => {
    setSelectedColumns(allColumns.filter((c) => c.defaultSelected).map((c) => c.key));
  };

  // Date range quick presets
  const applyDatePreset = (preset: "this_month" | "last_month" | "this_year" | "all") => {
    const now = new Date();
    if (preset === "all") {
      setStartDate("");
      setEndDate("");
      return;
    }
    if (preset === "this_month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(first.toISOString().split("T")[0]);
      setEndDate(last.toISOString().split("T")[0]);
      return;
    }
    if (preset === "last_month") {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(first.toISOString().split("T")[0]);
      setEndDate(last.toISOString().split("T")[0]);
      return;
    }
    if (preset === "this_year") {
      const first = new Date(now.getFullYear(), 0, 1);
      const last = new Date(now.getFullYear(), 11, 31);
      setStartDate(first.toISOString().split("T")[0]);
      setEndDate(last.toISOString().split("T")[0]);
      return;
    }
  };

  // Sorting
  const sortedData = useMemo(() => {
    if (!reportData?.data) return [];
    const list = [...reportData.data];
    if (!sortColumn) return list;

    list.sort((a, b) => {
      const valA = String(a[sortColumn] ?? "");
      const valB = String(b[sortColumn] ?? "");
      const cmp = valA.localeCompare(valB, "id", { numeric: true });
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [reportData, sortColumn, sortDirection]);

  const handleSort = (colKey: string) => {
    if (sortColumn === colKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(colKey);
      setSortDirection("asc");
    }
  };

  // Export CSV/Excel
  const handleExportCsv = () => {
    if (!reportData || sortedData.length === 0 || activeColumns.length === 0) return;

    const headers = activeColumns.map((c) => `"${c.label}"`).join(",");
    const rows = sortedData.map((row) =>
      activeColumns
        .map((c) => {
          const val = String(row[c.key] ?? "").replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(","),
    );

    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `Laporan_${domain.toUpperCase()}_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess("Laporan CSV berhasil diunduh!");
  };

  // Print Report PDF/HTML
  const handlePrint = () => {
    if (!reportData || sortedData.length === 0 || activeColumns.length === 0) return;

    const currentDomainItem = domains.find((d) => d.id === domain);
    const domainLabel = currentDomainItem?.label || domain;
    const printWin = window.open("", "_blank");
    if (!printWin) return;

    const tableHeaders = activeColumns.map((c) => `<th>${c.label}</th>`).join("");
    const tableRows = sortedData
      .map(
        (row) =>
          `<tr>${activeColumns
            .map((c) => `<td>${row[c.key] ?? "—"}</td>`)
            .join("")}</tr>`,
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Laporan INKAI Surabaya — ${domainLabel}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: sans-serif; font-size: 11px; color: #111; margin: 0; padding: 10px; }
          .header { display: flex; align-items: center; justify-content: space-between; border-b: 2px solid #b91c1c; padding-bottom: 8px; margin-bottom: 12px; }
          .title { font-size: 16px; font-weight: bold; text-transform: uppercase; color: #b91c1c; }
          .meta { font-size: 10px; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f3f4f6; border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
          td { border: 1px solid #ddd; padding: 5px 8px; font-size: 10px; }
          tr:nth-child(even) { background: #fafafa; }
          .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 10px; }
          .sig-box { text-align: center; width: 180px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">INSTITUT KARATE-DO INDONESIA (INKAI)</div>
            <div style="font-size: 12px; font-weight: bold;">PENGURUS CABANG KOTA SURABAYA</div>
            <div class="meta">Laporan Resmi: <strong>${domainLabel.toUpperCase()}</strong> | Scope: <strong>${userScope?.scopeLabel || "Cabang"}</strong> | Periode: ${startDate || "Awal"} s/d ${endDate || "Sekarang"}</div>
          </div>
          <div style="text-align: right;" class="meta">
            <div>Total Record: <strong>${sortedData.length} Baris</strong></div>
            <div>Dicetak Pada: ${new Date().toLocaleString("id-ID")}</div>
          </div>
        </div>

        <table>
          <thead><tr>${tableHeaders}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>

        <div class="footer">
          <div>* Dokumen ini dibuat otomatis melalui Portal Resmi INKAI Surabaya</div>
          <div class="sig-box">
            <p>Surabaya, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
            <p style="font-weight: bold;">Pengurus INKAI Surabaya</p>
            <br/><br/><br/>
            <p style="text-decoration: underline; font-weight: bold;">( Sekretariat INKAI SBY )</p>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
  };

  // Copy WA Summary
  const handleCopyWa = () => {
    if (!reportData) return;
    const currentDomainItem = domains.find((d) => d.id === domain);
    const domainLabel = currentDomainItem?.label || domain;
    const text = `*REKAP LAPORAN INKAI SURABAYA*\n` +
      `📌 *Domain:* ${domainLabel}\n` +
      `🏛️ *Scope Akses:* ${userScope?.scopeLabel || "Cabang"}\n` +
      `📅 *Periode:* ${startDate || "Awal"} s/d ${endDate || "Sekarang"}\n` +
      `📊 *Total Record:* ${reportData.totalCount} Baris Data\n` +
      `⚙️ *Kolom Ditampilkan:* ${activeColumns.map((c) => c.label).join(", ")}\n\n` +
      `_Diunduh dari Portal Admin INKAI Surabaya (${new Date().toLocaleDateString("id-ID")})_`;

    navigator.clipboard.writeText(text);
    showSuccess("Ringkasan Laporan berhasil disalin ke WhatsApp!");
  };

  return (
    <div className="space-y-4">
      {/* Executive Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border border-inkai-red/20 bg-gradient-to-r from-inkai-red/10 via-background to-muted/30">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-inkai-red text-white shadow-md">
              <FileSpreadsheet className="size-5" />
            </span>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">
              Laporan Custom & Generator Kolom
            </h1>
            {userScope && (
              <Badge variant="secondary" className="gap-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                <Building2 className="h-3 w-3" />
                <span>Scope: {userScope.scopeLabel}</span>
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Pilih domain laporan, atur kolom Cathlab interaktif, filter rentang tanggal, serta ekspor ke Excel/PDF sesuai hak akses wilayah.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyWa}
            className="h-8 gap-1.5 text-xs rounded-xl"
          >
            <Copy className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Salin WA</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-8 gap-1.5 text-xs rounded-xl border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Excel / CSV</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handlePrint}
            className="h-8 gap-1.5 text-xs rounded-xl bg-inkai-red text-white hover:bg-inkai-red/90"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Cetak PDF</span>
          </Button>
        </div>
      </div>

      {/* Dynamic Domain Selection Tabs (Auto-Detect Fitur Baru) */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-muted/60 text-xs font-semibold overflow-x-auto no-scrollbar scroll-smooth">
        {domains.map((item) => {
          const active = domain === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setDomain(item.id);
                setSortColumn(null);
              }}
              className={`flex items-center gap-2 py-2 px-3 rounded-xl whitespace-nowrap transition-all shrink-0 ${
                active
                  ? "bg-background text-inkai-red shadow-sm ring-1 ring-inkai-red/30 font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              }`}
            >
              {renderDomainIcon(item.iconName)}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Control & Filter Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 rounded-2xl border bg-card/60 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Dojo Context Switcher (Disabled / Locked if user is Dojo Scoped) */}
          {!userScope?.isDojoScoped ? (
            <DojoContextSwitcher
              dojos={dojos}
              value={dojoId}
              onChange={(id: string) => setDojoId(id)}
            />
          ) : (
            <Badge variant="outline" className="h-8 px-3 rounded-xl gap-1 text-xs border-inkai-red/30 text-inkai-red bg-inkai-red/5">
              <Building2 className="h-3.5 w-3.5" />
              <span>{dojos.find(d => d.id === userScope.managedDojoId)?.name || "Ranting Terkunci"}</span>
            </Badge>
          )}

          {/* Date Presets */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-1" />
            <button
              type="button"
              onClick={() => applyDatePreset("this_month")}
              className="px-2 py-1 rounded-lg text-[11px] hover:bg-background hover:shadow-xs transition"
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset("last_month")}
              className="px-2 py-1 rounded-lg text-[11px] hover:bg-background hover:shadow-xs transition"
            >
              Bulan Lalu
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset("this_year")}
              className="px-2 py-1 rounded-lg text-[11px] hover:bg-background hover:shadow-xs transition"
            >
              Tahun Ini
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset("all")}
              className="px-2 py-1 rounded-lg text-[11px] hover:bg-background hover:shadow-xs transition"
            >
              Semua
            </button>
          </div>

          {/* Date Picker Inputs */}
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 text-xs w-32 rounded-xl"
            />
            <span className="text-muted-foreground">s/d</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 text-xs w-32 rounded-xl"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Text Search */}
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari kata kunci..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs rounded-xl"
            />
          </div>

          {/* Column Picker Trigger Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className={`h-8 gap-1.5 text-xs rounded-xl ${
              showColumnPicker ? "border-inkai-red text-inkai-red bg-inkai-red/5" : ""
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Pilih Kolom ({activeColumns.length})</span>
          </Button>
        </div>
      </div>

      {/* Cathlab-Style Column Picker Panel */}
      {showColumnPicker && (
        <div className="p-4 rounded-2xl border bg-card shadow-md space-y-3 animation-fadeIn">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h3 className="font-bold text-xs">
                Pemilih Kolom Kustom (Cathlab-Style Column Customizer)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectAllColumns}
                className="h-7 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              >
                Pilih Semua Kolom
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetDefaultColumns}
                className="h-7 text-[11px] text-muted-foreground gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Default
              </Button>
            </div>
          </div>

          {/* Grouped Columns Selection Checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
            {Object.entries(columnsByCategory).map(([category, cols]) => (
              <div key={category} className="space-y-1.5 bg-muted/20 p-2.5 rounded-xl border border-muted/50">
                <div className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider border-b pb-1">
                  {category}
                </div>
                <div className="space-y-1 pt-1">
                  {cols.map((col) => {
                    const isChecked = selectedColumns.includes(col.key);
                    return (
                      <label
                        key={col.key}
                        className={`flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-inkai-red/10 text-inkai-red font-medium"
                            : "hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleColumn(col.key)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-inkai-red focus:ring-inkai-red"
                        />
                        <span className="truncate">{col.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Data Table */}
      <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b bg-muted/30 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold">Rincian Data Laporan</span>
            <Badge variant="secondary" className="text-[10px] font-semibold">
              {reportData?.totalCount || 0} Record
            </Badge>
          </div>
          {sortColumn && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span>Urut berdasarkan: <strong>{allColumns.find(c => c.key === sortColumn)?.label}</strong> ({sortDirection})</span>
              <button
                type="button"
                onClick={() => setSortColumn(null)}
                className="text-inkai-red hover:underline ml-1"
              >
                Reset Sort
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-inkai-red border-t-transparent"></div>
            <p>Memuat data laporan...</p>
          </div>
        ) : sortedData.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            Tidak ada data ditemukan untuk kriteria filter & scope wilayah ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {activeColumns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="p-3 cursor-pointer hover:bg-muted/80 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>{col.label}</span>
                        {sortColumn === col.key && (
                          <span className="text-inkai-red font-bold">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedData.map((row, idx) => (
                  <tr
                    key={String(row.id || idx)}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {activeColumns.map((col) => (
                      <td key={col.key} className="p-3 whitespace-nowrap">
                        {row[col.key] !== undefined && row[col.key] !== null
                          ? String(row[col.key])
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

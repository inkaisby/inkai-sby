"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Download,
  Lock,
  Plus,
  Printer,
  Trash2,
  Unlock,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InkaiConfirmDialog } from "@/components/ui/InkaiConfirmDialog";
import { formatRp } from "@/lib/terbilang";
import {
  formatKasDateId,
  parseKasImportTsv,
  ymdWib,
  type KasLedgerRow,
  type KasTableRow,
} from "@/lib/kas";
import { printKasDocument } from "@/lib/kas-print-html";

type KasPayload = {
  canWrite: boolean;
  canLock: boolean;
  rows: KasLedgerRow[];
  groups: KasTableRow[];
  kpis: {
    totalIn: number;
    totalOut: number;
    saldoAkhir: number;
    opening: number;
    unmatched: number;
  };
  kegiatanOptions: string[];
  lockedMonths: string[];
  currentMonth: string;
};

type DraftRow = {
  description: string;
  direction: "in" | "out";
  amount: string;
};

export function KasLedgerClient({ scopeLabel }: { scopeLabel: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [kegiatan, setKegiatan] = useState("");
  const [source, setSource] = useState("all");
  const [recon, setRecon] = useState("all");
  const [data, setData] = useState<KasPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [massOpen, setMassOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    txnDate: ymdWib(),
    description: "",
    kegiatan: "",
    direction: "in" as "in" | "out",
    amount: "",
  });
  const [massDate, setMassDate] = useState(ymdWib());
  const [massKegiatan, setMassKegiatan] = useState("");
  const [massRows, setMassRows] = useState<DraftRow[]>([
    { description: "", direction: "out", amount: "" },
  ]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("year", String(year));
    p.set("month", String(month));
    if (kegiatan) p.set("kegiatan", kegiatan);
    if (source !== "all") p.set("source", source);
    if (recon !== "all") p.set("recon", recon);
    return p.toString();
  }, [year, month, kegiatan, source, recon]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/kas?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat");
      setData(json);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat kas");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const locked = Boolean(data?.lockedMonths.includes(`${year}-${String(month).padStart(2, "0")}`));

  async function postEntries(
    entries: Array<{
      txnDate: string;
      description: string;
      kegiatan?: string;
      direction: "in" | "out";
      amount: number;
    }>,
  ) {
    const res = await fetch("/api/admin/kas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Gagal simpan");
    return json;
  }

  async function handleAdd() {
    try {
      await postEntries([
        {
          txnDate: form.txnDate,
          description: form.description,
          kegiatan: form.kegiatan,
          direction: form.direction,
          amount: Number(form.amount),
        },
      ]);
      toast.success("Mutasi kas tersimpan");
      setAddOpen(false);
      setForm({
        txnDate: ymdWib(),
        description: "",
        kegiatan: "",
        direction: "in",
        amount: "",
      });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal simpan");
    }
  }

  async function handleMass() {
    const entries = massRows
      .map((r) => ({
        txnDate: massDate,
        description: r.description.trim(),
        kegiatan: massKegiatan,
        direction: r.direction,
        amount: Number(r.amount),
      }))
      .filter((r) => r.description && r.amount > 0);
    if (!entries.length) {
      toast.error("Isi minimal satu baris");
      return;
    }
    try {
      await postEntries(entries);
      toast.success(`${entries.length} baris tersimpan`);
      setMassOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal simpan");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const res = await fetch(`/api/admin/kas/${deleteId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal hapus");
      return;
    }
    toast.success("Baris dihapus");
    setDeleteId(null);
    await load();
  }

  async function toggleRecon(row: KasLedgerRow) {
    const next = row.reconStatus === "matched" ? "open" : "matched";
    const res = await fetch(`/api/admin/kas/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reconStatus: next }),
    });
    if (!res.ok) {
      toast.error("Gagal mengubah rekon");
      return;
    }
    await load();
  }

  async function toggleLock() {
    const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
    const res = await fetch("/api/admin/kas/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yearMonth,
        lock: !locked,
        reason: locked ? "Buka buku" : undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal kunci buku");
      return;
    }
    toast.success(locked ? "Buku dibuka" : "Buku ditutup");
    await load();
  }

  function exportCsv() {
    const rows = data?.rows ?? [];
    const lines = [
      "No,Tanggal,Keterangan,Masuk,Keluar,Saldo,Kegiatan,Sumber",
      ...rows.map(
        (r) =>
          `${r.no},"${formatKasDateId(r.txnDate)}","${r.description.replace(/"/g, '""')}",${r.amountIn},${r.amountOut},${r.saldo},"${r.kegiatan}","${r.sourceType}"`,
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kas-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const drafts = parseKasImportTsv(
      file.name.endsWith(".csv") ? text.replace(/,/g, "\t") : text,
    );
    if (!drafts.length) {
      toast.error("Tidak ada baris valid (Tanggal/Keterangan/Masuk/Keluar/Kegiatan)");
      return;
    }
    const res = await fetch("/api/admin/kas/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: drafts.map((d) => ({
          txnDate: d.txnDate,
          description: d.description,
          kegiatan: d.kegiatan,
          direction: d.direction,
          amount: d.amount,
        })),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Gagal impor");
      return;
    }
    toast.success(`${json.created} baris diimpor`);
    await load();
  }

  function handlePrint() {
    printKasDocument({
      origin: window.location.origin,
      scopeLabel,
      periodLabel: `${month}/${year}`,
      printedAt: `${ymdWib()} WIB`,
      saldoAkhir: data?.kpis.saldoAkhir ?? 0,
      rows: data?.rows ?? [],
    });
  }

  const groups = data?.groups ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Total masuk" value={formatRp(data?.kpis.totalIn ?? 0)} />
        <Kpi label="Total keluar" value={formatRp(data?.kpis.totalOut ?? 0)} />
        <Kpi
          label="Saldo akhir"
          value={formatRp(data?.kpis.saldoAkhir ?? 0)}
          accent
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Saldo bawa bulan ini {formatRp(data?.kpis.opening ?? 0)} · Belum rekon{" "}
        {data?.kpis.unmatched ?? 0}
        {locked ? " · Buku bulan ini dikunci" : ""}
      </p>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <select
            className="h-10 rounded-md border bg-background px-2 text-sm"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2026, i, 1).toLocaleDateString("id-ID", { month: "long" })}
              </option>
            ))}
          </select>
          <Input
            type="number"
            className="w-24"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
          <select
            className="h-10 rounded-md border bg-background px-2 text-sm"
            value={kegiatan}
            onChange={(e) => setKegiatan(e.target.value)}
          >
            <option value="">Semua kegiatan</option>
            {(data?.kegiatanOptions ?? []).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border bg-background px-2 text-sm"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">Semua sumber</option>
            <option value="manual">Manual</option>
            <option value="iuran">Iuran</option>
            <option value="ukt">UKT</option>
            <option value="latber">Latber</option>
            <option value="kwitansi">Kwitansi</option>
          </select>
          <select
            className="h-10 rounded-md border bg-background px-2 text-sm"
            value={recon}
            onChange={(e) => setRecon(e.target.value)}
          >
            <option value="all">Rekon semua</option>
            <option value="open">Belum</option>
            <option value="matched">Cocok</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="text-xs" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Cetak
          </Button>
          <Button type="button" variant="outline" className="text-xs" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          {data?.canWrite ? (
            <>
              <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-md border px-3 text-xs">
                <Upload className="h-4 w-4" />
                Impor
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleImportFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <Button type="button" variant="outline" className="text-xs" onClick={() => setMassOpen(true)}>
                <Plus className="h-4 w-4" />
                Tambah massal
              </Button>
              <Button
                type="button"
                className="bg-inkai-red text-xs hover:bg-inkai-red/90"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Tambah
              </Button>
            </>
          ) : null}
          {data?.canLock ? (
            <Button type="button" variant="outline" className="text-xs" onClick={() => void toggleLock()}>
              {locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {locked ? "Buka buku" : "Tutup buku"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="p-3">No</th>
              <th className="p-3">Tanggal</th>
              <th className="p-3">Keterangan</th>
              <th className="p-3 text-right">Masuk</th>
              <th className="p-3 text-right">Keluar</th>
              <th className="p-3 text-right">Saldo</th>
              <th className="p-3">Kegiatan</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Memuat…
                </td>
              </tr>
            ) : groups.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Belum ada mutasi. Gunakan Tambah, Tambah massal, atau tunggu
                  verifikasi iuran/UKT/Latber. Isi Saldo awal sekali jika pindah dari Excel.
                </td>
              </tr>
            ) : (
              groups.map((row, idx) =>
                row.kind === "group" ? (
                  <tr key={`g-${row.kegiatan}-${idx}`} className="bg-muted/50 font-medium">
                    <td colSpan={3} className="p-3">
                      {row.kegiatan}
                    </td>
                    <td className="p-3 text-right">{formatRp(row.totalIn)}</td>
                    <td className="p-3 text-right">{formatRp(row.totalOut)}</td>
                    <td colSpan={3} />
                  </tr>
                ) : (
                  <tr key={row.id} className="border-b">
                    <td className="p-3">{row.no}</td>
                    <td className="p-3 whitespace-nowrap">{formatKasDateId(row.txnDate)}</td>
                    <td className="p-3">
                      <div>{row.description}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {row.sourceHref ? (
                          <Link href={row.sourceHref} className="underline">
                            {row.sourceType}
                          </Link>
                        ) : (
                          row.sourceType
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      {row.amountIn ? formatRp(row.amountIn) : "—"}
                    </td>
                    <td className="p-3 text-right">
                      {row.amountOut ? formatRp(row.amountOut) : "—"}
                    </td>
                    <td className="p-3 text-right">{formatRp(row.saldo)}</td>
                    <td className="p-3">{row.kegiatan || "—"}</td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 text-[11px]"
                          onClick={() => void toggleRecon(row)}
                        >
                          {row.reconStatus === "matched" ? "Cocok" : "Belum"}
                        </Button>
                        {data?.canWrite && row.sourceType === "manual" ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setDeleteId(row.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah mutasi</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Tanggal">
              <Input
                type="date"
                value={form.txnDate}
                onChange={(e) => setForm({ ...form, txnDate: e.target.value })}
              />
            </Field>
            <Field label="Keterangan">
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <Field label="Kegiatan">
              <Input
                value={form.kegiatan}
                onChange={(e) => setForm({ ...form, kegiatan: e.target.value })}
                placeholder="MUSKOT, Iuran, Saldo awal"
              />
            </Field>
            <Field label="Arah">
              <select
                className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                value={form.direction}
                onChange={(e) =>
                  setForm({ ...form, direction: e.target.value as "in" | "out" })
                }
              >
                <option value="in">Masuk</option>
                <option value="out">Keluar</option>
              </select>
            </Field>
            <Field label="Nominal">
              <Input
                type="number"
                min={1}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Batal
            </Button>
            <Button type="button" className="bg-inkai-red hover:bg-inkai-red/90" onClick={() => void handleAdd()}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={massOpen} onOpenChange={setMassOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah massal</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tanggal bersama">
              <Input type="date" value={massDate} onChange={(e) => setMassDate(e.target.value)} />
            </Field>
            <Field label="Kegiatan bersama">
              <Input value={massKegiatan} onChange={(e) => setMassKegiatan(e.target.value)} />
            </Field>
          </div>
          <div className="space-y-2">
            {massRows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_7rem_7rem_2rem] gap-2">
                <Input
                  placeholder="Keterangan"
                  value={row.description}
                  onChange={(e) => {
                    const next = [...massRows];
                    next[i] = { ...row, description: e.target.value };
                    setMassRows(next);
                  }}
                />
                <select
                  className="h-10 rounded-md border bg-background px-1 text-sm"
                  value={row.direction}
                  onChange={(e) => {
                    const next = [...massRows];
                    next[i] = { ...row, direction: e.target.value as "in" | "out" };
                    setMassRows(next);
                  }}
                >
                  <option value="in">Masuk</option>
                  <option value="out">Keluar</option>
                </select>
                <Input
                  type="number"
                  placeholder="Nominal"
                  value={row.amount}
                  onChange={(e) => {
                    const next = [...massRows];
                    next[i] = { ...row, amount: e.target.value };
                    setMassRows(next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setMassRows(massRows.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setMassRows([...massRows, { description: "", direction: "out", amount: "" }])
              }
            >
              + Baris
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMassOpen(false)}>
              Batal
            </Button>
            <Button type="button" className="bg-inkai-red hover:bg-inkai-red/90" onClick={() => void handleMass()}>
              Simpan semua
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InkaiConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
        title="Hapus baris kas?"
        description="Hanya baris manual yang dihapus. Jurnal otomatis tidak bisa dihapus dari sini."
        confirmLabel="Hapus"
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${accent ? "border-green-700/40 bg-green-50 dark:bg-green-950/20" : "bg-card"}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

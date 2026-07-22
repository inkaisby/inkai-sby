"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/lib/client-toast";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { billingStatusLabel } from "@/lib/admin-labels";
import { Loader2, Wand2 } from "lucide-react";

export function IuranOpsBar({
  canEdit,
  defaultAmount,
  billings,
}: {
  canEdit: boolean;
  defaultAmount: number;
  billings: Array<{
    id: string;
    fullName: string;
    nia: string;
    dojo: string;
    type: string;
    amount: number;
    status: string;
    dueDate: string;
    description: string;
  }>;
}) {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [amount, setAmount] = useState(String(defaultAmount));
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setOpen(false);
  }, []);

  async function generate(dryRun = false) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/billing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          month,
          amount: Number(amount),
          dryRun,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal membuat tagihan");
        return;
      }
      showSuccess(data.message || "Berhasil");
      if (!dryRun) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <details
      className="mb-4 rounded-xl border p-0 open:pb-0"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none px-3 py-3 marker:content-none sm:px-4 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Operasional iuran bulanan</p>
            <p className="text-xs text-muted-foreground">
              Default: Rp {defaultAmount.toLocaleString("id-ID")}
              <span className="sm:hidden">
                {" "}
                · {open ? "Sembunyikan" : "Tampilkan"}
              </span>
            </p>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <ExportCsvButton
              filename="iuran-export.csv"
              headers={[
                "Nama",
                "NIA",
                "Dojo",
                "Tipe",
                "Nominal",
                "Status",
                "Jatuh tempo",
                "Keterangan",
              ]}
              rows={billings.map((b) => [
                b.fullName,
                b.nia,
                b.dojo,
                b.type,
                b.amount,
                billingStatusLabel(b.status),
                b.dueDate,
                b.description,
              ])}
            />
          </div>
        </div>
      </summary>

      {canEdit ? (
        <div className="grid grid-cols-2 gap-2 border-t px-3 py-3 sm:flex sm:flex-wrap sm:items-end sm:px-4">
          <div>
            <label className="text-xs text-muted-foreground">Bulan</label>
            <Input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-10 w-full sm:h-8 sm:w-20"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tahun</label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-10 w-full sm:h-8 sm:w-24"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs text-muted-foreground">Nominal</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-10 w-full sm:h-8 sm:w-32"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 sm:h-8"
            disabled={busy}
            onClick={() => void generate(true)}
          >
            Cek dulu
          </Button>
          <Button
            type="button"
            size="sm"
            className="col-span-2 h-10 gap-1 bg-inkai-red hover:bg-inkai-red/90 sm:col-span-1 sm:h-8"
            disabled={busy}
            onClick={() => void generate(false)}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            Buat tagihan bulan ini
          </Button>
        </div>
      ) : null}
    </details>
  );
}

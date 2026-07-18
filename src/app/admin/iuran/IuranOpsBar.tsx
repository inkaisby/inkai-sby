"use client";

import { useState } from "react";
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
    <div className="mb-4 space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Operasional iuran bulanan</p>
          <p className="text-xs text-muted-foreground">
            Default dari Profil &amp; Kebijakan: Rp{" "}
            {defaultAmount.toLocaleString("id-ID")}
          </p>
        </div>
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

      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Bulan</label>
            <Input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-20"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tahun</label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Nominal</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-32"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void generate(true)}
          >
            Cek dulu
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1 bg-inkai-red hover:bg-inkai-red/90"
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
    </div>
  );
}

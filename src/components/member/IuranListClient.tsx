"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/lib/client-toast";
import { Loader2 } from "lucide-react";

type BillingItem = {
  id: string;
  type?: string;
  description?: string | null;
  dueDate?: string;
  amount?: number;
  status?: string;
  payment?: {
    proofUrl?: string | null;
    paidAt?: string | null;
    paymentMethod?: string | null;
  } | null;
};

function statusLabel(status: string) {
  if (status === "PAID") return { label: "Lunas", className: "bg-emerald-600 hover:bg-emerald-600" };
  if (status === "WAITING_VERIFICATION") {
    return { label: "Menunggu verifikasi", className: "" };
  }
  if (status === "REJECTED") return { label: "Ditolak", className: "" };
  return { label: "Belum bayar", className: "" };
}

function typeLabel(type: string) {
  if (type === "MONTHLY_IURAN" || type === "MONTHLY" || type === "IURAN") {
    return "Iuran bulanan";
  }
  if (type === "EVENT" || type === "UKT") return "UKT / Event";
  return type || "Tagihan";
}

function isUktBilling(b: BillingItem): boolean {
  const type = String(b.type || "").toUpperCase();
  const desc = String(b.description || "").toUpperCase();
  return type.includes("UKT") || type === "EVENT" || desc.includes("UKT");
}

function todayYmd() {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatPaidAt(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("id-ID");
  } catch {
    return null;
  }
}

export function IuranListClient({ billings }: { billings: BillingItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});

  async function submitReport(billingId: string, amount: number) {
    const paidAt = dates[billingId] || todayYmd();
    setBusyId(billingId);
    try {
      const res = await fetch(`/api/member/billing/${billingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidAt,
          amount,
          paymentMethod: "SETOR_RANTING",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal mengirim laporan setor");
        return;
      }
      showSuccess(data.message || "Laporan setor terkirim");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const visible = billings.filter((b) => !isUktBilling(b));

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Tidak ada tagihan iuran.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((b) => {
        const st = statusLabel(String(b.status || ""));
        const canReport =
          b.status === "PENDING" || b.status === "REJECTED";
        const amount = Number(b.amount || 0);
        const reportedAt = formatPaidAt(b.payment?.paidAt);
        const dateValue = dates[b.id] ?? todayYmd();

        return (
          <div
            key={b.id}
            className="rounded-2xl border border-border/60 bg-card p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{typeLabel(String(b.type || ""))}</p>
                <p className="text-sm text-muted-foreground">
                  {String(b.description || "Iuran anggota")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Jatuh tempo:{" "}
                  {b.dueDate
                    ? new Date(b.dueDate).toLocaleDateString("id-ID")
                    : "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold">
                  Rp {amount.toLocaleString("id-ID")}
                </p>
                <Badge
                  variant={b.status === "PAID" ? "default" : "secondary"}
                  className={`mt-1 ${st.className}`}
                >
                  {st.label}
                </Badge>
              </div>
            </div>

            {b.status === "WAITING_VERIFICATION" && reportedAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Dilaporkan setor {reportedAt} — menunggu konfirmasi ranting
              </p>
            ) : null}

            {canReport ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <label
                    htmlFor={`paidAt-${b.id}`}
                    className="text-xs text-muted-foreground"
                  >
                    Tanggal bayar
                  </label>
                  <Input
                    id={`paidAt-${b.id}`}
                    type="date"
                    className="h-9 w-[160px]"
                    max={todayYmd()}
                    value={dateValue}
                    disabled={busyId === b.id}
                    onChange={(e) =>
                      setDates((prev) => ({ ...prev, [b.id]: e.target.value }))
                    }
                  />
                </div>
                <p className="pb-2 text-xs text-muted-foreground">
                  Nominal: Rp {amount.toLocaleString("id-ID")} (sesuai tagihan)
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 bg-inkai-red hover:bg-inkai-red/90"
                  disabled={busyId === b.id || !dateValue}
                  onClick={() => void submitReport(b.id, amount)}
                >
                  {busyId === b.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Laporkan setor ke ranting"
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

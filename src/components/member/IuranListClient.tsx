"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { showError, showSuccess, showLoading } from "@/lib/client-toast";
import { InkaiLogoLoader } from "@/components/ui/InkaiLogoLoader";

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

const LOOKBACK_MONTHS = 24;
const BLOCKED = new Set(["PAID", "SUCCESS", "APPROVED", "WAITING_VERIFICATION"]);

function statusLabel(status: string) {
  if (status === "PAID") {
    return { label: "Lunas", className: "bg-emerald-600 hover:bg-emerald-600" };
  }
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

function periodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function periodLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function billingPeriodKey(b: BillingItem): string | null {
  const desc = String(b.description || "");
  const m = desc.match(/(\d{4}-\d{2})/);
  if (m) return m[1];
  if (b.dueDate) {
    try {
      const d = new Date(b.dueDate);
      return periodKey(d.getFullYear(), d.getMonth() + 1);
    } catch {
      return null;
    }
  }
  return null;
}

function listPeriodOptions(billings: BillingItem[]) {
  const blocked = new Set<string>();
  for (const b of billings) {
    if (!BLOCKED.has(String(b.status || ""))) continue;
    const key = billingPeriodKey(b);
    if (key) blocked.add(key);
  }

  const now = new Date();
  const options: Array<{ key: string; label: string }> = [];
  for (let i = 0; i < LOOKBACK_MONTHS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = periodKey(d.getFullYear(), d.getMonth() + 1);
    if (blocked.has(key)) continue;
    options.push({ key, label: periodLabel(key) });
  }
  return options;
}

export function IuranListClient({
  billings,
  monthlyDuesAmount,
}: {
  billings: BillingItem[];
  monthlyDuesAmount: number;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [periodBusy, setPeriodBusy] = useState(false);
  const periodOptions = useMemo(() => listPeriodOptions(billings), [billings]);
  const [period, setPeriod] = useState(periodOptions[0]?.key ?? "");
  const [periodPaidAt, setPeriodPaidAt] = useState(todayYmd());
  const selectedPeriod =
    periodOptions.find((p) => p.key === period)?.key || periodOptions[0]?.key;

  async function submitReport(billingId: string, amount: number) {
    const paidAt = dates[billingId] || todayYmd();
    const toastId = showLoading("Mengirim laporan setor…");
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
        showError(data.error || "Gagal mengirim laporan setor", {
          id: toastId,
        });
        return;
      }
      showSuccess(data.message || "Laporan setor terkirim", { id: toastId });
      router.refresh();
    } catch {
      showError("Gagal mengirim laporan setor", { id: toastId });
    } finally {
      setBusyId(null);
    }
  }

  async function submitPeriodReport() {
    const targetPeriod = selectedPeriod || period;
    if (!targetPeriod) {
      showError("Pilih periode iuran");
      return;
    }
    const toastId = showLoading(`Mengirim laporan setor ${targetPeriod}…`);
    setPeriodBusy(true);
    try {
      const res = await fetch("/api/member/billing/report-period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: targetPeriod,
          paidAt: periodPaidAt || todayYmd(),
          paymentMethod: "SETOR_RANTING",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal mengirim laporan setor", {
          id: toastId,
        });
        return;
      }
      showSuccess(data.message || "Laporan setor terkirim", { id: toastId });
      router.refresh();
    } catch {
      showError("Gagal mengirim laporan setor", { id: toastId });
    } finally {
      setPeriodBusy(false);
    }
  }

  const visible = billings.filter((b) => !isUktBilling(b));

  return (
    <div className="space-y-4">
      {periodOptions.length > 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="font-semibold">Laporkan setor periode</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pilih bulan berjalan atau bulan sebelumnya (maks. {LOOKBACK_MONTHS}{" "}
            bulan). Nominal sesuai iuran/bln Anda.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label
                htmlFor="iuran-period"
                className="text-xs text-muted-foreground"
              >
                Periode
              </label>
              <select
                id="iuran-period"
                className="flex h-9 w-[180px] rounded-md border border-input bg-background px-2 text-sm"
                value={selectedPeriod || ""}
                disabled={periodBusy}
                onChange={(e) => setPeriod(e.target.value)}
              >
                {periodOptions.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="iuran-period-paidAt"
                className="text-xs text-muted-foreground"
              >
                Tanggal bayar
              </label>
              <Input
                id="iuran-period-paidAt"
                type="date"
                className="h-9 w-[160px]"
                max={todayYmd()}
                value={periodPaidAt}
                disabled={periodBusy}
                onChange={(e) => setPeriodPaidAt(e.target.value)}
              />
            </div>
            <p className="pb-2 text-xs text-muted-foreground">
              Nominal: Rp {Math.round(monthlyDuesAmount).toLocaleString("id-ID")}
            </p>
            <Button
              type="button"
              size="sm"
              className="h-9 bg-inkai-red hover:bg-inkai-red/90"
              disabled={periodBusy || !selectedPeriod || !periodPaidAt}
              onClick={() => void submitPeriodReport()}
            >
              {periodBusy ? (
                <InkaiLogoLoader
                  size="sm"
                  showDots={false}
                  className="shrink-0"
                />
              ) : (
                "Laporkan setor ke ranting"
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Belum ada tagihan di daftar. Gunakan formulir periode di atas untuk
          melaporkan setor bulan sebelumnya.
        </div>
      ) : (
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
                    <p className="font-semibold">
                      {typeLabel(String(b.type || ""))}
                    </p>
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
                          setDates((prev) => ({
                            ...prev,
                            [b.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <p className="pb-2 text-xs text-muted-foreground">
                      Nominal: Rp {amount.toLocaleString("id-ID")} (sesuai
                      tagihan)
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 bg-inkai-red hover:bg-inkai-red/90"
                      disabled={busyId === b.id || !dateValue}
                      onClick={() => void submitReport(b.id, amount)}
                    >
                      {busyId === b.id ? (
                        <InkaiLogoLoader
                          size="sm"
                          showDots={false}
                          className="shrink-0"
                        />
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
      )}
    </div>
  );
}

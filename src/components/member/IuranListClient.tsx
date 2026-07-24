"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { showError, showSuccess } from "@/lib/client-toast";
import { ExternalLink, Loader2, Upload } from "lucide-react";

type BillingItem = {
  id: string;
  type?: string;
  description?: string | null;
  dueDate?: string;
  amount?: number;
  status?: string;
  payment?: { proofUrl?: string | null } | null;
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
  if (type === "MONTHLY_IURAN") return "Iuran bulanan";
  if (type === "EVENT" || type === "UKT") return "UKT / Event";
  return type || "Tagihan";
}

function isUktBilling(b: BillingItem): boolean {
  const type = String(b.type || "").toUpperCase();
  const desc = String(b.description || "").toUpperCase();
  return type.includes("UKT") || type === "EVENT" || desc.includes("UKT");
}

export function IuranListClient({ billings }: { billings: BillingItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function submitProof(billingId: string, file: File) {
    setBusyId(billingId);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("folder", "iuran");
      const up = await fetch("/api/member/upload", { method: "POST", body: form });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) {
        showError(upData.error || "Gagal mengunggah bukti");
        return;
      }

      const res = await fetch(`/api/member/billing/${billingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofUrl: upData.url,
          paymentMethod: "TRANSFER",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal mengirim bukti");
        return;
      }
      showSuccess(data.message || "Bukti terkirim");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  // Tagihan UKT tidak ditampilkan di daftar iuran anggota (anti-bocor nominal)
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
        const canUpload =
          b.status === "PENDING" || b.status === "REJECTED";
        const proofUrl = b.payment?.proofUrl;
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
                  Rp {Number(b.amount || 0).toLocaleString("id-ID")}
                </p>
                <Badge
                  variant={b.status === "PAID" ? "default" : "secondary"}
                  className={`mt-1 ${st.className}`}
                >
                  {st.label}
                </Badge>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {proofUrl ? (
                <a
                  href={proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-inkai-red hover:underline"
                >
                  Lihat bukti <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}

              {canUpload ? (
                <>
                  <input
                    ref={(el) => {
                      inputRefs.current[b.id] = el;
                    }}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void submitProof(b.id, file);
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={busyId === b.id}
                    onClick={() => inputRefs.current[b.id]?.click()}
                  >
                    {busyId === b.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Unggah bukti bayar
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

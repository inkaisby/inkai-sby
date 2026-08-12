"use client";

import { useState } from "react";
import { Loader2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MemberLatberStatusPayload } from "@/lib/member-latber-status";
import type { LatberDisplayStatus } from "@/lib/latber";
import { parseApiJson } from "@/lib/api-client";
import { showError, showSuccess } from "@/lib/client-toast";

const STATUS_CLASS: Partial<Record<LatberDisplayStatus, string>> = {
  belum_daftar: "bg-muted text-muted-foreground",
  belum_bayar: "bg-amber-500/15 text-amber-700",
  menunggu_terima_ranting: "bg-amber-500/15 text-amber-700",
  menunggu_konfirmasi_ranting: "bg-amber-500/15 text-amber-800",
  menunggu_verifikasi: "bg-amber-500/15 text-amber-700",
  lunas: "bg-emerald-600 text-white",
  ditolak: "bg-red-500/15 text-red-700",
  batal: "bg-muted text-muted-foreground",
};

export function LatberStatusCard({
  compact,
  initialData,
}: {
  compact?: boolean;
  initialData: MemberLatberStatusPayload;
}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  if (!data.period) return null;

  const status = data.displayStatus ?? "belum_daftar";
  const badgeClass = STATUS_CLASS[status] ?? "bg-muted";

  async function selfRegister() {
    if (!data.period?.id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/member/latber/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: data.period.id }),
      });
      const json = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal mendaftar");
      showSuccess("Pengajuan Latihan Bersama terkirim — menunggu ranting");
      setData((d) => ({
        ...d,
        registered: true,
        displayStatus: "menunggu_terima_ranting",
        statusLabel: "Menunggu Terima Ranting",
        canSelfRegister: false,
      }));
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal mendaftar");
    } finally {
      setLoading(false);
    }
  }

  async function confirmPayment() {
    if (!data.registrationId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/member/latber/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: data.registrationId }),
      });
      const json = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Gagal konfirmasi");
      showSuccess("Konfirmasi bayar tercatat");
      setData((d) => ({
        ...d,
        displayStatus: "menunggu_konfirmasi_ranting",
        statusLabel: "Menunggu Konfirmasi Ranting",
        memberPaymentConfirmedAt: new Date().toISOString(),
      }));
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal konfirmasi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border border-border/60 bg-card p-4 ${compact ? "" : "mb-4"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-inkai-red" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Latihan Bersama
            </p>
            <p className="font-semibold">{data.period.title}</p>
          </div>
        </div>
        <Badge className={badgeClass}>{data.statusLabel ?? status}</Badge>
      </div>

      {data.eventAt && (
        <p className="mt-2 text-sm text-muted-foreground">
          Jadwal: {new Date(data.eventAt).toLocaleString("id-ID")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {data.canSelfRegister && (
          <Button size="sm" disabled={loading} onClick={selfRegister}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Daftar Latihan Bersama"}
          </Button>
        )}
        {status === "menunggu_terima_ranting" && !data.memberPaymentConfirmedAt && (
          <Button size="sm" variant="outline" disabled={loading} onClick={confirmPayment}>
            Konfirmasi sudah bayar
          </Button>
        )}
      </div>
    </div>
  );
}

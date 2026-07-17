"use client";

import { useEffect, useState } from "react";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { showError, showSuccess } from "@/lib/client-toast";
import { Loader2 } from "lucide-react";

type Dojo = { id: string; nama: string; cabang?: { nama?: string } };
type Claim = {
  id: string;
  status: string;
  data: string;
  createdAt: string;
  adminNotes: string | null;
};

function parseData(data: string) {
  try {
    return JSON.parse(data) as {
      targetDojoName?: string;
      fromDojoName?: string;
      reason?: string;
    };
  } catch {
    return {};
  }
}

export function PindahDojoClient({
  currentDojoName,
}: {
  currentDojoName: string;
}) {
  const [dojos, setDojos] = useState<Dojo[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [targetDojoId, setTargetDojoId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [dojoRes, claimRes] = await Promise.all([
        fetch("/api/dojos"),
        fetch("/api/member/pindah"),
      ]);
      const dojoData = await dojoRes.json().catch(() => ({}));
      const claimData = await claimRes.json().catch(() => ({}));
      setDojos(dojoData.data ?? []);
      setClaims(claimData.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit() {
    if (!targetDojoId || reason.trim().length < 5) {
      showError("Pilih dojo tujuan dan isi alasan (min. 5 karakter)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/member/pindah", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDojoId, reason: reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal mengajukan");
        return;
      }
      showSuccess(data.message || "Pengajuan terkirim");
      setReason("");
      setTargetDojoId("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <MemberPageHeader title="Pindah Dojo" />
      <p className="mb-4 text-sm text-muted-foreground">
        Ajukan pindah ranting. Pengurus akan memverifikasi sebelum dojo diperbarui.
      </p>

      <div className="mb-6 rounded-2xl border border-border/60 bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dojo saat ini
        </p>
        <p className="mt-1 font-semibold">{currentDojoName || "—"}</p>
      </div>

      <div className="mb-8 space-y-3 rounded-2xl border border-border/60 bg-card p-4">
        <label className="block text-sm font-semibold">Dojo tujuan</label>
        <select
          value={targetDojoId}
          onChange={(e) => setTargetDojoId(e.target.value)}
          className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
          disabled={loading}
        >
          <option value="">Pilih dojo...</option>
          {dojos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nama}
            </option>
          ))}
        </select>
        <label className="block text-sm font-semibold">Alasan</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          placeholder="Jelaskan alasan pindah dojo..."
        />
        <Button
          className="w-full bg-inkai-red hover:bg-inkai-red/90"
          disabled={submitting || loading}
          onClick={() => void submit()}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajukan Pindah"}
        </Button>
      </div>

      <h3 className="mb-3 text-base font-extrabold">Riwayat Pengajuan</h3>
      {claims.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada pengajuan.
        </div>
      ) : (
        <div className="space-y-2">
          {claims.map((c) => {
            const d = parseData(c.data);
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-border/60 bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {d.fromDojoName || "—"} → {d.targetDojoName || "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">{d.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <Badge variant="secondary">{c.status}</Badge>
                </div>
                {c.adminNotes ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Catatan: {c.adminNotes}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

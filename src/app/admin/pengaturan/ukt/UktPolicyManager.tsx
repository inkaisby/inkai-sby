"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError, showSuccess } from "@/lib/client-toast";
import type { UktRegistrationPolicy } from "@/lib/ukt-registration-policy";
import { buildDefaultUktAdminUrl } from "@/lib/ukt";

function CheckRow({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/80 px-3 py-2.5 hover:bg-muted/40"
    >
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-4 w-4 accent-[var(--inkai-red,#c41e3a)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

export function UktPolicyManager({
  initialPolicy,
}: {
  initialPolicy: UktRegistrationPolicy;
}) {
  const router = useRouter();
  const [policy, setPolicy] = useState(initialPolicy);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/pengaturan/ukt", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(policy),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      showSuccess(data.message || "Pengaturan disimpan");
      if (data.data) setPolicy(data.data);
      router.refresh();
    } else {
      showError(data.error || "Gagal menyimpan");
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="rounded-xl border p-4 space-y-3">
        <div>
          <h3 className="font-semibold">Persyaratan pendaftaran</h3>
          <p className="text-sm text-muted-foreground">
            Centang syarat yang wajib dipenuhi sebelum anggota bisa didaftarkan UKT.
            Jadwal buka/batas pendaftaran selalu berlaku.
          </p>
        </div>
        <CheckRow
          id="req-dues"
          checked={policy.requireNoOutstandingDues}
          onChange={(v) =>
            setPolicy((p) => ({ ...p, requireNoOutstandingDues: v }))
          }
          label="Iuran tidak menunggak"
          hint="Anggota masih punya tagihan iuran PENDING / menunggu verifikasi tidak boleh daftar."
        />
        <CheckRow
          id="req-docs"
          checked={policy.requireDocuments}
          onChange={(v) => setPolicy((p) => ({ ...p, requireDocuments: v }))}
          label="Dokumen Akte & BPJS lengkap"
          hint="Kedua dokumen harus sudah diunggah di profil anggota."
        />
        <CheckRow
          id="req-att"
          checked={policy.requireMinAttendance}
          onChange={(v) =>
            setPolicy((p) => ({ ...p, requireMinAttendance: v }))
          }
          label="Kehadiran semester minimum"
          hint="Persentase absensi latihan di semester UKT harus mencapai ambang di bawah."
        />
        <div className="flex flex-wrap items-end gap-3 pl-1">
          <div className="space-y-1">
            <Label htmlFor="min-att">Ambang kehadiran (%)</Label>
            <Input
              id="min-att"
              type="number"
              min={0}
              max={100}
              className="w-28"
              disabled={!policy.requireMinAttendance}
              value={policy.minAttendancePct}
              onChange={(e) =>
                setPolicy((p) => ({
                  ...p,
                  minAttendancePct: Math.min(
                    100,
                    Math.max(0, parseInt(e.target.value, 10) || 0),
                  ),
                }))
              }
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <div>
          <h3 className="font-semibold">Berlaku untuk siapa</h3>
          <p className="text-sm text-muted-foreground">
            Jika tidak dicentang, peran itu boleh mendaftarkan anggota tanpa syarat di
            atas (periode tetap dicek). Cabang tetap bisa memakai waiver per anggota.
          </p>
        </div>
        <CheckRow
          id="enf-ranting"
          checked={policy.enforceForRanting}
          onChange={(v) => setPolicy((p) => ({ ...p, enforceForRanting: v }))}
          label="Terapkan ke admin ranting"
          hint="Matikan jika ranting boleh daftar dulu meski syarat belum lengkap."
        />
        <CheckRow
          id="enf-cabang"
          checked={policy.enforceForCabang}
          onChange={(v) => setPolicy((p) => ({ ...p, enforceForCabang: v }))}
          label="Terapkan ke admin cabang"
          hint="Biasanya tetap aktif; cabang bisa waiver jika perlu pengecualian."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving} className="bg-inkai-red hover:bg-inkai-red/90">
          {saving ? "Menyimpan…" : "Simpan pengaturan"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={buildDefaultUktAdminUrl()}>Ke Pendaftaran UKT</Link>
        </Button>
        {policy.updatedAt ? (
          <span className="text-xs text-muted-foreground">
            Terakhir diubah:{" "}
            {new Date(policy.updatedAt).toLocaleString("id-ID")}
          </span>
        ) : null}
      </div>
    </form>
  );
}

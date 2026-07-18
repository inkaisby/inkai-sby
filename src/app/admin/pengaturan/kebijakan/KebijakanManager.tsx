"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError, showSuccess } from "@/lib/client-toast";
import type {
  BranchOrgProfile,
  OperationalDefaults,
} from "@/lib/org-settings";

export function KebijakanManager({
  initialProfile,
  initialDefaults,
}: {
  initialProfile: BranchOrgProfile;
  initialDefaults: OperationalDefaults;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [defaults, setDefaults] = useState(initialDefaults);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    const res = await fetch("/api/admin/pengaturan/kebijakan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "profile", ...profile }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingProfile(false);
    if (res.ok) {
      showSuccess(data.message || "Profil disimpan");
      router.refresh();
    } else {
      showError(data.error || "Gagal menyimpan profil");
    }
  }

  async function saveDefaults(e: React.FormEvent) {
    e.preventDefault();
    setSavingDefaults(true);
    const res = await fetch("/api/admin/pengaturan/kebijakan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "defaults", ...defaults }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingDefaults(false);
    if (res.ok) {
      showSuccess(data.message || "Kebijakan disimpan");
      router.refresh();
    } else {
      showError(data.error || "Gagal menyimpan kebijakan");
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={saveProfile} className="space-y-4 rounded-xl border p-4">
        <div>
          <h3 className="font-semibold">Profil sekretariat cabang</h3>
          <p className="text-sm text-muted-foreground">
            Kontak resmi, jam layanan, dan rekening transfer cabang.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Alamat kantor</Label>
            <Input
              value={profile.address}
              onChange={(e) =>
                setProfile((p) => ({ ...p, address: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Telepon</Label>
            <Input
              value={profile.phone}
              onChange={(e) =>
                setProfile((p) => ({ ...p, phone: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>WhatsApp</Label>
            <Input
              value={profile.whatsapp}
              onChange={(e) =>
                setProfile((p) => ({ ...p, whatsapp: e.target.value }))
              }
              placeholder="628…"
            />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input
              type="email"
              value={profile.email}
              onChange={(e) =>
                setProfile((p) => ({ ...p, email: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Jam layanan</Label>
            <Input
              value={profile.hours}
              onChange={(e) =>
                setProfile((p) => ({ ...p, hours: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Link Google Maps</Label>
            <Input
              value={profile.mapsUrl}
              onChange={(e) =>
                setProfile((p) => ({ ...p, mapsUrl: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Bank</Label>
            <Input
              value={profile.bankName}
              onChange={(e) =>
                setProfile((p) => ({ ...p, bankName: e.target.value }))
              }
              placeholder="BCA / BRI / …"
            />
          </div>
          <div className="space-y-1">
            <Label>No. rekening</Label>
            <Input
              value={profile.bankAccountNumber}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  bankAccountNumber: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Atas nama</Label>
            <Input
              value={profile.bankAccountName}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  bankAccountName: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Instruksi pembayaran (tampil ke anggota)</Label>
            <textarea
              value={profile.paymentInstructions}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  paymentInstructions: e.target.value,
                }))
              }
              className="min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Transfer ke rekening cabang, cantumkan NIA di berita transfer…"
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={savingProfile}
          className="bg-inkai-red hover:bg-inkai-red/90"
        >
          {savingProfile ? "Menyimpan…" : "Simpan profil"}
        </Button>
      </form>

      <form onSubmit={saveDefaults} className="space-y-4 rounded-xl border p-4">
        <div>
          <h3 className="font-semibold">Kebijakan operasional</h3>
          <p className="text-sm text-muted-foreground">
            Default iuran bulanan dan catatan untuk pengurus. Tarif UKT tetap di
            modul UKT.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Iuran bulanan default (Rp)</Label>
            <Input
              type="number"
              min={0}
              value={defaults.monthlyDuesAmount}
              onChange={(e) =>
                setDefaults((d) => ({
                  ...d,
                  monthlyDuesAmount: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={defaults.forcePasswordHint}
                onChange={(e) =>
                  setDefaults((d) => ({
                    ...d,
                    forcePasswordHint: e.target.checked,
                  }))
                }
              />
              Tampilkan saran ganti password di Akun Saya
            </label>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Catatan instruksi bayar (opsional, override singkat)</Label>
            <textarea
              value={defaults.paymentInstructions}
              onChange={(e) =>
                setDefaults((d) => ({
                  ...d,
                  paymentInstructions: e.target.value,
                }))
              }
              className="min-h-20 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={savingDefaults}
            className="bg-inkai-red hover:bg-inkai-red/90"
          >
            {savingDefaults ? "Menyimpan…" : "Simpan kebijakan"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/ukt">Buka tarif UKT & komisi</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

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
import { ShieldCheck, UserCheck, PhoneCall, CreditCard, MapPin, Settings2 } from "lucide-react";

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
      showSuccess(data.message || "Profil & kontak disimpan");
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
      showSuccess(data.message || "Kebijakan operasional disimpan");
    } else {
      showError(data.error || "Gagal menyimpan kebijakan");
    }
  }

  return (
    <div className="space-y-8">
      {/* 1. Pengaturan Pendaftaran & Keanggotaan Mandiri */}
      <form onSubmit={saveDefaults} className="space-y-5 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-2.5 border-b pb-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base">1. Pengaturan Pendaftaran & Keanggotaan</h3>
            <p className="text-xs text-muted-foreground">
              Atur status verifikasi otomatis dan pembukaan formulir registrasi mandiri anggota baru.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2 sm:col-span-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border-gray-300 text-inkai-red focus:ring-inkai-red"
                checked={defaults.autoVerifyNewMember}
                onChange={(e) =>
                  setDefaults((d) => ({
                    ...d,
                    autoVerifyNewMember: e.target.checked,
                  }))
                }
              />
              <div>
                <span className="font-medium text-sm block">
                  ✓ Verifikasi Otomatis Pendaftaran Mandiri Anggota Baru (Langsung Active & Bisa Login)
                </span>
                <span className="text-xs text-muted-foreground leading-relaxed block mt-0.5">
                  Jika <strong>DICENTANG</strong>: Anggota baru yang mendaftar mandiri otomatis langsung aktif dan bisa login tanpa persetujuan admin. Jika <strong>TIDAK DICENTANG</strong>: Akun diset ke status <code>PENDING</code> dan wajib diverifikasi manual oleh Admin Ranting/Cabang di menu Kelola Anggota.
                </span>
              </div>
            </label>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2 sm:col-span-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border-gray-300 text-inkai-red focus:ring-inkai-red"
                checked={defaults.publicRegistrationOpen}
                onChange={(e) =>
                  setDefaults((d) => ({
                    ...d,
                    publicRegistrationOpen: e.target.checked,
                  }))
                }
              />
              <div>
                <span className="font-medium text-sm block">
                  🔓 Buka Formulir Pendaftaran Mandiri Publik (/login & /daftar)
                </span>
                <span className="text-xs text-muted-foreground leading-relaxed block mt-0.5">
                  Jika <strong>DICENTANG</strong>: Pengunjung publik bebas mendaftar mandiri. Jika <strong>TIDAK DICENTANG</strong>: Formulir pendaftaran mandiri ditutup sementara (misal saat pemeliharaan data atau penutupan periode).
                </span>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={savingDefaults}
            className="bg-inkai-red hover:bg-inkai-red/90"
          >
            {savingDefaults ? "Menyimpan…" : "Simpan Pengaturan Pendaftaran"}
          </Button>
        </div>
      </form>

      {/* 2 & 3. Profil Sekretariat, WA Hotline & Rekening Bank */}
      <form onSubmit={saveProfile} className="space-y-5 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-2.5 border-b pb-3">
          <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
            <PhoneCall className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base">2 & 3. Kontak Hotline WA, Rekening & Profil Cabang</h3>
            <p className="text-xs text-muted-foreground">
              Sumber data utama untuk tombol bantuan WhatsApp, info rekening bayar, dan QRIS cabang.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Hotline WA */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              WA Admin Bantuan / Permohonan Koreksi
            </Label>
            <Input
              value={profile.contactAdminWa}
              onChange={(e) =>
                setProfile((p) => ({ ...p, contactAdminWa: e.target.value }))
              }
              placeholder="085731241840"
            />
            <p className="text-[11px] text-muted-foreground">
              Nomor WhatsApp penerima permohonan koreksi data / bantuan atlet & anggota.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              WA Konfirmasi Pembayaran (UKT/Pertandingan)
            </Label>
            <Input
              value={profile.paymentConfirmationWa}
              onChange={(e) =>
                setProfile((p) => ({ ...p, paymentConfirmationWa: e.target.value }))
              }
              placeholder="082257203462"
            />
            <p className="text-[11px] text-muted-foreground">
              Nomor WhatsApp konfirmasi bukti transfer / QRIS dari peserta.
            </p>
          </div>

          {/* Profil Alamat & Kontak */}
          <div className="space-y-1 sm:col-span-2 pt-2 border-t">
            <Label>Alamat Kantor Sekretariat</Label>
            <Input
              value={profile.address}
              onChange={(e) =>
                setProfile((p) => ({ ...p, address: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Telepon Kantor</Label>
            <Input
              value={profile.phone}
              onChange={(e) =>
                setProfile((p) => ({ ...p, phone: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>WhatsApp Utama Sekretariat</Label>
            <Input
              value={profile.whatsapp}
              onChange={(e) =>
                setProfile((p) => ({ ...p, whatsapp: e.target.value }))
              }
              placeholder="628…"
            />
          </div>
          <div className="space-y-1">
            <Label>Email Resmi Sekretariat</Label>
            <Input
              type="email"
              value={profile.email}
              onChange={(e) =>
                setProfile((p) => ({ ...p, email: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Jam Layanan</Label>
            <Input
              value={profile.hours}
              onChange={(e) =>
                setProfile((p) => ({ ...p, hours: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Link Google Maps Lokasi</Label>
            <Input
              value={profile.mapsUrl}
              onChange={(e) =>
                setProfile((p) => ({ ...p, mapsUrl: e.target.value }))
              }
            />
          </div>

          {/* Rekening & QRIS */}
          <div className="space-y-1.5 pt-2 border-t sm:col-span-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rekening Pembayaran & QRIS Cabang
            </h4>
          </div>

          <div className="space-y-1">
            <Label>Nama Bank</Label>
            <Input
              value={profile.bankName}
              onChange={(e) =>
                setProfile((p) => ({ ...p, bankName: e.target.value }))
              }
              placeholder="Bank Mandiri / BCA / BRI"
            />
          </div>
          <div className="space-y-1">
            <Label>Nomor Rekening</Label>
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
            <Label>Atas Nama Rekening</Label>
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
            <Label>Link / URL Gambar QRIS Resmi (opsional)</Label>
            <Input
              value={profile.bankQrisUrl}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  bankQrisUrl: e.target.value,
                }))
              }
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Instruksi Pembayaran Lengkap (tampil di portal/modal)</Label>
            <textarea
              value={profile.paymentInstructions}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  paymentInstructions: e.target.value,
                }))
              }
              className="min-h-20 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Transfer ke rekening cabang, cantumkan NIA di berita transfer…"
            />
          </div>
        </div>

        {/* Pejabat Dokumen */}
        <div className="rounded-lg border bg-muted/30 p-3.5 sm:col-span-2 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pejabat Dokumen UKT & Nota Resmi
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Nama Bidang Ujian</Label>
              <Input
                value={profile.bidangUjianName}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    bidangUjianName: e.target.value,
                  }))
                }
                placeholder="SETIA BASUKI"
              />
            </div>
            <div className="space-y-1">
              <Label>Nama Bendahara Cabang</Label>
              <Input
                value={profile.bendaharaCabangName}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    bendaharaCabangName: e.target.value,
                  }))
                }
                placeholder="Habibur Rahman"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Nama Ketua Cabang (opsional)</Label>
              <Input
                value={profile.ketuaCabangName}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    ketuaCabangName: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={savingProfile}
            className="bg-inkai-red hover:bg-inkai-red/90"
          >
            {savingProfile ? "Menyimpan…" : "Simpan Profil & Rekening"}
          </Button>
        </div>
      </form>

      {/* 4. Pengaturan Absensi & Geofence GPS */}
      <form onSubmit={saveDefaults} className="space-y-5 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-2.5 border-b pb-3">
          <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
            <MapPin className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base">4. Pengaturan Absensi & Geofence GPS</h3>
            <p className="text-xs text-muted-foreground">
              Atur batas toleransi lokasi GPS dan aturan frekuensi absensi harian anggota.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Default Radius Geofence GPS (Meter)</Label>
            <Input
              type="number"
              min={10}
              max={5000}
              value={defaults.defaultGeofenceRadius}
              onChange={(e) =>
                setDefaults((d) => ({
                  ...d,
                  defaultGeofenceRadius: Number(e.target.value) || 150,
                }))
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Batas jarak maksimal posisi GPS anggota dari titik lokasi Dojo saat absen (default: 150m).
            </p>
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="size-4 rounded border-gray-300 text-inkai-red focus:ring-inkai-red"
                checked={defaults.limitOneAbsencePerDay}
                onChange={(e) =>
                  setDefaults((d) => ({
                    ...d,
                    limitOneAbsencePerDay: e.target.checked,
                  }))
                }
              />
              <span>Batasi Absensi Maksimal 1x Per Hari</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end border-t pt-3">
          <Button
            type="submit"
            disabled={savingDefaults}
            className="bg-inkai-red hover:bg-inkai-red/90"
          >
            {savingDefaults ? "Menyimpan…" : "Simpan Pengaturan Absensi"}
          </Button>
        </div>
      </form>

      {/* 5. Kebijakan Operasional Dues & Keamanan */}
      <form onSubmit={saveDefaults} className="space-y-4 rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-2.5 border-b pb-3">
          <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
            <Settings2 className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base">5. Kebijakan Operasional Iuran & Keamanan</h3>
            <p className="text-xs text-muted-foreground">
              Pengaturan default tagihan iuran bulanan dan petunjuk keamanan akun.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Iuran Bulanan Default (Rp)</Label>
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
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="size-4 rounded border-gray-300 text-inkai-red focus:ring-inkai-red"
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
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button
            type="submit"
            disabled={savingDefaults}
            className="bg-inkai-red hover:bg-inkai-red/90"
          >
            {savingDefaults ? "Menyimpan…" : "Simpan Kebijakan Operasional"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/ukt">Buka tarif UKT & CASHBACK</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

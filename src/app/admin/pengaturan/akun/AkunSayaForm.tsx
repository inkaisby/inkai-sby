"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { showError, showSuccess } from "@/lib/client-toast";

export type AkunSayaData = {
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  roleLabels: string[];
  scopeLabel: string;
};

export function AkunSayaForm({ initial }: { initial: AkunSayaData }) {
  const router = useRouter();
  const [email, setEmail] = useState(initial.email);
  const [fullName, setFullName] = useState(initial.fullName || "");
  const [phoneNumber, setPhoneNumber] = useState(initial.phoneNumber || "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    const res = await fetch("/api/admin/pengaturan/akun", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "profile",
        email: email.trim().toLowerCase(),
        fullName,
        phoneNumber,
      }),
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

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (savingPassword) return;
    if (newPassword !== newPasswordConfirm) {
      showError("Konfirmasi password baru tidak cocok");
      return;
    }
    setSavingPassword(true);
    const res = await fetch("/api/admin/pengaturan/akun", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "password",
        oldPassword,
        newPassword,
        newPasswordConfirm,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingPassword(false);
    if (res.ok) {
      showSuccess(data.message || "Password diubah");
      setOldPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } else {
      showError(data.error || "Gagal mengubah password");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={saveProfile} className="space-y-4 rounded-xl border p-4">
        <div>
          <h3 className="font-semibold">Profil</h3>
          <p className="text-sm text-muted-foreground">
            Data akun admin yang sedang login
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="akun-email">Email (username login)</Label>
          <Input
            id="akun-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Nama Lengkap</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Telepon</Label>
          <Input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {initial.roleLabels.map((r) => (
            <Badge key={r} variant="secondary">
              {r}
            </Badge>
          ))}
          <Badge variant="outline">{initial.scopeLabel}</Badge>
        </div>
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Status keaktifan akun dapat dilihat pengurus cabang/pusat saat Anda
          membuka aplikasi (untuk koordinasi operasional).
        </p>
        <Button
          type="submit"
          disabled={savingProfile}
          className="bg-inkai-red hover:bg-inkai-red/90"
        >
          {savingProfile ? "Menyimpan..." : "Simpan Profil"}
        </Button>
      </form>

      <form onSubmit={savePassword} className="space-y-4 rounded-xl border p-4">
        <div>
          <h3 className="font-semibold">Ubah Password</h3>
          <p className="text-sm text-muted-foreground">
            Minimal 8 karakter, wajib huruf dan angka
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Password Lama</Label>
          <Input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Password Baru</Label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Konfirmasi Password Baru</Label>
          <Input
            type="password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <Button
          type="submit"
          disabled={savingPassword}
          className="bg-inkai-red hover:bg-inkai-red/90"
        >
          {savingPassword ? "Menyimpan..." : "Ubah Password"}
        </Button>
      </form>
    </div>
  );
}

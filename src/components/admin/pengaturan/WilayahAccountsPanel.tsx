"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CredentialsReveal,
  type CredentialPayload,
} from "@/components/admin/pengaturan/CredentialsReveal";
import { showError, showSuccess } from "@/lib/client-toast";
import { generateSimplePassword } from "@/lib/security/password";
import {
  KeyRound,
  Plus,
  Star,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

type AccountRow = {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  isPrimary: boolean;
  createdAt: string;
};

export function WilayahAccountsPanel({
  scope,
  wilayahId,
  wilayahName,
  compact = false,
}: {
  scope: "branch" | "dojo";
  wilayahId: string;
  wilayahName: string;
  compact?: boolean;
}) {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [credential, setCredential] = useState<CredentialPayload | null>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [setAsPrimary, setSetAsPrimary] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ scope, wilayahId });
      const res = await fetch(`/api/admin/pengaturan/wilayah-accounts?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal memuat akun");
        setAccounts([]);
      } else {
        setAccounts((data.data as AccountRow[]) ?? []);
      }
    } catch {
      showError("Gagal memuat akun");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [scope, wilayahId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd() {
    setAddOpen(true);
    setEmail("");
    setFullName("");
    setPhoneNumber("");
    const pw = generateSimplePassword(wilayahName);
    setPassword(pw);
    setPasswordConfirm(pw);
    setSetAsPrimary(accounts.length === 0);
  }

  function openReset(a: AccountRow) {
    setResetId(a.id);
    const pw = generateSimplePassword(a.fullName || a.email);
    setNewPassword(pw);
    setNewPasswordConfirm(pw);
  }

  async function createAccount() {
    setBusy(true);
    const res = await fetch("/api/admin/pengaturan/wilayah-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        wilayahId,
        email,
        fullName,
        phoneNumber,
        password,
        passwordConfirm,
        setAsPrimary,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      showSuccess(data.message || "Akun ditambahkan");
      setAddOpen(false);
      if (data.loginEmail && data.loginPassword) {
        setCredential({
          title: `Akun baru — ${wilayahName}`,
          loginEmail: data.loginEmail,
          loginPassword: data.loginPassword,
          hint: "Salin sekarang. Tidak disimpan di browser.",
        });
      }
      void load();
    } else {
      showError(data.error || "Gagal menambah akun");
    }
  }

  async function patch(
    userId: string,
    action: "activate" | "deactivate" | "set_primary" | "reset_password",
    extra?: Record<string, string>,
  ) {
    setBusy(true);
    const res = await fetch("/api/admin/pengaturan/wilayah-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        wilayahId,
        userId,
        action,
        ...extra,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      showSuccess(data.message || "Berhasil");
      if (action === "reset_password" && data.loginEmail && data.loginPassword) {
        setResetId(null);
        setCredential({
          title: `Password direset — ${wilayahName}`,
          loginEmail: data.loginEmail,
          loginPassword: data.loginPassword,
          hint: "Salin sekarang. Tidak disimpan di browser.",
        });
      }
      void load();
    } else {
      showError(data.error || "Gagal memproses");
    }
  }

  const label = scope === "branch" ? "cabang" : "ranting";
  const activeCount = accounts.filter((a) => a.isActive).length;

  return (
    <div className={compact ? "space-y-2" : "space-y-3 rounded-xl border p-3"}>
      <CredentialsReveal
        credential={credential}
        onDismiss={() => setCredential(null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-inkai-red" />
          <div>
            <p className="text-sm font-semibold">
              Akun admin {label}
              {!compact ? ` — ${wilayahName}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Memuat…"
                : `${accounts.length} akun · ${activeCount} aktif · multi-login diizinkan`}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="bg-inkai-red hover:bg-inkai-red/90"
          disabled={busy || loading}
          onClick={openAdd}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Tambah akun
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat daftar akun…</p>
      ) : accounts.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          Belum ada akun. Tambahkan email pengurus agar tidak saling pinjam
          password.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium truncate">
                    {a.fullName || "—"}
                  </span>
                  {a.isPrimary ? (
                    <Badge className="gap-1 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200">
                      <Star className="h-3 w-3" />
                      PIC utama
                    </Badge>
                  ) : null}
                  <Badge variant={a.isActive ? "default" : "outline"}>
                    {a.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>
                <p className="font-mono text-xs text-muted-foreground truncate">
                  {a.email}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {!a.isPrimary && a.isActive ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void patch(a.id, "set_primary")}
                    title="Jadikan PIC utama"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => openReset(a)}
                  title="Reset password"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void patch(a.id, a.isActive ? "deactivate" : "activate")
                  }
                  title={a.isActive ? "Nonaktifkan" : "Aktifkan"}
                >
                  {a.isActive ? (
                    <UserX className="h-3.5 w-3.5" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah akun — {wilayahName}</DialogTitle>
            <DialogDescription>
              Setiap pengurus punya email sendiri. Password ditampilkan sekali
              setelah dibuat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Email / username</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Nama lengkap</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Telepon (opsional)</Label>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Konfirmasi password</Label>
              <Input
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={setAsPrimary}
                onChange={(e) => setSetAsPrimary(e.target.checked)}
              />
              Jadikan PIC utama (kontak & notifikasi)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Batal
            </Button>
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={busy}
              onClick={() => void createAccount()}
            >
              Buat akun
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetId} onOpenChange={(o) => !o && setResetId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Password baru ditampilkan sekali setelah disimpan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Password baru</Label>
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Konfirmasi</Label>
              <Input
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetId(null)}>
              Batal
            </Button>
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={busy || !resetId}
              onClick={() =>
                resetId &&
                void patch(resetId, "reset_password", {
                  newPassword,
                  newPasswordConfirm,
                })
              }
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

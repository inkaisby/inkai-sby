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
  ArrowRightLeft,
  KeyRound,
  Mail,
  Plus,
  Star,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

const JABATAN_OPTIONS = [
  { value: "KETUA", label: "Ketua" },
  { value: "SEKRETARIS", label: "Sekretaris" },
  { value: "BENDAHARA", label: "Bendahara" },
  { value: "PENGURUS", label: "Pengurus" },
] as const;

type AccountRow = {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  isPrimary: boolean;
  isHomeDojo?: boolean;
  managedDojoIds?: string[];
  managedDojoCount?: number;
  jabatan: string | null;
  jabatanLabel: string | null;
  createdAt: string;
};

type SiblingDojo = { id: string; name: string };

type PrimaryContact = {
  userId: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  jabatan: string | null;
  jabatanLabel: string | null;
} | null;

type HandoverRow = {
  at: string;
  fromUserId: string | null;
  toUserId: string;
  note: string;
  byEmail: string;
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
  const [siblingDojos, setSiblingDojos] = useState<SiblingDojo[]>([]);
  const [primaryContact, setPrimaryContact] = useState<PrimaryContact>(null);
  const [handovers, setHandovers] = useState<HandoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [manageTarget, setManageTarget] = useState<AccountRow | null>(null);
  const [manageIds, setManageIds] = useState<string[]>([]);
  const [managePrimary, setManagePrimary] = useState("");
  const [resetTarget, setResetTarget] = useState<AccountRow | null>(null);
  const [emailTarget, setEmailTarget] = useState<AccountRow | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [deactivateTarget, setDeactivateTarget] = useState<AccountRow | null>(
    null,
  );
  const [handoverTarget, setHandoverTarget] = useState<AccountRow | null>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState("");
  const [handoverNote, setHandoverNote] = useState("");
  const [deactivatePrevious, setDeactivatePrevious] = useState(false);
  const [credential, setCredential] = useState<CredentialPayload | null>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [setAsPrimary, setSetAsPrimary] = useState(false);
  const [jabatan, setJabatan] = useState<string>("PENGURUS");
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
        setPrimaryContact(null);
        setHandovers([]);
      } else {
        setAccounts((data.data as AccountRow[]) ?? []);
        setPrimaryContact((data.primaryContact as PrimaryContact) ?? null);
        setHandovers((data.handovers as HandoverRow[]) ?? []);
        setSiblingDojos((data.siblingDojos as SiblingDojo[]) ?? []);
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
    setJabatan(accounts.length === 0 ? "KETUA" : "PENGURUS");
  }

  function openReset(a: AccountRow) {
    setResetTarget(a);
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
        jabatan,
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
          hint: "Salin, kirim ke pengurus, lalu centang checklist.",
        });
      }
      void load();
    } else {
      showError(data.error || "Gagal menambah akun");
    }
  }

  async function patch(
    userId: string,
    action:
      | "activate"
      | "deactivate"
      | "set_primary"
      | "reset_password"
      | "set_jabatan"
      | "handover"
      | "change_email"
      | "set_managed_dojos"
      | "unlink_dojo",
    extra?: Record<string, string | boolean | null | string[]>,
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
        setResetTarget(null);
        setCredential({
          title: `Password direset — ${wilayahName}`,
          loginEmail: data.loginEmail,
          loginPassword: data.loginPassword,
          hint: "Password lama hangus. Salin & kirim ke pemilik akun.",
        });
      }
      if (action === "change_email") {
        setEmailTarget(null);
        setNewEmail("");
      }
      if (action === "deactivate") {
        setDeactivateTarget(null);
        setDeactivateConfirm("");
      }
      if (action === "handover") {
        setHandoverTarget(null);
        setHandoverNote("");
        setDeactivatePrevious(false);
      }
      if (action === "set_managed_dojos" || action === "unlink_dojo") {
        setManageTarget(null);
      }
      void load();
    } else {
      showError(data.error || "Gagal memproses");
    }
  }

  async function linkExistingAccount() {
    if (!linkEmail.trim()) {
      showError("Email wajib diisi");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/pengaturan/wilayah-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        wilayahId,
        action: "link_existing",
        linkEmail: linkEmail.trim().toLowerCase(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      showSuccess(data.message || "Akun ditautkan");
      setLinkOpen(false);
      setLinkEmail("");
      void load();
    } else {
      showError(data.error || "Gagal menautkan akun");
    }
  }

  function openManageDojos(a: AccountRow) {
    const ids =
      a.managedDojoIds && a.managedDojoIds.length > 0
        ? [...a.managedDojoIds]
        : [wilayahId];
    if (!ids.includes(wilayahId)) ids.push(wilayahId);
    setManageIds(ids);
    setManagePrimary(ids.includes(wilayahId) ? wilayahId : ids[0]);
    setManageTarget(a);
  }

  function toggleManageDojo(id: string) {
    setManageIds((prev) => {
      if (id === wilayahId) return prev; // ranting sheet wajib
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        if (managePrimary === id) setManagePrimary(wilayahId);
        return next.length ? next : [wilayahId];
      }
      return [...prev, id];
    });
  }

  const label = scope === "branch" ? "cabang" : "ranting";
  const activeCount = accounts.filter((a) => a.isActive).length;
  const showMultiDojo = scope === "dojo" && siblingDojos.length > 1;

  return (
    <div className={compact ? "space-y-2" : "space-y-3 rounded-xl border p-3"}>
      <CredentialsReveal
        credential={credential}
        onDismiss={() => setCredential(null)}
      />

      {primaryContact ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Kontak resmi (PIC)
          </p>
          <p className="text-muted-foreground">
            {primaryContact.fullName || "—"}
            {primaryContact.jabatanLabel
              ? ` · ${primaryContact.jabatanLabel}`
              : ""}
            {" · "}
            <span className="font-mono text-xs">{primaryContact.email}</span>
            {primaryContact.phoneNumber
              ? ` · ${primaryContact.phoneNumber}`
              : ""}
          </p>
        </div>
      ) : null}

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
        <div className="flex flex-wrap gap-1">
          {showMultiDojo ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || loading}
              onClick={() => {
                setLinkOpen(true);
                setLinkEmail("");
              }}
            >
              Tautkan akun
            </Button>
          ) : null}
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
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat daftar akun…</p>
      ) : accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed px-3 py-6 text-center">
          <p className="text-sm font-medium">Belum ada akun pengurus</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tambahkan email sendiri per pengurus — jangan saling pinjam
            password.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-3 bg-inkai-red hover:bg-inkai-red/90"
            onClick={openAdd}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Tambah akun pertama
          </Button>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium truncate">
                    {a.fullName || "—"}
                  </span>
                  {a.isPrimary ? (
                    <Badge className="gap-1 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200">
                      <Star className="h-3 w-3" />
                      PIC
                    </Badge>
                  ) : null}
                  {(a.managedDojoCount ?? 0) > 1 ? (
                    <Badge variant="outline" className="border-inkai-red/40 text-inkai-red">
                      +{(a.managedDojoCount ?? 1) - 1} ranting
                    </Badge>
                  ) : null}
                  {a.isHomeDojo === false ? (
                    <Badge variant="secondary">Pengelola</Badge>
                  ) : null}
                  {a.jabatanLabel ? (
                    <Badge variant="secondary">{a.jabatanLabel}</Badge>
                  ) : null}
                  <Badge variant={a.isActive ? "default" : "outline"}>
                    {a.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>
                <p className="font-mono text-xs text-muted-foreground truncate">
                  {a.email}
                </p>
                <select
                  className="h-7 max-w-[11rem] rounded border bg-background px-1.5 text-xs"
                  value={a.jabatan || ""}
                  disabled={busy}
                  onChange={(e) =>
                    void patch(a.id, "set_jabatan", {
                      jabatan: e.target.value || null,
                    })
                  }
                >
                  <option value="">Tanpa jabatan</option>
                  {JABATAN_OPTIONS.map((j) => (
                    <option key={j.value} value={j.value}>
                      {j.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-1">
                {showMultiDojo ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => openManageDojos(a)}
                    title="Ranting yang dikelola"
                  >
                    Multi
                  </Button>
                ) : null}
                {!a.isPrimary && a.isActive ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setHandoverTarget(a);
                      setHandoverNote("");
                      setDeactivatePrevious(false);
                    }}
                    title="Serah terima PIC"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setEmailTarget(a);
                    setNewEmail(a.email);
                  }}
                  title="Ubah email"
                >
                  <Mail className="h-3.5 w-3.5" />
                </Button>
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
                  onClick={() => {
                    if (a.isActive) {
                      setDeactivateTarget(a);
                      setDeactivateConfirm("");
                    } else {
                      void patch(a.id, "activate");
                    }
                  }}
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

      {handovers.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Riwayat serah terima PIC
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {handovers.slice(0, 5).map((h, i) => (
              <li key={`${h.at}-${i}`} className="rounded border px-2 py-1.5">
                {new Date(h.at).toLocaleString("id-ID")} · ke{" "}
                {accounts.find((a) => a.id === h.toUserId)?.email || h.toUserId}
                {h.note ? ` — ${h.note}` : ""}
                <span className="block opacity-70">oleh {h.byEmail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah akun — {wilayahName}</DialogTitle>
            <DialogDescription>
              Satu pintu untuk akun wilayah. Password ditampilkan sekali setelah
              dibuat.
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
              <Label>Jabatan</Label>
              <select
                className="h-8 w-full rounded-lg border px-2 text-sm"
                value={jabatan}
                onChange={(e) => setJabatan(e.target.value)}
              >
                {JABATAN_OPTIONS.map((j) => (
                  <option key={j.value} value={j.value}>
                    {j.label}
                  </option>
                ))}
              </select>
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
              Jadikan PIC utama (kontak resmi & notifikasi prioritas)
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

      <Dialog
        open={!!emailTarget}
        onOpenChange={(o) => {
          if (!o) {
            setEmailTarget(null);
            setNewEmail("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah email login</DialogTitle>
            <DialogDescription>
              Email saat ini:{" "}
              <span className="font-mono">{emailTarget?.email}</span>
              {scope === "dojo"
                ? ". Cabang dapat mengganti username login ranting."
                : "."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Email baru</Label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEmailTarget(null);
                setNewEmail("");
              }}
            >
              Batal
            </Button>
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={busy || !emailTarget || !newEmail.trim()}
              onClick={() =>
                emailTarget &&
                void patch(emailTarget.id, "change_email", {
                  newEmail: newEmail.trim().toLowerCase(),
                })
              }
            >
              Simpan email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resetTarget}
        onOpenChange={(o) => !o && setResetTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Password lama untuk{" "}
              <span className="font-mono">{resetTarget?.email}</span> akan
              hangus segera setelah disimpan.
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
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Batal
            </Button>
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={busy || !resetTarget}
              onClick={() =>
                resetTarget &&
                void patch(resetTarget.id, "reset_password", {
                  newPassword,
                  newPasswordConfirm,
                })
              }
            >
              Reset &amp; hanguskan password lama
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deactivateTarget}
        onOpenChange={(o) => {
          if (!o) {
            setDeactivateTarget(null);
            setDeactivateConfirm("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nonaktifkan akun</DialogTitle>
            <DialogDescription>
              Ketik email akun untuk konfirmasi:{" "}
              <span className="font-mono">{deactivateTarget?.email}</span>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deactivateConfirm}
            onChange={(e) => setDeactivateConfirm(e.target.value)}
            placeholder="email akun"
            autoComplete="off"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeactivateTarget(null);
                setDeactivateConfirm("");
              }}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={
                busy ||
                !deactivateTarget ||
                deactivateConfirm.trim().toLowerCase() !==
                  deactivateTarget.email.toLowerCase()
              }
              onClick={() =>
                deactivateTarget &&
                void patch(deactivateTarget.id, "deactivate")
              }
            >
              Nonaktifkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!handoverTarget}
        onOpenChange={(o) => {
          if (!o) {
            setHandoverTarget(null);
            setHandoverNote("");
            setDeactivatePrevious(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Serah terima PIC</DialogTitle>
            <DialogDescription>
              Pindahkan PIC utama ke{" "}
              <strong>{handoverTarget?.fullName || handoverTarget?.email}</strong>
              . Notifikasi prioritas & kontak resmi mengikuti PIC baru.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Catatan periode / alasan (opsional)</Label>
              <Input
                value={handoverNote}
                onChange={(e) => setHandoverNote(e.target.value)}
                placeholder="Mis. periode 2026–2027"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={deactivatePrevious}
                onChange={(e) => setDeactivatePrevious(e.target.checked)}
              />
              Nonaktifkan PIC lama setelah serah terima
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHandoverTarget(null)}
            >
              Batal
            </Button>
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={busy || !handoverTarget}
              onClick={() =>
                handoverTarget &&
                void patch(handoverTarget.id, "handover", {
                  note: handoverNote,
                  deactivatePrevious,
                })
              }
            >
              Serahkan PIC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={linkOpen}
        onOpenChange={(o) => {
          if (!o) {
            setLinkOpen(false);
            setLinkEmail("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tautkan akun existing</DialogTitle>
            <DialogDescription>
              Tambahkan akses ke ranting <strong>{wilayahName}</strong> untuk
              akun ADMIN_DOJO yang sudah ada (mis. ketua yang membawahi
              beberapa ranting).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Email akun</Label>
            <Input
              type="email"
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              placeholder="gading@gmail.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>
              Batal
            </Button>
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={busy || !linkEmail.trim()}
              onClick={() => void linkExistingAccount()}
            >
              Tautkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!manageTarget}
        onOpenChange={(o) => {
          if (!o) setManageTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ranting yang dikelola</DialogTitle>
            <DialogDescription>
              {manageTarget?.email} — pilih ranting se-cabang. Ranting{" "}
              <strong>{wilayahName}</strong> wajib tetap tercentang dari sheet
              ini (cabut lewat tombol Cabut).
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-2">
            {siblingDojos.map((d) => {
              const checked = manageIds.includes(d.id);
              const isSheet = d.id === wilayahId;
              return (
                <label
                  key={d.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isSheet}
                    onChange={() => toggleManageDojo(d.id)}
                  />
                  <span className="flex-1">{d.name}</span>
                  {checked ? (
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <input
                        type="radio"
                        name="primary-dojo"
                        checked={managePrimary === d.id}
                        onChange={() => setManagePrimary(d.id)}
                      />
                      Utama
                    </label>
                  ) : null}
                </label>
              );
            })}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {manageTarget && manageTarget.isHomeDojo === false ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                disabled={busy}
                onClick={() =>
                  manageTarget &&
                  void patch(manageTarget.id, "unlink_dojo")
                }
              >
                Cabut dari ranting ini
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setManageTarget(null)}>
              Batal
            </Button>
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={busy || !manageTarget || manageIds.length === 0}
              onClick={() =>
                manageTarget &&
                void patch(manageTarget.id, "set_managed_dojos", {
                  managedDojoIds: manageIds,
                  primaryDojoId: managePrimary || wilayahId,
                })
              }
            >
              Simpan cakupan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

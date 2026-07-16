"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { showError, showSuccess } from "@/lib/client-toast";
import {
  Archive,
  Check,
  Copy,
  KeyRound,
  Pencil,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { generateSimplePassword } from "@/lib/security/password";

export type RantingRow = {
  id: string;
  name: string;
  headName?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  schedule?: string | null;
  kecamatan?: string | null;
  tempatLatihan?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  branchId?: string;
  branchName?: string;
  memberCount?: number;
  adminEmail?: string | null;
  adminIsActive?: boolean | null;
};

type Mode = "create" | "edit" | "login" | "reset" | null;

type RevealedCredential = {
  loginEmail: string;
  loginPassword: string;
};

const CREDENTIAL_STORAGE_KEY = "inkai-ranting-credentials-v1";

function loadStoredCredentials(): Record<string, RevealedCredential> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CREDENTIAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, RevealedCredential>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function persistCredentials(map: Record<string, RevealedCredential>) {
  try {
    localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

const emptyForm = {
  name: "",
  branchId: "",
  headName: "",
  address: "",
  kecamatan: "",
  tempatLatihan: "",
  phoneNumber: "",
  schedule: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountName: "",
  adminEmail: "",
  adminPassword: "",
  adminPasswordConfirm: "",
};

export function RantingSettingsManager({
  branches,
  dojos,
  lockedBranchId,
}: {
  branches: { id: string; name: string }[];
  dojos: RantingRow[];
  lockedBranchId?: string | null;
}) {
  const router = useRouter();
  const defaultBranchId = lockedBranchId || branches[0]?.id || "";
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetName, setTargetName] = useState("");
  const [form, setForm] = useState({ ...emptyForm, branchId: defaultBranchId });
  const [detailDojoId, setDetailDojoId] = useState<string | null>(null);
  const [revealedByDojoId, setRevealedByDojoId] = useState<
    Record<string, RevealedCredential>
  >({});
  const [pendingReveal, setPendingReveal] = useState<RevealedCredential | null>(
    null,
  );
  const [copiedCredential, setCopiedCredential] = useState(false);

  useEffect(() => {
    setRevealedByDojoId(loadStoredCredentials());
  }, []);

  const targetDojo = useMemo(
    () => dojos.find((d) => d.id === targetId) ?? null,
    [dojos, targetId],
  );

  const detailDojo = useMemo(
    () => dojos.find((d) => d.id === detailDojoId) ?? null,
    [dojos, detailDojoId],
  );

  const detailCredential = useMemo(() => {
    if (!detailDojo?.adminEmail) return null;
    const stored = revealedByDojoId[detailDojo.id];
    return {
      loginEmail: stored?.loginEmail || detailDojo.adminEmail,
      loginPassword:
        stored?.loginPassword || generateSimplePassword(detailDojo.name),
    };
  }, [detailDojo, revealedByDojoId]);

  useEffect(() => {
    if (!pendingReveal) return;
    const match = dojos.find(
      (d) =>
        d.adminEmail?.toLowerCase() === pendingReveal.loginEmail.toLowerCase(),
    );
    if (!match) return;
    saveCredential(match.id, pendingReveal.loginEmail, pendingReveal.loginPassword);
    setDetailDojoId(match.id);
    setCopiedCredential(false);
    setPendingReveal(null);
  }, [dojos, pendingReveal]);

  function saveCredential(
    dojoId: string,
    loginEmail: string,
    loginPassword: string,
  ) {
    setRevealedByDojoId((prev) => {
      const next = {
        ...prev,
        [dojoId]: { loginEmail, loginPassword },
      };
      persistCredentials(next);
      return next;
    });
  }

  function revealCredential(
    dojoId: string,
    loginEmail: string,
    loginPassword: string,
  ) {
    saveCredential(dojoId, loginEmail, loginPassword);
    setDetailDojoId(dojoId);
    setCopiedCredential(false);
  }

  async function copyDetailCredential() {
    if (!detailCredential) return;
    const text = `Username: ${detailCredential.loginEmail}\nPassword: ${detailCredential.loginPassword}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCredential(true);
      showSuccess("Kredensial disalin ke clipboard");
      setTimeout(() => setCopiedCredential(false), 2000);
    } catch {
      showSuccess("Salin manual dari kotak di bawah");
    }
  }

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function fillGeneratedPassword() {
    const seed = targetName || form.name || "Inkai";
    const password = generateSimplePassword(seed);
    setForm((prev) => ({
      ...prev,
      adminPassword: password,
      adminPasswordConfirm: password,
    }));
    showSuccess(`Password diisi: ${password}`);
  }

  function resetPanel() {
    setMode(null);
    setTargetId(null);
    setTargetName("");
    setForm({ ...emptyForm, branchId: defaultBranchId });
  }

  function openCreate() {
    setMode("create");
    setTargetId(null);
    setTargetName("");
    setForm({ ...emptyForm, branchId: defaultBranchId });
  }

  function openEdit(d: RantingRow) {
    setMode("edit");
    setTargetId(d.id);
    setTargetName(d.name);
    setForm({
      name: d.name,
      branchId: d.branchId || defaultBranchId,
      headName: d.headName || "",
      address: d.address || "",
      kecamatan: d.kecamatan || "",
      tempatLatihan: d.tempatLatihan || "",
      phoneNumber: d.phoneNumber || "",
      schedule: d.schedule || "",
      bankName: d.bankName || "",
      bankAccountNumber: d.bankAccountNumber || "",
      bankAccountName: d.bankAccountName || "",
      adminEmail: "",
      adminPassword: "",
      adminPasswordConfirm: "",
    });
  }

  function openLogin(d: RantingRow) {
    setMode("login");
    setTargetId(d.id);
    setTargetName(d.name);
    setForm({
      ...emptyForm,
      branchId: d.branchId || defaultBranchId,
      adminEmail: d.adminEmail || "",
      adminPassword: "",
      adminPasswordConfirm: "",
    });
  }

  function openReset(d: RantingRow) {
    setMode("reset");
    setTargetId(d.id);
    setTargetName(d.name);
    setForm({
      ...emptyForm,
      branchId: d.branchId || defaultBranchId,
      adminEmail: d.adminEmail || "",
      adminPassword: "",
      adminPasswordConfirm: "",
    });
  }

  async function archiveDojo(d: RantingRow) {
    if (
      !confirm(
        `Arsipkan ranting "${d.name}"? Akun admin ranting akan dinonaktifkan.`,
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/pengaturan/ranting", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Ranting diarsipkan");
      router.refresh();
    } else {
      showError(data.error || "Gagal mengarsipkan");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mode || loading) return;

    if (
      (mode === "create" || mode === "login" || mode === "reset") &&
      form.adminPassword !== form.adminPasswordConfirm
    ) {
      showError("Konfirmasi password tidak cocok");
      return;
    }

    setLoading(true);

    if (mode === "login" || mode === "reset") {
      if (!targetId) {
        setLoading(false);
        return;
      }
      const endpoint =
        mode === "reset"
          ? "/api/admin/pengaturan/ranting/reset-password"
          : "/api/admin/pengaturan/ranting/login";
      const body =
        mode === "reset"
          ? {
              dojoId: targetId,
              adminPassword: form.adminPassword,
              adminPasswordConfirm: form.adminPasswordConfirm,
            }
          : {
              dojoId: targetId,
              adminEmail: form.adminEmail,
              adminPassword: form.adminPassword,
              adminPasswordConfirm: form.adminPasswordConfirm,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (res.ok) {
        showSuccess(data.message || "Berhasil");
        if (data.loginEmail && data.loginPassword && targetId) {
          revealCredential(targetId, data.loginEmail, data.loginPassword);
        }
        resetPanel();
        router.refresh();
      } else {
        showError(data.error || "Gagal menyimpan akun login");
      }
      return;
    }

    const payload =
      mode === "edit"
        ? {
            id: targetId,
            name: form.name,
            headName: form.headName,
            address: form.address,
            kecamatan: form.kecamatan,
            tempatLatihan: form.tempatLatihan,
            phoneNumber: form.phoneNumber,
            schedule: form.schedule,
            bankName: form.bankName,
            bankAccountNumber: form.bankAccountNumber,
            bankAccountName: form.bankAccountName,
          }
        : {
            ...form,
            branchId: lockedBranchId || form.branchId,
          };

    const res = await fetch("/api/admin/pengaturan/ranting", {
      method: mode === "edit" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (res.ok) {
      showSuccess(data.message || "Berhasil disimpan");
      if (data.loginEmail && data.loginPassword) {
        const newId =
          (typeof data.data?.id === "string" && data.data.id) ||
          (typeof data.data?.dojoId === "string" && data.data.dojoId) ||
          null;
        if (newId) {
          revealCredential(newId, data.loginEmail, data.loginPassword);
        } else {
          setPendingReveal({
            loginEmail: data.loginEmail,
            loginPassword: data.loginPassword,
          });
        }
      }
      resetPanel();
      router.refresh();
    } else {
      showError(data.error || "Gagal menyimpan ranting");
    }
  }

  const panelTitle =
    mode === "create"
      ? "Tambah Ranting + Akun Login"
      : mode === "edit"
        ? `Ubah Data: ${targetName || targetDojo?.name || ""}`
        : mode === "login"
          ? `Akun Login: ${targetName || targetDojo?.name || ""}`
          : mode === "reset"
            ? `Reset Password: ${targetName || targetDojo?.name || ""}`
            : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Buat username &amp; password agar pengurus ranting bisa login. Klik
          baris untuk melihat kredensial kapan saja.
        </p>
        <Button
          type="button"
          onClick={openCreate}
          disabled={loading}
          className="bg-inkai-red hover:bg-inkai-red/90"
        >
          Tambah Ranting
        </Button>
      </div>

      {mode && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-xl border border-inkai-red/20 bg-inkai-red/5 p-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <h3 className="font-semibold">{panelTitle}</h3>
            {(mode === "login" || mode === "reset") && (
              <p className="text-sm text-muted-foreground">
                Password minimal 8 karakter, wajib huruf dan angka. Setelah
                simpan, salin kredensial segera.
              </p>
            )}
          </div>

          {mode !== "login" && mode !== "reset" && (
            <>
              {!lockedBranchId && mode === "create" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Cabang</Label>
                  <select
                    value={form.branchId}
                    onChange={(e) => setField("branchId", e.target.value)}
                    className="h-8 w-full rounded-lg border px-2 text-sm"
                    required
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {lockedBranchId && mode === "create" && (
                <div className="sm:col-span-2 text-sm text-muted-foreground">
                  Cabang:{" "}
                  <span className="font-medium text-foreground">
                    {branches.find((b) => b.id === lockedBranchId)?.name ||
                      "Cabang Anda"}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Nama Ranting</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>PIC / Ketua</Label>
                <Input
                  value={form.headName}
                  onChange={(e) => setField("headName", e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Alamat</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kecamatan</Label>
                <Input
                  value={form.kecamatan}
                  onChange={(e) => setField("kecamatan", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tempat Latihan</Label>
                <Input
                  value={form.tempatLatihan}
                  onChange={(e) => setField("tempatLatihan", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telepon</Label>
                <Input
                  value={form.phoneNumber}
                  onChange={(e) => setField("phoneNumber", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Jadwal</Label>
                <Input
                  value={form.schedule}
                  onChange={(e) => setField("schedule", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bank</Label>
                <Input
                  value={form.bankName}
                  onChange={(e) => setField("bankName", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>No. Rekening</Label>
                <Input
                  value={form.bankAccountNumber}
                  onChange={(e) => setField("bankAccountNumber", e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Atas Nama Rekening</Label>
                <Input
                  value={form.bankAccountName}
                  onChange={(e) => setField("bankAccountName", e.target.value)}
                />
              </div>
            </>
          )}

          {(mode === "create" || mode === "login" || mode === "reset") && (
            <>
              <div className="space-y-1.5 sm:col-span-2 border-t pt-3">
                <p className="text-sm font-semibold">
                  {mode === "reset"
                    ? "Password Baru"
                    : "Akun Login Admin Ranting"}
                </p>
              </div>
              {mode !== "reset" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Username (Email)</Label>
                  <Input
                    type="email"
                    value={form.adminEmail}
                    onChange={(e) => setField("adminEmail", e.target.value)}
                    required
                    placeholder="admin.ranting@contoh.com"
                    autoComplete="off"
                  />
                </div>
              )}
              {mode === "reset" && (
                <div className="sm:col-span-2 text-sm text-muted-foreground">
                  Username tetap:{" "}
                  <span className="font-mono text-foreground">
                    {form.adminEmail || "—"}
                  </span>
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center gap-2">
                  <Label>Password</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={fillGeneratedPassword}
                    disabled={loading}
                  >
                    <Sparkles className="size-3.5" />
                    Generate Password
                  </Button>
                </div>
                <Input
                  type="text"
                  value={form.adminPassword}
                  onChange={(e) => setField("adminPassword", e.target.value)}
                  required
                  placeholder="Min. 8 karakter, huruf + angka"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Konfirmasi Password</Label>
                <Input
                  type="text"
                  value={form.adminPasswordConfirm}
                  onChange={(e) =>
                    setField("adminPasswordConfirm", e.target.value)
                  }
                  required
                  placeholder="Ulangi password"
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <Button
              type="submit"
              disabled={loading}
              className="bg-inkai-red hover:bg-inkai-red/90"
            >
              {loading
                ? "Menyimpan..."
                : mode === "login"
                  ? "Simpan Akun Login"
                  : mode === "reset"
                    ? "Reset Password"
                    : mode === "edit"
                      ? "Simpan Data"
                      : "Buat Ranting & Akun"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetPanel}
              disabled={loading}
            >
              Batal
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Ranting</TableHead>
              <TableHead className="hidden sm:table-cell">Cabang</TableHead>
              <TableHead className="hidden md:table-cell">PIC</TableHead>
              <TableHead className="hidden lg:table-cell">Kecamatan</TableHead>
              <TableHead>Username Login</TableHead>
              <TableHead className="hidden md:table-cell">Anggota</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dojos.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  Tidak ada data yang cocok dengan pencarian.
                </TableCell>
              </TableRow>
            ) : (
              dojos.map((d) => (
                <TableRow
                  key={d.id}
                  className="cursor-pointer"
                  onClick={() => setDetailDojoId(d.id)}
                >
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {d.branchName || "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {d.headName || "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {d.kecamatan || "—"}
                  </TableCell>
                  <TableCell>
                    {d.adminEmail ? (
                      <div className="space-y-1">
                        <span className="font-mono text-xs">{d.adminEmail}</span>
                        <Badge
                          variant={
                            d.adminIsActive === false ? "outline" : "secondary"
                          }
                          className="ml-0 block w-fit"
                        >
                          {d.adminIsActive === false
                            ? "Nonaktif"
                            : "Bisa login"}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-sm text-amber-700 dark:text-amber-400">
                        Belum ada akun
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="secondary">{d.memberCount ?? 0}</Badge>
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => openLogin(d)}
                        className="gap-1"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        {d.adminEmail ? "Ganti Login" : "Buat Login"}
                      </Button>
                      {d.adminEmail ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() => openReset(d)}
                          className="gap-1"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reset PW
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={loading}
                        onClick={() => openEdit(d)}
                        className="gap-1"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Data
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={loading}
                        onClick={() => archiveDojo(d)}
                        className="gap-1 text-destructive"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Arsip
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet
        open={Boolean(detailDojo)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailDojoId(null);
            setCopiedCredential(false);
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {detailDojo ? (
            <>
              <SheetHeader>
                <SheetTitle>{detailDojo.name}</SheetTitle>
                <SheetDescription>
                  Detail ranting &amp; akun login
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4 pb-6">
                {detailCredential ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <div className="mb-2">
                      <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                        Kredensial {detailDojo.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Username dan password akun login ranting — bisa dilihat
                        dan disalin kapan saja.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border bg-background px-3 py-2">
                        <p className="text-xs text-muted-foreground">Username</p>
                        <p className="font-mono text-sm break-all">
                          {detailCredential.loginEmail}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-background px-3 py-2">
                        <p className="text-xs text-muted-foreground">Password</p>
                        <p className="font-mono text-sm">
                          {detailCredential.loginPassword}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={copyDetailCredential}
                        className="gap-1.5"
                      >
                        {copiedCredential ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {copiedCredential
                          ? "Tersalin"
                          : "Salin Username + Password"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                      Kredensial {detailDojo.name}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Belum ada akun login untuk ranting ini.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 gap-1.5"
                      onClick={() => {
                        setDetailDojoId(null);
                        openLogin(detailDojo);
                      }}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Buat Login
                    </Button>
                  </div>
                )}

                <div className="grid gap-3 text-sm">
                  <DetailField label="Cabang" value={detailDojo.branchName} />
                  <DetailField label="PIC" value={detailDojo.headName} />
                  <DetailField
                    label="Kecamatan"
                    value={detailDojo.kecamatan}
                  />
                  <DetailField
                    label="Tempat Latihan"
                    value={detailDojo.tempatLatihan}
                  />
                  <DetailField label="Alamat" value={detailDojo.address} />
                  <DetailField label="Telepon" value={detailDojo.phoneNumber} />
                  <DetailField label="Jadwal" value={detailDojo.schedule} />
                  <DetailField
                    label="Anggota"
                    value={String(detailDojo.memberCount ?? 0)}
                  />
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-foreground">{value?.trim() || "—"}</p>
    </div>
  );
}

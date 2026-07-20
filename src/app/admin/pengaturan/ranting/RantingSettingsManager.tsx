"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { generateSimplePassword } from "@/lib/security/password";
import {
  CredentialsReveal,
  type CredentialPayload,
} from "@/components/admin/pengaturan/CredentialsReveal";
import { Archive, KeyRound, Pencil, Star, Users } from "lucide-react";
import { ManagedDojoMatrix } from "@/components/admin/pengaturan/ManagedDojoMatrix";
import { WilayahAccountsPanel } from "@/components/admin/pengaturan/WilayahAccountsPanel";

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
  adminCount?: number;
  adminIsPrimary?: boolean;
};

type Mode = "create" | "edit" | null;

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
  selfManagedOnly = false,
  archived = [],
  adminsUnavailable = false,
}: {
  branches: { id: string; name: string }[];
  dojos: RantingRow[];
  lockedBranchId?: string | null;
  /** Admin ranting: hanya ubah data sendiri, tanpa tambah/arsip/login. */
  selfManagedOnly?: boolean;
  archived?: RantingRow[];
  /** Username/admin emails gagal dimuat — jangan tampilkan "Belum ada akun". */
  adminsUnavailable?: boolean;
}) {
  const router = useRouter();
  const defaultBranchId = lockedBranchId || branches[0]?.id || "";
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetName, setTargetName] = useState("");
  const [form, setForm] = useState({ ...emptyForm, branchId: defaultBranchId });
  const [detailDojoId, setDetailDojoId] = useState<string | null>(null);
  const [credential, setCredential] = useState<CredentialPayload | null>(null);
  /** Cabang/pengprov: boleh ubah email & password login ranting di form data. */
  const canEditCredentials = !selfManagedOnly;
  const autoOpenedRef = useRef(false);

  // Admin ranting: buka form Ubah Data otomatis (satu atau multi ranting).
  useEffect(() => {
    if (!selfManagedOnly || dojos.length === 0 || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    openEdit(dojos[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-open once on mount
  }, [selfManagedOnly, dojos]);

  const targetDojo = useMemo(
    () => dojos.find((d) => d.id === targetId) ?? null,
    [dojos, targetId],
  );

  const detailDojo = useMemo(
    () => dojos.find((d) => d.id === detailDojoId) ?? null,
    [dojos, detailDojoId],
  );

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
      adminEmail: d.adminEmail || "",
      adminPassword: "",
      adminPasswordConfirm: "",
    });
  }

  function fillGeneratedPassword() {
    const pw = generateSimplePassword(form.name || form.adminEmail || "Ranting");
    setForm((prev) => ({
      ...prev,
      adminPassword: pw,
      adminPasswordConfirm: pw,
    }));
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

  async function restoreDojo(d: RantingRow) {
    if (!confirm(`Pulihkan ranting "${d.name}" dari arsip?`)) return;
    setLoading(true);
    const res = await fetch("/api/admin/pengaturan/ranting", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id, restore: true }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Ranting dipulihkan");
      router.refresh();
    } else {
      showError(data.error || "Gagal memulihkan");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mode || loading) return;

    const email = form.adminEmail.trim().toLowerCase();
    const password = form.adminPassword;
    const passwordConfirm = form.adminPasswordConfirm;

    if (canEditCredentials) {
      if (password || passwordConfirm) {
        if (password.length < 8) {
          showError("Password minimal 8 karakter");
          return;
        }
        if (password !== passwordConfirm) {
          showError("Konfirmasi password tidak cocok");
          return;
        }
        if (!email) {
          showError("Isi email login jika mengatur password");
          return;
        }
      }
    }

    setLoading(true);

    const credentials =
      canEditCredentials && email
        ? {
            adminEmail: email,
            ...(password ? { adminPassword: password } : {}),
          }
        : {};

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
            ...credentials,
          }
        : {
            name: form.name,
            branchId: lockedBranchId || form.branchId,
            headName: form.headName,
            address: form.address,
            kecamatan: form.kecamatan,
            tempatLatihan: form.tempatLatihan,
            phoneNumber: form.phoneNumber,
            schedule: form.schedule,
            bankName: form.bankName,
            bankAccountNumber: form.bankAccountNumber,
            bankAccountName: form.bankAccountName,
            ...credentials,
            ...(canEditCredentials && password
              ? { adminPasswordConfirm: passwordConfirm }
              : {}),
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
      if (
        typeof data.loginEmail === "string" &&
        typeof data.loginPassword === "string"
      ) {
        setCredential({
          title: `Login ranting — ${form.name || targetName}`,
          loginEmail: data.loginEmail,
          loginPassword: data.loginPassword,
          hint: "Salin dan kirim ke pengurus ranting. Password tidak ditampilkan lagi setelah ditutup.",
        });
      } else if (canEditCredentials && email && password) {
        setCredential({
          title: `Login ranting — ${form.name || targetName}`,
          loginEmail: email,
          loginPassword: password,
          hint: "Salin dan kirim ke pengurus ranting. Password tidak ditampilkan lagi setelah ditutup.",
        });
      }
      const newId =
        mode === "create"
          ? (typeof data.data?.id === "string" && data.data.id) ||
            (typeof data.data?.dojoId === "string" && data.data.dojoId) ||
            null
          : null;
      if (selfManagedOnly && mode === "edit" && targetId) {
        setTargetName(form.name);
        setForm((prev) => ({
          ...prev,
          adminPassword: "",
          adminPasswordConfirm: "",
        }));
      } else {
        resetPanel();
        if (newId && !email) {
          setDetailDojoId(newId);
        }
      }
      router.refresh();
    } else {
      showError(data.error || "Gagal menyimpan ranting");
    }
  }

  const panelTitle =
    mode === "create"
      ? "Tambah Ranting"
      : mode === "edit"
        ? `Ubah Data: ${targetName || targetDojo?.name || ""}`
        : "";

  return (
    <div className="space-y-4">
      <CredentialsReveal
        credential={credential}
        onDismiss={() => setCredential(null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {selfManagedOnly
            ? "Klik Ubah untuk memperbarui data ranting Anda. Email & password di bagian Akun Saya."
            : "Data ranting + email/password login PIC. Multi-akun lewat tombol Akun (jabatan, serah terima)."}
        </p>
        {!selfManagedOnly && (
          <Button
            type="button"
            onClick={openCreate}
            disabled={loading}
            className="bg-inkai-red hover:bg-inkai-red/90"
          >
            Tambah Ranting
          </Button>
        )}
      </div>

      {!selfManagedOnly &&
      (lockedBranchId || branches.length === 1) &&
      (lockedBranchId || branches[0]?.id) ? (
        <ManagedDojoMatrix
          branchId={lockedBranchId || branches[0]!.id}
        />
      ) : null}

      {mode && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-xl border border-inkai-red/20 bg-inkai-red/5 p-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <h3 className="font-semibold">{panelTitle}</h3>
            {mode === "create" ? (
              <p className="text-sm text-muted-foreground">
                Setelah ranting dibuat, panel akun terbuka otomatis untuk
                menambah pengurus.
              </p>
            ) : null}
          </div>

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
            <Label>PIC / Ketua (nama tampilan)</Label>
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
              placeholder="08… atau dua nomor dipisah /"
              maxLength={60}
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

          {canEditCredentials ? (
            <>
              <div className="sm:col-span-2 border-t border-inkai-red/15 pt-3">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                  <KeyRound className="h-4 w-4" />
                  Login admin ranting (PIC)
                </h4>
                <p className="text-xs text-muted-foreground">
                  {mode === "edit"
                    ? "Ubah email atau set password baru untuk akun PIC. Kosongkan password jika hanya mengubah data/email."
                    : "Opsional: buat akun login sekaligus. Bisa juga ditambah nanti lewat tombol Akun."}
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ranting-admin-email">Email (username login)</Label>
                <Input
                  id="ranting-admin-email"
                  type="email"
                  autoComplete="off"
                  placeholder="contoh@email.com"
                  value={form.adminEmail}
                  onChange={(e) => setField("adminEmail", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="ranting-admin-password">
                    {mode === "edit" ? "Password baru" : "Password"}
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={fillGeneratedPassword}
                    disabled={loading}
                  >
                    Generate
                  </Button>
                </div>
                <Input
                  id="ranting-admin-password"
                  type="text"
                  autoComplete="new-password"
                  placeholder={
                    mode === "edit" ? "Kosongkan jika tidak diganti" : "Min. 8 karakter"
                  }
                  value={form.adminPassword}
                  onChange={(e) => setField("adminPassword", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ranting-admin-password-confirm">
                  Konfirmasi password
                </Label>
                <Input
                  id="ranting-admin-password-confirm"
                  type="text"
                  autoComplete="new-password"
                  placeholder="Ulangi password"
                  value={form.adminPasswordConfirm}
                  onChange={(e) =>
                    setField("adminPasswordConfirm", e.target.value)
                  }
                />
              </div>
            </>
          ) : null}

          <div className="flex gap-2 sm:col-span-2">
            <Button
              type="submit"
              disabled={loading}
              className="bg-inkai-red hover:bg-inkai-red/90"
            >
              {loading
                ? "Menyimpan..."
                : mode === "edit"
                  ? "Simpan Data"
                  : "Buat Ranting"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetPanel}
              disabled={loading}
            >
              {selfManagedOnly ? "Tutup" : "Batal"}
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
              <TableHead>Akun</TableHead>
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
                    {adminsUnavailable ? (
                      <span className="text-sm text-muted-foreground">
                        Tidak tersedia
                      </span>
                    ) : d.adminCount && d.adminCount > 0 ? (
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="secondary">{d.adminCount} akun</Badge>
                          {d.adminIsPrimary ? (
                            <Badge className="gap-0.5 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200">
                              <Star className="h-3 w-3" />
                              PIC
                            </Badge>
                          ) : null}
                        </div>
                        {d.adminEmail ? (
                          <span className="block font-mono text-[10px] text-muted-foreground truncate max-w-[9rem]">
                            {d.adminEmail}
                            {d.adminCount > 1 ? " +" : ""}
                          </span>
                        ) : null}
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
                      {!selfManagedOnly && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() => setDetailDojoId(d.id)}
                          className="gap-1"
                        >
                          <Users className="h-3.5 w-3.5" />
                          Akun
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={loading}
                        onClick={() => openEdit(d)}
                        className="gap-1"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {selfManagedOnly ? "Ubah" : "Data"}
                      </Button>
                      {!selfManagedOnly && (
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
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {archived.length > 0 && !selfManagedOnly ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Arsip ranting ({archived.length})
          </h3>
          <div className="overflow-x-auto rounded-xl border border-dashed">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead className="hidden sm:table-cell">Cabang</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archived.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {d.branchName || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => void restoreDojo(d)}
                      >
                        Pulihkan
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      <Sheet
        open={Boolean(detailDojo) || Boolean(detailDojoId && !detailDojo)}
        onOpenChange={(open) => {
          if (!open) setDetailDojoId(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {detailDojo ? (
            <>
              <SheetHeader>
                <SheetTitle>{detailDojo.name}</SheetTitle>
                <SheetDescription>
                  Multi-akun pengurus, jabatan, PIC, dan serah terima
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 px-4 pb-6">
                {!selfManagedOnly ? (
                  <WilayahAccountsPanel
                    scope="dojo"
                    wilayahId={detailDojo.id}
                    wilayahName={detailDojo.name}
                  />
                ) : null}

                <div className="grid gap-3 text-sm">
                  <DetailField label="Cabang" value={detailDojo.branchName} />
                  <DetailField label="PIC tampilan" value={detailDojo.headName} />
                  <DetailField label="Kecamatan" value={detailDojo.kecamatan} />
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
          ) : detailDojoId ? (
            <div className="space-y-4 px-4 pb-6">
              <SheetHeader>
                <SheetTitle>Akun ranting baru</SheetTitle>
                <SheetDescription>
                  Ranting tersimpan. Tambahkan akun pengurus di bawah.
                </SheetDescription>
              </SheetHeader>
              {!selfManagedOnly ? (
                <WilayahAccountsPanel
                  scope="dojo"
                  wilayahId={detailDojoId}
                  wilayahName="Ranting baru"
                />
              ) : null}
            </div>
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

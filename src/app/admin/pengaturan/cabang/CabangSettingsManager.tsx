"use client";

import { useState } from "react";
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
import { showError, showSuccess } from "@/lib/client-toast";
import { Archive, Users } from "lucide-react";
import {
  CredentialsReveal,
  type CredentialPayload,
} from "@/components/admin/pengaturan/CredentialsReveal";
import { WilayahAccountsPanel } from "@/components/admin/pengaturan/WilayahAccountsPanel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type BranchRow = {
  id: string;
  name: string;
  headName?: string | null;
  city?: string | null;
  provinceName?: string;
  dojoCount?: number;
  adminEmail?: string | null;
  adminCount?: number;
  isDeleted?: boolean;
};

export function CabangSettingsManager({
  provinces,
  branches,
  archived = [],
}: {
  provinces: { id: string; name: string }[];
  branches: BranchRow[];
  archived?: BranchRow[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [name, setName] = useState("");
  const [headName, setHeadName] = useState("");
  const [provinceId, setProvinceId] = useState(provinces[0]?.id ?? "");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [credential, setCredential] = useState<CredentialPayload | null>(null);
  const [accountsBranch, setAccountsBranch] = useState<BranchRow | null>(null);

  function resetForm() {
    setOpenForm(false);
    setEditingId(null);
    setName("");
    setHeadName("");
    setAdminEmail("");
    setAdminPassword("");
    setAdminPasswordConfirm("");
    setProvinceId(provinces[0]?.id ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (!editingId || adminPassword) {
      if (adminPassword !== adminPasswordConfirm) {
        showError("Konfirmasi password tidak cocok");
        return;
      }
    }

    setLoading(true);

    const payload = {
      ...(editingId ? { id: editingId } : {}),
      name,
      headName,
      ...(editingId ? {} : { provinceId }),
      adminEmail,
      adminPassword,
    };

    const res = await fetch("/api/admin/pengaturan/cabang", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (res.ok) {
      showSuccess(data.message || "Berhasil disimpan");
      if (data.loginEmail && adminPassword) {
        setCredential({
          title: `Kredensial admin cabang`,
          loginEmail: data.loginEmail,
          loginPassword: adminPassword,
        });
      }
      resetForm();
      router.refresh();
    } else {
      showError(data.error || "Gagal menyimpan cabang");
    }
  }

  function startEdit(b: BranchRow) {
    setCredential(null);
    setOpenForm(true);
    setEditingId(b.id);
    setName(b.name);
    setHeadName(b.headName || "");
    setAdminEmail(b.adminEmail || "");
    setAdminPassword("");
    setAdminPasswordConfirm("");
  }

  async function archiveBranch(b: BranchRow) {
    if (
      !confirm(
        `Arsipkan cabang "${b.name}"? Ranting di bawahnya dan admin terkait akan dinonaktifkan.`,
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/pengaturan/cabang", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Cabang diarsipkan");
      router.refresh();
    } else {
      showError(data.error || "Gagal mengarsipkan");
    }
  }

  async function restoreBranch(b: BranchRow) {
    if (!confirm(`Pulihkan cabang "${b.name}" dari arsip?`)) return;
    setLoading(true);
    const res = await fetch("/api/admin/pengaturan/cabang", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id, restore: true }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Cabang dipulihkan");
      router.refresh();
    } else {
      showError(data.error || "Gagal memulihkan");
    }
  }

  return (
    <div className="space-y-4">
      <CredentialsReveal
        credential={credential}
        onDismiss={() => setCredential(null)}
      />

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={loading}
          className="bg-inkai-red hover:bg-inkai-red/90"
          onClick={() => {
            setCredential(null);
            setOpenForm(true);
            setEditingId(null);
            setName("");
            setHeadName("");
            setAdminEmail("");
            setAdminPassword("");
            setAdminPasswordConfirm("");
          }}
        >
          Tambah Cabang
        </Button>
      </div>

      {openForm && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <h3 className="font-semibold">
              {editingId ? "Ubah Cabang" : "Tambah Cabang"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Email admin wajib — akun ADMIN_BRANCH akan dibuat/diperbarui.
            </p>
          </div>

          {!editingId && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Provinsi</Label>
              <select
                value={provinceId}
                onChange={(e) => setProvinceId(e.target.value)}
                className="h-8 w-full rounded-lg border px-2 text-sm"
                required
              >
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Nama Cabang</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Ketua</Label>
            <Input value={headName} onChange={(e) => setHeadName(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Username Admin (Email)</Label>
            <Input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required={!editingId}
              placeholder={editingId ? "Kosongkan jika tidak diganti" : ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password Admin</Label>
            <Input
              type="text"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required={!editingId}
              placeholder={editingId ? "Kosongkan jika tidak diganti" : "Min. 8 karakter"}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Konfirmasi Password</Label>
            <Input
              type="text"
              value={adminPasswordConfirm}
              onChange={(e) => setAdminPasswordConfirm(e.target.value)}
              required={!editingId || !!adminPassword}
              placeholder="Ulangi password"
              autoComplete="new-password"
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button
              type="submit"
              disabled={loading}
              className="bg-inkai-red hover:bg-inkai-red/90"
            >
              {loading
                ? "Menyimpan..."
                : editingId
                  ? "Simpan Perubahan"
                  : "Tambah Cabang"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>
              Batal
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Cabang</TableHead>
              <TableHead className="hidden sm:table-cell">Provinsi</TableHead>
              <TableHead>Ketua</TableHead>
              <TableHead className="hidden md:table-cell">Kota</TableHead>
              <TableHead className="hidden lg:table-cell">Admin</TableHead>
              <TableHead>Ranting</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Tidak ada data yang cocok dengan pencarian.
                </TableCell>
              </TableRow>
            ) : (
              branches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {b.provinceName || "—"}
                  </TableCell>
                  <TableCell>{b.headName || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {b.city || "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {b.adminCount && b.adminCount > 0 ? (
                      <div className="space-y-0.5">
                        <Badge variant="secondary">{b.adminCount} akun</Badge>
                        {b.adminEmail ? (
                          <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[10rem]">
                            {b.adminEmail}
                            {b.adminCount > 1 ? " +" : ""}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-700 dark:text-amber-400">
                        Belum ada
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{b.dojoCount ?? 0}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => setAccountsBranch(b)}
                        className="gap-1"
                      >
                        <Users className="h-3.5 w-3.5" />
                        Akun
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => startEdit(b)}
                      >
                        Ubah
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={loading}
                        onClick={() => archiveBranch(b)}
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

      {archived.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Arsip cabang ({archived.length})
          </h3>
          <div className="overflow-x-auto rounded-xl border border-dashed">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead className="hidden sm:table-cell">Provinsi</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archived.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {b.provinceName || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => void restoreBranch(b)}
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
        open={Boolean(accountsBranch)}
        onOpenChange={(open) => {
          if (!open) setAccountsBranch(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {accountsBranch ? (
            <>
              <SheetHeader>
                <SheetTitle>Akun admin — {accountsBranch.name}</SheetTitle>
                <SheetDescription>
                  Beberapa email boleh mengelola cabang yang sama. PIC utama
                  ditandai; akun aktif terakhir tidak bisa dinonaktifkan.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                <WilayahAccountsPanel
                  scope="branch"
                  wilayahId={accountsBranch.id}
                  wilayahName={accountsBranch.name}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Download, KeyRound, Pencil, Plus, UserCheck, UserX } from "lucide-react";

export type AdminUserRow = {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber?: string | null;
  isActive: boolean;
  roleLabels: string[];
  primaryRole?: string | null;
  scopeLabel: string;
  managedProvinceId?: string | null;
  managedBranchId?: string | null;
  managedDojoId?: string | null;
  createdAt?: string | null;
};

type ScopeOption = { id: string; name: string };

const ROLE_OPTIONS = [
  { value: "ADMIN_DOJO", label: "Admin Ranting" },
  { value: "ADMIN_BRANCH", label: "Admin Cabang" },
  { value: "ADMIN_PROVINCE", label: "Admin Provinsi" },
  { value: "ADMIN", label: "Admin" },
] as const;

export function UserSettingsTable({
  users,
  branches = [],
  dojos = [],
  provinces = [],
  canCreate = true,
}: {
  users: AdminUserRow[];
  branches?: ScopeOption[];
  dojos?: Array<ScopeOption & { branchId?: string }>;
  provinces?: ScopeOption[];
  canCreate?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [credential, setCredential] = useState<CredentialPayload | null>(null);
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null);
  const [resetUser, setResetUser] = useState<AdminUserRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState<string>("ADMIN_DOJO");
  const [managedBranchId, setManagedBranchId] = useState("");
  const [managedDojoId, setManagedDojoId] = useState("");
  const [managedProvinceId, setManagedProvinceId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const scopedDojos = useMemo(() => {
    if (!managedBranchId) return dojos;
    return dojos.filter((d) => d.branchId === managedBranchId);
  }, [dojos, managedBranchId]);

  function openEdit(u: AdminUserRow) {
    setEditUser(u);
    setFullName(u.fullName || "");
    setPhoneNumber(u.phoneNumber || "");
    setRole(u.primaryRole || u.roleLabels[0] || "ADMIN_DOJO");
    setManagedBranchId(u.managedBranchId || "");
    setManagedDojoId(u.managedDojoId || "");
    setManagedProvinceId(u.managedProvinceId || "");
  }

  function openCreate() {
    setCreateOpen(true);
    setFullName("");
    setPhoneNumber("");
    setEmail("");
    setRole("ADMIN_DOJO");
    setManagedBranchId(branches[0]?.id || "");
    setManagedDojoId("");
    setManagedProvinceId(provinces[0]?.id || "");
    const pw = generateSimplePassword("Admin");
    setPassword(pw);
    setPasswordConfirm(pw);
  }

  function openReset(u: AdminUserRow) {
    setResetUser(u);
    const pw = generateSimplePassword(u.fullName || u.email);
    setNewPassword(pw);
    setNewPasswordConfirm(pw);
  }

  async function toggleActive(user: AdminUserRow) {
    setLoading(true);
    const res = await fetch("/api/admin/pengaturan/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, isActive: !user.isActive }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "User diperbarui");
      router.refresh();
    } else {
      showError(data.error || "Gagal memperbarui user");
    }
  }

  async function saveEdit() {
    if (!editUser) return;
    setLoading(true);
    const res = await fetch("/api/admin/pengaturan/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: editUser.id,
        fullName,
        phoneNumber,
        role,
        managedProvinceId: role === "ADMIN_PROVINCE" ? managedProvinceId || null : null,
        managedBranchId: role === "ADMIN_BRANCH" ? managedBranchId || null : null,
        managedDojoId: role === "ADMIN_DOJO" ? managedDojoId || null : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "User diperbarui");
      setEditUser(null);
      router.refresh();
    } else {
      showError(data.error || "Gagal menyimpan");
    }
  }

  async function saveCreate() {
    setLoading(true);
    const res = await fetch("/api/admin/pengaturan/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        fullName,
        phoneNumber,
        role,
        managedProvinceId: role === "ADMIN_PROVINCE" ? managedProvinceId : null,
        managedBranchId: role === "ADMIN_BRANCH" ? managedBranchId : null,
        managedDojoId: role === "ADMIN_DOJO" ? managedDojoId : null,
        password,
        passwordConfirm,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "User dibuat");
      setCreateOpen(false);
      if (data.loginEmail && data.loginPassword) {
        setCredential({
          title: "Kredensial user baru",
          loginEmail: data.loginEmail,
          loginPassword: data.loginPassword,
          hint: "Tampilkan sekali — salin sekarang, tidak disimpan di browser.",
        });
      }
      router.refresh();
    } else {
      showError(data.error || "Gagal membuat user");
    }
  }

  async function saveReset() {
    if (!resetUser) return;
    setLoading(true);
    const res = await fetch("/api/admin/pengaturan/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: resetUser.id,
        action: "reset_password",
        newPassword,
        newPasswordConfirm,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Password direset");
      setResetUser(null);
      if (data.loginEmail && data.loginPassword) {
        setCredential({
          title: "Password direset",
          loginEmail: data.loginEmail,
          loginPassword: data.loginPassword,
          hint: "Tampilkan sekali — salin sekarang, tidak disimpan di browser.",
        });
      }
    } else {
      showError(data.error || "Gagal reset password");
    }
  }

  function exportCsv() {
    const header = ["email", "nama", "role", "cakupan", "status", "telepon"];
    const lines = users.map((u) =>
      [
        u.email,
        u.fullName || "",
        u.roleLabels.join("|"),
        u.scopeLabel,
        u.isActive ? "aktif" : "nonaktif",
        u.phoneNumber || "",
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess("CSV diekspor");
  }

  const scopeFields = (
    <>
      {role === "ADMIN_PROVINCE" ? (
        <div className="space-y-1">
          <Label>Provinsi</Label>
          <select
            className="h-9 w-full rounded-lg border px-2 text-sm"
            value={managedProvinceId}
            onChange={(e) => setManagedProvinceId(e.target.value)}
          >
            <option value="">Pilih…</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {role === "ADMIN_BRANCH" ? (
        <div className="space-y-1">
          <Label>Cabang</Label>
          <select
            className="h-9 w-full rounded-lg border px-2 text-sm"
            value={managedBranchId}
            onChange={(e) => setManagedBranchId(e.target.value)}
          >
            <option value="">Pilih…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {role === "ADMIN_DOJO" ? (
        <>
          <div className="space-y-1">
            <Label>Filter cabang</Label>
            <select
              className="h-9 w-full rounded-lg border px-2 text-sm"
              value={managedBranchId}
              onChange={(e) => {
                setManagedBranchId(e.target.value);
                setManagedDojoId("");
              }}
            >
              <option value="">Semua cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Ranting</Label>
            <select
              className="h-9 w-full rounded-lg border px-2 text-sm"
              value={managedDojoId}
              onChange={(e) => setManagedDojoId(e.target.value)}
            >
              <option value="">Pilih…</option>
              {scopedDojos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}
    </>
  );

  return (
    <div className="space-y-3">
      <CredentialsReveal
        credential={credential}
        onDismiss={() => setCredential(null)}
      />

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={exportCsv}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
        {canCreate ? (
          <Button
            type="button"
            size="sm"
            className="bg-inkai-red hover:bg-inkai-red/90"
            onClick={openCreate}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Tambah User
          </Button>
        ) : null}
      </div>

      {users.length === 0 ? (
        <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
          Tidak ada data yang cocok. Buat user baru atau lewat tambah
          cabang/ranting.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username / Email</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Cakupan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs sm:text-sm">
                    {u.email}
                  </TableCell>
                  <TableCell className="font-medium">
                    {u.fullName || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roleLabels.map((r) => (
                        <Badge key={r} variant="secondary">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {u.scopeLabel}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? "default" : "outline"}>
                      {u.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => openEdit(u)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => openReset(u)}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => void toggleActive(u)}
                      >
                        {u.isActive ? (
                          <UserX className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah user</DialogTitle>
            <DialogDescription>{editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nama</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Telepon</Label>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <select
                className="h-9 w-full rounded-lg border px-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            {scopeFields}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Batal
            </Button>
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={loading}
              onClick={() => void saveEdit()}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah user admin</DialogTitle>
            <DialogDescription>
              Password ditampilkan sekali setelah dibuat — salin segera.
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
              <Label>Nama</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <select
                className="h-9 w-full rounded-lg border px-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            {scopeFields}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Batal
            </Button>
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={loading}
              onClick={() => void saveCreate()}
            >
              Buat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUser} onOpenChange={(o) => !o && setResetUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>{resetUser?.email}</DialogDescription>
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
            <Button variant="outline" onClick={() => setResetUser(null)}>
              Batal
            </Button>
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={loading}
              onClick={() => void saveReset()}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

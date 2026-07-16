"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { showError, showSuccess } from "@/lib/client-toast";

export type AdminUserRow = {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber?: string | null;
  isActive: boolean;
  roleLabels: string[];
  scopeLabel: string;
  createdAt?: string | null;
};

export function UserSettingsTable({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();

  async function toggleActive(user: AdminUserRow) {
    const res = await fetch("/api/admin/pengaturan/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, isActive: !user.isActive }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showSuccess(data.message || "User diperbarui");
      router.refresh();
    } else {
      showError(data.error || "Gagal memperbarui user");
    }
  }

  if (users.length === 0) {
    return (
      <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
        Tidak ada data yang cocok dengan pencarian.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username / Email</TableHead>
            <TableHead>Nama</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="hidden md:table-cell">Cakupan</TableHead>
            <TableHead className="hidden lg:table-cell">Telepon</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-mono text-xs sm:text-sm">{u.email}</TableCell>
              <TableCell className="font-medium">{u.fullName || "—"}</TableCell>
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
              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                {u.phoneNumber || "—"}
              </TableCell>
              <TableCell>
                <Badge variant={u.isActive ? "default" : "outline"}>
                  {u.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => toggleActive(u)}>
                  {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

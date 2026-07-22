"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMemberName, formatRankLabel } from "@/lib/belt";
import {
  reasonLabel,
  type MemberLifecycleMeta,
} from "@/lib/member-lifecycle";
import { canSoftDeleteMembers, isCabangAdmin } from "@/lib/wilayah-rbac";
import { showError, showSuccess } from "@/lib/client-toast";
import { postMemberBulkChunked } from "@/lib/member-bulk-client";
import { BulkProgressBar } from "@/components/admin/BulkProgressBar";
import { MemberActions } from "./MemberActions";

type ArchivedRow = {
  id: string;
  fullName: string;
  nia: string | null;
  currentRank: string;
  status: string;
  updatedAt: string;
  dojo: { name: string };
  lifecycle: MemberLifecycleMeta | null;
};

type DialogKind = "purge" | "restore" | null;

export function ArchivedMembersPanel({
  userRoles = [],
  defaultDojoId = "",
}: {
  userRoles?: string[];
  defaultDojoId?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ArchivedRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialogKind, setDialogKind] = useState<DialogKind>(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [acting, setActing] = useState(false);
  const [progress, setProgress] = useState({
    percent: 0,
    done: 0,
    total: 0,
  });

  const canRestore = isCabangAdmin(userRoles);
  const canPurge = canSoftDeleteMembers(userRoles);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (q.trim()) qs.set("q", q.trim());
    if (defaultDojoId) qs.set("dojoId", defaultDojoId);
    try {
      const res = await fetch(`/api/admin/members/archived?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal memuat arsip");
        setRows([]);
      } else {
        setRows((data.data as ArchivedRow[]) ?? []);
      }
    } catch {
      showError("Gagal memuat arsip");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q, defaultDojoId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(rows.map((r) => r.id)));
  }

  function closeDialog() {
    if (acting) return;
    setDialogKind(null);
    setConfirmPhrase("");
    setProgress({ percent: 0, done: 0, total: 0 });
  }

  async function submitPurge() {
    if (confirmPhrase.trim().toUpperCase() !== "HAPUS") {
      showError('Ketik "HAPUS" untuk mengonfirmasi');
      return;
    }
    setActing(true);
    setProgress({ percent: 0, done: 0, total: selectedIds.size });
    const result = await postMemberBulkChunked(
      {
        action: "purge",
        memberIds: [...selectedIds],
        confirmPhrase: confirmPhrase.trim(),
      },
      {
        onProgress: (p) =>
          setProgress({
            percent: p.percent,
            done: p.done,
            total: p.total,
          }),
      },
    );
    setActing(false);
    if (!result.ok && result.okCount === 0) {
      showError(
        result.error || result.message || "Gagal hapus permanen",
      );
      return;
    }
    showSuccess(result.message || "Berhasil dihapus");
    setDialogKind(null);
    setConfirmPhrase("");
    setProgress({ percent: 0, done: 0, total: 0 });
    setSelectedIds(new Set());
    void load();
    router.refresh();
  }

  async function submitRestore() {
    setActing(true);
    setProgress({ percent: 0, done: 0, total: selectedIds.size });
    const result = await postMemberBulkChunked(
      {
        action: "restore",
        memberIds: [...selectedIds],
      },
      {
        onProgress: (p) =>
          setProgress({
            percent: p.percent,
            done: p.done,
            total: p.total,
          }),
      },
    );
    setActing(false);
    if (!result.ok && result.okCount === 0) {
      showError(result.error || "Gagal memulihkan");
      return;
    }
    showSuccess(result.message || "Berhasil dipulihkan");
    setDialogKind(null);
    setProgress({ percent: 0, done: 0, total: 0 });
    setSelectedIds(new Set());
    void load();
    router.refresh();
  }

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const colCount = canPurge ? 7 : 6;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Cari arsip</label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nama / NIA…"
          />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          Muat ulang
        </Button>
      </div>

      {!canRestore ? (
        <p className="text-xs text-muted-foreground">
          Melihat arsip: pulihkan hanya oleh pengurus cabang. Hapus permanen
          tersedia untuk ranting/cabang dalam scope.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              {canPurge ? (
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-inkai-red"
                    checked={allSelected}
                    disabled={rows.length === 0 || loading}
                    onChange={toggleSelectAll}
                    aria-label="Pilih semua arsip"
                  />
                </TableHead>
              ) : null}
              <TableHead>Nama</TableHead>
              <TableHead>NIA</TableHead>
              <TableHead>Sabuk</TableHead>
              <TableHead className="hidden sm:table-cell">Dojo</TableHead>
              <TableHead className="hidden md:table-cell">Diarsipkan</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="h-20 text-center text-muted-foreground"
                >
                  Memuat arsip…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="h-20 text-center text-muted-foreground"
                >
                  Tidak ada anggota di arsip.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => (
                <TableRow key={m.id}>
                  {canPurge ? (
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-inkai-red"
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleSelect(m.id)}
                        aria-label={`Pilih ${m.fullName}`}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="font-medium text-inkai-red">
                    {formatMemberName(m.fullName)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {m.nia || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {formatRankLabel(m.currentRank) || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {m.dojo?.name ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {m.lifecycle?.changedAt
                      ? new Date(m.lifecycle.changedAt).toLocaleDateString("id-ID")
                      : new Date(m.updatedAt).toLocaleDateString("id-ID")}
                    {m.lifecycle?.reasonCode
                      ? ` · ${reasonLabel(m.lifecycle.reasonCode)}`
                      : ""}
                  </TableCell>
                  <TableCell>
                    <MemberActions
                      memberId={m.id}
                      status={m.status}
                      nia={m.nia}
                      fullName={m.fullName}
                      userRoles={userRoles}
                      isArchived
                      onSuccess={() => {
                        void load();
                        router.refresh();
                        showSuccess("Daftar arsip diperbarui");
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {canPurge && selectedIds.size > 0 ? (
        <div className="fixed bottom-4 left-1/2 z-40 flex w-[min(100%-1.5rem,40rem)] -translate-x-1/2 flex-col gap-2 rounded-xl border bg-background/95 px-3 py-3 shadow-lg backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-4">
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{selectedIds.size}</span>{" "}
            dipilih
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSelectedIds(new Set())}
            >
              Batal
            </Button>
            {canRestore ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                onClick={() => setDialogKind("restore")}
              >
                Pulihkan terpilih
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setDialogKind("purge")}
            >
              Hapus permanen
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={dialogKind === "purge"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!acting}>
          <DialogHeader>
            <DialogTitle>
              Hapus permanen {selectedIds.size} anggota arsip?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Data dihapus dari arsip beserta riwayat terkait. Tindakan ini{" "}
                  <strong>tidak bisa dibatalkan</strong>.
                </p>
                <p className="text-amber-700 dark:text-amber-400">
                  Ketik <strong>HAPUS</strong> untuk mengonfirmasi.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          {acting ? (
            <BulkProgressBar
              percent={progress.percent}
              done={progress.done}
              total={progress.total}
              label="Menghapus permanen…"
            />
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                Ketik <span className="font-medium text-foreground">HAPUS</span>
              </label>
              <Input
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="HAPUS"
                autoComplete="off"
                disabled={acting}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={acting}
              onClick={closeDialog}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                acting || confirmPhrase.trim().toUpperCase() !== "HAPUS"
              }
              onClick={() => void submitPurge()}
            >
              {acting ? `${progress.percent}%` : "Hapus permanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogKind === "restore"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!acting}>
          <DialogHeader>
            <DialogTitle>
              Pulihkan {selectedIds.size} anggota dari arsip?
            </DialogTitle>
            <DialogDescription>
              Anggota dipulihkan sebagai <strong>Nonaktif</strong>. Aktifkan
              kembali setelah dicek.
            </DialogDescription>
          </DialogHeader>
          {acting ? (
            <BulkProgressBar
              percent={progress.percent}
              done={progress.done}
              total={progress.total}
              label="Memulihkan anggota…"
            />
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={acting}
              onClick={closeDialog}
            >
              Batal
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={acting}
              onClick={() => void submitRestore()}
            >
              {acting ? `${progress.percent}%` : "Pulihkan semua"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

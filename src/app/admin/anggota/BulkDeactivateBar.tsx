"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  DEACTIVATE_REASON_CODES,
  DEACTIVATE_REASON_LABELS,
  type DeactivateReasonCode,
  type MemberStatusKind,
} from "@/lib/member-lifecycle";
import { showError, showSuccess } from "@/lib/client-toast";
import { postMemberBulkChunked } from "@/lib/member-bulk-client";
import { BulkProgressBar } from "@/components/admin/BulkProgressBar";

type DialogKind = "deactivate" | "delete" | null;

export function BulkDeactivateBar({
  selectedIds,
  pendingIds = [],
  onClear,
}: {
  selectedIds: string[];
  pendingIds?: string[];
  onClear: () => void;
}) {
  const router = useRouter();
  const [dialogKind, setDialogKind] = useState<DialogKind>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({
    percent: 0,
    done: 0,
    total: 0,
  });
  const [statusKind, setStatusKind] = useState<MemberStatusKind>("INACTIVE");
  const [reasonCode, setReasonCode] =
    useState<DeactivateReasonCode>("BERHENTI_LATIHAN");
  const [reasonNote, setReasonNote] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");

  if (selectedIds.length === 0) return null;

  function closeDialog() {
    if (loading) return;
    setDialogKind(null);
    setConfirmPhrase("");
    setReasonNote("");
    setStatusKind("INACTIVE");
    setReasonCode("BERHENTI_LATIHAN");
    setProgress({ percent: 0, done: 0, total: 0 });
  }

  async function approvePending() {
    if (pendingIds.length === 0) {
      showError("Pilih anggota berstatus PENDING untuk disetujui");
      return;
    }
    setLoading(true);
    setProgress({ percent: 0, done: 0, total: pendingIds.length });
    const result = await postMemberBulkChunked(
      {
        action: "approve",
        memberIds: pendingIds,
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
    setLoading(false);
    if (!result.ok && result.okCount === 0) {
      showError(result.error || "Gagal approve");
      return;
    }
    showSuccess(result.message || "Berhasil");
    onClear();
    router.refresh();
  }

  async function submitDeactivate() {
    setLoading(true);
    setProgress({ percent: 0, done: 0, total: selectedIds.length });
    const result = await postMemberBulkChunked(
      {
        action: "deactivate",
        memberIds: selectedIds,
        statusKind,
        reasonCode,
        reasonNote: reasonNote.trim() || undefined,
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
    setLoading(false);
    if (!result.ok && result.okCount === 0) {
      showError(result.error || "Gagal nonaktif massal");
      return;
    }
    showSuccess(result.message || "Bulk nonaktif selesai");
    closeDialog();
    onClear();
    router.refresh();
  }

  async function submitDelete() {
    if (confirmPhrase.trim().toUpperCase() !== "ARSIPKAN") {
      showError('Ketik "ARSIPKAN" untuk mengonfirmasi');
      return;
    }
    setLoading(true);
    setProgress({ percent: 0, done: 0, total: selectedIds.length });
    const result = await postMemberBulkChunked(
      {
        action: "delete",
        memberIds: selectedIds,
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
    setLoading(false);
    if (!result.ok && result.okCount === 0) {
      showError(result.error || "Gagal arsip massal");
      return;
    }
    showSuccess(result.message || "Bulk arsip selesai");
    setDialogKind(null);
    setConfirmPhrase("");
    setProgress({ percent: 0, done: 0, total: 0 });
    onClear();
    router.refresh();
  }

  return (
    <>
      <div className="fixed bottom-4 left-1/2 z-40 flex w-[min(100%-1.5rem,40rem)] -translate-x-1/2 flex-col gap-2 rounded-xl border bg-background/95 px-3 py-3 shadow-lg backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-4">
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{selectedIds.length}</span>{" "}
          dipilih
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={onClear}
          >
            Batal
          </Button>
          {pendingIds.length > 0 ? (
            <Button
              type="button"
              size="sm"
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={loading}
              onClick={() => void approvePending()}
            >
              Setujui {pendingIds.length} pending
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={loading}
            onClick={() => setDialogKind("delete")}
          >
            Hapus / arsipkan
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={loading}
            onClick={() => setDialogKind("deactivate")}
          >
            Nonaktifkan terpilih
          </Button>
        </div>
      </div>

      <Dialog
        open={dialogKind === "deactivate"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          showCloseButton={!loading}
        >
          <DialogHeader>
            <DialogTitle>
              Nonaktifkan {selectedIds.length} anggota?
            </DialogTitle>
            <DialogDescription>
              Semua anggota terpilih akan dinonaktifkan dengan alasan yang sama.
              Login mereka diblokir; NIA & riwayat tetap ada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {loading ? (
              <BulkProgressBar
                percent={progress.percent}
                done={progress.done}
                total={progress.total}
                label="Menonaktifkan anggota…"
              />
            ) : null}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Jenis</label>
              <select
                value={statusKind}
                onChange={(e) =>
                  setStatusKind(e.target.value as MemberStatusKind)
                }
                className="h-9 w-full rounded-lg border px-2 text-sm"
                disabled={loading}
              >
                <option value="INACTIVE">Nonaktif</option>
                <option value="SUSPENDED">Ditangguhkan</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Alasan</label>
              <select
                value={reasonCode}
                onChange={(e) =>
                  setReasonCode(e.target.value as DeactivateReasonCode)
                }
                className="h-9 w-full rounded-lg border px-2 text-sm"
                disabled={loading}
              >
                {DEACTIVATE_REASON_CODES.map((code) => (
                  <option key={code} value={code}>
                    {DEACTIVATE_REASON_LABELS[code]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Catatan</label>
              <Input
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="Opsional"
                disabled={loading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={closeDialog}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={loading}
              onClick={() => void submitDeactivate()}
            >
              {loading ? "Memproses…" : "Nonaktifkan semua"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogKind === "delete"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          showCloseButton={!loading}
        >
          <DialogHeader>
            <DialogTitle>
              Hapus / arsipkan {selectedIds.length} anggota?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Soft-delete: hilang dari daftar operasional. Jejak audit &
                  riwayat tetap ada; cabang dapat memulihkan dari panel Arsip.
                </p>
                <p className="text-amber-700 dark:text-amber-400">
                  Pertimbangkan Nonaktifkan jika anggota mungkin kembali.
                  Ketik <strong>ARSIPKAN</strong> untuk mengonfirmasi.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <BulkProgressBar
              percent={progress.percent}
              done={progress.done}
              total={progress.total}
              label="Mengarsipkan anggota…"
            />
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                Ketik{" "}
                <span className="font-medium text-foreground">ARSIPKAN</span>
              </label>
              <Input
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="ARSIPKAN"
                autoComplete="off"
                disabled={loading}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={closeDialog}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                loading || confirmPhrase.trim().toUpperCase() !== "ARSIPKAN"
              }
              onClick={() => void submitDelete()}
            >
              {loading ? `${progress.percent}%` : "Arsipkan semua"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

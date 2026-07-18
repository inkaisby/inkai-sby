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

export function BulkDeactivateBar({
  selectedIds,
  onClear,
}: {
  selectedIds: string[];
  onClear: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusKind, setStatusKind] = useState<MemberStatusKind>("INACTIVE");
  const [reasonCode, setReasonCode] =
    useState<DeactivateReasonCode>("BERHENTI_LATIHAN");
  const [reasonNote, setReasonNote] = useState("");

  if (selectedIds.length === 0) return null;

  async function submit() {
    setLoading(true);
    const res = await fetch("/api/admin/members/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "deactivate",
        memberIds: selectedIds,
        statusKind,
        reasonCode,
        reasonNote: reasonNote.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Bulk nonaktif selesai");
      setOpen(false);
      onClear();
      router.refresh();
    } else {
      showError(data.error || "Gagal nonaktif massal");
    }
  }

  return (
    <>
      <div className="fixed bottom-4 left-1/2 z-40 flex w-[min(100%-1.5rem,32rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-xl border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{selectedIds.length}</span>{" "}
          dipilih
        </p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onClear}>
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => setOpen(true)}
          >
            Nonaktifkan terpilih
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
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
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Jenis</label>
              <select
                value={statusKind}
                onChange={(e) =>
                  setStatusKind(e.target.value as MemberStatusKind)
                }
                className="h-9 w-full rounded-lg border px-2 text-sm"
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={loading}
              onClick={() => void submit()}
            >
              {loading ? "Memproses…" : "Nonaktifkan semua"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

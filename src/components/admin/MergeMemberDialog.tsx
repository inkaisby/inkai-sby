"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showError, showSuccess } from "@/lib/client-toast";

export type MergeCandidate = {
  id: string;
  fullName: string;
  nia?: string | null;
  status: string;
  hasAccount: boolean;
  email?: string | null;
  reasons: string[];
  suggestedKeepId: string;
  suggestedMergeId: string;
  mergeEligible: boolean;
  mergeBlockReason?: string | null;
  counts?: {
    billings: number;
    attendances: number;
    eventRegistrations: number;
    ranks: number;
  };
};

function reasonLabel(reasons: string[]) {
  const map: Record<string, string> = {
    NIK: "NIK",
    NIA: "NIA",
    NAME_BIRTHDATE: "nama + tgl lahir",
    NAME: "nama",
  };
  return reasons.map((r) => map[r] ?? r).join(", ");
}

export function MergeMemberDialog({
  open,
  onOpenChange,
  currentMemberId,
  currentLabel,
  currentHasAccount,
  currentEmail,
  candidate,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMemberId: string;
  currentLabel: string;
  currentHasAccount: boolean;
  currentEmail?: string | null;
  candidate: MergeCandidate | null;
  onMerged?: (keepMemberId: string) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [preferUserFrom, setPreferUserFrom] = useState<"keep" | "merge">("keep");

  if (!candidate) return null;

  const keepId = candidate.suggestedKeepId;
  const mergeId = candidate.suggestedMergeId;
  const bothHaveAccount = currentHasAccount && candidate.hasAccount;

  // Label sisi keep vs merge relatif ke suggested IDs
  const keepIsCurrent = keepId === currentMemberId;
  const keepLabel = keepIsCurrent ? currentLabel : candidate.fullName;
  const mergeLabel = keepIsCurrent ? candidate.fullName : currentLabel;
  const keepEmail = keepIsCurrent ? currentEmail : candidate.email;
  const mergeEmail = keepIsCurrent ? candidate.email : currentEmail;
  const keepHasAccount = keepIsCurrent ? currentHasAccount : candidate.hasAccount;
  const mergeHasAccount = keepIsCurrent ? candidate.hasAccount : currentHasAccount;

  async function handleMerge() {
    if (!candidate?.mergeEligible) {
      showError(candidate?.mergeBlockReason || "Tidak dapat digabung");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/members/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keepMemberId: keepId,
          mergeMemberId: mergeId,
          preferUserFrom: bothHaveAccount ? preferUserFrom : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        keepMemberId?: string;
      };
      if (!res.ok) {
        showError(data.error || "Gagal menggabungkan");
        return;
      }
      showSuccess(data.message || "Berhasil digabung");
      onOpenChange(false);
      onMerged?.(data.keepMemberId || keepId);
      router.refresh();
    } catch {
      showError("Gagal menggabungkan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gabungkan data anggota</DialogTitle>
          <DialogDescription>
            Data operasional dipertahankan; akun login digabung. Duplikat
            diarsipkan (bukan dihapus permanen).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Dipertahankan
            </p>
            <p className="font-medium">{keepLabel}</p>
            <p className="text-xs text-muted-foreground">
              {keepHasAccount
                ? `Akun: ${keepEmail || "ada"}`
                : "Belum punya akun login"}
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="text-xs font-medium text-amber-800 uppercase dark:text-amber-200">
              Digabung lalu diarsipkan
            </p>
            <p className="font-medium">{mergeLabel}</p>
            <p className="text-xs text-muted-foreground">
              {mergeHasAccount
                ? `Akun: ${mergeEmail || "ada"} → dipindah ke data di atas`
                : "Tanpa akun"}
              {candidate.reasons?.length
                ? ` · cocok ${reasonLabel(candidate.reasons)}`
                : ""}
            </p>
          </div>

          {bothHaveAccount ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Kedua data punya akun. Pilih email yang tetap aktif:
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="preferUser"
                  checked={preferUserFrom === "keep"}
                  onChange={() => setPreferUserFrom("keep")}
                />
                {keepEmail || "Email data dipertahankan"}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="preferUser"
                  checked={preferUserFrom === "merge"}
                  onChange={() => setPreferUserFrom("merge")}
                />
                {mergeEmail || "Email data digabung"}
              </label>
            </div>
          ) : null}

          {!candidate.mergeEligible ? (
            <p className="text-xs text-red-700 dark:text-red-300">
              {candidate.mergeBlockReason}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Setelah digabung, anggota login dengan email yang tersambung dan
              melihat riwayat iuran/absensi dari data ranting.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Batal
          </Button>
          <Button
            className="bg-inkai-red"
            onClick={handleMerge}
            disabled={loading || !candidate.mergeEligible}
          >
            {loading ? "Menggabungkan..." : "Gabungkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

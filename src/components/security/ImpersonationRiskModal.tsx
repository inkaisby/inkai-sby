"use client";

import { useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { IMPERSONATION_CONFIRM_PHRASE } from "@/lib/security/impersonation-constants";

export { IMPERSONATION_CONFIRM_PHRASE };

const RISK_POINTS = [
  "Anda akan bertindak penuh sebagai target — setiap aksi tercatat seolah dilakukan oleh akun tersebut.",
  "Jejak audit mencatat aktor → target; sesi ini tidak anonim.",
  "Aksi yang Anda lakukan berdampak nyata pada data & akun target (bukan simulasi).",
  "Jika sesi Anda (aktor) bocor selagi mode ini aktif, dampaknya membesar — mencakup akun target juga.",
  "Sesi ambil alih otomatis berakhir 15 menit dan ditandai banner merah selama aktif.",
  "Dilarang menyamar tanpa mandat/alasan sah dari organisasi.",
  "Target akan menerima notifikasi bahwa akunnya sedang diambil alih.",
  "Mengubah password, email, atau menghapus akun target diblokir selama mode ini aktif.",
  "Token API Inkai tetap milik Anda (aktor) — data yang tampil difilter mengikuti target, bukan data Anda sendiri.",
];

export type ImpersonationRiskModalSubmitInput = {
  reason: string;
  password: string;
  confirmPhrase: string;
};

export function ImpersonationRiskModal({
  open,
  onOpenChange,
  targetName,
  targetEmail,
  submitting,
  errorMessage,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetName: string;
  targetEmail: string;
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (input: ImpersonationRiskModalSubmitInput) => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");

  const reasonOk = reason.trim().length >= 3;
  const phraseOk = confirmPhrase.trim() === IMPERSONATION_CONFIRM_PHRASE;
  const canSubmit =
    acknowledged && reasonOk && password.length > 0 && phraseOk && !submitting;

  function resetAndClose() {
    setAcknowledged(false);
    setReason("");
    setPassword("");
    setConfirmPhrase("");
    onOpenChange(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ reason: reason.trim(), password, confirmPhrase: confirmPhrase.trim() });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose();
        else onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={!submitting}
        className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-inkai-red/10 text-inkai-red">
              <ShieldAlert className="size-5" />
            </span>
            <DialogTitle>Ambil alih akun</DialogTitle>
          </div>
          <DialogDescription>
            Anda akan mengambil alih sesi{" "}
            <span className="font-semibold text-foreground">
              {targetName || targetEmail}
            </span>
            {targetEmail ? (
              <span className="text-muted-foreground"> ({targetEmail})</span>
            ) : null}
            . Baca seluruh risiko sebelum melanjutkan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-inkai-red/30 bg-inkai-red/5 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wide text-inkai-red uppercase">
              <AlertTriangle className="size-3.5" />
              Risiko mode ambil alih
            </div>
            <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-foreground/90">
              {RISK_POINTS.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ol>
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-inkai-red"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={submitting}
            />
            <span>
              Saya memahami dan menerima seluruh risiko di atas, serta memiliki
              mandat sah untuk mengambil alih akun ini.
            </span>
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="impersonate-reason">Alasan (wajib)</Label>
            <Input
              id="impersonate-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: menindaklanjuti tiket dukungan #123"
              disabled={submitting}
              minLength={3}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="impersonate-password">Password Anda (step-up)</Label>
            <Input
              id="impersonate-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={submitting}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="impersonate-phrase">
              Ketik <span className="font-mono font-bold">{IMPERSONATION_CONFIRM_PHRASE}</span>{" "}
              untuk konfirmasi
            </Label>
            <Input
              id="impersonate-phrase"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder={IMPERSONATION_CONFIRM_PHRASE}
              disabled={submitting}
              autoComplete="off"
              aria-invalid={confirmPhrase.length > 0 && !phraseOk}
              required
            />
          </div>

          {errorMessage ? (
            <p className="text-sm font-medium text-destructive">{errorMessage}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={resetAndClose}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="bg-inkai-red text-white hover:bg-inkai-red/90"
              disabled={!canSubmit}
            >
              {submitting ? "Memproses…" : "Ambil alih akun"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Loader2, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { clearPresenceBeforeLogout } from "@/components/presence/PresenceHeartbeat";

export function LogoutConfirmDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (loading) return;
    setLoading(true);
    try {
      await clearPresenceBeforeLogout();
      await signOut({ callbackUrl: "/" });
    } catch {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (loading) return;
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={!loading} className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-center">
          <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-inkai-red/10 text-inkai-red ring-1 ring-inkai-red/15">
            <LogOut className="h-6 w-6" strokeWidth={2} />
          </div>
          <DialogTitle className="text-lg font-semibold">
            Keluar dari akun?
          </DialogTitle>
          <DialogDescription className="text-center">
            Sesi Anda akan diakhiri. Anda dapat masuk kembali kapan saja dengan
            email dan password yang sama.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            variant="outline"
            className="sm:min-w-28"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            className="bg-inkai-red text-white hover:bg-inkai-red/90 sm:min-w-28"
            disabled={loading}
            onClick={handleConfirm}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Keluar...
              </>
            ) : (
              <>
                <LogOut />
                Ya, Keluar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function InkaiConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  onConfirm,
  loading = false,
  variant = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  variant?: "default" | "danger";
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (loading) return;
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={!loading} className="gap-0 overflow-hidden border-border/60 p-0 sm:max-w-md">
        <div className="border-b bg-gradient-to-br from-inkai-red/8 via-background to-inkai-yellow/8 px-6 pb-5 pt-6">
          <DialogHeader className="items-center text-center">
            <div className="mb-3 rounded-full bg-background p-1 shadow-md ring-1 ring-border/60">
              <Image
                src="/logo-inkai.png"
                alt="Logo INKAI"
                width={56}
                height={56}
                className="rounded-full"
              />
            </div>
            <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="text-center">{description}</DialogDescription>
            ) : null}
          </DialogHeader>
        </div>
        <DialogFooter className="gap-2 px-6 py-4 sm:justify-center">
          <Button
            type="button"
            variant="outline"
            className="sm:min-w-28"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className={
              variant === "danger"
                ? "bg-inkai-red text-white hover:bg-inkai-red/90 sm:min-w-28"
                : "sm:min-w-28"
            }
            disabled={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

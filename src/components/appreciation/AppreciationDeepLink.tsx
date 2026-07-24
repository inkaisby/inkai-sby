"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showError, showSuccess } from "@/lib/client-toast";
import { cn } from "@/lib/utils";

/** Scroll ke entri saat deep-link ?tokoh= / hash. Ringan, sekali mount. */
export function AppreciationScrollTarget({
  targetId,
}: {
  targetId: string | null;
}) {
  useEffect(() => {
    if (!targetId) return;
    const el = document.getElementById(`apresiasi-${targetId}`);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "center",
    });
  }, [targetId]);

  return null;
}

/** Thumbnail: buka lightbox foto (bukan navigasi ?tokoh=). */
export function AppreciationPhotoLink({
  name,
  photoUrl,
  isKenangan,
}: {
  path?: string;
  name: string;
  photoUrl: string | null;
  isKenangan: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!photoUrl) {
    return (
      <div
        className={cn(
          "flex size-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold sm:size-20",
          isKenangan
            ? "bg-foreground/10 text-foreground/70"
            : "bg-inkai-red/10 text-inkai-red",
        )}
        aria-hidden
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative size-16 shrink-0 overflow-hidden rounded-full ring-1 ring-border/60 transition-opacity hover:opacity-90 sm:size-20"
        aria-label={`Lihat foto ${name}`}
      >
        <Image
          src={photoUrl}
          alt={name}
          fill
          className="object-cover"
          sizes="80px"
          unoptimized
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[min(92vw,36rem)] gap-3 border-0 bg-black/95 p-3 text-white sm:max-w-[min(92vw,36rem)]"
          showCloseButton
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{name}</DialogTitle>
          </DialogHeader>
          <div className="relative mx-auto aspect-square w-full max-h-[75vh] overflow-hidden rounded-lg">
            <Image
              src={photoUrl}
              alt={name}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 92vw, 36rem"
              unoptimized
              priority
            />
          </div>
          <p className="truncate text-center text-sm text-white/80">{name}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AppreciationCopyLink({
  path,
  className,
}: {
  path: string;
  className?: string;
}) {
  async function copy() {
    try {
      const url = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(url);
      showSuccess("Tautan disalin");
    } catch {
      showError("Gagal menyalin tautan");
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={cn(
        "h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground",
        className,
      )}
      onClick={() => void copy()}
      aria-label="Salin tautan"
    >
      <Link2 className="h-3.5 w-3.5" />
      Salin tautan
    </Button>
  );
}

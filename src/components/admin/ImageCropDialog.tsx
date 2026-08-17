"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cropImageFile } from "@/lib/compress-image";

const VIEW_PX = 280;

export function ImageCropDialog({
  file,
  open,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  open: boolean;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [nat, setNat] = useState({ w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    if (!file || !open) {
      setReady(false);
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setReady(false);
    setZoom(1);
    return () => URL.revokeObjectURL(url);
  }, [file, open]);

  function minCrop() {
    return Math.min(nat.w, nat.h);
  }

  function cropSize() {
    return Math.max(32, minCrop() / zoom);
  }

  function clampOffset(x: number, y: number, size: number) {
    return {
      x: Math.max(0, Math.min(nat.w - size, x)),
      y: Math.max(0, Math.min(nat.h - size, y)),
    };
  }

  function onImageLoad(img: HTMLImageElement) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNat({ w, h });
    const size = Math.min(w, h);
    setOffset({
      x: Math.max(0, (w - size) / 2),
      y: Math.max(0, (h - size) / 2),
    });
    setZoom(1);
    setReady(true);
  }

  const size = cropSize();
  const scale = VIEW_PX / size;

  async function handleConfirm() {
    if (!file) return;
    setBusy(true);
    try {
      const cropped = await cropImageFile(file, {
        sx: offset.x,
        sy: offset.y,
        size,
      });
      onConfirm(cropped);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>Potong foto 1:1</DialogTitle>
          <DialogDescription>
            Geser foto dan atur zoom agar wajah di tengah lingkaran avatar.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div
            className="relative overflow-hidden rounded-full border bg-muted"
            style={{ width: VIEW_PX, height: VIEW_PX, touchAction: "none" }}
            onPointerDown={(e) => {
              if (!ready) return;
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              drag.current = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                origX: offset.x,
                origY: offset.y,
              };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || d.pointerId !== e.pointerId) return;
              const dx = (e.clientX - d.startX) / scale;
              const dy = (e.clientY - d.startY) / scale;
              setOffset(clampOffset(d.origX - dx, d.origY - dy, size));
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            {objectUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={objectUrl}
                alt=""
                draggable={false}
                className="absolute max-w-none select-none"
                style={{
                  width: nat.w * scale,
                  height: nat.h * scale,
                  left: -offset.x * scale,
                  top: -offset.y * scale,
                  visibility: ready ? "visible" : "hidden",
                }}
                onLoad={(e) => onImageLoad(e.currentTarget)}
              />
            ) : null}
          </div>
          <label className="flex w-full items-center gap-2 text-xs text-muted-foreground">
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              disabled={!ready || busy}
              className="flex-1"
              onChange={(e) => {
                const nextZoom = Number(e.target.value);
                const nextSize = Math.max(32, minCrop() / nextZoom);
                setZoom(nextZoom);
                setOffset((prev) =>
                  clampOffset(
                    prev.x + (size - nextSize) / 2,
                    prev.y + (size - nextSize) / 2,
                    nextSize,
                  ),
                );
              }}
            />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Batal
          </Button>
          <Button
            type="button"
            className="bg-inkai-red"
            disabled={!ready || busy}
            onClick={() => void handleConfirm()}
          >
            Pakai
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Props = {
  label: string;
  valueUrl?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
};

export function UktSignaturePad({
  label,
  valueUrl,
  onChange,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => clearCanvas());
    return () => cancelAnimationFrame(id);
  }, [open, clearCanvas]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const onPointerUp = () => {
    drawing.current = false;
    last.current = null;
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (!blob) throw new Error("Gagal membuat gambar tanda tangan");
      const file = new File([blob], `ttd-${Date.now()}.png`, {
        type: "image/png",
      });
      const form = new FormData();
      form.set("file", file);
      form.set("folder", "ukt-ttd");
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Gagal mengunggah tanda tangan");
      }
      onChange(data.url);
      setOpen(false);
      toast.success("Tanda tangan disimpan");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan TTD");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <PenLine className="mr-1 h-3.5 w-3.5" />
          {valueUrl ? "Ubah TTD" : "Tanda tangan"}
        </Button>
        {valueUrl ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            <Eraser className="mr-1 h-3.5 w-3.5" />
            Hapus
          </Button>
        ) : null}
      </div>
      {valueUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={valueUrl}
          alt={`TTD ${label}`}
          className="h-10 max-w-[140px] object-contain"
        />
      ) : (
        <p className="text-[11px] text-muted-foreground">Belum ada TTD digital</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tanda tangan — {label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Corekan di area putih (jari / stylus / mouse).
            </p>
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              className="w-full touch-none rounded-md border bg-white"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={clearCanvas}>
              <Eraser className="mr-1 h-4 w-4" />
              Bersihkan
            </Button>
            <Button
              type="button"
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={saving}
              onClick={() => void save()}
            >
              <Upload className="mr-1 h-4 w-4" />
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

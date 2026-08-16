"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Props = {
  label: string;
  valueUrl?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  /** Jika diisi, TTD di-upload ke folder member-ttd dan di-persist ke Member.signatureUrl */
  memberId?: string | null;
  uploadFolder?: string;
};

const EXPORT_MAX_W = 400;
const EXPORT_MAX_H = 150;

function applyStrokeStyle(ctx: CanvasRenderingContext2D, dpr: number) {
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(2, 2 * dpr);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function canvasHasInk(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width < 1 || canvas.height < 1) return false;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a > 8 && (r < 250 || g < 250 || b < 250)) return true;
  }
  return false;
}

async function loadImageOntoCanvas(
  canvas: HTMLCanvasElement,
  url: string,
): Promise<boolean> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load failed"));
      img.src = url;
    });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(
      canvas.width / Math.max(1, img.naturalWidth),
      canvas.height / Math.max(1, img.naturalHeight),
      1,
    );
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    ctx.drawImage(img, x, y, w, h);
    applyStrokeStyle(ctx, window.devicePixelRatio || 1);
    return true;
  } catch {
    return false;
  }
}

function downscaleToBlob(source: HTMLCanvasElement): Promise<Blob | null> {
  const scale = Math.min(
    EXPORT_MAX_W / Math.max(1, source.width),
    EXPORT_MAX_H / Math.max(1, source.height),
    1,
  );
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const off = document.createElement("canvas");
  off.width = EXPORT_MAX_W;
  off.height = EXPORT_MAX_H;
  const ctx = off.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, off.width, off.height);
  const x = (EXPORT_MAX_W - w) / 2;
  const y = (EXPORT_MAX_H - h) / 2;
  ctx.drawImage(source, x, y, w, h);
  return new Promise((resolve) => off.toBlob((b) => resolve(b), "image/png"));
}

export function SignaturePadField({
  label,
  valueUrl,
  onChange,
  disabled,
  memberId,
  uploadFolder,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const dprRef = useRef(1);
  const orientationLocked = useRef(false);

  const paintBlank = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    applyStrokeStyle(ctx, dprRef.current);
  }, []);

  const resizeCanvas = useCallback(
    async (opts?: { loadUrl?: string | null; preserve?: boolean }) => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      const cssW = Math.max(120, Math.floor(rect.width));
      const cssH = Math.max(120, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dprRef.current = dpr;
      const nextW = Math.floor(cssW * dpr);
      const nextH = Math.floor(cssH * dpr);

      let snapshot: ImageData | null = null;
      if (opts?.preserve && canvas.width > 0 && canvas.height > 0) {
        const prev = canvas.getContext("2d");
        if (prev) {
          try {
            snapshot = prev.getImageData(0, 0, canvas.width, canvas.height);
          } catch {
            snapshot = null;
          }
        }
      }

      const prevW = canvas.width;
      const prevH = canvas.height;
      canvas.width = nextW;
      canvas.height = nextH;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (snapshot && prevW > 0 && prevH > 0) {
        const tmp = document.createElement("canvas");
        tmp.width = prevW;
        tmp.height = prevH;
        tmp.getContext("2d")?.putImageData(snapshot, 0, 0);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, nextW, nextH);
        ctx.drawImage(tmp, 0, 0, nextW, nextH);
        applyStrokeStyle(ctx, dpr);
        return;
      }

      if (opts?.loadUrl) {
        const ok = await loadImageOntoCanvas(canvas, opts.loadUrl);
        if (!ok) {
          paintBlank();
          toast.message("Gambar TTD lama tidak bisa diedit — coret ulang");
        }
        return;
      }

      paintBlank();
    },
    [paintBlank],
  );

  useEffect(() => {
    if (!open) {
      if (orientationLocked.current) {
        const orient = screen.orientation as ScreenOrientation & {
          unlock?: () => void;
        };
        try {
          orient.unlock?.();
        } catch {
          /* ignore */
        }
        orientationLocked.current = false;
      }
      return;
    }

    const orient = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    void orient.lock?.("landscape").then(
      () => {
        orientationLocked.current = true;
      },
      () => {
        orientationLocked.current = false;
      },
    );

    let cancelled = false;
    const boot = async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (cancelled) return;
      await resizeCanvas({ loadUrl: valueUrl || null, preserve: false });
    };
    void boot();

    const onResize = () => {
      void resizeCanvas({ preserve: true });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [open, valueUrl, resizeCanvas]);

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
    if (!canvasHasInk(canvas)) {
      toast.error("Corekan tanda tangan dulu sebelum menyimpan");
      return;
    }
    setSaving(true);
    try {
      const blob = await downscaleToBlob(canvas);
      if (!blob) throw new Error("Gagal membuat gambar tanda tangan");
      const file = new File([blob], `ttd-${Date.now()}.png`, {
        type: "image/png",
      });
      const form = new FormData();
      form.set("file", file);
      form.set("folder", uploadFolder || (memberId ? "member-ttd" : "ukt-ttd"));
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Gagal mengunggah tanda tangan");
      }
      if (memberId) {
        const persist = await fetch(
          `/api/admin/members/${encodeURIComponent(memberId)}/signature`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ signatureUrl: data.url }),
          },
        );
        if (!persist.ok) {
          const err = (await persist.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(err.error || "Gagal menyimpan TTD ke profil anggota");
        }
      }
      onChange(data.url);
      setOpen(false);
      toast.success(
        memberId
          ? "Tanda tangan disimpan ke arsip anggota"
          : "Tanda tangan disimpan",
      );
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
        <DialogContent
          className="fixed inset-0 top-0 left-0 z-[60] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 ring-0 sm:max-w-none"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
            paddingLeft: "env(safe-area-inset-left)",
            paddingRight: "env(safe-area-inset-right)",
          }}
        >
          <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12 text-left">
            <DialogTitle>Tanda tangan — {label}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Corekan di area putih (jari / stylus / mouse). Putar ke landscape
              bila memungkinkan.
            </p>
          </DialogHeader>
          <div
            ref={wrapRef}
            className="min-h-0 flex-1 overscroll-none bg-muted/40 p-2 sm:p-3"
          >
            <canvas
              ref={canvasRef}
              className="h-full w-full touch-none overscroll-none rounded-md border bg-white"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
            <Button type="button" variant="outline" onClick={paintBlank}>
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

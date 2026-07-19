"use client";

import { useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  documentProxyUrl,
  formatFileSize,
} from "@/lib/document-url";

function isImageType(contentType: string | null, url: string) {
  if (contentType?.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i.test(url);
}

function isPdfType(contentType: string | null, url: string) {
  if (contentType?.includes("pdf")) return true;
  return /\.pdf(\?|$)/i.test(url);
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  title,
  url,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url: string | null;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sizeLabel, setSizeLabel] = useState("—");
  const [contentType, setContentType] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !url) {
      setLoading(false);
      setError(null);
      setSizeLabel("—");
      setContentType(null);
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    let cancelled = false;
    let created: string | null = null;

    async function load() {
      setLoading(true);
      setError(null);
      setSizeLabel("…");
      try {
        const res = await fetch(documentProxyUrl(url!), { cache: "no-store" });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error || "Gagal memuat dokumen");
        }
        const type = res.headers.get("content-type");
        const lenHeader = res.headers.get("content-length");
        const blob = await res.blob();
        if (cancelled) return;
        const size =
          lenHeader && Number.isFinite(Number(lenHeader))
            ? Number(lenHeader)
            : blob.size;
        created = URL.createObjectURL(blob);
        setObjectUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return created;
        });
        setContentType(type || blob.type || null);
        setSizeLabel(formatFileSize(size));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Gagal memuat dokumen");
          setSizeLabel("—");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  function handlePrint() {
    if (!objectUrl) return;
    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        return;
      } catch {
        // fall through
      }
    }
    const w = window.open(
      "",
      "_blank",
      "noopener,noreferrer,width=900,height=700",
    );
    if (!w) return;
    const safeTitle = title.replace(/</g, "&lt;");
    if (isImageType(contentType, url || "")) {
      w.document.write(
        `<!doctype html><html><head><title>${safeTitle}</title>
        <style>html,body{margin:0;background:#fff}img{max-width:100%;height:auto;display:block;margin:0 auto}</style>
        </head><body><img src="${objectUrl}" onload="setTimeout(function(){window.focus();window.print()},200)"/></body></html>`,
      );
    } else {
      w.document.write(
        `<!doctype html><html><head><title>${safeTitle}</title>
        <style>html,body,iframe{margin:0;height:100%;width:100%;border:0}</style>
        </head><body><iframe src="${objectUrl}" onload="setTimeout(function(){try{this.contentWindow.print()}catch(e){window.print()}},300)"></iframe></body></html>`,
      );
    }
    w.document.close();
  }

  const kind = objectUrl
    ? isImageType(contentType, url || "")
      ? "image"
      : isPdfType(contentType, url || "")
        ? "pdf"
        : "other"
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-3 sm:max-w-3xl"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>{title || "Dokumen"}</DialogTitle>
          <DialogDescription>
            Ukuran:{" "}
            <span className="font-medium text-foreground">{sizeLabel}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[280px] flex-1 overflow-auto rounded-lg border bg-muted/30">
          {loading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Memuat dokumen…
            </p>
          ) : error ? (
            <p className="p-8 text-center text-sm text-destructive">{error}</p>
          ) : objectUrl && kind === "image" ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={objectUrl}
                alt={title}
                className="mx-auto max-h-[60vh] w-auto max-w-full object-contain p-2"
              />
              <iframe
                ref={iframeRef}
                title={`${title} print`}
                srcDoc={`<!doctype html><html><head><style>@page{margin:12mm}html,body{margin:0}img{max-width:100%;height:auto}</style></head><body><img src="${objectUrl}"/></body></html>`}
                className="pointer-events-none absolute h-0 w-0 opacity-0"
                aria-hidden
              />
            </div>
          ) : objectUrl ? (
            <iframe
              ref={iframeRef}
              title={title}
              src={objectUrl}
              className="h-[60vh] w-full border-0 bg-white"
            />
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <p className="self-center text-xs text-muted-foreground">
            {contentType || (objectUrl ? "Dokumen siap ditampilkan" : "")}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Tutup
            </Button>
            <Button
              type="button"
              onClick={handlePrint}
              disabled={!objectUrl || loading || Boolean(error)}
            >
              <Printer className="mr-1.5 h-4 w-4" />
              Print
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

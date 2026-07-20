"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Printer } from "lucide-react";
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
        // Pastikan MIME PDF eksplisit agar Chrome viewer tidak gagal.
        const normalizedType =
          type?.includes("pdf") || /\.pdf(\?|$)/i.test(url!)
            ? "application/pdf"
            : type || blob.type || "application/octet-stream";
        const typedBlob =
          blob.type === normalizedType
            ? blob
            : new Blob([blob], { type: normalizedType });
        created = URL.createObjectURL(typedBlob);
        setObjectUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return created;
        });
        setContentType(normalizedType);
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

  function handleOpenTab() {
    if (!objectUrl) return;
    window.open(objectUrl, "_blank", "noopener,noreferrer");
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
          ) : objectUrl && kind === "pdf" ? (
            <object
              data={objectUrl}
              type="application/pdf"
              title={title}
              className="h-[60vh] w-full bg-white"
            >
              <iframe
                ref={iframeRef}
                title={title}
                src={objectUrl}
                className="h-[60vh] w-full border-0 bg-white"
              />
            </object>
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Tutup
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenTab}
              disabled={!objectUrl || loading || Boolean(error)}
            >
              <ExternalLink className="mr-1.5 h-4 w-4" />
              Tab baru
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

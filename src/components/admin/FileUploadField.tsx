"use client";

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type ReactNode,
} from "react";
import { ImageCropDialog } from "@/components/admin/ImageCropDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showAdminFetchError } from "@/lib/admin-client-error";
import { showError, showSuccess } from "@/lib/client-toast";
import {
  compressUploadFile,
  DOCUMENT_COMPRESS_MAX_BYTES,
  getImageDimensions,
  isNearlySquare,
} from "@/lib/compress-image";
import { Camera, CheckCircle2, Loader2, Trash2, Upload } from "lucide-react";

function isPhotoFolder(folder: string) {
  return folder === "photo" || folder.startsWith("members/photo");
}

function fileMatchesAccept(file: File, accept: string) {
  if (!accept.trim()) return true;
  return accept.split(",").some((raw) => {
    const part = raw.trim().toLowerCase();
    if (!part) return false;
    if (part === "image/*") return file.type.startsWith("image/");
    if (part.endsWith("/*")) {
      return file.type.startsWith(part.slice(0, -1));
    }
    if (part.startsWith(".")) {
      return file.name.toLowerCase().endsWith(part);
    }
    return file.type.toLowerCase() === part;
  });
}

function imageFromClipboard(
  e: ClipboardEvent | ReactClipboardEvent,
): File | null {
  const items = e.clipboardData?.items;
  if (items) {
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }
  const files = e.clipboardData?.files;
  if (files) {
    for (const file of files) {
      if (file.type.startsWith("image/")) return file;
    }
  }
  return null;
}

function pasteTargetIsField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function FileUploadField({
  label,
  value,
  onChange,
  onUploaded,
  folder = "pengurus",
  accept = "image/*,application/pdf",
  hint,
  /** Sembunyikan URL di input (dokumen anggota — cegah bocor URL Blob). */
  hideUrl = false,
  /** Kompres otomatis ke ~150 KB sebelum unggah (dokumen Akte/BPJS). */
  compressToMaxBytes,
  /** Default admin; anggota pakai `/api/member/upload`. */
  uploadEndpoint = "/api/admin/upload",
  /** Zona avatar: children jadi target klik/drop. */
  variant = "field",
  children,
  /** Tempel gambar di mana saja (skip input teks). */
  listenWindowPaste = false,
}: {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  /** Dipanggil hanya setelah unggah file berhasil (bukan saat ketik URL). */
  onUploaded?: (url: string) => void;
  folder?: string;
  accept?: string;
  hint?: string;
  hideUrl?: boolean;
  compressToMaxBytes?: number;
  uploadEndpoint?: string;
  variant?: "field" | "avatar";
  children?: ReactNode;
  listenWindowPaste?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const ingestRef = useRef<(file: File | null) => Promise<void>>(
    async () => {},
  );
  const hasFile = Boolean(value?.trim());
  const photoFolder = isPhotoFolder(folder);
  const shouldCompress =
    compressToMaxBytes != null ||
    folder.startsWith("members/akte") ||
    folder.startsWith("members/bpjs") ||
    folder === "akte" ||
    folder === "bpjs" ||
    photoFolder;
  const maxBytes = compressToMaxBytes ?? DOCUMENT_COMPRESS_MAX_BYTES;
  const dropHint = photoFolder
    ? "Lepas foto di sini, atau tempel (Ctrl+V)"
    : "Lepas file di sini, atau tempel gambar (Ctrl+V)";

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      let toUpload = file;
      if (shouldCompress) {
        toUpload = await compressUploadFile(file, maxBytes);
      }
      const body = new FormData();
      body.set("file", toUpload);
      body.set("folder", folder);
      const res = await fetch(uploadEndpoint, { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
      if (!res.ok) {
        showAdminFetchError(res, data, "Gagal upload");
        return;
      }
      const url = String(data.url ?? "");
      if (!url) {
        showError("Gagal upload");
        return;
      }
      onChange(url);
      onUploaded?.(url);
      const kb = Math.round(toUpload.size / 1024);
      showSuccess(
        shouldCompress
          ? photoFolder
            ? `Foto diunggah (${kb} KB)`
            : `Dokumen diunggah (${kb} KB)`
          : "File berhasil diunggah",
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal mengunggah");
    } finally {
      setUploading(false);
    }
  }

  async function ingestFile(file: File | null) {
    if (!file || uploading || cropFile) return;
    if (!fileMatchesAccept(file, accept)) {
      showError(
        photoFolder || accept.includes("image/")
          ? "Hanya file gambar (JPG/PNG/WebP)"
          : "Jenis file tidak didukung",
      );
      return;
    }
    if (photoFolder && !file.type.startsWith("image/")) {
      showError("Hanya file gambar (JPG/PNG/WebP)");
      return;
    }
    if (photoFolder && file.type.startsWith("image/")) {
      try {
        const { width, height } = await getImageDimensions(file);
        if (!isNearlySquare(width, height)) {
          setCropFile(file);
          return;
        }
      } catch {
        showError("Gagal membaca gambar");
        return;
      }
    }
    await uploadFile(file);
  }
  ingestRef.current = ingestFile;

  function onDragEnter(e: ReactDragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragOver(e: ReactDragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(e: ReactDragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDrop(e: ReactDragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    void ingestFile(file);
  }

  function onPasteLocal(e: ReactClipboardEvent) {
    const file = imageFromClipboard(e);
    if (!file) return;
    e.preventDefault();
    void ingestFile(file);
  }

  useEffect(() => {
    if (!listenWindowPaste) return;
    function onPaste(e: ClipboardEvent) {
      if (pasteTargetIsField(e.target)) return;
      const file = imageFromClipboard(e);
      if (!file) return;
      e.preventDefault();
      void ingestRef.current(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [listenWindowPaste]);

  const dropProps = {
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    onPaste: onPasteLocal,
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      className="hidden"
      onChange={(e) => {
        void ingestFile(e.target.files?.[0] ?? null);
        e.target.value = "";
      }}
    />
  );

  const cropDialog = (
    <ImageCropDialog
      file={cropFile}
      open={!!cropFile}
      onCancel={() => setCropFile(null)}
      onConfirm={(cropped) => {
        setCropFile(null);
        void uploadFile(cropped);
      }}
    />
  );

  if (variant === "avatar") {
    return (
      <div className="relative shrink-0">
        {cropDialog}
        {fileInput}
        <button
          type="button"
          disabled={uploading}
          aria-label={label}
          title={hint || dropHint}
          tabIndex={0}
          className={`group relative block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-inkai-red ${
            dragging ? "ring-2 ring-inkai-red ring-offset-2" : ""
          }`}
          {...dropProps}
          onClick={() => {
            if (!uploading) inputRef.current?.click();
          }}
        >
          {children}
          <span
            className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/35 text-white transition-opacity ${
              uploading || dragging
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
            }`}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </span>
        </button>
        {hasFile ? (
          <button
            type="button"
            disabled={uploading}
            className="absolute -bottom-1 -right-1 rounded-full border bg-background p-1 text-destructive shadow-sm hover:bg-muted"
            aria-label="Hapus foto"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange("");
            }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {cropDialog}
      <Label>{label}</Label>
      <div
        tabIndex={0}
        className={`rounded-md border border-dashed p-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inkai-red ${
          dragging
            ? "border-inkai-red bg-inkai-red/5"
            : "border-transparent"
        }`}
        {...dropProps}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {hideUrl ? (
            <div
              className={`flex min-h-9 flex-1 items-center gap-2 rounded-md border px-3 text-sm ${
                hasFile
                  ? "border-emerald-500/40 bg-emerald-500/5 text-foreground"
                  : "border-input bg-background text-muted-foreground"
              }`}
              onClick={() => {
                if (!uploading) inputRef.current?.click();
              }}
            >
              {hasFile ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    {photoFolder ? "Foto sudah diunggah" : "Dokumen sudah diunggah"}
                  </span>
                </>
              ) : (
                <span>{photoFolder ? "Belum ada foto" : "Belum ada dokumen"}</span>
              )}
            </div>
          ) : (
            <Input
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://… atau unggah file"
            />
          )}
          {fileInput}
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              className="gap-1.5"
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Unggah
            </Button>
            {hideUrl && hasFile ? (
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                className="gap-1.5 text-destructive"
                onClick={() => onChange("")}
                aria-label={photoFolder ? "Hapus foto" : "Hapus dokumen"}
              >
                <Trash2 className="h-4 w-4" />
                Hapus
              </Button>
            ) : null}
          </div>
        </div>
        {hint ? (
          <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
        ) : null}
        {photoFolder || !hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{dropHint}</p>
        ) : null}
      </div>
      {!hideUrl &&
      value &&
      (value.match(/\.(png|jpe?g|webp|gif)(\?|$)/i) ||
        value.includes("blob.vercel-storage") ||
        value.includes("/image")) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="Preview"
          className="mt-1 h-16 w-16 rounded-lg border object-cover"
        />
      ) : null}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError, showSuccess } from "@/lib/client-toast";
import { CheckCircle2, Loader2, Trash2, Upload } from "lucide-react";

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
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const hasFile = Boolean(value?.trim());

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("folder", folder);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal upload");
        return;
      }
      const url = String(data.url);
      onChange(url);
      onUploaded?.(url);
      showSuccess("File berhasil diunggah");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {hideUrl ? (
          <div
            className={`flex min-h-9 flex-1 items-center gap-2 rounded-md border px-3 text-sm ${
              hasFile
                ? "border-emerald-500/40 bg-emerald-500/5 text-foreground"
                : "border-input bg-background text-muted-foreground"
            }`}
          >
            {hasFile ? (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Dokumen sudah diunggah</span>
              </>
            ) : (
              <span>Belum ada dokumen</span>
            )}
          </div>
        ) : (
          <Input
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://… atau unggah file"
          />
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
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
              aria-label="Hapus dokumen"
            >
              <Trash2 className="h-4 w-4" />
              Hapus
            </Button>
          ) : null}
        </div>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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

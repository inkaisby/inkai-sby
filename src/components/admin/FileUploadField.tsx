"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError, showSuccess } from "@/lib/client-toast";
import { Loader2, Upload } from "lucide-react";

export function FileUploadField({
  label,
  value,
  onChange,
  folder = "pengurus",
  accept = "image/*,application/pdf",
  hint,
}: {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  folder?: string;
  accept?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
      onChange(String(data.url));
      showSuccess("File berhasil diunggah");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… atau unggah file"
        />
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
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          className="gap-1.5 shrink-0"
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Unggah
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {value &&
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

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cloud, ExternalLink, Loader2, HardDrive } from "lucide-react";
import { showError, showSuccess } from "@/lib/client-toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  folder: string;
  onSuccess: (url: string) => void;
};

export function GoogleDriveImportDialog({
  open,
  onOpenChange,
  title,
  folder,
  onSuccess,
}: Props) {
  const [driveUrl, setDriveUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    const trimmed = driveUrl.trim();
    if (!trimmed) {
      showError("Masukkan tautan Google Drive terlebih dahulu.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/drive-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driveUrl: trimmed,
          folder,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengimpor file dari Google Drive.");
      }

      showSuccess("File dari Google Drive berhasil diimpor.");
      onSuccess(data.url);
      setDriveUrl("");
      onOpenChange(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal mengimpor file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Impor file dokumen langsung dari Google Drive.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="gdrive-url" className="text-xs font-medium">
              Tautan Berbagi Google Drive
            </Label>
            <Input
              id="gdrive-url"
              placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              className="text-xs font-mono h-9"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="rounded-md border bg-muted/40 p-2.5 text-[11px] text-muted-foreground space-y-1">
            <p className="font-medium text-foreground flex items-center gap-1">
              <Cloud className="h-3.5 w-3.5 text-blue-500" />
              Petunjuk Tautan Google Drive:
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Buka file di Google Drive lalu klik tombol <strong>Bagikan (Share)</strong>.</li>
              <li>Ubah akses umum menjadi: <strong>Siapa saja yang memiliki link</strong> (Anyone with the link).</li>
              <li>Salin tautan dan tempelkan pada kolom di atas.</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs h-8"
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleImport}
            disabled={loading || !driveUrl.trim()}
            className="text-xs h-8 gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Mengunduh...
              </>
            ) : (
              <>
                <ExternalLink className="h-3.5 w-3.5" />
                Impor File
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


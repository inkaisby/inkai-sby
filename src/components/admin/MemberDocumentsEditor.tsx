"use client";

import { useState } from "react";
import { CheckCircle2, Eye, HardDrive, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUploadField } from "@/components/admin/FileUploadField";
import { GoogleDriveImportDialog } from "@/components/admin/GoogleDriveImportDialog";
import { showError, showSuccess } from "@/lib/client-toast";

export function MemberDocumentsEditor({
  memberId,
  birthCertificateUrl,
  bpjsCardUrl,
  bpjsCardNumber,
  onPreview,
  onSaved,
}: {
  memberId: string;
  birthCertificateUrl?: string | null;
  bpjsCardUrl?: string | null;
  bpjsCardNumber?: string | null;
  onPreview: (title: string, url: string) => void;
  onSaved: (next: {
    birthCertificateUrl: string | null;
    bpjsCardUrl: string | null;
    bpjsCardNumber: string | null;
  }) => void;
}) {
  const [akte, setAkte] = useState(birthCertificateUrl ?? "");
  const [bpjs, setBpjs] = useState(bpjsCardUrl ?? "");
  const [bpjsNo, setBpjsNo] = useState(bpjsCardNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [scanningBpjs, setScanningBpjs] = useState(false);
  const [bpjsOcrDetected, setBpjsOcrDetected] = useState(false);

  // Dialog Google Drive
  const [driveDialog, setDriveDialog] = useState<{
    open: boolean;
    field: "birthCertificateUrl" | "bpjsCardUrl";
    title: string;
    folder: string;
  } | null>(null);

  const [prevMemberId, setPrevMemberId] = useState(memberId);
  if (prevMemberId !== memberId) {
    setPrevMemberId(memberId);
    setAkte(birthCertificateUrl ?? "");
    setBpjs(bpjsCardUrl ?? "");
    setBpjsNo(bpjsCardNumber ?? "");
    setBpjsOcrDetected(false);
  }

  const dirty =
    (akte.trim() || null) !== (birthCertificateUrl?.trim() || null) ||
    (bpjs.trim() || null) !== (bpjsCardUrl?.trim() || null) ||
    (bpjsNo.replace(/\s+/g, "").trim() || null) !==
      (bpjsCardNumber?.replace(/\s+/g, "").trim() || null);

  async function scanBpjsNumber(fileUrl: string) {
    if (!fileUrl) return;
    setScanningBpjs(true);
    try {
      const res = await fetch("/api/admin/ocr-bpjs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.bpjsNumber) {
        setBpjsNo(data.bpjsNumber);
        setBpjsOcrDetected(true);
        showSuccess(`Nomor BPJS terisi otomatis: ${data.bpjsNumber}`);

        // Update nomor BPJS ke profil anggota
        await fetch(`/api/admin/members/${memberId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "set_documents",
            bpjsCardNumber: data.bpjsNumber,
          }),
        });

        onSaved({
          birthCertificateUrl: akte || null,
          bpjsCardUrl: fileUrl,
          bpjsCardNumber: data.bpjsNumber,
        });
      }
    } catch {
      /* Abaikan kegagalan OCR agar tidak mengganggu alur simpan */
    } finally {
      setScanningBpjs(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_documents",
          birthCertificateUrl: akte.trim() || null,
          bpjsCardUrl: bpjs.trim() || null,
          bpjsCardNumber: bpjsNo.replace(/\s+/g, "").trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(
          (typeof data.error === "string" && data.error) ||
            "Gagal menyimpan dokumen",
        );
        return;
      }
      showSuccess(data.message || "Dokumen disimpan");
      onSaved({
        birthCertificateUrl:
          typeof data.birthCertificateUrl === "string"
            ? data.birthCertificateUrl
            : data.birthCertificateUrl ?? null,
        bpjsCardUrl:
          typeof data.bpjsCardUrl === "string"
            ? data.bpjsCardUrl
            : data.bpjsCardUrl ?? null,
        bpjsCardNumber:
          typeof data.bpjsCardNumber === "string"
            ? data.bpjsCardNumber
            : data.bpjsCardNumber ?? null,
      });
    } finally {
      setSaving(false);
    }
  }

  async function uploadAndSave(
    field: "birthCertificateUrl" | "bpjsCardUrl",
    url: string,
  ) {
    if (field === "birthCertificateUrl") setAkte(url);
    else setBpjs(url);

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        action: "set_documents",
        [field]: url,
      };
      if (field === "bpjsCardUrl" && bpjsNo.trim()) {
        body.bpjsCardNumber = bpjsNo.replace(/\s+/g, "").trim();
      }
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(
          (typeof data.error === "string" && data.error) ||
            "Gagal menyimpan dokumen",
        );
        return;
      }
      showSuccess("Dokumen diunggah & disimpan");
      onSaved({
        birthCertificateUrl:
          field === "birthCertificateUrl"
            ? url
            : birthCertificateUrl ?? null,
        bpjsCardUrl: field === "bpjsCardUrl" ? url : bpjsCardUrl ?? null,
        bpjsCardNumber:
          typeof data.bpjsCardNumber === "string"
            ? data.bpjsCardNumber
            : bpjsCardNumber ?? null,
      });

      // Jika kartu BPJS baru saja diunggah, otomatis scan nomor kartu
      if (field === "bpjsCardUrl") {
        void scanBpjsNumber(url);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Akte Kelahiran */}
      <div className="space-y-2">
        <FileUploadField
          label="Akte kelahiran"
          value={akte}
          folder="members/akte"
          hideUrl
          compressToMaxBytes={150 * 1024}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          hint="Foto/scan otomatis dikompres maks. 150 KB (PDF hanya jika sudah ≤150 KB)"
          onChange={setAkte}
          onUploaded={(url) => void uploadAndSave("birthCertificateUrl", url)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 px-2.5 text-muted-foreground hover:text-foreground"
            onClick={() =>
              setDriveDialog({
                open: true,
                field: "birthCertificateUrl",
                title: "Pilih Akte Kelahiran dari Google Drive",
                folder: "members/akte",
              })
            }
          >
            <HardDrive className="h-3.5 w-3.5 text-blue-500" />
            Pilih dari Google Drive
          </Button>

          {akte ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-inkai-red hover:bg-inkai-red/5 text-xs"
              onClick={() => onPreview("Akte kelahiran", akte)}
            >
              <Eye className="h-3.5 w-3.5" />
              Lihat akte
            </Button>
          ) : null}
        </div>
      </div>

      {/* Kartu BPJS */}
      <div className="space-y-2">
        <FileUploadField
          label="Kartu BPJS"
          value={bpjs}
          folder="members/bpjs"
          hideUrl
          compressToMaxBytes={150 * 1024}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          hint="Foto/scan otomatis dikompres maks. 150 KB (PDF hanya jika sudah ≤150 KB)"
          onChange={setBpjs}
          onUploaded={(url) => void uploadAndSave("bpjsCardUrl", url)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 px-2.5 text-muted-foreground hover:text-foreground"
            onClick={() =>
              setDriveDialog({
                open: true,
                field: "bpjsCardUrl",
                title: "Pilih Kartu BPJS dari Google Drive",
                folder: "members/bpjs",
              })
            }
          >
            <HardDrive className="h-3.5 w-3.5 text-blue-500" />
            Pilih dari Google Drive
          </Button>

          {bpjs ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-inkai-red hover:bg-inkai-red/5 text-xs"
              onClick={() => onPreview("Kartu BPJS", bpjs)}
            >
              <Eye className="h-3.5 w-3.5" />
              Lihat BPJS
            </Button>
          ) : null}
        </div>
      </div>

      {/* Nomor BPJS dengan OCR Auto-Detect */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={`bpjs-no-${memberId}`} className="text-xs font-medium">
            Nomor BPJS (opsional)
          </Label>
          {bpjs ? (
            <button
              type="button"
              disabled={scanningBpjs}
              onClick={() => void scanBpjsNumber(bpjs)}
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-50"
            >
              {scanningBpjs ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Membaca kartu...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  Pindai ulang dari kartu
                </>
              )}
            </button>
          ) : null}
        </div>

        <div className="relative">
          <Input
            id={`bpjs-no-${memberId}`}
            value={bpjsNo}
            onChange={(e) => {
              setBpjsNo(e.target.value);
              setBpjsOcrDetected(false);
            }}
            placeholder="Contoh: 0001234567890"
            className="font-mono text-sm pr-24"
          />
          {scanningBpjs ? (
            <span className="absolute right-2.5 top-2.5 flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Membaca...
            </span>
          ) : bpjsOcrDetected ? (
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Terisi otomatis
            </span>
          ) : null}
        </div>

        {scanningBpjs ? (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-0.5">
            <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
            Sistem sedang membaca 13 digit nomor BPJS dari foto kartu...
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        size="sm"
        disabled={saving || !dirty}
        onClick={() => void save()}
        className="gap-1.5 text-xs h-8"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Simpan dokumen
      </Button>

      {/* Dialog Google Drive */}
      {driveDialog ? (
        <GoogleDriveImportDialog
          open={driveDialog.open}
          onOpenChange={(open) => {
            if (!open) setDriveDialog(null);
          }}
          title={driveDialog.title}
          folder={driveDialog.folder}
          onSuccess={(url) => {
            void uploadAndSave(driveDialog.field, url);
          }}
        />
      ) : null}
    </div>
  );
}

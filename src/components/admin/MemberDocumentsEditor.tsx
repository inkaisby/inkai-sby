"use client";

import { useEffect, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUploadField } from "@/components/admin/FileUploadField";
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

  useEffect(() => {
    setAkte(birthCertificateUrl ?? "");
    setBpjs(bpjsCardUrl ?? "");
    setBpjsNo(bpjsCardNumber ?? "");
  }, [memberId, birthCertificateUrl, bpjsCardUrl, bpjsCardNumber]);

  const dirty =
    (akte.trim() || null) !== (birthCertificateUrl?.trim() || null) ||
    (bpjs.trim() || null) !== (bpjsCardUrl?.trim() || null) ||
    (bpjsNo.replace(/\s+/g, "").trim() || null) !==
      (bpjsCardNumber?.replace(/\s+/g, "").trim() || null);

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
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <FileUploadField
          label="Akte kelahiran"
          value={akte}
          folder="members/akte"
          hideUrl
          hint="PDF atau gambar, maks. 8 MB — unggah langsung tersimpan"
          onChange={setAkte}
          onUploaded={(url) => void uploadAndSave("birthCertificateUrl", url)}
        />
        {akte ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-inkai-red"
            onClick={() => onPreview("Akte kelahiran", akte)}
          >
            <Eye className="h-3.5 w-3.5" />
            Lihat akte
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <FileUploadField
          label="Kartu BPJS"
          value={bpjs}
          folder="members/bpjs"
          hideUrl
          hint="PDF atau gambar, maks. 8 MB — unggah langsung tersimpan"
          onChange={setBpjs}
          onUploaded={(url) => void uploadAndSave("bpjsCardUrl", url)}
        />
        {bpjs ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-inkai-red"
            onClick={() => onPreview("Kartu BPJS", bpjs)}
          >
            <Eye className="h-3.5 w-3.5" />
            Lihat BPJS
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`bpjs-no-${memberId}`}>Nomor BPJS (opsional)</Label>
        <Input
          id={`bpjs-no-${memberId}`}
          value={bpjsNo}
          onChange={(e) => setBpjsNo(e.target.value)}
          placeholder="Contoh: 0001234567890"
          className="font-mono text-sm"
        />
      </div>

      <Button
        type="button"
        size="sm"
        disabled={saving || !dirty}
        onClick={() => void save()}
        className="gap-1.5"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Simpan dokumen
      </Button>
    </div>
  );
}

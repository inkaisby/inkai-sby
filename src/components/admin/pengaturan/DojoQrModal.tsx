"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildDojoQrPayload } from "@/lib/attendance-geofence";
import { showError, showSuccess } from "@/lib/client-toast";
import { Copy, Printer, QrCode } from "lucide-react";

interface DojoQrModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dojo: {
    id: string;
    name: string;
    address?: string | null;
    schedule?: string | null;
    branchName?: string | null;
  } | null;
}

export function DojoQrModal({ open, onOpenChange, dojo }: DojoQrModalProps) {
  const [copied, setCopied] = useState(false);

  if (!dojo) return null;

  const targetDojo = dojo;
  const payload = buildDojoQrPayload(targetDojo.id, targetDojo.name);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&margin=10&data=${encodeURIComponent(payload)}`;

  async function handleCopyPayload() {
    try {
      if (typeof window !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(payload);
      }
      setCopied(true);
      showSuccess("Kode QR Dojo disalin");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showError("Gagal menyalin kode");
    }
  }

  function handlePrintPoster() {
    if (!targetDojo) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showError("Popup diblokir oleh browser. Izinkan popup untuk mencetak.");
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>POSTER QR ABSENSI - ${targetDojo.name}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      background-color: #fff;
    }
    .poster-box {
      border: 6px solid #C8102E;
      border-radius: 24px;
      padding: 36px;
      max-width: 600px;
      width: 100%;
      box-sizing: border-box;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    .header-logo {
      width: 70px;
      height: 70px;
      margin-bottom: 12px;
    }
    .org-title {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #555;
      text-transform: uppercase;
      margin: 0;
    }
    .dojo-name {
      font-size: 32px;
      font-weight: 900;
      color: #C8102E;
      text-transform: uppercase;
      margin: 8px 0 16px 0;
      line-height: 1.2;
    }
    .tagline {
      font-size: 16px;
      font-weight: 700;
      background: #f4f4f5;
      padding: 10px 16px;
      border-radius: 999px;
      display: inline-block;
      margin-bottom: 24px;
      color: #27272a;
    }
    .qr-frame {
      background: #ffffff;
      border: 3px solid #e4e4e7;
      border-radius: 20px;
      padding: 16px;
      display: inline-block;
      margin-bottom: 24px;
    }
    .qr-img {
      width: 260px;
      height: 260px;
      display: block;
    }
    .instructions {
      font-size: 14px;
      color: #52525b;
      margin-bottom: 20px;
      line-height: 1.5;
    }
    .instructions strong {
      color: #111;
    }
    .footer-info {
      font-size: 12px;
      color: #71717a;
      border-top: 1px dashed #e4e4e7;
      padding-top: 16px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="poster-box">
    <img src="/logo-inkai.png" alt="INKAI" class="header-logo" />
    <p class="org-title">INSTITUT KARATE-DO INDONESIA — SURABAYA</p>
    <h1 class="dojo-name">${targetDojo.name}</h1>
    <div class="tagline">📌 SCAN UNTUK ABSENSI LATIHAN</div>
    <div class="qr-frame">
      <img src="${qrUrl}" alt="QR Dojo ${targetDojo.name}" class="qr-img" />
    </div>
    <div class="instructions">
      Buka menu <strong>Absensi</strong> di portal keanggotaan INKAI Surabaya,<br/>
      ketuk <strong>"Scan Kode QR Ranting"</strong> lalu arahkan kamera ke barcode ini.
    </div>
    <div class="footer-info">
      ${targetDojo.address ? `Alamat: ${targetDojo.address}<br/>` : ""}
      ${targetDojo.schedule ? `Jadwal: ${targetDojo.schedule}<br/>` : ""}
      Portal Keanggotaan INKAI Surabaya • https://inkai-sby.vercel.app
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    }
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <QrCode className="h-5 w-5 text-inkai-red" />
            Barcode / Kode QR Dojo
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {targetDojo.branchName || "INKAI Cabang Surabaya"}
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-inkai-red">
            {targetDojo.name}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Cetak poster ini untuk dipasang di dojo agar karateka dapat melakukan scan absensi.
          </p>

          <div className="mt-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt={`QR Code ${targetDojo.name}`}
              className="h-56 w-56 object-contain"
            />
          </div>

          <p className="mt-3 font-mono text-[11px] text-muted-foreground break-all bg-muted px-2 py-1 rounded">
            {payload}
          </p>

          <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-2 text-xs"
              onClick={() => void handleCopyPayload()}
            >
              <Copy className="h-4 w-4" />
              {copied ? "Tersalin!" : "Salin Kode"}
            </Button>
            <Button
              type="button"
              className="flex-1 gap-2 bg-inkai-red hover:bg-inkai-red/90 text-xs"
              onClick={handlePrintPoster}
            >
              <Printer className="h-4 w-4" />
              Cetak Poster QR
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

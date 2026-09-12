"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SITE_URL } from "@/lib/site";
import { formatMemberName, formatRankLabel, isBlackBeltRank } from "@/lib/belt";
import { showError, showSuccess } from "@/lib/client-toast";
import { CreditCard, Printer, QrCode } from "lucide-react";

export type PrintableMemberItem = {
  id: string;
  fullName: string;
  nia?: string | null;
  currentRank?: string | null;
  dojoName?: string | null;
  mshNumber?: string | null;
};

type CardFormat = "ktp_grid" | "ktp_single" | "grid_3" | "grid_4";

interface MemberBarcodePrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: PrintableMemberItem[];
  title?: string;
}

export function MemberBarcodePrintModal({
  open,
  onOpenChange,
  members,
  title = "Cetak Barcode / Kartu Anggota",
}: MemberBarcodePrintModalProps) {
  const [cardFormat, setCardFormat] = useState<CardFormat>("ktp_grid");
  const [paperSize, setPaperSize] = useState<"A4" | "F4">("A4");
  const [showBelt, setShowBelt] = useState(false);

  if (!open) return null;

  function handlePrintWindow() {
    if (members.length === 0) {
      showError("Tidak ada data anggota untuk dicetak");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showError("Popup diblokir oleh browser. Izinkan popup untuk mencetak.");
      return;
    }

    const isKtpGrid = cardFormat === "ktp_grid";
    const isKtpSingle = cardFormat === "ktp_single";

    const paperSizeCss = isKtpSingle
      ? "@page { size: 85.6mm 54mm landscape; margin: 0; }"
      : paperSize === "F4"
        ? "@page { size: 215mm 330mm portrait; margin: 8mm; }"
        : "@page { size: A4 portrait; margin: 8mm; }";

    const gridLayoutCss = isKtpSingle
      ? "display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; margin: 0;"
      : isKtpGrid
        ? "display: grid; grid-template-columns: repeat(2, 85.6mm); gap: 6mm 10mm; justify-content: center; width: 100%;"
        : cardFormat === "grid_4"
          ? "display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; width: 100%;"
          : "display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; width: 100%;";

    const cardsHtml = members
      .map((m) => {
        const name = formatMemberName(m.fullName || "ANGGOTA");
        const niaStr = m.nia?.trim() || m.id;
        const qrValue = `${SITE_URL}/v/${niaStr}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=4&data=${encodeURIComponent(qrValue)}`;
        const beltStr = formatRankLabel(m.currentRank) || "—";
        const dojoStr = m.dojoName?.trim() || "—";
        const showMsh = isBlackBeltRank(m.currentRank) && Boolean(m.mshNumber?.trim());

        if (isKtpGrid || isKtpSingle) {
          return `
            <div class="ktp-card ${isKtpSingle ? "ktp-page-break" : ""}">
              <div class="card-header">
                <img src="/logo-inkai.png" alt="INKAI" class="logo-img" />
                <div class="header-text">
                  <span class="org-title">INSTITUT KARATE-DO INDONESIA</span>
                  <span class="branch-title">CABANG SURABAYA</span>
                </div>
                <span class="card-badge">KARTU ANGGOTA</span>
              </div>
              <div class="card-body">
                <div class="qr-col">
                  <img src="${qrUrl}" alt="QR ${name}" class="qr-img" />
                  <span class="qr-sub">SCAN VERIFIKASI</span>
                </div>
                <div class="info-col">
                  <div class="member-name">${name}</div>
                  <div class="member-nia">NIA ${m.nia ? m.nia.trim() : "—"}</div>
                  ${showMsh ? `<div class="member-msh">No. MSH ${m.mshNumber?.trim()}</div>` : ""}
                  ${showBelt ? `<div class="member-belt">SABUK: ${beltStr}</div>` : ""}
                  <div class="member-dojo">DOJO: ${dojoStr}</div>
                </div>
              </div>
            </div>
          `;
        }

        return `
          <div class="card-item">
            <div class="card-header-v">
              <img src="/logo-inkai.png" alt="INKAI" class="logo-img-v" />
              <div class="header-text-v">
                <span class="org-title-v">INKAI SURABAYA</span>
                <span class="card-label-v">KARTU ANGGOTA</span>
              </div>
            </div>
            <div class="qr-box">
              <img src="${qrUrl}" alt="QR ${name}" class="qr-img-v" />
            </div>
            <div class="member-info">
              <div class="member-name-v">${name}</div>
              <div class="member-nia-v">NIA ${m.nia ? m.nia.trim() : "—"}</div>
              ${showMsh ? `<div class="member-msh-v">No. MSH ${m.mshNumber?.trim()}</div>` : ""}
              ${showBelt ? `<div class="member-belt-v">SABUK: ${beltStr}</div>` : ""}
              <div class="member-dojo-v">${dojoStr}</div>
            </div>
          </div>
        `;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>CETAK KARTU ANGGOTA KTP / CR80 - INKAI SURABAYA</title>
  <style>
    ${paperSizeCss}
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .print-grid {
      ${gridLayoutCss}
      box-sizing: border-box;
    }
    
    /* Style Kartu KTP Standar (85.6mm x 54mm) */
    .ktp-card {
      width: 85.6mm;
      height: 54mm;
      border: 1.5px solid #d4d4d8;
      border-radius: 3.5mm;
      padding: 3mm;
      box-sizing: border-box;
      background: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      break-inside: avoid;
      position: relative;
      overflow: hidden;
    }
    .ktp-page-break {
      page-break-after: always;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1.5px solid #C8102E;
      padding-bottom: 1.5mm;
      margin-bottom: 1.5mm;
    }
    .logo-img {
      width: 6mm;
      height: 6mm;
      object-fit: contain;
    }
    .header-text {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      flex: 1;
      margin-left: 2mm;
    }
    .org-title {
      font-size: 5.5pt;
      font-weight: 900;
      letter-spacing: 0.2px;
      color: #111;
      line-height: 1;
    }
    .branch-title {
      font-size: 5pt;
      font-weight: 800;
      color: #C8102E;
      letter-spacing: 0.2px;
      line-height: 1;
    }
    .card-badge {
      font-size: 4.5pt;
      font-weight: 800;
      background: #C8102E;
      color: #fff;
      padding: 1px 4px;
      border-radius: 2px;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .card-body {
      display: flex;
      align-items: center;
      gap: 3mm;
      flex: 1;
    }
    .qr-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .qr-img {
      width: 25.5mm;
      height: 25.5mm;
      display: block;
    }
    .qr-sub {
      font-size: 3.5pt;
      font-weight: 700;
      color: #71717a;
      margin-top: 1px;
    }
    .info-col {
      display: flex;
      flex-direction: column;
      justify-content: center;
      flex: 1;
      min-width: 0;
      gap: 0.5mm;
      text-align: left;
    }
    .member-name {
      font-size: 8.5pt;
      font-weight: 900;
      text-transform: uppercase;
      color: #111;
      line-height: 1.1;
      margin-bottom: 1px;
      word-break: break-word;
    }
    .member-nia {
      font-size: 8pt;
      font-weight: 800;
      color: #C8102E;
    }
    .member-msh {
      font-size: 6.5pt;
      font-weight: 700;
      color: #b91c1c;
    }
    .member-belt {
      font-size: 6.5pt;
      font-weight: 700;
      color: #27272a;
    }
    .member-dojo {
      font-size: 6pt;
      color: #52525b;
    }

    /* Style Layout Vertical Grid Regular */
    .card-item {
      border: 2px solid #e4e4e7;
      border-radius: 12px;
      padding: 10px;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      break-inside: avoid;
      box-sizing: border-box;
    }
    .card-header-v {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      border-bottom: 1px solid #f4f4f5;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    .logo-img-v { width: 22px; height: 22px; object-fit: contain; }
    .header-text-v { display: flex; flex-direction: column; text-align: left; }
    .org-title-v { font-size: 8px; font-weight: 800; color: #555; }
    .card-label-v { font-size: 7.5px; font-weight: 700; color: #C8102E; }
    .qr-box { background: #fff; border: 1px solid #e4e4e7; border-radius: 8px; padding: 4px; margin-bottom: 6px; }
    .qr-img-v { width: 95px; height: 95px; display: block; }
    .member-info { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 1px; }
    .member-name-v { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #111; line-height: 1.1; }
    .member-nia-v { font-size: 10px; font-weight: 800; color: #C8102E; }
    .member-msh-v { font-size: 8.5px; font-weight: 700; color: #b91c1c; }
    .member-belt-v { font-size: 8.5px; font-weight: 700; color: #3f3f46; }
    .member-dojo-v { font-size: 8.5px; color: #71717a; }
  </style>
</head>
<body>
  <div class="print-grid">
    ${cardsHtml}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 600);
    }
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    showSuccess(`${members.length} kartu ID Card anggota disiapkan untuk dicetak`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <CreditCard className="h-5 w-5 text-inkai-red" />
            {title} ({members.length} Anggota)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="space-y-1">
              <Label className="text-xs">Format Kartu / ID Card</Label>
              <select
                className="h-9 w-full rounded-lg border bg-background px-2 text-xs font-semibold text-inkai-red"
                value={cardFormat}
                onChange={(e) => setCardFormat(e.target.value as CardFormat)}
              >
                <option value="ktp_grid">🪪 ID Card KTP / CR80 (85.6 × 54 mm — 10 kartu/A4)</option>
                <option value="ktp_single">💳 Printer PVC Single (1 Kartu / Halaman)</option>
                <option value="grid_3">📑 3 Kolom Standar ID Card Tegak</option>
                <option value="grid_4">🏷️ 4 Kolom Stiker Label Compact</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Ukuran Kertas</Label>
              <select
                className="h-9 w-full rounded-lg border bg-background px-2 text-xs font-medium"
                value={paperSize}
                disabled={cardFormat === "ktp_single"}
                onChange={(e) => setPaperSize(e.target.value as "A4" | "F4")}
              >
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="F4">F4 Folio (215 × 330 mm)</option>
              </select>
            </div>

            <div className="col-span-2 pt-2 border-t border-border/60">
              <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBelt}
                  onChange={(e) => setShowBelt(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-inkai-red"
                />
                <span>Tampilkan Tingkat Sabuk di Kartu (Opsional)</span>
              </label>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                💡 <strong>Rekomendasi:</strong> Biarkan tidak dicentang jika kartu cetak PVC fisik dipakai permanen. Sabuk/Kyu terbaru akan selalu tampil otomatis secara real-time saat Kode QR discan.
              </p>
            </div>
          </div>

          {/* Pratinjau KTP Card / Badges */}
          <div className="max-h-[360px] overflow-y-auto rounded-xl border border-border/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">
                Pratinjau KTP / ID Card ({members.length} anggota):
              </p>
              <span className="text-[11px] font-mono font-bold text-inkai-red bg-inkai-red/10 px-2 py-0.5 rounded">
                CR80: 85.6 mm × 54 mm
              </span>
            </div>

            <div className="flex flex-col items-center gap-3">
              {members.slice(0, 6).map((m) => {
                const niaStr = m.nia?.trim() || m.id;
                const qrValue = `${SITE_URL}/v/${niaStr}`;
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=4&data=${encodeURIComponent(qrValue)}`;
                const showMsh = isBlackBeltRank(m.currentRank) && Boolean(m.mshNumber?.trim());

                return (
                  <div
                    key={m.id}
                    className="relative w-full max-w-[340px] rounded-xl border-2 border-border bg-gradient-to-br from-card via-background to-card p-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between border-b border-inkai-red/30 pb-1.5 mb-2">
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logo-inkai.png" alt="INKAI" className="h-5 w-5 object-contain" />
                        <div className="text-left">
                          <p className="text-[10px] font-extrabold tracking-tight leading-none text-foreground">
                            INSTITUT KARATE-DO INDONESIA
                          </p>
                          <p className="text-[9px] font-bold text-inkai-red leading-none">
                            CABANG SURABAYA
                          </p>
                        </div>
                      </div>
                      <span className="rounded bg-inkai-red px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                        KARTU ANGGOTA
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="rounded-lg border bg-white p-1 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrUrl} alt={`QR ${m.fullName}`} className="h-20 w-20 object-contain" />
                      </div>

                      <div className="min-w-0 flex-1 text-left space-y-0.5">
                        <p className="text-xs font-extrabold uppercase truncate text-foreground">
                          {formatMemberName(m.fullName)}
                        </p>
                        <p className="text-[11px] font-extrabold text-inkai-red font-mono">
                          NIA {m.nia ? m.nia.trim() : "—"}
                        </p>
                        {showMsh ? (
                          <p className="text-[10px] font-bold text-red-700">
                            No. MSH {m.mshNumber?.trim()}
                          </p>
                        ) : null}
                        {showBelt ? (
                          <p className="text-[10px] font-bold text-foreground/80">
                            SABUK: {formatRankLabel(m.currentRank) || "—"}
                          </p>
                        ) : null}
                        <p className="text-[10px] text-muted-foreground truncate">
                          DOJO: {m.dojoName || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {members.length > 6 ? (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                + {members.length - 6} kartu ID Card anggota lainnya (siap dicetak massal)
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Tutup
            </Button>
            <Button
              type="button"
              className="gap-2 bg-inkai-red hover:bg-inkai-red/90"
              onClick={handlePrintWindow}
            >
              <Printer className="h-4 w-4" />
              Cetak {members.length} ID Card (Ukuran KTP)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

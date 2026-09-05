import { openHtmlPrintWindow } from "@/lib/ukt-print-html";
import type { BeltFeeKey, UktSemester } from "@/lib/ukt";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type UktMatrixPrintRow = {
  no: number;
  dojoName: string;
  putih: number;
  kuning: number;
  hijau: number;
  biru: number;
  cokelat: number;
  total: number;
};

export type UktMatrixPrintData = {
  semester: UktSemester;
  year: number;
  rows: UktMatrixPrintRow[];
  totalPutih: number;
  totalKuning: number;
  totalHijau: number;
  totalBiru: number;
  totalCokelat: number;
  grandTotal: number;
  origin: string;
  printedAt: string;
  sekretariatAddress?: string;
  paper?: "A4" | "F4";
  orientation?: "portrait" | "landscape";
  bidangUjianName?: string;
  orgKetuaCabangName?: string | null;
  strukturKetuaName?: string | null;
  pengprovHeadName?: string | null;
};

export function buildUktMatrixPrintHtml(data: UktMatrixPrintData): string {
  const logoUrl = `${data.origin}/logo-inkai.png`;
  const sekretariat =
    data.sekretariatAddress?.trim() ||
    "Sekretariat: Jl. Raya Kertajaya Indah No. 77 Surabaya";
  const paper = data.paper ?? "A4";
  const orientation = data.orientation ?? "portrait";
  const pageSize =
    paper === "F4"
      ? orientation === "landscape"
        ? "330mm 215mm"
        : "215mm 330mm"
      : `A4 ${orientation}`;

  const rowsHtml = data.rows
    .map(
      (r) => `
      <tr>
        <td style="text-align: center;">${r.no}</td>
        <td style="text-align: left; font-weight: 600;">${escapeHtml(r.dojoName)}</td>
        <td style="text-align: center;">${r.putih || 0}</td>
        <td style="text-align: center;">${r.kuning || 0}</td>
        <td style="text-align: center;">${r.hijau || 0}</td>
        <td style="text-align: center;">${r.biru || 0}</td>
        <td style="text-align: center;">${r.cokelat || 0}</td>
        <td style="text-align: center; font-weight: bold; background-color: #f8fafc;">${r.total}</td>
      </tr>
    `,
    )
    .join("");

  const ketuaName =
    data.orgKetuaCabangName?.trim() ||
    data.strukturKetuaName?.trim() ||
    "Syahril Nasution";
  const bidangName = data.bidangUjianName?.trim() || "Senshi Abdullah";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Rekapitulasi Pendaftaran Peserta Ujian UKT Semester ${data.semester} ${data.year}</title>
  <style>
    @page {
      size: ${pageSize};
      margin: 12mm 15mm;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      color: #0f172a;
      margin: 0;
      padding: 0;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 3px double #1e293b;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .logo {
      width: 65px;
      height: auto;
    }
    .header-text {
      flex: 1;
    }
    .header-text h1 {
      font-size: 14pt;
      font-weight: bold;
      margin: 0 0 2px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header-text h2 {
      font-size: 11pt;
      font-weight: normal;
      margin: 0;
      color: #334155;
    }
    .header-text p {
      font-size: 8.5pt;
      margin: 3px 0 0 0;
      color: #64748b;
    }
    .doc-title {
      text-align: center;
      margin: 15px 0;
    }
    .doc-title h3 {
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 0 0 4px 0;
      text-decoration: underline;
    }
    .doc-title p {
      font-size: 10pt;
      font-weight: bold;
      margin: 0;
      color: #334155;
    }
    table.matrix-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 10pt;
    }
    table.matrix-table th,
    table.matrix-table td {
      border: 1px solid #334155;
      padding: 6px 8px;
    }
    table.matrix-table th {
      background-color: #f1f5f9;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      font-size: 9.5pt;
    }
    table.matrix-table tr.total-row td {
      background-color: #e2e8f0;
      font-weight: bold;
      font-size: 10.5pt;
    }
    .signatures {
      margin-top: 35px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      width: 45%;
    }
    .sig-box p {
      margin: 2px 0;
      font-size: 10pt;
    }
    .sig-space {
      height: 60px;
    }
    .printed-footer {
      margin-top: 25px;
      font-size: 8pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="${logoUrl}" alt="INKAI" class="logo" />
    <div class="header-text">
      <h1>INSTITUT KARATE-DO INDONESIA (INKAI)</h1>
      <h2>PENGURUS CABANG KOTA SURABAYA</h2>
      <p>${escapeHtml(sekretariat)}</p>
    </div>
  </div>

  <div class="doc-title">
    <h3>REKAPITULASI PENDAFTARAN PESERTA UJIAN</h3>
    <p>SEMESTER ${data.semester} TAHUN ${data.year}</p>
  </div>

  <table class="matrix-table">
    <thead>
      <tr>
        <th style="width: 35px;">NO</th>
        <th>NAMA RANTING</th>
        <th style="width: 65px;">PUTIH</th>
        <th style="width: 65px;">KUNING</th>
        <th style="width: 65px;">HIJAU</th>
        <th style="width: 65px;">BIRU</th>
        <th style="width: 65px;">COKLAT</th>
        <th style="width: 75px;">JUMLAH</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="total-row">
        <td colspan="2" style="text-align: center;">JUMLAH / TOTAL</td>
        <td style="text-align: center;">${data.totalPutih}</td>
        <td style="text-align: center;">${data.totalKuning}</td>
        <td style="text-align: center;">${data.totalHijau}</td>
        <td style="text-align: center;">${data.totalBiru}</td>
        <td style="text-align: center;">${data.totalCokelat}</td>
        <td style="text-align: center; color: #b91c1c;">${data.grandTotal}</td>
      </tr>
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-box">
      <p>Mengetahui,</p>
      <p><b>Ketua Cabang INKAI Surabaya</b></p>
      <div class="sig-space"></div>
      <p><b><u>${escapeHtml(ketuaName)}</u></b></p>
    </div>
    <div class="sig-box">
      <p>Surabaya, ${escapeHtml(data.printedAt)}</p>
      <p><b>Ketua Bidang Ujian</b></p>
      <div class="sig-space"></div>
      <p><b><u>${escapeHtml(bidangName)}</u></b></p>
    </div>
  </div>

  <div class="printed-footer">
    <span>Dicetak otomatis dari Sistem INKAI Surabaya (${data.origin})</span>
    <span>Tanggal Cetak: ${escapeHtml(data.printedAt)}</span>
  </div>
</body>
</html>`;
}

export function openUktMatrixPrint(data: UktMatrixPrintData): void {
  openHtmlPrintWindow(buildUktMatrixPrintHtml(data));
}

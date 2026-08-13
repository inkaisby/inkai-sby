import {
  buildLatberRekapFilename,
  buildLatberRekapTotals,
  formatLatberCurrency,
  type LatberRekapRow,
} from "@/lib/latber";
import {
  downloadPdfFromHtml,
  openHtmlPrintWindow,
} from "@/lib/ukt-print-html";

export type LatberRekapPrintData = {
  periodTitle: string;
  feeAmount: number;
  komisiRanting: number;
  rows: LatberRekapRow[];
  origin: string;
  printedAt: string;
  sekretariatAddress?: string;
  includeRanting?: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildLatberRekapPrintHtml(data: LatberRekapPrintData): string {
  const logoUrl = `${data.origin.replace(/\/$/, "")}/logo-inkai.png`;
  const sekretariat =
    data.sekretariatAddress?.trim() ||
    "Sekretariat: Jl. Raya Kertajaya Indah No. 77 Surabaya";
  const includeRanting = data.includeRanting !== false;
  const colCount = includeRanting ? 7 : 6;
  const totals = buildLatberRekapTotals(
    data.rows.length,
    data.feeAmount,
    data.komisiRanting,
  );

  const tableRows =
    data.rows.length === 0
      ? `<tr><td colspan="${colCount}" style="text-align:center;padding:8px 0;">Belum ada peserta disetujui</td></tr>`
      : data.rows
          .map(
            (r) => `
        <tr>
          <td class="c">${r.no}</td>
          <td>${escapeHtml(r.nia)}</td>
          <td>${escapeHtml(r.nama)}</td>
          <td>${escapeHtml(r.sabuk)}</td>
          ${includeRanting ? `<td>${escapeHtml(r.ranting)}</td>` : ""}
          <td class="r">${escapeHtml(formatLatberCurrency(r.biaya))}</td>
          <td>${escapeHtml(r.status)}</td>
        </tr>`,
          )
          .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Rekap Latihan Bersama</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0; background: #fff; color: #000;
      font-family: Calibri, "Segoe UI", Arial, sans-serif;
      font-size: 11px; line-height: 1.4;
    }
    .page { width: 273mm; margin: 0 auto; }
    .kop {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px;
    }
    .kop img { width: 48px; height: 48px; object-fit: contain; flex-shrink: 0; }
    .kop-text { text-align: center; }
    .kop-title { font-size: 15px; font-weight: 700; }
    .kop-city { font-size: 12px; }
    .kop-address { font-size: 10px; }
    .doc-title {
      text-align: center; font-size: 13px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 12px;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th, td { border: 1px solid #000; padding: 4px 6px; }
    th { background: #d9e1f2; font-size: 10px; }
    td.c, th.c { text-align: center; }
    td.r, th.r { text-align: right; }
    .totals { width: 280px; margin-left: auto; font-size: 12px; }
    .totals-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .totals-row.total { border-top: 1px solid #000; padding-top: 6px; margin-top: 6px; font-weight: 700; }
    .footer-date { text-align: center; margin-top: 18px; font-size: 10px; color: #444; }
  </style>
</head>
<body>
  <div class="page">
    <div class="kop">
      <img src="${logoUrl}" alt="Logo INKAI" />
      <div class="kop-text">
        <div class="kop-title">INKAI — INSTITUT KARATE-DO INDONESIA</div>
        <div class="kop-city">KOTA SURABAYA</div>
        <div class="kop-address">${escapeHtml(sekretariat.startsWith("Sekretariat") ? sekretariat : `Sekretariat: ${sekretariat}`)}</div>
      </div>
    </div>
    <h1 class="doc-title">Rekap Latihan Bersama</h1>
    <p style="margin:0 0 10px;">Agenda : ${escapeHtml(data.periodTitle)} · Peserta : ${data.rows.length} orang</p>
    <table>
      <thead>
        <tr>
          <th class="c" style="width:36px;">No</th>
          <th>NIA</th>
          <th>Nama</th>
          <th>Sabuk</th>
          ${includeRanting ? "<th>Ranting</th>" : ""}
          <th class="r">Biaya</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(formatLatberCurrency(totals.subtotal))}</span></div>
      <div class="totals-row"><span>Komisi ranting</span><span>− ${escapeHtml(formatLatberCurrency(totals.komisiTotal))}</span></div>
      <div class="totals-row total"><span>Setor cabang</span><span>${escapeHtml(formatLatberCurrency(totals.grandTotal))}</span></div>
    </div>
    <div class="footer-date">${escapeHtml(data.printedAt)}</div>
  </div>
</body>
</html>`;
}

export function printLatberRekapDocument(data: LatberRekapPrintData): void {
  openHtmlPrintWindow(buildLatberRekapPrintHtml(data));
}

export async function downloadLatberRekapPdf(
  data: LatberRekapPrintData,
  filename = buildLatberRekapFilename(data.periodTitle, "pdf"),
): Promise<void> {
  await downloadPdfFromHtml(buildLatberRekapPrintHtml(data), filename, {
    orientation: "landscape",
  });
}

import { formatLatberCurrency } from "@/lib/latber";
import { openHtmlPrintWindow } from "@/lib/ukt-print-html";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type LatberNotaPrintData = {
  periodTitle: string;
  dojoName?: string;
  komisiPerPerson?: string;
  rows: Array<{
    no: number;
    nia: string;
    nama: string;
    sabuk: string;
    status: string;
    biaya: string;
  }>;
  paidCount: number;
  unpaidCount?: number;
  unpaidAmount?: string;
  subtotal: string;
  komisiTotal: string;
  grandTotal: string;
  origin: string;
  printedAt: string;
  sekretariatAddress?: string;
  bendaharaCabangName?: string;
};

export function buildLatberNotaPrintHtml(data: LatberNotaPrintData): string {
  const logoUrl = `${data.origin}/logo-inkai.png`;
  const sekretariat =
    data.sekretariatAddress?.trim() ||
    "Sekretariat: Jl. Raya Kertajaya Indah No. 77 Surabaya";
  const bendahara = data.bendaharaCabangName?.trim() || "Habibur Rahman";

  const tableRows =
    data.rows.length === 0
      ? `<tr><td colspan="7" style="text-align:center;padding:8px 0;">Belum ada peserta terdaftar</td></tr>`
      : data.rows
          .map(
            (r) => `
        <tr>
          <td style="padding:2px 1px;text-align:center;vertical-align:top;">${r.no}</td>
          <td style="padding:2px 1px;vertical-align:top;">${escapeHtml(r.nia)}</td>
          <td style="padding:2px 1px;vertical-align:top;word-break:break-word;">${escapeHtml(r.nama)}</td>
          <td style="padding:2px 1px;vertical-align:top;">${escapeHtml(r.sabuk)}</td>
          <td style="padding:2px 1px;vertical-align:top;">${escapeHtml(r.status)}</td>
          <td style="padding:2px 1px;text-align:center;vertical-align:top;font-size:14px;">☐</td>
          <td style="padding:2px 1px;text-align:right;vertical-align:top;">${escapeHtml(r.biaya)}</td>
        </tr>`,
          )
          .join("");

  const dojoLine = data.dojoName
    ? `<div style="font-weight:bold;text-transform:uppercase;">RANTING : ${escapeHtml(data.dojoName)}</div>`
    : "";
  const komisiLabel = data.komisiPerPerson
    ? `CASHBACK Ranting (${data.paidCount} × ${escapeHtml(data.komisiPerPerson)})`
    : `CASHBACK Ranting`;
  const unpaidCount = data.unpaidCount ?? 0;
  const unpaidLine =
    unpaidCount > 0 && data.unpaidAmount
      ? `<div style="font-size:10px;color:#92400e;">Termasuk ${unpaidCount} Belum Bayar (${escapeHtml(data.unpaidAmount)})</div>`
      : "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Nota Latihan Bersama</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 10mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0; background: #fff; color: #000;
      font-family: "Courier New", Courier, monospace;
      font-size: 11px; line-height: 1.45;
    }
    .page { width: 100%; max-width: 190mm; margin: 0 auto; }
    .kop {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px;
    }
    .kop img { width: 52px; height: 52px; object-fit: contain; flex-shrink: 0; }
    .kop-text { text-align: center; }
    .kop-title { font-size: 15px; font-weight: 700; }
    .kop-city { font-size: 12px; }
    .kop-address { font-size: 10px; }
    .doc-title {
      text-align: center; font-size: 12px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 14px;
    }
    .meta { margin-bottom: 12px; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px; table-layout: fixed; }
    th { border-bottom: 1px solid #000; text-align: left; padding: 3px 1px; font-size: 10px; }
    th:last-child { text-align: right; }
    th.hadir, td.hadir { width: 36px; text-align: center; }
    .totals { font-size: 11px; }
    .totals-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .totals-row.total { border-top: 1px solid #000; padding-top: 8px; margin-top: 8px; font-weight: 700; font-size: 13px; }
    .signatures {
      display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
      margin-top: 28px; text-align: center; font-size: 11px;
    }
    .sign-space { height: 56px; }
    .sign-line { border-top: 1px solid #000; padding-top: 4px; margin-top: 8px; }
    .footer-date { text-align: center; margin-top: 20px; font-size: 10px; color: #444; }
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
    <h1 class="doc-title">Nota Latihan Bersama</h1>
    <div class="meta">
      <div>Agenda : ${escapeHtml(data.periodTitle)}</div>
      ${dojoLine}
      <div>Jumlah peserta : ${data.paidCount} orang</div>
      ${unpaidLine}
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:28px;text-align:center;">No</th>
          <th style="width:14%;">NIA</th>
          <th>Nama</th>
          <th style="width:16%;">Sabuk</th>
          <th style="width:12%;">Status</th>
          <th class="hadir">Hadir</th>
          <th style="width:14%;text-align:right;">Biaya</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(data.subtotal)}</span></div>
      <div class="totals-row"><span>${komisiLabel}</span><span>− ${escapeHtml(data.komisiTotal)}</span></div>
      <div class="totals-row total"><span>Setor cabang</span><span>${escapeHtml(data.grandTotal)}</span></div>
    </div>
    <div class="signatures">
      <div>
        <div class="sign-space">Ketua Ranting</div>
        <div class="sign-line">( _________________ )</div>
      </div>
      <div>
        <div class="sign-space">Bendahara Cabang</div>
        <div class="sign-line">${escapeHtml(bendahara)}</div>
      </div>
    </div>
    <div class="footer-date">${escapeHtml(data.printedAt)}</div>
  </div>
</body>
</html>`;
}

export function printLatberNotaDocument(data: LatberNotaPrintData): void {
  openHtmlPrintWindow(buildLatberNotaPrintHtml(data));
}

export function formatLatberNotaCurrency(amount: number): string {
  return formatLatberCurrency(amount);
}

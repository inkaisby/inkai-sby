import { openHtmlPrintWindow } from "@/lib/ukt-print-html";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type LatberRosterPrintRow = {
  no: number;
  nia: string;
  nama: string;
  ranting?: string;
  sabuk: string;
  status: string;
  tglDaftar: string;
};

export type LatberRosterPrintData = {
  periodTitle: string;
  dojoLabel: string;
  participantCount: number;
  showRantingColumn: boolean;
  rows: LatberRosterPrintRow[];
  origin: string;
  printedAt: string;
  sekretariatAddress?: string;
};

export function buildLatberRosterPrintHtml(data: LatberRosterPrintData): string {
  const logoUrl = `${data.origin}/logo-inkai.png`;
  const sekretariat =
    data.sekretariatAddress?.trim() ||
    "Sekretariat: Jl. Raya Kertajaya Indah No. 77 Surabaya";
  const colCount = data.showRantingColumn ? 7 : 6;

  const tableRows =
    data.rows.length === 0
      ? `<tr><td colspan="${colCount}" style="text-align:center;padding:8px 0;">Belum ada peserta</td></tr>`
      : data.rows
          .map(
            (r) => `
        <tr>
          <td style="padding:3px 2px;text-align:center;vertical-align:top;">${r.no}</td>
          <td style="padding:3px 2px;vertical-align:top;">${escapeHtml(r.nia)}</td>
          <td style="padding:3px 2px;vertical-align:top;word-break:break-word;">${escapeHtml(r.nama)}</td>
          ${
            data.showRantingColumn
              ? `<td style="padding:3px 2px;vertical-align:top;">${escapeHtml(r.ranting || "—")}</td>`
              : ""
          }
          <td style="padding:3px 2px;vertical-align:top;">${escapeHtml(r.sabuk)}</td>
          <td style="padding:3px 2px;vertical-align:top;">${escapeHtml(r.status)}</td>
          <td style="padding:3px 2px;vertical-align:top;white-space:nowrap;">${escapeHtml(r.tglDaftar)}</td>
        </tr>`,
          )
          .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Daftar Peserta Latihan Bersama</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 10mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0; background: #fff; color: #000;
      font-family: "Courier New", Courier, monospace;
      font-size: 11px; line-height: 1.4;
    }
    .page { width: 100%; max-width: 190mm; margin: 0 auto; }
    .kop {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px;
    }
    .kop img { width: 48px; height: 48px; object-fit: contain; }
    .kop-title { font-size: 14px; font-weight: 700; text-align: center; }
    .kop-city { font-size: 12px; text-align: center; }
    .kop-address { font-size: 10px; text-align: center; }
    .doc-title {
      text-align: center; font-size: 12px; font-weight: 700;
      text-transform: uppercase; margin: 0 0 12px;
    }
    .meta { margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 12px; }
    th { border-bottom: 1px solid #000; text-align: left; padding: 4px 2px; font-size: 10px; }
    th:first-child, td:first-child { width: 28px; text-align: center; }
    .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #444; }
  </style>
</head>
<body>
  <div class="page">
    <div class="kop">
      <img src="${logoUrl}" alt="Logo INKAI" />
      <div>
        <div class="kop-title">INKAI — INSTITUT KARATE-DO INDONESIA</div>
        <div class="kop-city">KOTA SURABAYA</div>
        <div class="kop-address">${escapeHtml(
          sekretariat.startsWith("Sekretariat")
            ? sekretariat
            : `Sekretariat: ${sekretariat}`,
        )}</div>
      </div>
    </div>
    <h1 class="doc-title">Daftar Peserta Latihan Bersama</h1>
    <div class="meta">
      <div>Agenda : ${escapeHtml(data.periodTitle)}</div>
      <div style="font-weight:bold;text-transform:uppercase;">Ranting : ${escapeHtml(data.dojoLabel)}</div>
      <div>Peserta : ${data.participantCount} orang</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>NIA</th>
          <th>Nama</th>
          ${data.showRantingColumn ? "<th>Ranting</th>" : ""}
          <th>Sabuk</th>
          <th>Status</th>
          <th>Tgl daftar</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="footer">${escapeHtml(data.printedAt)}</div>
  </div>
</body>
</html>`;
}

export function printLatberRosterDocument(data: LatberRosterPrintData): void {
  openHtmlPrintWindow(buildLatberRosterPrintHtml(data));
}

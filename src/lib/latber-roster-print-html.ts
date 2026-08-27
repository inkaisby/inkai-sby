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

export type LatberRosterPrintPaper = "A4" | "F4";
export type LatberRosterPrintOrientation = "portrait" | "landscape";

export type LatberRosterPrintData = {
  periodTitle: string;
  dojoLabel: string;
  participantCount: number;
  showRantingColumn: boolean;
  rows: LatberRosterPrintRow[];
  origin: string;
  printedAt: string;
  sekretariatAddress?: string;
  paper?: LatberRosterPrintPaper;
  orientation?: LatberRosterPrintOrientation;
};

export function latberRosterPageSizeCss(
  paper: LatberRosterPrintPaper = "A4",
  orientation: LatberRosterPrintOrientation = "landscape",
): string {
  if (paper === "F4") {
    return orientation === "landscape" ? "330mm 215mm" : "215mm 330mm";
  }
  return `A4 ${orientation}`;
}

export function buildLatberRosterPrintHtml(data: LatberRosterPrintData): string {
  const logoUrl = `${data.origin}/logo-inkai.png`;
  const sekretariat =
    data.sekretariatAddress?.trim() ||
    "Sekretariat: Jl. Raya Kertajaya Indah No. 77 Surabaya";
  const paper = data.paper ?? "A4";
  const orientation = data.orientation ?? "landscape";
  const pageSize = latberRosterPageSizeCss(paper, orientation);
  const colCount = data.showRantingColumn ? 8 : 7;

  const tableRows =
    data.rows.length === 0
      ? `<tr><td colspan="${colCount}" style="text-align:center;padding:8px 0;">Belum ada peserta</td></tr>`
      : data.rows
          .map(
            (r) => `
        <tr>
          <td class="mark">☐</td>
          <td class="no">${r.no}</td>
          <td>${escapeHtml(r.nia)}</td>
          <td>${escapeHtml(r.nama)}</td>
          ${
            data.showRantingColumn
              ? `<td>${escapeHtml(r.ranting || "—")}</td>`
              : ""
          }
          <td>${escapeHtml(r.sabuk)}</td>
          <td>${escapeHtml(r.status)}</td>
          <td>${escapeHtml(r.tglDaftar)}</td>
        </tr>`,
          )
          .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Daftar Peserta Latihan Bersama</title>
  <style>
    @page { size: ${pageSize}; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0; background: #fff; color: #000;
      font-family: "Courier New", Courier, monospace;
      font-size: 10px; line-height: 1.35;
    }
    .page { width: 100%; max-width: 100%; margin: 0 auto; }
    .kop {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px;
    }
    .kop img { width: 44px; height: 44px; object-fit: contain; }
    .kop-title { font-size: 13px; font-weight: 700; text-align: center; }
    .kop-city { font-size: 11px; text-align: center; }
    .kop-address { font-size: 9px; text-align: center; overflow-wrap: anywhere; }
    .doc-title {
      text-align: center; font-size: 11px; font-weight: 700;
      text-transform: uppercase; margin: 0 0 10px;
    }
    .meta { margin-bottom: 10px; overflow-wrap: anywhere; word-break: break-word; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; margin-bottom: 10px; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th, td {
      text-align: left; padding: 3px 4px; vertical-align: top;
      overflow-wrap: anywhere; word-break: break-word;
    }
    th { border-bottom: 1px solid #000; font-size: 9px; }
    th.mark, td.mark, th.no, td.no {
      width: 1%; white-space: nowrap; text-align: center;
    }
    td.mark { font-size: 16px; line-height: 1; }
    .footer { text-align: center; margin-top: 12px; font-size: 9px; color: #444; }
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
          <th class="mark">☐</th>
          <th class="no">No</th>
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

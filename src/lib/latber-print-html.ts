import { formatLatberCurrency } from "@/lib/latber";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type LatberNotaPrintData = {
  periodTitle: string;
  rows: Array<{
    no: number;
    nia: string;
    nama: string;
    sabuk: string;
    biaya: string;
  }>;
  paidCount: number;
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
      ? `<tr><td colspan="5" style="text-align:center;padding:8px 0;">Belum ada peserta lunas</td></tr>`
      : data.rows
          .map(
            (r) => `
        <tr>
          <td style="padding:2px 0;text-align:center;">${r.no}</td>
          <td style="padding:2px 0;">${escapeHtml(r.nia)}</td>
          <td style="padding:2px 0;">${escapeHtml(r.nama)}</td>
          <td style="padding:2px 0;">${escapeHtml(r.sabuk)}</td>
          <td style="padding:2px 0;text-align:right;">${escapeHtml(r.biaya)}</td>
        </tr>`,
          )
          .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Nota Latihan Bersama</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0; background: #fff; color: #000;
      font-family: "Courier New", Courier, monospace;
      font-size: 12px; line-height: 1.5;
    }
    .page { width: 100%; max-width: 186mm; margin: 0 auto; }
    .kop {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      border-bottom: 2px solid #000; padding-bottom: 14px; margin-bottom: 20px;
    }
    .kop img { width: 56px; height: 56px; object-fit: contain; flex-shrink: 0; }
    .kop-text { text-align: center; }
    .kop-title { font-size: 16px; font-weight: 700; }
    .kop-city { font-size: 13px; }
    .kop-address { font-size: 11px; }
    .doc-title {
      text-align: center; font-size: 13px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 20px;
    }
    .meta { margin-bottom: 16px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
    th { border-bottom: 1px solid #000; text-align: left; padding: 4px 0; }
    th:last-child { text-align: right; }
    .totals { font-size: 12px; }
    .totals-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .totals-row.total { border-top: 1px solid #000; padding-top: 8px; margin-top: 8px; font-weight: 700; font-size: 14px; }
    .signatures {
      display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
      margin-top: 32px; text-align: center; font-size: 12px;
    }
    .sign-space { height: 64px; }
    .sign-line { border-top: 1px solid #000; padding-top: 4px; margin-top: 8px; }
    .footer-date { text-align: center; margin-top: 24px; font-size: 11px; color: #444; }
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
      <div>Peserta lunas : ${data.paidCount} orang</div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:32px;text-align:center;">No</th>
          <th>NIA</th>
          <th>Nama</th>
          <th>Sabuk</th>
          <th style="text-align:right;">Biaya</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(data.subtotal)}</span></div>
      <div class="totals-row"><span>Komisi ranting</span><span>− ${escapeHtml(data.komisiTotal)}</span></div>
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

function openHtmlPrintWindow(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 800);
  };

  const doPrint = () => {
    win.focus();
    win.print();
    cleanup();
  };

  const img = doc.querySelector("img");
  if (img && !img.complete) {
    img.addEventListener("load", () => setTimeout(doPrint, 80), { once: true });
    img.addEventListener("error", () => setTimeout(doPrint, 80), { once: true });
    setTimeout(doPrint, 1200);
  } else {
    setTimeout(doPrint, 120);
  }
}

export function printLatberNotaDocument(data: LatberNotaPrintData): void {
  openHtmlPrintWindow(buildLatberNotaPrintHtml(data));
}

export function formatLatberNotaCurrency(amount: number): string {
  return formatLatberCurrency(amount);
}

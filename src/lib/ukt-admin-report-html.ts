import {
  BELT_FEE_KEYS,
  BELT_FEE_LABELS,
  formatRupiahNota,
  type BeltFeeKey,
} from "@/lib/ukt";
import { downloadPdfFromHtml } from "@/lib/ukt-print-html";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type UktAdminReportPrintData = {
  semester: string;
  year: number;
  tanggal: string;
  tempat: string;
  counts: Record<BeltFeeKey, number>;
  pengprovFees: Record<BeltFeeKey, number>;
  sectionITotal: number;
  participantTotal: number;
  salahPenulisanQty: number;
  salahPenulisanFee: number;
  hilangRusakQty: number;
  hilangRusakFee: number;
  sectionIITotal: number;
  setorPengprov: number;
  pengujiCount: number;
  pengujiTotal: number;
  jumlahBersih: number;
  bankFooter: string;
  bukuBaru: string;
  bukuDipakai: string;
  bukuSisa: string;
  origin: string;
  sekretariatAddress?: string;
};

const BELT_LETTER: Record<BeltFeeKey, string> = {
  PUTIH: "a",
  KUNING: "b",
  HIJAU: "c",
  BIRU: "d",
  COKELAT: "e",
};

export function buildUktAdminReportPrintHtml(data: UktAdminReportPrintData): string {
  const logoUrl = `${data.origin}/logo-inkai.png`;
  const sekretariat =
    data.sekretariatAddress?.trim() ||
    "Sekretariat: Jl. Raya Kertajaya Indah No. 77 Surabaya";

  const beltRows = BELT_FEE_KEYS.map((belt) => {
    const n = data.counts[belt];
    const fee = data.pengprovFees[belt];
    const sub = n * fee;
    return `
      <tr>
        <td>${BELT_LETTER[belt]}. Sabuk ${escapeHtml(BELT_FEE_LABELS[belt])}</td>
        <td class="num">${n} Orang</td>
        <td class="num">x ${formatRupiahNota(fee)}</td>
        <td class="num">= ${formatRupiahNota(sub)}</td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Perincian Administrasi UKT ${data.semester} ${data.year}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 10mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: "Times New Roman", Times, serif;
      font-size: 12px;
      line-height: 1.45;
    }
    .page { width: 100%; max-width: 190mm; margin: 0 auto; }
    .header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .header img { width: 56px; height: 56px; object-fit: contain; flex-shrink: 0; }
    .header-text { text-align: center; flex: 0 1 auto; }
    .header-text .org { font-size: 14px; font-weight: 700; letter-spacing: 0.02em; }
    .header-text .city { font-size: 13px; font-weight: 700; }
    .header-text .addr { font-size: 10px; }
    h1 {
      margin: 10px 0 8px;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .meta { margin-bottom: 10px; }
    .meta div { margin: 2px 0; }
    .section-title { font-weight: 700; margin: 10px 0 4px; }
    table.lines { width: 100%; border-collapse: collapse; }
    table.lines td { padding: 2px 4px; vertical-align: top; }
    table.lines td.num { text-align: right; white-space:nowrap; }
    .jumlah-row td { font-weight: 700; border-top: 1px solid #000; padding-top: 4px; }
    .setor {
      margin-top: 10px;
      font-weight: 700;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #000;
      padding-top: 6px;
    }
    .pengprov { margin-top: 12px; }
    .pengprov .row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 2px 0;
    }
    .bersih {
      margin-top: 6px;
      font-weight: 700;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #000;
      padding-top: 6px;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 18px;
      text-align: center;
    }
    .sign-space { height: 48px; }
    .sign-line { border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
    .arsip {
      margin-top: 14px;
      font-size: 11px;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .bank {
      margin-top: 12px;
      background: #1e3a8a;
      color: #fff;
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      padding: 8px 6px;
      letter-spacing: 0.01em;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <img src="${escapeHtml(logoUrl)}" alt="Logo INKAI" />
      <div class="header-text">
        <div class="org">INKAI — INSTITUT KARATE-DO INDONESIA</div>
        <div class="city">KOTA SURABAYA</div>
        <div class="addr">${escapeHtml(sekretariat)}</div>
      </div>
    </div>

    <h1>PERINCIAN ADMINISTRASI UJIAN SEMESTER ${escapeHtml(data.semester)} TAHUN ${data.year}</h1>

    <div class="meta">
      <div>Cabang&nbsp;&nbsp;: KOTA SURABAYA</div>
      <div>Tanggal&nbsp;: ${escapeHtml(data.tanggal)}</div>
      <div>Tempat&nbsp;&nbsp;: ${escapeHtml(data.tempat)}</div>
    </div>

    <div class="section-title">I. BIAYA UJIAN</div>
    <table class="lines">
      <tbody>
        ${beltRows}
        <tr class="jumlah-row">
          <td>Jumlah</td>
          <td class="num">${data.participantTotal} Orang</td>
          <td></td>
          <td class="num">${formatRupiahNota(data.sectionITotal)}</td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">II. BUKU UJIAN</div>
    <table class="lines">
      <tbody>
        <tr>
          <td>Biaya Salah Penulisan</td>
          <td class="num">${data.salahPenulisanQty} Buku</td>
          <td class="num">x ${formatRupiahNota(data.salahPenulisanFee)}</td>
          <td class="num">= ${formatRupiahNota(data.salahPenulisanQty * data.salahPenulisanFee)}</td>
        </tr>
        <tr>
          <td>Buku Baru Hilang/Rusak</td>
          <td class="num">${data.hilangRusakQty} Buku</td>
          <td class="num">x ${formatRupiahNota(data.hilangRusakFee)}</td>
          <td class="num">= ${formatRupiahNota(data.hilangRusakQty * data.hilangRusakFee)}</td>
        </tr>
        <tr class="jumlah-row">
          <td>Jumlah</td>
          <td></td>
          <td></td>
          <td class="num">${formatRupiahNota(data.sectionIITotal)}</td>
        </tr>
      </tbody>
    </table>

    <div class="setor">
      <span>JUMLAH YANG DISETOR KE PENGPROV (I + II)</span>
      <span>${formatRupiahNota(data.setorPengprov)}</span>
    </div>

    <div class="signatures">
      <div>
        <div>Penerima</div>
        <div style="font-size:10px;">PENGKOT INKAI SURABAYA</div>
        <div class="sign-space"></div>
        <div class="sign-line">( _________________ )</div>
      </div>
      <div>
        <div>Penyetor</div>
        <div class="sign-space"></div>
        <div class="sign-line">( _________________ )</div>
      </div>
    </div>

    <div class="pengprov">
      <div class="section-title">PERINCIAN UNTUK PENGPROV :</div>
      <div class="row"><span>1. Jumlah Penerimaan</span><span>${formatRupiahNota(data.setorPengprov)}</span></div>
      <div class="row">
        <span>2. Biaya Penguji (${data.pengujiCount} orang)</span>
        <span>- ${formatRupiahNota(data.pengujiTotal)}</span>
      </div>
      <div class="bersih">
        <span>JUMLAH BERSIH DISETOR</span>
        <span>${formatRupiahNota(data.jumlahBersih)}</span>
      </div>
    </div>

    <div class="signatures" style="margin-top:14px;grid-template-columns:1fr;">
      <div>
        <div>Bendahara Pengprov INKAI Jatim</div>
        <div class="sign-space"></div>
        <div class="sign-line">( _________________ )</div>
      </div>
    </div>

    <div class="arsip">
      <span><strong>ARSIP PENGKOT</strong></span>
      <span>Buku Baru : ${escapeHtml(data.bukuBaru || "—")}</span>
      <span>Dipakai : ${escapeHtml(data.bukuDipakai || "—")}</span>
      <span>Sisa : ${escapeHtml(data.bukuSisa || "—")}</span>
    </div>

    <div class="bank">${escapeHtml(data.bankFooter)}</div>
  </div>
</body>
</html>`;
}

function openHtmlPrintWindow(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 1000);
  };

  win.onafterprint = cleanup;
  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
}

export function printUktAdminReportDocument(data: UktAdminReportPrintData): void {
  openHtmlPrintWindow(buildUktAdminReportPrintHtml(data));
}

export async function downloadUktAdminReportPdf(
  data: UktAdminReportPrintData,
  filename = "perincian-administrasi-ukt.pdf",
): Promise<void> {
  await downloadPdfFromHtml(buildUktAdminReportPrintHtml(data), filename);
}

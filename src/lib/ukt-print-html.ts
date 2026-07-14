import {
  BELT_FEE_KEYS,
  formatRupiahNota,
  type BeltFeeKey,
} from "@/lib/ukt";

export type UktNotaPrintData = {
  notaNo: string;
  semester: string;
  dojoName: string;
  periodTitle: string;
  registeredCount: number;
  counts: Record<BeltFeeKey, number>;
  beltFees: Record<BeltFeeKey, number>;
  komisiRanting: number;
  rusak: number;
  hilang: number;
  subtotalA: number;
  subtotalB: number;
  totalC: number;
  grandTotal: number;
  origin: string;
  printedAt: string;
};

export function buildUktNotaPrintHtml(data: UktNotaPrintData): string {
  const beltRows = BELT_FEE_KEYS.filter((belt) => data.counts[belt] > 0);
  const logoUrl = `${data.origin}/logo-inkai.png`;

  const tableRows =
    beltRows.length === 0
      ? `<tr><td colspan="4" style="text-align:center;padding:8px 0;">Belum ada peserta terdaftar</td></tr>`
      : beltRows
          .map(
            (belt) => `
        <tr>
          <td style="padding:2px 0;">${belt}</td>
          <td style="padding:2px 0;text-align:right;">${data.counts[belt]}</td>
          <td style="padding:2px 0;text-align:right;">${formatRupiahNota(data.beltFees[belt])}</td>
          <td style="padding:2px 0;text-align:right;">${formatRupiahNota(data.counts[belt] * data.beltFees[belt])}</td>
        </tr>`,
          )
          .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Nota UKT ${data.dojoName}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: "Courier New", Courier, monospace;
      font-size: 12px;
      line-height: 1.5;
    }
    .page {
      width: 100%;
      max-width: 186mm;
      margin: 0 auto;
    }
    .kop {
      position: relative;
      min-height: 72px;
      border-bottom: 2px solid #000;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .kop img {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 64px;
      height: 64px;
      object-fit: contain;
    }
    .kop-text { text-align: center; }
    .kop-title { font-size: 16px; font-weight: 700; }
    .kop-city { font-size: 13px; }
    .kop-address { font-size: 11px; }
    .doc-title {
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 0 0 20px;
    }
    .meta { margin-bottom: 20px; font-size: 12px; }
    .meta-row { margin-bottom: 4px; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 12px;
    }
    th {
      border-bottom: 1px solid #000;
      padding: 4px 0;
      text-align: left;
    }
    th:nth-child(n+2), td:nth-child(n+2) { text-align: right; }
    .summary { font-size: 12px; }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .summary-total {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #000;
      padding-top: 8px;
      margin-top: 8px;
      font-size: 14px;
      font-weight: 700;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-top: 32px;
      text-align: center;
      font-size: 12px;
    }
    .sign-space { margin-bottom: 64px; }
    .sign-line { border-top: 1px solid #000; padding-top: 4px; }
    .footer-date {
      margin-top: 16px;
      text-align: center;
      font-size: 11px;
      color: #555;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="kop">
      <img src="${logoUrl}" alt="Logo INKAI" />
      <div class="kop-text">
        <div class="kop-title">INKAI — INSTITUT KARATE-DO INDONESIA</div>
        <div class="kop-city">KOTA SURABAYA</div>
        <div class="kop-address">Sekretariat: Jl. Raya Kertajaya Indah No. 77 Surabaya</div>
      </div>
    </div>

    <h1 class="doc-title">Nota Pembayaran Ujian Kenaikan Tingkat</h1>

    <div class="meta meta-grid">
      <div class="meta-row">Nota No. : ${data.notaNo}</div>
      <div class="meta-row">SEMESTER : ${data.semester}</div>
      <div class="meta-row" style="grid-column:1/-1;font-weight:700;text-transform:uppercase;">
        RANTING : ${data.dojoName}
      </div>
      <div class="meta-row" style="grid-column:1/-1;">Agenda : ${data.periodTitle}</div>
      <div class="meta-row" style="grid-column:1/-1;">Jumlah Peserta : ${data.registeredCount} anggota</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Sabuk</th>
          <th>Jumlah</th>
          <th>Biaya</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>

    <div class="summary">
      <div class="summary-row">
        <span>Subtotal A (Biaya UKT)</span>
        <span>${formatRupiahNota(data.subtotalA)}</span>
      </div>
      <div class="summary-row">
        <span>Subtotal B (Buku Rusak/Hilang)</span>
        <span>${formatRupiahNota(data.subtotalB)}</span>
      </div>
      <div class="summary-row">
        <span>Komisi Ranting (${data.registeredCount} × ${formatRupiahNota(data.komisiRanting)})</span>
        <span>- ${formatRupiahNota(data.totalC)}</span>
      </div>
      <div class="summary-total">
        <span>TOTAL</span>
        <span>${formatRupiahNota(data.grandTotal)}</span>
      </div>
    </div>

    <div class="signatures">
      <div>
        <div class="sign-space">Ketua Ranting</div>
        <div class="sign-line">( _________________ )</div>
      </div>
      <div>
        <div class="sign-space">Bendahara Cabang</div>
        <div class="sign-line">Habibur Rahman</div>
      </div>
    </div>

    <div class="footer-date">${data.printedAt}</div>
  </div>
</body>
</html>`;
}

export function printUktNotaDocument(data: UktNotaPrintData): boolean {
  const html = buildUktNotaPrintHtml(data);
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
  };

  if (printWindow.document.readyState === "complete") {
    setTimeout(triggerPrint, 250);
  } else {
    printWindow.onload = () => setTimeout(triggerPrint, 250);
  }

  printWindow.onafterprint = () => printWindow.close();
  return true;
}

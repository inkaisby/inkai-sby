import {
  BELT_FEE_KEYS,
  formatRupiahNota,
  type BeltFeeKey,
} from "@/lib/ukt";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
  sekretariatAddress?: string;
  bendaharaCabangName?: string;
};

export function buildUktNotaPrintHtml(data: UktNotaPrintData): string {
  const beltRows = BELT_FEE_KEYS.filter((belt) => data.counts[belt] > 0);
  const logoUrl = `${data.origin}/logo-inkai.png`;
  const sekretariat =
    data.sekretariatAddress?.trim() ||
    "Sekretariat: Jl. Raya Kertajaya Indah No. 77 Surabaya";
  const bendahara = data.bendaharaCabangName?.trim() || "Habibur Rahman";

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
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      border-bottom: 2px solid #000;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .kop img {
      width: 56px;
      height: 56px;
      object-fit: contain;
      flex-shrink: 0;
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
        <div class="kop-address">${escapeHtml(sekretariat.startsWith("Sekretariat") ? sekretariat : `Sekretariat: ${sekretariat}`)}</div>
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
        <div class="sign-line">${escapeHtml(bendahara)}</div>
      </div>
    </div>

    <div class="footer-date">${data.printedAt}</div>
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

export function printUktNotaDocument(data: UktNotaPrintData): void {
  openHtmlPrintWindow(buildUktNotaPrintHtml(data));
}

export type UktPesertaPrintData = {
  title: string;
  branchLabel: string;
  rows: Array<{
    no: number;
    nia: string;
    nama: string;
    tempatTanggalLahir: string;
    jenisKelamin: string;
    alamat: string;
    kyu: string;
    kyuBaru: string;
    ranting: string;
  }>;
  origin: string;
  printedPlaceDate: string;
  signatoryTitle: string;
  signatoryName: string;
  sekretariatAddress?: string;
};

export function buildUktPesertaPrintHtml(data: UktPesertaPrintData): string {
  const logoUrl = `${data.origin}/logo-inkai.png`;
  const sekretariatLine = data.sekretariatAddress?.trim()
    ? data.sekretariatAddress.trim().startsWith("Sekretariat")
      ? data.sekretariatAddress.trim()
      : `Sekretariat: ${data.sekretariatAddress.trim()}`
    : "";
  const bodyRows =
    data.rows.length === 0
      ? `<tr><td colspan="9" style="text-align:center;padding:12px;">Belum ada peserta</td></tr>`
      : data.rows
          .map(
            (r) => `
        <tr>
          <td class="c">${r.no}</td>
          <td>${escapeHtml(r.nia)}</td>
          <td class="nama">${escapeHtml(r.nama)}</td>
          <td>${escapeHtml(r.tempatTanggalLahir)}</td>
          <td class="c">${escapeHtml(r.jenisKelamin)}</td>
          <td>${escapeHtml(r.alamat)}</td>
          <td class="c">${escapeHtml(r.kyu)}</td>
          <td class="c">${escapeHtml(r.kyuBaru)}</td>
          <td>${escapeHtml(r.ranting)}</td>
        </tr>`,
          )
          .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(data.title)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm 8mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      line-height: 1.25;
    }
    .page { width: 100%; }
    .kop {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
    }
    .kop-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1;
    }
    .kop img { width: 52px; height: 52px; object-fit: contain; }
    .org-name {
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .cabang {
      font-weight: 700;
      font-size: 12px;
      white-space: nowrap;
      text-transform: uppercase;
    }
    .title {
      text-align: center;
      font-weight: 700;
      font-size: 14px;
      text-decoration: underline;
      text-transform: uppercase;
      margin: 10px 0 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #000;
      padding: 3px 4px;
      vertical-align: top;
      word-wrap: break-word;
    }
    th {
      font-size: 9px;
      text-transform: uppercase;
      background: #f3f3f3;
    }
    td.c { text-align: center; }
    td.nama { font-weight: 600; }
    col.c-no { width: 4%; }
    col.c-nia { width: 9%; }
    col.c-nama { width: 18%; }
    col.c-ttl { width: 14%; }
    col.c-jk { width: 5%; }
    col.c-alamat { width: 22%; }
    col.c-kyu { width: 5%; }
    col.c-kyub { width: 6%; }
    col.c-ranting { width: 17%; }
    .sign {
      margin-top: 28px;
      width: 240px;
      margin-left: auto;
      text-align: center;
    }
    .sign .place { margin-bottom: 4px; }
    .sign .role { margin-bottom: 48px; }
    .sign .name {
      font-weight: 700;
      text-decoration: underline;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="kop">
      <div class="kop-left">
        <img src="${logoUrl}" alt="INKAI" />
        <div class="org-name">Institut Karate-Do Indonesia<br/>Kota Surabaya${
          sekretariatLine
            ? `<br/><span style="font-weight:400;font-size:10px;">${escapeHtml(sekretariatLine)}</span>`
            : ""
        }</div>
      </div>
      <div class="cabang">${escapeHtml(data.branchLabel)}</div>
    </div>
    <div class="title">${escapeHtml(data.title)}</div>
    <table>
      <colgroup>
        <col class="c-no" />
        <col class="c-nia" />
        <col class="c-nama" />
        <col class="c-ttl" />
        <col class="c-jk" />
        <col class="c-alamat" />
        <col class="c-kyu" />
        <col class="c-kyub" />
        <col class="c-ranting" />
      </colgroup>
      <thead>
        <tr>
          <th>No. Urut</th>
          <th>No. Induk Anggota</th>
          <th>Nama</th>
          <th>Tempat Tanggal Lahir</th>
          <th>Jenis Kelamin</th>
          <th>Alamat</th>
          <th>Kyu</th>
          <th>Kyu Baru</th>
          <th>Ranting</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
    <div class="sign">
      <div class="place">${escapeHtml(data.printedPlaceDate)}</div>
      <div class="role">${escapeHtml(data.signatoryTitle)}</div>
      <div class="name">${escapeHtml(data.signatoryName)}</div>
    </div>
  </div>
</body>
</html>`;
}

export function printUktPesertaDocument(data: UktPesertaPrintData): void {
  openHtmlPrintWindow(buildUktPesertaPrintHtml(data));
}

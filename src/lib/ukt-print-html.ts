import {
  formatRupiahNota,
  type NotaBeltLine,
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
  lines: NotaBeltLine[];
  komisiRanting: number;
  rusak: number;
  hilang: number;
  subtotalA: number;
  subtotalB: number;
  totalC: number;
  grandTotal: number;
  unpaidCount?: number;
  unpaidAmount?: number;
  origin: string;
  printedAt: string;
  sekretariatAddress?: string;
  bendaharaCabangName?: string;
};

export function buildUktNotaPrintHtml(data: UktNotaPrintData): string {
  const logoUrl = `${data.origin}/logo-inkai.png`;
  const sekretariat =
    data.sekretariatAddress?.trim() ||
    "Sekretariat: Jl. Raya Kertajaya Indah No. 77 Surabaya";
  const bendahara = data.bendaharaCabangName?.trim() || "Habibur Rahman";
  const unpaidCount = data.unpaidCount ?? 0;
  const unpaidAmount = data.unpaidAmount ?? 0;

  const tableRows =
    data.lines.length === 0
      ? `<tr><td colspan="4" style="text-align:center;padding:8px 0;">Belum ada peserta terdaftar</td></tr>`
      : data.lines
          .map(
            (line) => `
        <tr>
          <td style="padding:2px 0;">${escapeHtml(line.belt)}</td>
          <td style="padding:2px 0;text-align:right;">${line.count}</td>
          <td style="padding:2px 0;text-align:right;">${formatRupiahNota(line.unitFee)}</td>
          <td style="padding:2px 0;text-align:right;">${formatRupiahNota(line.subtotal)}</td>
        </tr>`,
          )
          .join("");

  const unpaidMeta =
    unpaidCount > 0
      ? `<div class="meta-row" style="grid-column:1/-1;font-size:11px;">
        Termasuk ${unpaidCount} Belum Bayar (${formatRupiahNota(unpaidAmount)})
      </div>`
      : "";

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
      ${unpaidMeta}
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
        <span>CASHBACK Ranting (${data.registeredCount} × ${formatRupiahNota(data.komisiRanting)})</span>
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

/** Cetak HTML lewat iframe off-screen — satu sesi, sapu orphan, Cancel tidak print lagi. */
const PRINT_FRAME_ATTR = "data-inkai-print-frame";
const PDF_FRAME_ATTR = "data-inkai-pdf-frame";

let printSessionToken = 0;

function sweepInkaiFrames(attr: string): void {
  document
    .querySelectorAll(`iframe[${attr}="1"]`)
    .forEach((el) => {
      try {
        el.remove();
      } catch {
        /* ignore */
      }
    });
}

export function openHtmlPrintWindow(html: string): void {
  // Batalkan sesi lama + sapu iframe cetak liar sebelum membuat yang baru.
  printSessionToken += 1;
  const session = printSessionToken;
  sweepInkaiFrames(PRINT_FRAME_ATTR);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute(PRINT_FRAME_ATTR, "1");
  // Off-screen (bukan display:none / 0×0) agar Safari/WebKit tetap mencetak.
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1024px;height:768px;border:0;opacity:0;pointer-events:none;";
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

  let printed = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  let mediaQuery: MediaQueryList | null = null;
  let onMediaChange: ((e: MediaQueryListEvent) => void) | null = null;

  const isSessionAlive = () =>
    session === printSessionToken && iframe.isConnected;

  const cleanup = () => {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = undefined;
    }
    if (cleanupTimer) clearTimeout(cleanupTimer);
    if (mediaQuery && onMediaChange) {
      try {
        mediaQuery.removeEventListener("change", onMediaChange);
      } catch {
        /* ignore */
      }
      mediaQuery = null;
      onMediaChange = null;
    }
    try {
      win.onafterprint = null;
    } catch {
      /* ignore */
    }
    cleanupTimer = setTimeout(() => {
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
    }, 800);
  };

  const doPrint = () => {
    if (printed || !isSessionAlive()) return;
    printed = true;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = undefined;
    }

    // afterprint / matchMedia: hapus iframe setelah dialog selesai (Cancel atau Print).
    win.onafterprint = () => {
      if (isSessionAlive()) cleanup();
    };
    try {
      mediaQuery = win.matchMedia("print");
      onMediaChange = (e: MediaQueryListEvent) => {
        if (!e.matches && isSessionAlive()) cleanup();
      };
      mediaQuery.addEventListener("change", onMediaChange);
    } catch {
      /* ignore */
    }
    // Timeout aman jika browser tidak memicu afterprint.
    setTimeout(() => {
      if (isSessionAlive()) cleanup();
    }, 60_000);

    // setTimeout(0): jangan menumpuk print di stack click yang sama.
    setTimeout(() => {
      if (!isSessionAlive()) return;
      try {
        win.focus();
        win.print();
      } catch {
        // Safari/WebKit: fallback popup hanya jika print() throw sebelum dialog.
        try {
          const blob = new Blob([html], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          const popup = window.open(url, "_blank", "noopener,noreferrer");
          if (popup) {
            popup.onload = () => {
              try {
                popup.focus();
                popup.print();
              } catch {
                /* ignore */
              }
              setTimeout(() => URL.revokeObjectURL(url), 2000);
            };
          } else {
            URL.revokeObjectURL(url);
          }
        } catch {
          /* ignore */
        }
        cleanup();
      }
    }, 0);
  };

  const waitImagesThenPrint = () => {
    if (!isSessionAlive()) return;
    const images = Array.from(doc.images);
    if (images.length === 0) {
      setTimeout(doPrint, 120);
      return;
    }
    let pending = images.filter((img) => !img.complete).length;
    if (pending === 0) {
      setTimeout(doPrint, 80);
      return;
    }
    const onDone = () => {
      pending -= 1;
      if (pending <= 0) setTimeout(doPrint, 80);
    };
    for (const img of images) {
      if (img.complete) continue;
      img.addEventListener("load", onDone, { once: true });
      img.addEventListener("error", onDone, { once: true });
    }
    // Fallback jika load macet — tetap sekali saja berkat guard `printed` + session
    fallbackTimer = setTimeout(doPrint, 2500);
  };

  waitImagesThenPrint();
}

export function printUktNotaDocument(data: UktNotaPrintData): void {
  openHtmlPrintWindow(buildUktNotaPrintHtml(data));
}

export type UktPesertaPrintData = {
  title: string;
  branchLabel: string;
  rows: Array<{
    no: number;
    noRanting?: number;
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
      ? `<tr><td colspan="10" style="text-align:center;padding:12px;">Belum ada peserta</td></tr>`
      : data.rows
          .map(
            (r) => `
        <tr>
          <td class="c">${r.no}</td>
          <td class="c">${escapeHtml(r.nia)}</td>
          <td class="c">${r.noRanting ?? ""}</td>
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
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    th, td {
      border: 1px solid #000;
      padding: 3px 4px;
      vertical-align: middle;
      word-wrap: break-word;
    }
    th {
      font-size: 9px;
      text-transform: uppercase;
      background: #f3f3f3;
      text-align: center;
    }
    td.c { text-align: center; }
    td.nama { font-weight: 600; }
    col.c-no { width: 4%; }
    col.c-nia { width: 9%; }
    col.c-nor { width: 4%; }
    col.c-nama { width: 17%; }
    col.c-ttl { width: 13%; }
    col.c-jk { width: 5%; }
    col.c-alamat { width: 21%; }
    col.c-kyu { width: 5%; }
    col.c-kyub { width: 6%; }
    col.c-ranting { width: 16%; }
    .sign {
      margin-top: 20px;
      width: 240px;
      margin-left: auto;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sign .place { margin-bottom: 4px; }
    .sign .role { margin-bottom: 36px; }
    .sign .name {
      font-weight: 700;
      text-decoration: underline;
      text-transform: uppercase;
      white-space: nowrap;
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
        <col class="c-nor" />
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
          <th>No. R</th>
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

async function waitForImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  if (images.length === 0) return;
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
          setTimeout(() => resolve(), 1500);
        }),
    ),
  );
}

export type DownloadPdfFromHtmlOptions = {
  orientation?: "portrait" | "landscape";
};

/**
 * Unduh PDF langsung (tanpa dialog print browser) dari HTML UKT.
 * Beberapa elemen `.page` → tiap elemen halaman PDF baru (konten tinggi tetap dipecah).
 */
export async function downloadPdfFromHtml(
  html: string,
  filename: string,
  options?: DownloadPdfFromHtmlOptions,
): Promise<void> {
  sweepInkaiFrames(PDF_FRAME_ATTR);

  const orientation = options?.orientation ?? "portrait";
  const iframeW = orientation === "landscape" ? "297mm" : "210mm";
  const iframeH = orientation === "landscape" ? "210mm" : "297mm";
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute(PDF_FRAME_ATTR, "1");
  iframe.style.cssText =
    `position:fixed;left:-12000px;top:0;width:${iframeW};height:${iframeH};border:0;opacity:0;pointer-events:none;`;
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    iframe.remove();
    throw new Error("Gagal menyiapkan dokumen PDF");
  }

  doc.open();
  doc.write(html);
  doc.close();
  await waitForImages(doc);
  await new Promise((r) => setTimeout(r, 80));

  try {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const pages = Array.from(doc.querySelectorAll(".page")) as HTMLElement[];
    const targets = pages.length > 0 ? pages : [doc.body];

    const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let firstPdfPage = true;

    for (const target of targets) {
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: target.scrollWidth,
        windowHeight: target.scrollHeight,
      } as never);

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      if (!firstPdfPage) {
        pdf.addPage();
      }
      firstPdfPage = false;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
    }

    const safeName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    pdf.save(safeName);
  } finally {
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
  }
}

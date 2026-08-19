import { formatRp, terbilangId } from "@/lib/terbilang";
import {
  downloadPdfFromHtml,
  openHtmlPrintWindow,
} from "@/lib/ukt-print-html";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type KwitansiPrintData = {
  no: string;
  tanggal: string;
  terimaDari: string;
  jumlah: number;
  untukPembayaran: string;
  penerimaName?: string;
  penyetorName?: string;
  penerimaSignUrl?: string | null;
  penyetorSignUrl?: string | null;
  origin: string;
  /** Watermark DRAFT (default false). */
  draft?: boolean;
};

export type DaftarPenerimaPrintRow = {
  no: number;
  nama: string;
  jabatan: string;
  nominal: number;
  signUrl?: string | null;
};

export type DaftarPenerimaPrintData = {
  title: string;
  subtitle?: string;
  roleColumnLabel: string;
  rows: DaftarPenerimaPrintRow[];
  total: number;
  origin: string;
  sekretariatAddress?: string;
  draft?: boolean;
};

export type NotaItemPrintRow = {
  no: number;
  deskripsi: string;
  jumlah: number;
  harga: number;
  total: number;
  petugas: string;
};

export type NotaPengeluaranPrintData = {
  noNota: string;
  tanggal: string;
  items: NotaItemPrintRow[];
  subTotal: number;
  pajakPersen: number;
  pajakAmount: number;
  grandTotal: number;
  bidangUjianName?: string;
  bendaharaName?: string;
  bidangUjianSignUrl?: string | null;
  bendaharaSignUrl?: string | null;
  origin: string;
  sekretariatAddress?: string;
  contactPhone?: string;
  draft?: boolean;
};

function signImg(url: string | null | undefined, alt: string): string {
  if (!url) return "";
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" style="max-height:64px;max-width:180px;object-fit:contain;" />`;
}

function draftCss(): string {
  return `
  .draft-wrap { position: relative; }
  .draft-mark {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    pointer-events: none; z-index: 5;
    font-size: 72px; font-weight: 700; letter-spacing: 0.12em;
    color: rgba(185, 28, 28, 0.12); transform: rotate(-28deg);
    font-family: Arial, Helvetica, sans-serif;
  }`;
}

function draftMark(draft?: boolean): string {
  if (!draft) return "";
  return `<div class="draft-mark" aria-hidden="true">DRAFT</div>`;
}

function kwitansiSheetInner(data: KwitansiPrintData): string {
  const terbilang = terbilangId(data.jumlah);
  const rp = formatRp(data.jumlah);
  return `
  <div class="sheet draft-wrap">
    ${draftMark(data.draft)}
    <aside class="stub">
      <h2>KWITANSI</h2>
      <div>No. ${escapeHtml(data.no)}</div>
      <div>Tanggal: ${escapeHtml(data.tanggal)}</div>
      <div style="margin-top:6px">Terima dari:<br/><strong>${escapeHtml(data.terimaDari || "—")}</strong></div>
      <div style="margin-top:6px">Jumlah: <strong>${escapeHtml(rp)}</strong></div>
      <div class="muted" style="margin-top:4px">${escapeHtml(terbilang)}</div>
      <div style="margin-top:6px">Untuk pembayaran:<br/>${escapeHtml(data.untukPembayaran || "—")}</div>
    </aside>
    <section class="body">
      <h1 class="title">KWITANSI PEMBAYARAN</h1>
      <div class="row">
        <div>No. ${escapeHtml(data.no)}</div>
        <div>Tanggal: ${escapeHtml(data.tanggal)}</div>
      </div>
      <div class="field inline"><span>Sudah terima dari</span><span class="dots">${escapeHtml(data.terimaDari || "")}</span></div>
      <div class="terbilang">Terbilang: ${escapeHtml(terbilang)}</div>
      <div class="field inline"><span>Untuk pembayaran</span><span class="dots">${escapeHtml(data.untukPembayaran || "")}</span></div>
      <div class="rp-box"><span>RP. ${escapeHtml(rp.replace(/^Rp\s?/, ""))}</span></div>
      <div class="signs">
        <div class="sign">
          <div class="sign-space">${signImg(data.penerimaSignUrl, "TTD Penerima")}</div>
          <div class="sign-line">${escapeHtml(data.penerimaName || "………………")}</div>
          <div>Penerima</div>
        </div>
        <div class="sign">
          <div class="sign-space">${signImg(data.penyetorSignUrl, "TTD Penyetor")}</div>
          <div class="sign-line">${escapeHtml(data.penyetorName || "………………")}</div>
          <div>Penyetor</div>
        </div>
      </div>
    </section>
  </div>`;
}

function kwitansiStyles(): string {
  return `
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif; color: #111; margin: 0;
    display: flex; flex-direction: column; align-items: flex-start;
  }
  .sheet {
    display: flex; width: 100%; height: auto; border: 1.5px solid #222;
    page-break-after: always; break-after: page;
  }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
  .stub {
    width: 32%; padding: 8px 10px; border-right: 2px dashed #444;
    font-size: 11px; line-height: 1.4;
  }
  .stub h2 { font-size: 13px; margin: 0 0 8px; letter-spacing: 0.04em; }
  .body { flex: 1; padding: 10px 14px; position: relative; }
  .title { text-align: center; font-size: 20px; font-weight: 700; letter-spacing: 0.08em; margin: 0 0 10px; }
  .row { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; font-size: 13px; }
  .field { margin: 6px 0; font-size: 13px; }
  .dots { border-bottom: 1px dotted #333; min-height: 1.1em; flex: 1; margin-left: 6px; }
  .inline { display: flex; align-items: flex-end; gap: 4px; }
  .terbilang { font-style: italic; margin: 8px 0; font-size: 13px; }
  .rp-box {
    display: inline-block; margin-top: 8px; padding: 5px 16px 5px 12px;
    border: 2px solid #111; font-weight: 700; font-size: 15px;
    transform: skewX(-8deg);
  }
  .rp-box span { display: inline-block; transform: skewX(8deg); }
  .signs { display: flex; justify-content: space-between; margin-top: 16px; gap: 20px; }
  .sign { width: 42%; text-align: center; font-size: 12px; }
  .sign-space { min-height: 64px; display: flex; align-items: flex-end; justify-content: center; }
  .sign-line { border-top: 1px solid #333; margin-top: 4px; padding-top: 4px; }
  .muted { color: #444; font-size: 11px; }
  ${draftCss()}`;
}

/** Kwitansi klasik landscape — tinggi mengikuti konten. */
export function buildKwitansiPrintHtml(data: KwitansiPrintData): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Kwitansi ${escapeHtml(data.no)}</title>
<style>${kwitansiStyles()}</style>
</head>
<body>
  ${kwitansiSheetInner(data)}
</body>
</html>`;
}

/** Beberapa lembar kwitansi dalam satu dokumen (satu dialog print). */
export function buildKwitansiBatchPrintHtml(
  items: KwitansiPrintData[],
): string {
  if (items.length === 0) return buildKwitansiPrintHtml({
    no: "",
    tanggal: "",
    terimaDari: "",
    jumlah: 0,
    untukPembayaran: "",
    origin: "",
  });
  if (items.length === 1) return buildKwitansiPrintHtml(items[0]!);
  const sheets = items.map((d) => kwitansiSheetInner(d)).join("\n");
  const title = items.map((d) => d.no).filter(Boolean).join(", ");
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Kwitansi ${escapeHtml(title)}</title>
<style>${kwitansiStyles()}</style>
</head>
<body>
  ${sheets}
</body>
</html>`;
}

export function buildDaftarPenerimaPrintHtml(
  data: DaftarPenerimaPrintData,
): string {
  const logoUrl = `${data.origin}/logo-inkai.png`;
  const rows = data.rows
    .map(
      (r) => `<tr>
      <td style="text-align:center">${r.no}</td>
      <td>${escapeHtml(r.nama)}</td>
      <td>${escapeHtml(r.jabatan)}</td>
      <td style="text-align:right">${escapeHtml(formatRp(r.nominal))}</td>
      <td style="text-align:center">${signImg(r.signUrl, "TTD") || "—"}</td>
    </tr>`,
    )
    .join("");
  const sekretariat = data.sekretariatAddress?.trim()
    ? data.sekretariatAddress.trim()
    : "Sekretariat INKAI Kota Surabaya";

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(data.title)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; }
  .kop { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #b91c1c; padding-bottom: 10px; margin-bottom: 14px; }
  .kop img { width: 56px; height: 56px; object-fit: contain; }
  .kop h1 { margin: 0; font-size: 16px; color: #b91c1c; }
  .kop p { margin: 2px 0 0; font-size: 11px; color: #444; }
  h2 { text-align: center; font-size: 15px; margin: 0 0 4px; }
  .sub { text-align: center; color: #555; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #333; padding: 6px 8px; }
  th { background: #f3f4f6; }
  tfoot td { font-weight: 700; }
  .foot { margin-top: 18px; font-size: 11px; color: #444; }
  .page { position: relative; }
  ${draftCss()}
</style>
</head>
<body>
  <div class="page draft-wrap">
    ${draftMark(data.draft)}
  <div class="kop">
    <img src="${escapeHtml(logoUrl)}" alt="Logo INKAI" />
    <div>
      <h1>INKAI Kota Surabaya</h1>
      <p>Institut Karate-Do Indonesia</p>
    </div>
  </div>
  <h2>${escapeHtml(data.title)}</h2>
  ${data.subtitle ? `<p class="sub">${escapeHtml(data.subtitle)}</p>` : ""}
  <table>
    <thead>
      <tr>
        <th style="width:40px">No.</th>
        <th>Nama Lengkap</th>
        <th>${escapeHtml(data.roleColumnLabel)}</th>
        <th style="width:120px">Nominal</th>
        <th style="width:100px">Tanda Tangan</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="5" style="text-align:center">Tidak ada data</td></tr>`}</tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align:right">TOTAL</td>
        <td style="text-align:right">${escapeHtml(formatRp(data.total))}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
  <p class="foot">${escapeHtml(sekretariat)}</p>
  </div>
</body>
</html>`;
}

export function buildNotaPengeluaranPrintHtml(
  data: NotaPengeluaranPrintData,
): string {
  const logoUrl = `${data.origin}/logo-inkai.png`;
  const rows = data.items
    .map(
      (r) => `<tr>
      <td style="text-align:center">${r.no}</td>
      <td>${escapeHtml(r.deskripsi)}</td>
      <td style="text-align:center">${r.jumlah}</td>
      <td style="text-align:right">${escapeHtml(formatRp(r.harga))}</td>
      <td style="text-align:right">${escapeHtml(formatRp(r.total))}</td>
      <td>${escapeHtml(r.petugas || "—")}</td>
    </tr>`,
    )
    .join("");
  const emptyRows =
    data.items.length < 6
      ? Array.from({ length: 6 - data.items.length })
          .map(
            () =>
              `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`,
          )
          .join("")
      : "";
  const sekretariat = data.sekretariatAddress?.trim()
    ? data.sekretariatAddress.trim()
    : "Sekretariat INKAI Kota Surabaya";
  const phone = data.contactPhone?.trim() || "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Nota Pengeluaran ${escapeHtml(data.noNota)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .head img { width: 64px; height: 64px; object-fit: contain; }
  .head h1 { margin: 0; font-size: 22px; color: #b91c1c; letter-spacing: 0.04em; text-align: right; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 10px; gap: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #b91c1c; color: #fff; padding: 7px 6px; border: 1px solid #7f1d1d; }
  td { border: 1px solid #7f1d1d; padding: 6px; min-height: 22px; }
  .summary-wrap { display: flex; justify-content: space-between; margin-top: 10px; gap: 16px; }
  .note { flex: 1; font-size: 12px; color: #333; }
  .summary { width: 240px; }
  .summary table { width: 100%; }
  .summary td { border: 1px solid #7f1d1d; padding: 5px 6px; }
  .summary td.label { background: #b91c1c; color: #fff; font-weight: 600; width: 55%; }
  .signs { display: flex; justify-content: space-between; margin-top: 28px; }
  .sign { width: 40%; text-align: center; }
  .sign-space { min-height: 64px; display: flex; align-items: flex-end; justify-content: center; }
  .sign-line { border-top: 1px solid #333; margin-top: 4px; padding-top: 4px; }
  .footer { margin-top: 20px; background: #b91c1c; color: #fff; padding: 8px 12px; display: flex; justify-content: space-between; font-size: 11px; }
  .page { position: relative; }
  ${draftCss()}
</style>
</head>
<body>
  <div class="page draft-wrap">
    ${draftMark(data.draft)}
  <div class="head">
    <img src="${escapeHtml(logoUrl)}" alt="Logo INKAI" />
    <h1>NOTA<br/>PENGELUARAN</h1>
  </div>
  <div class="meta">
    <div>No. Nota: <strong>${escapeHtml(data.noNota)}</strong></div>
    <div>Tanggal: <strong>${escapeHtml(data.tanggal)}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:36px">No</th>
        <th>Deskripsi</th>
        <th style="width:70px">Jumlah</th>
        <th style="width:100px">Harga</th>
        <th style="width:100px">Total</th>
        <th style="width:120px">Petugas</th>
      </tr>
    </thead>
    <tbody>${rows}${emptyRows}</tbody>
  </table>
  <div class="summary-wrap">
    <div class="note">Bukti pengeluaran resmi INKAI Kota Surabaya.</div>
    <div class="summary">
      <table>
        <tr><td class="label">Sub Total</td><td style="text-align:right">${escapeHtml(formatRp(data.subTotal))}</td></tr>
        <tr><td class="label">Pajak ${data.pajakPersen}%</td><td style="text-align:right">${escapeHtml(formatRp(data.pajakAmount))}</td></tr>
        <tr><td class="label">TOTAL</td><td style="text-align:right"><strong>${escapeHtml(formatRp(data.grandTotal))}</strong></td></tr>
      </table>
    </div>
  </div>
  <div class="signs">
    <div class="sign">
      <div>Bidang Ujian,</div>
      <div class="sign-space">${signImg(data.bidangUjianSignUrl, "TTD Bidang Ujian")}</div>
      <div class="sign-line">${escapeHtml(data.bidangUjianName || "………………")}</div>
    </div>
    <div class="sign">
      <div>Bendahara,</div>
      <div class="sign-space">${signImg(data.bendaharaSignUrl, "TTD Bendahara")}</div>
      <div class="sign-line">${escapeHtml(data.bendaharaName || "………………")}</div>
    </div>
  </div>
  <div class="footer">
    <span>${phone ? escapeHtml(phone) : ""}</span>
    <span>${escapeHtml(sekretariat)}</span>
  </div>
  </div>
</body>
</html>`;
}

export function printKwitansi(data: KwitansiPrintData) {
  openHtmlPrintWindow(buildKwitansiPrintHtml({ ...data, draft: Boolean(data.draft) }));
}

export function printKwitansiBatch(items: KwitansiPrintData[]) {
  const withDraft = items.map((d) => ({ ...d, draft: Boolean(d.draft) }));
  openHtmlPrintWindow(buildKwitansiBatchPrintHtml(withDraft));
}

export async function downloadKwitansiPdf(
  data: KwitansiPrintData,
  filename: string,
) {
  await downloadPdfFromHtml(
    buildKwitansiPrintHtml({ ...data, draft: Boolean(data.draft) }),
    filename,
  );
}

export async function downloadKwitansiBatchPdf(
  items: KwitansiPrintData[],
  filename: string,
) {
  const withDraft = items.map((d) => ({ ...d, draft: Boolean(d.draft) }));
  await downloadPdfFromHtml(buildKwitansiBatchPrintHtml(withDraft), filename);
}

export function printDaftarPenerima(data: DaftarPenerimaPrintData) {
  openHtmlPrintWindow(
    buildDaftarPenerimaPrintHtml({ ...data, draft: Boolean(data.draft) }),
  );
}

export async function downloadDaftarPenerimaPdf(
  data: DaftarPenerimaPrintData,
  filename: string,
) {
  await downloadPdfFromHtml(
    buildDaftarPenerimaPrintHtml({ ...data, draft: Boolean(data.draft) }),
    filename,
  );
}

export function printNotaPengeluaran(data: NotaPengeluaranPrintData) {
  openHtmlPrintWindow(
    buildNotaPengeluaranPrintHtml({ ...data, draft: Boolean(data.draft) }),
  );
}

export async function downloadNotaPengeluaranPdf(
  data: NotaPengeluaranPrintData,
  filename: string,
) {
  await downloadPdfFromHtml(
    buildNotaPengeluaranPrintHtml({ ...data, draft: Boolean(data.draft) }),
    filename,
  );
}

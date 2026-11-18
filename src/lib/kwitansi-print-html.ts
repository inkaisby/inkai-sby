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
  eventLabel?: string;
  penerimaRole?: string;
  penyetorRole?: string;
  penerimaName?: string;
  penyetorName?: string;
  penerimaSignUrl?: string | null;
  penyetorSignUrl?: string | null;
  origin: string;
  /** Watermark DRAFT (default false). */
  draft?: boolean;
};

/**
 * Mengecek apakah judul dokumen merupakan teks placeholder umum
 * (bukan nama event/kegiatan spesifik).
 */
export function isGenericDocTitle(title?: string | null): boolean {
  if (!title) return true;
  const s = title.trim().toLowerCase();
  return (
    s === "" ||
    s === "kwitansi pembayaran" ||
    s === "kwitansi" ||
    s === "nota pengeluaran" ||
    s === "nota" ||
    s === "pembayaran"
  );
}

/**
 * Membersihkan nama event agar tidak mengembalikan judul generik.
 */
export function cleanEventLabel(label?: string | null): string {
  if (!label) return "";
  let s = label.trim();
  // Hilangkan koma awal atau koma akhir jika ada
  s = s.replace(/^,\s*/, "").replace(/,\s*$/, "").trim();
  if (isGenericDocTitle(s)) return "";
  return s;
}

/**
 * Menggabungkan deskripsi/rincian item dengan event terkait secara harmonis.
 * Menghilangkan suffix generik seperti ", Kwitansi Pembayaran" atau ", Nota Pengeluaran" jika ada.
 */
export function formatUntukPembayaran(
  deskripsi?: string | null,
  event?: string | null,
): string {
  let base = (deskripsi || "").trim();
  // Bersihkan jika ada akhiran generik (misal ", Kwitansi Pembayaran", ", Nota Pengeluaran", dsb.)
  base = base
    .replace(
      /,\s*(kwitansi\s+pembayaran|nota\s+pengeluaran|kwitansi|nota|pembayaran)\s*$/gi,
      "",
    )
    .trim();

  const ev = cleanEventLabel(event);
  if (base && ev) {
    if (!base.toLowerCase().includes(ev.toLowerCase())) {
      return `${base}, ${ev}`;
    }
    return base;
  }
  return base || ev || "—";
}

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
  bidangUjianRole?: string;
  bidangUjianName?: string;
  bendaharaRole?: string;
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

export type KwitansiPrintLayout =
  | "f4-4"
  | "f4-5"
  | "f4-3"
  | "f4-2"
  | "portrait-1"
  | "landscape";

export type KwitansiPrintOptions = {
  /**
   * Pilihan tata letak cetak kwitansi:
   * - "f4-4": Kertas F4 Portrait, memuat 4 kwitansi bertingkat dengan garis potong gunting (Hemat Kertas & Proporsional).
   * - "f4-5": Kertas F4 Portrait, memuat 5 kwitansi bertingkat dengan garis potong gunting (Super Ringkas / 5 slip per lembar F4).
   * - "f4-3": Kertas F4 Portrait, memuat 3 kwitansi bertingkat dengan garis potong gunting.
   * - "f4-2": Kertas F4 Portrait, memuat 2 kwitansi bertingkat dengan garis potong gunting.
   * - "portrait-1": Kertas F4/A4 Portrait, 1 kwitansi per lembar dengan batas potong/lampiran nota asli di bawah.
   * - "landscape": Kertas A4 Landscape, 1 kwitansi klasik selebar halaman penuh.
   */
  layout?: KwitansiPrintLayout;
};

export function kwitansiCardHtml(
  data: KwitansiPrintData,
  layout: KwitansiPrintLayout = "f4-4",
): string {
  const terbilang = terbilangId(data.jumlah);
  const rp = formatRp(data.jumlah);
  const penerimaLabel = data.penerimaRole?.trim() || "Penerima";
  const penyetorLabel = data.penyetorRole?.trim() || "Penyetor";
  const untukText = formatUntukPembayaran(data.untukPembayaran, data.eventLabel);
  const isCompact = layout === "f4-3";

  return `
  <div class="kw-card kw-card-${layout} draft-wrap">
    ${draftMark(data.draft)}
    <aside class="kw-stub">
      <div class="kw-stub-head">
        <img src="${data.origin}/logo-inkai.png" alt="INKAI" class="kw-stub-logo" />
        <div>
          <h2>KWITANSI</h2>
          <div class="kw-stub-sub">INKAI SURABAYA</div>
        </div>
      </div>
      <div class="kw-stub-meta">No. ${escapeHtml(data.no)}</div>
      <div class="kw-stub-meta">Tanggal: ${escapeHtml(data.tanggal)}</div>
      <div class="kw-stub-field">Terima dari:<br/><strong>${escapeHtml(data.terimaDari || "—")}</strong></div>
      <div class="kw-stub-field">Jumlah: <strong>${escapeHtml(rp)}</strong></div>
      <div class="kw-stub-muted">${escapeHtml(terbilang)}</div>
      <div class="kw-stub-field">Untuk pembayaran:<br/>${escapeHtml(untukText || "—")}</div>
    </aside>
    <section class="kw-body">
      <div class="kw-head-wrap">
        <img src="${data.origin}/logo-inkai.png" alt="INKAI" class="kw-head-logo" />
        <div class="kw-head-titles">
          <h1 class="kw-title">KWITANSI PEMBAYARAN</h1>
          <div class="kw-subtitle">INSTITUT KARATE-DO INDONESIA (INKAI) CABANG SURABAYA</div>
        </div>
      </div>
      <div class="kw-row">
        <div>No. ${escapeHtml(data.no)}</div>
        <div>Tanggal: ${escapeHtml(data.tanggal)}</div>
      </div>
      <div class="kw-field kw-inline">
        <span class="kw-field-lbl">Sudah terima dari</span>
        <span class="kw-dots">${escapeHtml(data.terimaDari || "")}</span>
      </div>
      <div class="kw-terbilang">Terbilang: ${escapeHtml(terbilang)}</div>
      <div class="kw-field kw-inline">
        <span class="kw-field-lbl">Untuk pembayaran</span>
        <span class="kw-dots">${escapeHtml(untukText || "")}</span>
      </div>
      <div class="kw-amount-row">
        <div class="kw-rp-box"><span>RP. ${escapeHtml(rp.replace(/^Rp\s?/, ""))}</span></div>
        <div class="kw-stamp-lunas">LUNAS</div>
      </div>
      <div class="kw-signs">
        <div class="kw-sign">
          <div class="kw-sign-space">${signImg(data.penerimaSignUrl, `TTD ${escapeHtml(penerimaLabel)}`)}</div>
          <div class="kw-sign-line">${escapeHtml(data.penerimaName || "………………")}</div>
          <div class="kw-sign-role">${escapeHtml(penerimaLabel)}</div>
        </div>
        <div class="kw-sign">
          <div class="kw-sign-space">${signImg(data.penyetorSignUrl, `TTD ${escapeHtml(penyetorLabel)}`)}</div>
          <div class="kw-sign-line">${escapeHtml(data.penyetorName || "………………")}</div>
          <div class="kw-sign-role">${escapeHtml(penyetorLabel)}</div>
        </div>
      </div>
    </section>
  </div>`;
}

function kwitansiSheetInner(data: KwitansiPrintData): string {
  return kwitansiCardHtml(data, "f4-4");
}

function kwitansiStyles(layout: KwitansiPrintLayout = "f4-4"): string {
  const isLandscape = layout === "landscape";
  const isF45 = layout === "f4-5";
  const isF44 = layout === "f4-4";
  const isF43 = layout === "f4-3";
  const isF42 = layout === "f4-2";
  const isPortrait1 = layout === "portrait-1";

  const pageSize = isLandscape
    ? "A4 landscape"
    : "215mm 330mm portrait";

  const pageMargin = isLandscape
    ? "8mm"
    : isF45
    ? "4mm 8mm"
    : isF44
    ? "5mm 8mm"
    : isF43
    ? "6mm 10mm"
    : "8mm 10mm";

  return `
  @page { size: ${pageSize}; margin: ${pageMargin}; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif; color: #111; margin: 0; padding: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    background: #fff;
  }

  /* Sheet wrappers */
  .sheet-landscape {
    display: flex; width: 100%; height: auto; border: 1.5px solid #222;
    page-break-after: always; break-after: page;
  }
  .sheet-landscape:last-child { page-break-after: auto; break-after: auto; }

  .page-f4-4 {
    width: 100%; height: 320mm; max-height: 320mm;
    display: flex; flex-direction: column; justify-content: flex-start;
    page-break-after: always; break-after: page; overflow: hidden;
  }
  .page-f4-4:last-child { page-break-after: auto; break-after: auto; }

  .page-f4-5 {
    width: 100%; height: 322mm; max-height: 322mm;
    display: flex; flex-direction: column; justify-content: flex-start;
    page-break-after: always; break-after: page; overflow: hidden;
  }
  .page-f4-5:last-child { page-break-after: auto; break-after: auto; }

  .page-f4 {
    width: 100%; height: 314mm; max-height: 314mm;
    display: flex; flex-direction: column; justify-content: flex-start;
    page-break-after: always; break-after: page; overflow: hidden;
  }
  .page-f4:last-child { page-break-after: auto; break-after: auto; }

  .page-f4-3 {
    width: 100%; height: 318mm; max-height: 318mm;
    display: flex; flex-direction: column; justify-content: flex-start;
    page-break-after: always; break-after: page; overflow: hidden;
  }
  .page-f4-3:last-child { page-break-after: auto; break-after: auto; }

  .page-portrait-1 {
    width: 100%; page-break-after: always; break-after: page;
  }
  .page-portrait-1:last-child { page-break-after: auto; break-after: auto; }

  /* Kartu Kwitansi Base */
  .kw-card {
    display: flex; width: 100%; position: relative; background: #fff;
  }
  .kw-card-landscape {
    border: 1.5px solid #222; page-break-after: always; break-after: page;
  }
  .kw-card-landscape:last-child { page-break-after: auto; break-after: auto; }

  .kw-card-f4-4 {
    height: 73mm; max-height: 73mm; border: 1.2px solid #222; overflow: hidden;
  }
  .kw-card-f4-5 {
    height: 58mm; max-height: 58mm; border: 1.2px solid #222; overflow: hidden;
  }
  .kw-card-f4-3 {
    height: 98mm; max-height: 98mm; border: 1.5px solid #222; overflow: hidden;
  }
  .kw-card-f4-2 {
    height: 144mm; max-height: 144mm; border: 1.5px solid #222; overflow: hidden;
  }
  .kw-card-portrait-1 {
    height: 76mm; max-height: 76mm; border: 1.2px solid #222; overflow: hidden;
  }

  /* Stub Bonggol Kiri */
  .kw-stub {
    width: ${isF45 ? "28%" : isF44 ? "29%" : isF43 ? "29%" : "31%"};
    padding: ${isF45 ? "3px 6px" : isF44 ? "4px 8px" : isF43 ? "5px 8px" : "8px 10px"};
    border-right: 1.2px dashed #444;
    font-size: ${isF45 ? "8px" : isF44 ? "8.8px" : isF43 ? "9.5px" : "11px"};
    line-height: ${isF45 ? "1.15" : isF44 ? "1.2" : isF43 ? "1.25" : "1.35"};
    background: #fafafa;
  }
  .kw-stub-head { display: flex; align-items: center; gap: 4px; margin-bottom: ${isF45 ? "2px" : isF44 ? "3px" : "6px"}; }
  .kw-stub-logo { width: ${isF45 ? "16px" : isF44 ? "18px" : isF43 ? "20px" : "24px"}; height: ${isF45 ? "16px" : isF44 ? "18px" : isF43 ? "20px" : "24px"}; object-fit: contain; }
  .kw-stub-sub { font-size: ${isF45 ? "6.5px" : isF44 ? "7px" : isF43 ? "8px" : "9px"}; color: #555; font-weight: 600; }
  .kw-stub h2 { font-size: ${isF45 ? "9px" : isF44 ? "10px" : isF43 ? "11px" : "13px"}; margin: 0; letter-spacing: 0.04em; }
  .kw-stub-meta { font-size: ${isF45 ? "7.5px" : isF44 ? "8px" : isF43 ? "9px" : "10px"}; margin-bottom: 1px; }
  .kw-stub-field { margin-top: ${isF45 ? "1.5px" : isF44 ? "2.5px" : isF43 ? "4px" : "6px"}; }
  .kw-stub-muted { color: #555; font-size: ${isF45 ? "7px" : isF44 ? "7.8px" : isF43 ? "8.5px" : "10px"}; font-style: italic; margin-top: 1px; }

  /* Body Kwitansi Kanan */
  .kw-body {
    flex: 1;
    padding: ${isF45 ? "3px 8px" : isF44 ? "4px 10px" : isF43 ? "6px 12px" : "8px 14px"};
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .kw-head-wrap {
    display: flex; align-items: center; justify-content: center; position: relative;
    margin-bottom: ${isF45 ? "1px" : isF44 ? "2px" : isF43 ? "3px" : "6px"};
    min-height: ${isF45 ? "20px" : isF44 ? "24px" : isF43 ? "30px" : "40px"};
  }
  .kw-head-logo {
    position: absolute; left: 0; top: 50%; transform: translateY(-50%);
    width: ${isF45 ? "20px" : isF44 ? "24px" : isF43 ? "32px" : "42px"};
    height: ${isF45 ? "20px" : isF44 ? "24px" : isF43 ? "32px" : "42px"};
    object-fit: contain;
  }
  .kw-head-titles { text-align: center; }
  .kw-title {
    text-align: center;
    font-size: ${isF45 ? "11px" : isF44 ? "12.5px" : isF43 ? "14px" : "18px"};
    font-weight: 700;
    letter-spacing: 0.05em; margin: 0;
  }
  .kw-subtitle {
    font-size: ${isF45 ? "6.5px" : isF44 ? "7.2px" : isF43 ? "8px" : "9.5px"};
    font-weight: 600; letter-spacing: 0.04em; color: #444; margin-top: 1px;
  }
  .kw-row {
    display: flex; justify-content: space-between; gap: 6px;
    margin-bottom: ${isF45 ? "1px" : isF44 ? "1.5px" : isF43 ? "3px" : "5px"};
    font-size: ${isF45 ? "7.8px" : isF44 ? "8.5px" : isF43 ? "10px" : "12px"};
  }
  .kw-field {
    margin: ${isF45 ? "1px 0" : isF44 ? "1.5px 0" : isF43 ? "3px 0" : "5px 0"};
    font-size: ${isF45 ? "8px" : isF44 ? "8.8px" : isF43 ? "10.5px" : "12px"};
  }
  .kw-field-lbl { shrink-0: 0; white-space: nowrap; }
  .kw-dots { border-bottom: 1px dotted #333; min-height: 1em; flex: 1; margin-left: 4px; }
  .kw-inline { display: flex; align-items: flex-end; gap: 4px; }
  .kw-terbilang {
    font-style: italic;
    margin: ${isF45 ? "1px 0" : isF44 ? "1.5px 0" : isF43 ? "3px 0" : "5px 0"};
    font-size: ${isF45 ? "7.5px" : isF44 ? "8.2px" : isF43 ? "10px" : "12px"};
    color: #222;
  }
  .kw-amount-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: ${isF45 ? "1.5px" : isF44 ? "2.5px" : isF43 ? "4px" : "6px"};
  }
  .kw-rp-box {
    display: inline-block;
    padding: ${isF45 ? "1.5px 6px" : isF44 ? "2px 8px" : isF43 ? "3px 12px 3px 8px" : "4px 16px 4px 10px"};
    border: 1.5px solid #111; font-weight: 700;
    font-size: ${isF45 ? "9.5px" : isF44 ? "11px" : isF43 ? "12px" : "14px"};
    transform: skewX(-8deg);
  }
  .kw-rp-box span { display: inline-block; transform: skewX(8deg); }
  .kw-stamp-lunas {
    border: 1.5px solid #15803d; color: #15803d;
    font-size: ${isF45 ? "8px" : isF44 ? "9.5px" : isF43 ? "11px" : "13px"};
    font-weight: 800;
    letter-spacing: 0.12em;
    padding: ${isF45 ? "1px 4px" : isF44 ? "1.5px 6px" : isF43 ? "2px 8px" : "3px 12px"};
    border-radius: 3px; transform: rotate(-5deg);
    font-family: Arial, Helvetica, sans-serif;
  }
  .kw-signs {
    display: flex; justify-content: space-between;
    margin-top: ${isF45 ? "2px" : isF44 ? "2.5px" : isF43 ? "6px" : "12px"};
    gap: 12px;
  }
  .kw-sign { width: 44%; text-align: center; font-size: ${isF45 ? "7.5px" : isF44 ? "8.2px" : isF43 ? "9.5px" : "11px"}; }
  .kw-sign-space {
    min-height: ${isF45 ? "18px" : isF44 ? "22px" : isF43 ? "34px" : "52px"};
    display: flex; align-items: flex-end; justify-content: center;
  }
  .kw-sign-space img {
    max-height: ${isF45 ? "18px" : isF44 ? "22px" : isF43 ? "34px" : "50px"} !important;
  }
  .kw-sign-line {
    border-top: 1px solid #333; margin-top: 2px; padding-top: 1px;
    font-weight: 600;
  }
  .kw-sign-role { font-size: ${isF45 ? "6.8px" : isF44 ? "7.5px" : isF43 ? "8.5px" : "10px"}; color: #444; }

  /* Cut dividers */
  .kw-cut-divider {
    height: 10mm; display: flex; align-items: center; justify-content: center;
    position: relative; width: 100%; margin: 2mm 0;
  }
  .kw-cut-divider::before {
    content: ""; position: absolute; left: 0; right: 0; top: 50%;
    border-top: 1.5px dashed #777;
  }
  .kw-cut-divider-4 {
    height: 6mm; display: flex; align-items: center; justify-content: center;
    position: relative; width: 100%; margin: 0.5mm 0;
  }
  .kw-cut-divider-4::before {
    content: ""; position: absolute; left: 0; right: 0; top: 50%;
    border-top: 1.2px dashed #777;
  }
  .kw-cut-divider-5 {
    height: 4.5mm; display: flex; align-items: center; justify-content: center;
    position: relative; width: 100%; margin: 0.3mm 0;
  }
  .kw-cut-divider-5::before {
    content: ""; position: absolute; left: 0; right: 0; top: 50%;
    border-top: 1px dashed #777;
  }
  .kw-cut-divider-3 {
    height: 8mm; display: flex; align-items: center; justify-content: center;
    position: relative; width: 100%; margin: 1mm 0;
  }
  .kw-cut-divider-3::before {
    content: ""; position: absolute; left: 0; right: 0; top: 50%;
    border-top: 1.2px dashed #777;
  }
  .kw-cut-text {
    position: relative; background: #fff; padding: 0 8px;
    font-size: 8px; font-family: Arial, Helvetica, sans-serif; color: #555;
    letter-spacing: 0.08em; font-weight: bold;
  }
  .kw-cut-icon {
    position: relative; background: #fff; padding-right: 3px; font-size: 11px; color: #333;
  }

  ${draftCss()}`;
}

/** Kwitansi cetak (mendukung Portrait F4 Muat 4-5 Slip, Multi-up 2-3 slip, dan Landscape). */
export function buildKwitansiPrintHtml(
  data: KwitansiPrintData,
  options?: KwitansiPrintOptions,
): string {
  const layout = options?.layout || "f4-4";
  const styles = kwitansiStyles(layout);

  let content = "";
  if (layout === "landscape") {
    content = kwitansiCardHtml(data, "landscape");
  } else if (layout === "portrait-1") {
    content = `
    <div class="page-portrait-1">
      ${kwitansiCardHtml(data, "portrait-1")}
      <div class="kw-cut-divider">
        <span class="kw-cut-icon">✂</span>
        <span class="kw-cut-text">POTONG DI SINI / LAMPIRAN BUKTI FISIK NOTA</span>
      </div>
    </div>`;
  } else if (layout === "f4-5") {
    content = `
    <div class="page-f4-5">
      ${kwitansiCardHtml(data, "f4-5")}
      <div class="kw-cut-divider-5">
        <span class="kw-cut-icon">✂</span>
        <span class="kw-cut-text">POTONG DI SINI</span>
      </div>
    </div>`;
  } else if (layout === "f4-3") {
    content = `
    <div class="page-f4-3">
      ${kwitansiCardHtml(data, "f4-3")}
      <div class="kw-cut-divider-3">
        <span class="kw-cut-icon">✂</span>
        <span class="kw-cut-text">POTONG DI SINI</span>
      </div>
    </div>`;
  } else if (layout === "f4-2") {
    content = `
    <div class="page-f4">
      ${kwitansiCardHtml(data, "f4-2")}
      <div class="kw-cut-divider">
        <span class="kw-cut-icon">✂</span>
        <span class="kw-cut-text">POTONG DI SINI</span>
      </div>
    </div>`;
  } else {
    // f4-4 default (muat 4 kwitansi per lembar F4)
    content = `
    <div class="page-f4-4">
      ${kwitansiCardHtml(data, "f4-4")}
      <div class="kw-cut-divider-4">
        <span class="kw-cut-icon">✂</span>
        <span class="kw-cut-text">POTONG DI SINI</span>
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Kwitansi ${escapeHtml(data.no)}</title>
<style>${styles}</style>
</head>
<body>
  ${content}
</body>
</html>`;
}

/** Beberapa lembar kwitansi dalam satu dokumen (mendukung F4 muat 4, 5, 2, atau 3 per lembar). */
export function buildKwitansiBatchPrintHtml(
  items: KwitansiPrintData[],
  options?: KwitansiPrintOptions,
): string {
  const layout = options?.layout || "f4-4";
  if (items.length === 0) {
    return buildKwitansiPrintHtml({
      no: "",
      tanggal: "",
      terimaDari: "",
      jumlah: 0,
      untukPembayaran: "",
      origin: "",
    }, options);
  }

  const title = items
    .map((d) => d.no)
    .filter(Boolean)
    .slice(0, 5)
    .join(", ") + (items.length > 5 ? "…" : "");

  const styles = kwitansiStyles(layout);

  if (layout === "landscape") {
    const sheets = items.map((d) => kwitansiCardHtml(d, "landscape")).join("\n");
    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Kwitansi ${escapeHtml(title)}</title>
<style>${styles}</style>
</head>
<body>
  ${sheets}
</body>
</html>`;
  }

  if (layout === "portrait-1") {
    const pages = items
      .map(
        (d) => `
    <div class="page-portrait-1">
      ${kwitansiCardHtml(d, "portrait-1")}
      <div class="kw-cut-divider">
        <span class="kw-cut-icon">✂</span>
        <span class="kw-cut-text">POTONG DI SINI / LAMPIRAN BUKTI FISIK NOTA</span>
      </div>
    </div>`,
      )
      .join("\n");
    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Kwitansi Portrait ${escapeHtml(title)}</title>
<style>${styles}</style>
</head>
<body>
  ${pages}
</body>
</html>`;
  }

  if (layout === "f4-5") {
    const chunks: KwitansiPrintData[][] = [];
    for (let i = 0; i < items.length; i += 5) {
      chunks.push(items.slice(i, i + 5));
    }
    const pages = chunks
      .map((chunk) => {
        const chunkHtml = chunk
          .map((d, idx) => {
            const isLast = idx === chunk.length - 1;
            return `${kwitansiCardHtml(d, "f4-5")}${
              !isLast || chunk.length < 5
                ? `<div class="kw-cut-divider-5"><span class="kw-cut-icon">✂</span><span class="kw-cut-text">POTONG DI SINI</span></div>`
                : ""
            }`;
          })
          .join("\n");
        return `<div class="page-f4-5">${chunkHtml}</div>`;
      })
      .join("\n");

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Kwitansi F4 (5 Kwitansi/Lembar) ${escapeHtml(title)}</title>
<style>${styles}</style>
</head>
<body>
  ${pages}
</body>
</html>`;
  }

  if (layout === "f4-3") {
    const chunks: KwitansiPrintData[][] = [];
    for (let i = 0; i < items.length; i += 3) {
      chunks.push(items.slice(i, i + 3));
    }
    const pages = chunks
      .map((chunk) => {
        const chunkHtml = chunk
          .map((d, idx) => {
            const isLast = idx === chunk.length - 1;
            return `${kwitansiCardHtml(d, "f4-3")}${
              !isLast || chunk.length < 3
                ? `<div class="kw-cut-divider-3"><span class="kw-cut-icon">✂</span><span class="kw-cut-text">POTONG DI SINI</span></div>`
                : ""
            }`;
          })
          .join("\n");
        return `<div class="page-f4-3">${chunkHtml}</div>`;
      })
      .join("\n");

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Kwitansi F4 (3 Kwitansi/Lembar) ${escapeHtml(title)}</title>
<style>${styles}</style>
</head>
<body>
  ${pages}
</body>
</html>`;
  }

  if (layout === "f4-2") {
    const chunks: KwitansiPrintData[][] = [];
    for (let i = 0; i < items.length; i += 2) {
      chunks.push(items.slice(i, i + 2));
    }
    const pages = chunks
      .map((chunk) => {
        const chunkHtml = chunk
          .map((d, idx) => {
            const isLast = idx === chunk.length - 1;
            return `${kwitansiCardHtml(d, "f4-2")}${
              !isLast || chunk.length < 2
                ? `<div class="kw-cut-divider"><span class="kw-cut-icon">✂</span><span class="kw-cut-text">POTONG DI SINI</span></div>`
                : ""
            }`;
          })
          .join("\n");
        return `<div class="page-f4">${chunkHtml}</div>`;
      })
      .join("\n");

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Kwitansi F4 (2 Kwitansi/Lembar) ${escapeHtml(title)}</title>
<style>${styles}</style>
</head>
<body>
  ${pages}
</body>
</html>`;
  }

  // Default: f4-4 (4 kwitansi per lembar F4 Portrait)
  const chunks: KwitansiPrintData[][] = [];
  for (let i = 0; i < items.length; i += 4) {
    chunks.push(items.slice(i, i + 4));
  }
  const pages = chunks
    .map((chunk) => {
      const chunkHtml = chunk
        .map((d, idx) => {
          const isLast = idx === chunk.length - 1;
          return `${kwitansiCardHtml(d, "f4-4")}${
            !isLast || chunk.length < 4
              ? `<div class="kw-cut-divider-4"><span class="kw-cut-icon">✂</span><span class="kw-cut-text">POTONG DI SINI</span></div>`
              : ""
          }`;
        })
        .join("\n");
      return `<div class="page-f4-4">${chunkHtml}</div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Kwitansi F4 (4 Kwitansi/Lembar) ${escapeHtml(title)}</title>
<style>${styles}</style>
</head>
<body>
  ${pages}
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

export function formatTanggalId(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function notaPengeluaranStyles(): string {
  return `
  @page { size: A4 portrait; margin: 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; margin: 0; padding: 0; }
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
  .page { position: relative; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  ${draftCss()}`;
}

export function notaPengeluaranSheetInner(
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
  const rolePenanggungJawab =
    data.bidangUjianRole?.trim() || "Ketua Panitia / Penanggung Jawab";
  const roleBendahara = data.bendaharaRole?.trim() || "Bendahara";

  return `
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
      <div>${escapeHtml(rolePenanggungJawab)},</div>
      <div class="sign-space">${signImg(data.bidangUjianSignUrl, `TTD ${escapeHtml(rolePenanggungJawab)}`)}</div>
      <div class="sign-line">${escapeHtml(data.bidangUjianName || "………………")}</div>
    </div>
    <div class="sign">
      <div>${escapeHtml(roleBendahara)},</div>
      <div class="sign-space">${signImg(data.bendaharaSignUrl, `TTD ${escapeHtml(roleBendahara)}`)}</div>
      <div class="sign-line">${escapeHtml(data.bendaharaName || "………………")}</div>
    </div>
  </div>
  <div class="footer">
    <span>${phone ? escapeHtml(phone) : ""}</span>
    <span>${escapeHtml(sekretariat)}</span>
  </div>
  </div>`;
}

export function buildNotaPengeluaranPrintHtml(
  data: NotaPengeluaranPrintData,
): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Nota Pengeluaran ${escapeHtml(data.noNota)}</title>
<style>${notaPengeluaranStyles()}</style>
</head>
<body>
  ${notaPengeluaranSheetInner(data)}
</body>
</html>`;
}

export function buildNotaPengeluaranBatchPrintHtml(
  items: NotaPengeluaranPrintData[],
): string {
  if (items.length === 0) {
    return buildNotaPengeluaranPrintHtml({
      noNota: "",
      tanggal: "",
      items: [],
      subTotal: 0,
      pajakPersen: 0,
      pajakAmount: 0,
      grandTotal: 0,
      origin: "",
    });
  }
  if (items.length === 1) return buildNotaPengeluaranPrintHtml(items[0]!);
  const sheets = items.map((d) => notaPengeluaranSheetInner(d)).join("\n");
  const title = items.map((d) => d.noNota).filter(Boolean).join(", ");
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Nota Pengeluaran ${escapeHtml(title)}</title>
<style>${notaPengeluaranStyles()}</style>
</head>
<body>
  ${sheets}
</body>
</html>`;
}

export function printNotaPengeluaranBatch(items: NotaPengeluaranPrintData[]) {
  const withDraft = items.map((d) => ({ ...d, draft: Boolean(d.draft) }));
  openHtmlPrintWindow(buildNotaPengeluaranBatchPrintHtml(withDraft));
}

export function printKwitansi(
  data: KwitansiPrintData,
  options?: KwitansiPrintOptions,
) {
  openHtmlPrintWindow(
    buildKwitansiPrintHtml({ ...data, draft: Boolean(data.draft) }, options),
  );
}

export function printKwitansiBatch(
  items: KwitansiPrintData[],
  options?: KwitansiPrintOptions,
) {
  const withDraft = items.map((d) => ({ ...d, draft: Boolean(d.draft) }));
  openHtmlPrintWindow(buildKwitansiBatchPrintHtml(withDraft, options));
}

export async function downloadKwitansiPdf(
  data: KwitansiPrintData,
  filename: string,
  options?: KwitansiPrintOptions,
) {
  await downloadPdfFromHtml(
    buildKwitansiPrintHtml({ ...data, draft: Boolean(data.draft) }, options),
    filename,
  );
}

export async function downloadKwitansiBatchPdf(
  items: KwitansiPrintData[],
  filename: string,
  options?: KwitansiPrintOptions,
) {
  const withDraft = items.map((d) => ({ ...d, draft: Boolean(d.draft) }));
  await downloadPdfFromHtml(
    buildKwitansiBatchPrintHtml(withDraft, options),
    filename,
  );
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

import {
  buildUktHasilUjianFilename,
  countUktHasilUjianRanting,
  countUktHasilUjianSabuk,
  formatUktExamDateLong,
  resolveUktHasilUjianLastNia,
  UKT_HASIL_UJIAN_OFFICERS,
  UKT_HASIL_UJIAN_SABUK_ORDER,
  type UktHasilUjianRecapRow,
  type UktSemester,
} from "@/lib/ukt";
import {
  downloadPdfFromHtml,
  openHtmlPrintWindow,
} from "@/lib/ukt-print-html";
import { UKT_TTD_DEFAULT_PENGUJI_SLOTS } from "@/lib/ukt-ttd";

export type UktHasilUjianPrintData = {
  semester: UktSemester;
  year: number;
  examAt?: string | null;
  ketuaCabangName?: string | null;
  bidangUjianName?: string | null;
  pengdaKetua?: string | null;
  pengdaKetuaTitle?: string | null;
  mshKetua?: string | null;
  mshKetuaTitle?: string | null;
  pengujiNames?: string[] | null;
  pengdaKetuaSignUrl?: string | null;
  mshKetuaSignUrl?: string | null;
  ketuaCabangSignUrl?: string | null;
  bidangUjianSignUrl?: string | null;
  pengujiSignUrls?: string[] | null;
  origin: string;
  rows: UktHasilUjianRecapRow[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TABLE_HEADERS = [
  "NO. URUT",
  "NO. URUT PESERTA RANTING",
  "NO. INDUK ANGGOTA",
  "NAMA",
  "TEMPAT TANGGAL LAHIR",
  "JENIS KELAMIN",
  "ALAMAT",
  "KYU LAMA",
  "KYU BARU",
  "SABUK",
  "RANTING",
] as const;

const CENTER_COLS = new Set([0, 1, 5, 7, 8]);

function buildKopHtml(logoUrl: string): string {
  return `
    <div class="kop">
      <img src="${escapeHtml(logoUrl)}" alt="Logo INKAI" />
      <div class="kop-text">
        <div class="kop-org">INSTITUT KARATE-DO INDONESIA</div>
        <div class="kop-region">DAERAH JAWA TIMUR</div>
      </div>
      <div class="kop-city">KAB/KOTA  :  SURABAYA</div>
    </div>`;
}

function signImgHtml(url: string | null | undefined): string {
  const src = (url || "").trim();
  if (!src) return `<div class="sign-space"></div>`;
  return `<div class="sign-space"><img class="sign-img" src="${escapeHtml(src)}" alt="" /></div>`;
}

export function buildUktHasilUjianPrintHtml(data: UktHasilUjianPrintData): string {
  const logoUrl = `${data.origin.replace(/\/$/, "")}/logo-inkai.png`;
  const title = `REKAP HASIL UJIAN SEMESTER ${data.semester} TAHUN ${data.year}`;
  const examLabel = formatUktExamDateLong(data.examAt);
  const placeDate = examLabel ? `Surabaya, ${examLabel}` : "Surabaya,";
  const ketua = (data.ketuaCabangName || "").trim();
  const bidang = (data.bidangUjianName || "").trim();
  const pengda = (data.pengdaKetua || UKT_HASIL_UJIAN_OFFICERS.pengdaKetua).trim();
  const pengdaTitle = (
    data.pengdaKetuaTitle || UKT_HASIL_UJIAN_OFFICERS.pengdaKetuaTitle
  ).trim();
  const msh = (data.mshKetua || UKT_HASIL_UJIAN_OFFICERS.mshKetua).trim();
  const mshTitle = (
    data.mshKetuaTitle || UKT_HASIL_UJIAN_OFFICERS.mshKetuaTitle
  ).trim();
  const counts = countUktHasilUjianSabuk(data.rows);
  const total = data.rows.length;
  const rantingCount = countUktHasilUjianRanting(data.rows);
  const lastNia = resolveUktHasilUjianLastNia(data.rows);
  const sabukLines = UKT_HASIL_UJIAN_SABUK_ORDER.filter(
    (sabuk) => sabuk !== "HITAM" || counts.HITAM > 0,
  );

  const pengujiRaw = (data.pengujiNames || [])
    .map((n) => n.trim())
    .filter(Boolean);
  const slotCount = Math.max(
    UKT_TTD_DEFAULT_PENGUJI_SLOTS,
    sabukLines.length,
    pengujiRaw.length,
  );
  const pengujiSlots: string[] = [];
  for (let i = 0; i < slotCount; i++) {
    pengujiSlots.push(pengujiRaw[i] || "");
  }

  const headerCells = TABLE_HEADERS.map((label) => `<th>${label}</th>`).join("");
  const bodyRows =
    data.rows.length === 0
      ? `<tr><td colspan="11" class="empty">Belum ada peserta dengan Kyu Baru</td></tr>`
      : data.rows
          .map((row) => {
            const values = [
              String(row.no),
              String(row.noRanting),
              row.nia,
              row.nama,
              row.tempatTanggalLahir,
              row.jenisKelamin,
              row.alamat,
              row.kyuLama,
              row.kyuBaru,
              row.sabuk,
              row.ranting,
            ];
            return `<tr>${values
              .map(
                (value, idx) =>
                  `<td class="${CENTER_COLS.has(idx) ? "c" : "l"}">${escapeHtml(value)}</td>`,
              )
              .join("")}</tr>`;
          })
          .join("");

  const noteRows: string[] = [];
  const maxRows = Math.max(sabukLines.length + 1, pengujiSlots.length);
  for (let i = 0; i < maxRows; i++) {
    const sabuk = sabukLines[i];
    const left =
      sabuk != null
        ? `<td class="sabuk-line">SABUK ${sabuk} = ${counts[sabuk]}</td>`
        : i === sabukLines.length
          ? `<td class="sabuk-line total-line">= ${total}</td>`
          : `<td class="sabuk-line"></td>`;
    const name = pengujiSlots[i] ?? "";
    const right = `<td class="penguji">${i + 1}. ${escapeHtml(name)}</td>`;
    if (sabuk != null || i === sabukLines.length || name || i < UKT_TTD_DEFAULT_PENGUJI_SLOTS) {
      noteRows.push(`<tr>${left}${right}</tr>`);
    }
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Calibri, "Segoe UI", Arial, sans-serif;
      font-size: 10px;
      line-height: 1.35;
    }
    .page {
      width: 277mm;
      min-height: 190mm;
      margin: 0 auto;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .kop {
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .kop img {
      width: 56px;
      height: 56px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .kop-text { flex: 1; }
    .kop-org { font-size: 16px; font-weight: 700; letter-spacing: 0.02em; }
    .kop-region { font-size: 13px; font-weight: 700; }
    .kop-city { font-size: 12px; font-weight: 700; white-space: nowrap; }
    h1 {
      margin: 0 0 10px;
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    table.recap {
      width: 100%;
      border-collapse: collapse;
      font-size: 8px;
    }
    table.recap th, table.recap td {
      border: 1px solid #000;
      padding: 3px 4px;
      vertical-align: middle;
    }
    table.recap th {
      background: #d9e1f2;
      font-weight: 700;
      text-align: center;
    }
    table.recap td.c { text-align: center; }
    table.recap td.l { text-align: left; }
    table.recap td.empty { text-align: center; padding: 12px; }
    .ttd-head {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 8px;
      margin-top: 8px;
      font-size: 11px;
    }
    .ttd-col { min-height: 88px; }
    .ttd-col .role { margin-top: 2px; }
    .ttd-col .title { margin-top: 2px; }
    .sign-space {
      height: 42px;
      margin-top: 8px;
      display: flex;
      align-items: flex-end;
    }
    .sign-img {
      max-height: 40px;
      max-width: 120px;
      object-fit: contain;
    }
    .ttd-col .name {
      margin-top: 4px;
      font-weight: 700;
      text-decoration: underline;
    }
    .ttd-col .rank { font-size: 10px; }
    .ttd-meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 11px;
    }
    table.notes {
      width: 100%;
      border-collapse: collapse;
      margin-top: 28px;
      font-size: 11px;
    }
    table.notes td { padding: 2px 6px 2px 0; vertical-align: top; }
    table.notes td.sabuk-line {
      width: 42%;
      white-space: nowrap;
      font-weight: 600;
    }
    table.notes td.sabuk-line.total-line { font-weight: 700; }
    table.notes td.penguji { width: 58%; }
    .notes-head { font-weight: 700; padding-top: 8px; }
    .ranting-count { font-weight: 700; margin-top: 12px; }
    .last-nia {
      margin-top: 28px;
      font-size: 11px;
    }
    .last-nia strong { margin-left: 12px; }
  </style>
</head>
<body>
  <div class="page">
    ${buildKopHtml(logoUrl)}
    <h1>${escapeHtml(title)}</h1>
    <table class="recap">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>
  <div class="page">
    ${buildKopHtml(logoUrl)}
    <div class="ttd-meta">
      <div>Mengetahui,</div>
      <div>${escapeHtml(placeDate)}</div>
    </div>
    <div class="ttd-head">
      <div class="ttd-col">
        <div>Pengurus Daerah INKAI Jatim</div>
        <div class="title">Ketua Umum,</div>
        ${signImgHtml(data.pengdaKetuaSignUrl)}
        <div class="name">${escapeHtml(pengda)}</div>
        <div class="rank">${escapeHtml(pengdaTitle)}</div>
      </div>
      <div class="ttd-col">
        <div>Majelis Sabuk Hitam INKAI Jatim</div>
        <div class="title">Ketua,</div>
        ${signImgHtml(data.mshKetuaSignUrl)}
        <div class="name">${escapeHtml(msh)}</div>
        <div class="rank">${escapeHtml(mshTitle)}</div>
      </div>
      <div class="ttd-col">
        <div>Pengurus Kota INKAI Surabaya</div>
        <div class="title">Ketua,</div>
        ${signImgHtml(data.ketuaCabangSignUrl)}
        <div class="name">${escapeHtml(ketua)}</div>
      </div>
      <div class="ttd-col">
        <div>Koordinator Penguji</div>
        <div class="title">&nbsp;</div>
        ${signImgHtml(data.bidangUjianSignUrl)}
        <div class="name">${escapeHtml(bidang)}</div>
      </div>
    </div>
    <table class="notes">
      <thead>
        <tr>
          <td class="notes-head">CATATAN :</td>
          <td class="notes-head">NAMA-NAMA PENGUJI :</td>
        </tr>
      </thead>
      <tbody>
        ${noteRows.join("")}
      </tbody>
    </table>
    <div class="ranting-count">JUMLAH RANTING YANG IKUT UJIAN : ${rantingCount} RANTING</div>
    <div class="last-nia">${escapeHtml(lastNia)}<strong>NIA TERAKHIR</strong></div>
  </div>
</body>
</html>`;
}

export function printUktHasilUjianDocument(data: UktHasilUjianPrintData): void {
  openHtmlPrintWindow(buildUktHasilUjianPrintHtml(data));
}

export async function downloadUktHasilUjianPdf(
  data: UktHasilUjianPrintData,
  filename?: string,
): Promise<void> {
  const name =
    filename ||
    buildUktHasilUjianFilename(data.semester, data.year, data.examAt, "pdf");
  await downloadPdfFromHtml(buildUktHasilUjianPrintHtml(data), name, {
    orientation: "landscape",
  });
}

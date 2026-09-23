import { getRomanMonth } from "@/lib/sekretaris-rbac";
import { LOGO_FORKI_BASE64, LOGO_INKAI_BASE64, STEMPEL_INKAI_BASE64 } from "@/lib/logos-base64";

export type PrintSuratOptions = {
  nomorSurat: string;
  tanggalSurat: string | Date;
  perihal: string;
  tujuan?: string;
  kategori: string; // ST | SK | UNDANGAN | KETERANGAN | PERMOHONAN | REKOMENDASI | TUGAS
  type: string; // KELUAR | MASUK
  scopeType?: string; // PROVINCE | BRANCH | DOJO
  scopeName?: string; // e.g. "SURABAYA" or "DOJO AIRLANGGA"
  paperSize?: "A4" | "F4"; // A4 | F4
  signatureMode?: "SYSTEM" | "MANUAL" | "DRAW"; // SYSTEM | MANUAL | DRAW
  ketuaName?: string;
  ketuaJabatan?: string;
  sekretarisName?: string;
  sekretarisJabatan?: string;
  signedKetuaUrl?: string | null;
  signedSekretarisUrl?: string | null;
  stampUrl?: string | null;
  ditetapkanDi?: string;
  contentHtml?: string;
  tableHeaders?: string[];
  tableRows?: Array<Record<string, string>>;
  activeDojos?: string[];
  verificationUrl?: string | null;
  fontFamily?: string;
  fontSize?: string;
};

export function buildSuratPrintHtml(opts: PrintSuratOptions): string {
  const paperSize = opts.paperSize || "A4";
  const paperHeightCss = paperSize === "F4" ? "330mm" : "297mm";
  const paperWidthCss = paperSize === "F4" ? "215mm" : "210mm";

  const tgl = opts.tanggalSurat
    ? new Date(opts.tanggalSurat).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "04 September 2026";

  const ketua = opts.ketuaName || "JONATHAN C. B. KANDOU, S.Pd.";
  const ketuaJab = opts.ketuaJabatan || "Ketua";
  const sekretaris = opts.sekretarisName || "MIFTACHUL AU’LIDHINA";
  const sekretarisJab = opts.sekretarisJabatan || "Sekretaris";
  const kota = opts.ditetapkanDi || "Surabaya";
  const fontFamily = opts.fontFamily || "'Times New Roman', Times, serif";
  const fontSize = opts.fontSize || "12pt";

  // Build active dojos footer list
  const dojosList = opts.activeDojos && opts.activeDojos.length > 0
    ? opts.activeDojos
    : [
        "AIRLANGGA", "AL-IRSYAD", "AR-RAYYAN", "AL-MIZAN", "AT-TAQWA",
        "BALADHIKA KEBRAON", "BENSHI", "CAKRA KOARMATIM", "FORTRESS", "GADING",
        "GRIYA AMERTA", "JAMBANGAN", "J-WON", "KAI-ZEN", "KETINTANG", "MANYAR",
        "MATAHATI", "MEIKYO", "SDN PAKIS V", "SD MUJAHIDIN", "SENO SAKTI",
        "SHABARA", "SIMOMULYO", "SMA SEJAHTERA", "SMPN 17", "SMPN 19", "TPI", "TOPAN"
      ];

  const dojosFormatted = dojosList
    .map((d, i) => `<span class="ranting-item"><span class="ranting-num">${i + 1}.</span>${d}</span>`)
    .join("");

  // Default Judul & Nomor
  let judulSurat = "SURAT TUGAS";
  if (opts.kategori === "SK") judulSurat = "SURAT KEPUTUSAN";
  else if (opts.kategori === "UNDANGAN") judulSurat = "SURAT UNDANGAN";
  else if (opts.kategori === "KETERANGAN") judulSurat = "SURAT KETERANGAN";
  else if (opts.kategori === "PERMOHONAN") judulSurat = "SURAT PERMOHONAN";
  else if (opts.kategori === "REKOMENDASI") judulSurat = "SURAT REKOMENDASI";
  else if (opts.kategori === "PEMBERITAHUAN") judulSurat = "SURAT PEMBERITAHUAN";
  else if (opts.kategori === "RAPAT" || opts.kategori === "NOTULEN") judulSurat = "RESUME & NOTULENSI RAPAT";

  // Signature rendering mode
  const isManual = opts.signatureMode === "MANUAL";
  const ketuaSignImg = !isManual && opts.signedKetuaUrl
    ? `<img src="${opts.signedKetuaUrl}" style="height:60px; object-fit:contain;" alt="TTD Ketua" />`
    : isManual
      ? `<div style="height:60px;"></div>`
      : `<div style="height:60px; display:flex; align-items:center; justify-content:center; font-style:italic; color:#4b5563; font-size:10pt;">[ TTD Digital ]</div>`;

  const sekretarisSignImg = !isManual && opts.signedSekretarisUrl
    ? `<img src="${opts.signedSekretarisUrl}" style="height:60px; object-fit:contain;" alt="TTD Sekretaris" />`
    : isManual
      ? `<div style="height:60px;"></div>`
      : `<div style="height:60px; display:flex; align-items:center; justify-content:center; font-style:italic; color:#4b5563; font-size:10pt;">[ TTD Digital ]</div>`;

  const stampImg = isManual || opts.stampUrl === "NONE"
    ? `<div style="width:75px; height:75px;"></div>`
    : opts.stampUrl
      ? `<img src="${opts.stampUrl}" style="height:75px; width:75px; object-fit:contain;" alt="Stempel Basah" />`
      : `<img src="${STEMPEL_INKAI_BASE64}" style="height:75px; width:75px; object-fit:contain;" alt="Stempel INKAI Kota Surabaya" />`;

  // Default sample table if provided
  let tableSectionHtml = "";
  if (opts.tableRows && opts.tableRows.length > 0) {
    const headers = opts.tableHeaders || ["NO", "NAMA", "JABATAN"];
    const ths = headers.map(h => `<th style="border:1px solid #000; padding:4px 8px; background-color:#f3f4f6; text-align:${h === "NO" ? "center" : "left"}; font-weight:bold;">${h}</th>`).join("");
    const trs = opts.tableRows.map((row, idx) => {
      const tds = headers.map(h => {
        const val = row[h] || row[h.toLowerCase()] || "";
        return `<td style="border:1px solid #000; padding:4px 8px; text-align:${h === "NO" ? "center" : "left"};">${h === "NO" ? idx + 1 : val}</td>`;
      }).join("");
      return `<tr>${tds}</tr>`;
    }).join("");

    tableSectionHtml = `
      <table style="width:100%; border-collapse:collapse; margin:12px 0; font-size:10.5pt;">
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    `;
  }

  // QR Code element
  const qrHtml = opts.verificationUrl
    ? `<div style="text-align:center; margin-top:8px;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(opts.verificationUrl)}" style="width:65px; height:65px;" alt="QR Verifikasi" />
        <div style="font-size:7pt; color:#4b5563; margin-top:2px;">Scan Verifikasi Surat Resmi</div>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${judulSurat} - ${opts.nomorSurat}</title>
  <style>
    @page {
      size: ${paperSize} portrait;
      margin: 8mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: ${fontFamily};
      font-size: ${fontSize};
      line-height: 1.45;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
    }
    .sheet {
      width: ${paperWidthCss};
      min-height: ${paperHeightCss};
      padding: 12mm 16mm 14mm 16mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      background: #fff;
    }
    @media print {
      @page {
        size: ${paperSize} portrait;
        margin: 8mm 12mm 10mm 12mm;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }
      .sheet {
        padding: 0 !important;
        width: 100% !important;
        min-height: auto !important;
        box-shadow: none !important;
      }
    }
    .kop-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      text-align: center;
      padding-bottom: 4px;
    }
    .kop-logo {
      width: 75px;
      height: 75px;
      object-fit: contain;
    }
    .kop-text {
      flex: 1;
      padding: 0 12px;
    }
    .kop-text h2 {
      margin: 0;
      font-size: 13pt;
      font-weight: bold;
      letter-spacing: 0.5px;
    }
    .kop-text h1 {
      margin: 2px 0;
      font-size: 15pt;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .kop-text h3 {
      margin: 0;
      font-size: 14pt;
      font-weight: bold;
      letter-spacing: 3px;
    }
    .kop-text p {
      margin: 2px 0 0 0;
      font-size: 8.5pt;
      line-height: 1.25;
    }
    .kop-divider {
      border-top: 3px solid #000;
      border-bottom: 1px solid #000;
      height: 4px;
      margin-bottom: 14px;
    }
    .surat-title-box {
      text-align: center;
      margin-bottom: 16px;
    }
    .surat-title {
      font-size: 13pt;
      font-weight: bold;
      text-decoration: underline;
      letter-spacing: 1px;
      margin: 0;
    }
    .surat-nomor {
      font-size: 11pt;
      font-weight: bold;
      margin-top: 2px;
    }
    .surat-content {
      flex: 1;
      text-align: justify;
    }
    .surat-content ol, .surat-content ul {
      margin-top: 4px;
      margin-bottom: 8px;
      padding-left: 20px;
    }
    .ttd-section {
      margin-top: 20px;
      page-break-inside: avoid;
    }
    .ttd-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 10px;
    }
    .ttd-box {
      text-align: center;
      width: 42%;
    }
    .stamp-box {
      text-align: center;
      width: 16%;
    }
    .footer-ranting {
      border-top: 1.5px solid #000;
      padding-top: 5px;
      margin-top: 16px;
      font-size: 7.5pt;
      line-height: 1.4;
      font-family: Arial, sans-serif;
      page-break-inside: avoid;
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }
    .footer-ranting-label {
      font-weight: 800;
      white-space: nowrap;
      flex-shrink: 0;
      padding-top: 1px;
      letter-spacing: 0.5px;
    }
    .footer-ranting-list {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 2px 6px;
    }
    .ranting-item {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 7pt;
    }
    .ranting-num {
      font-weight: 700;
      color: #111;
      flex-shrink: 0;
    }
    @media print {
      body { background: none; }
      .sheet { width: 100%; min-height: auto; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div>
      <!-- Kop Surat -->
      <div class="kop-header">
        <img src="${LOGO_FORKI_BASE64}" class="kop-logo" alt="FORKI" />
        <div class="kop-text">
          <h2>PENGURUS KOTA</h2>
          <h1>INSTITUT KARATE-DO INDONESIA</h1>
          <h3>S U R A B A Y A</h3>
          <p>Sekretariat : Jl. Raya Kertajaya Indah No. 77, Manyar Sabrangan, Kec. Mulyorejo, Surabaya, Jawa Timur, 60116.</p>
          <p>Contact Person : 085731241840 – 089656346642 | inkaisby@gmail.com</p>
        </div>
        <img src="${LOGO_INKAI_BASE64}" class="kop-logo" alt="INKAI" />
      </div>
      <div class="kop-divider"></div>

      <!-- Judul & Nomor -->
      <div class="surat-title-box">
        <div class="surat-title">${judulSurat}</div>
        <div class="surat-nomor">NOMOR : ${opts.nomorSurat}</div>
      </div>

      <!-- Body Surat -->
      <div class="surat-content">
        ${
          opts.contentHtml ||
          `<p style="margin-bottom:8px;">I. Berkenaan dengan pelaksanaan kegiatan organisasi INKAI Cabang Surabaya, dengan ini Pengurus Kota INKAI Surabaya menugaskan/mengundangkan personel sebagaimana terlampir di bawah ini:</p>
           ${tableSectionHtml}
           <p style="margin-top:8px;">II. Pelaksanaan kegiatan diselenggarakan pada tanggal <b>${tgl}</b> bertempat di Gedung Prasarana Olahraga Dispora Jatim Surabaya.</p>
           <p style="margin-top:8px;">III. Segera melaksanakan tugas ini dengan penuh rasa tanggung jawab serta melaporkan hasilnya kepada Ketua Pengurus Kota INKAI Surabaya.</p>
           <p style="margin-top:8px;">IV. Demikian untuk menjadikan perhatian dan atas kerjasama yang baik disampaikan terima kasih.</p>`
        }
      </div>

      <!-- Penetapan & Dual TTD -->
      <div class="ttd-section">
        <div style="text-align:right; margin-bottom:8px;">
          <div>Ditetapkan di &nbsp;: ${kota}</div>
          <div>Pada tanggal &nbsp;: ${tgl}</div>
        </div>
        <div style="text-align:center; font-weight:bold; font-size:11pt; margin-bottom:12px;">
          PENGURUS KOTA<br />INSTITUT KARATE-DO INDONESIA SURABAYA
        </div>
        <div class="ttd-grid">
          <div class="ttd-box">
            ${ketuaSignImg}
            <div style="font-weight:bold; text-decoration:underline; margin-top:4px;">${ketua}</div>
            <div>${ketuaJab}</div>
          </div>
          <div class="stamp-box">
            ${stampImg}
            ${qrHtml}
          </div>
          <div class="ttd-box">
            ${sekretarisSignImg}
            <div style="font-weight:bold; text-decoration:underline; margin-top:4px;">${sekretaris}</div>
            <div>${sekretarisJab}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Dynamic Ranting Aktif -->
    <div class="footer-ranting">
      <div class="footer-ranting-label">RTG :</div>
      <div class="footer-ranting-list">
        ${dojosFormatted}
      </div>
    </div>
  </div>
</body>
</html>`;
}

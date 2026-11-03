import type {
  WasitJuriDiscipline,
  WasitJuriLicenseGrade,
  WasitJuriPeriodDto,
  WasitJuriRegistrantDto,
  WasitJuriSubmissionType,
} from "@/lib/wasit-juri-data";

const GRADE_LABEL: Record<WasitJuriLicenseGrade, string> = {
  JURI_B: "Juri B",
  JURI_A: "Juri A",
  WASIT_B: "Wasit B",
  WASIT_A: "Wasit A",
};

const DISCIPLINE_LABEL: Record<WasitJuriDiscipline, string> = {
  KATA_KUMITE: "Kata & Kumite",
  KUMITE: "Kumite",
  KATA: "Kata",
};

const SUBMISSION_LABEL: Record<WasitJuriSubmissionType, string> = {
  BARU: "Baru",
  KENAIKAN: "Kenaikan",
  REFRESHING: "Refreshing",
};

function escapeHtml(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateId(ymd: string | null | undefined): string {
  if (!ymd) return "-";
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function generateWasitJuriRecapHtml(opts: {
  periodTitle: string;
  period?: WasitJuriPeriodDto | null;
  registrants: WasitJuriRegistrantDto[];
  scopeLabel: string;
  isArchiveView?: boolean;
  paperSize?: "A4" | "F4";
  origin?: string;
}): string {
  const {
    periodTitle,
    period,
    registrants,
    scopeLabel,
    isArchiveView = false,
    paperSize = "A4",
    origin = "",
  } = opts;

  const logoUrl = origin
    ? `${origin.replace(/\/$/, "")}/logo-inkai.png`
    : "/logo-inkai.png";
  const pageCssSize = paperSize === "F4" ? "215mm 330mm" : "A4";
  const printDate = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const totalCount = registrants.length;
  const paidCount = registrants.filter((r) => r.paymentState === "LUNAS").length;
  const passedCount = registrants.filter((r) => r.status === "LULUS").length;
  const totalFeePaid = registrants
    .filter((r) => r.paymentState === "LUNAS")
    .reduce((acc, r) => acc + r.feeAmount, 0);

  const rowsHtml = registrants
    .map((r, idx) => {
      const idCode = r.mshNumber && r.mshNumber !== "—" ? r.mshNumber : r.nia;
      const targetStr = `${GRADE_LABEL[r.targetGrade]} (${DISCIPLINE_LABEL[r.discipline]})`;
      const payText =
        r.paymentState === "LUNAS"
          ? `LUNAS (${r.paymentMethod})`
          : r.paymentState === "MENUNGGU_VERIFIKASI"
            ? "MENUNGGU VERIF"
            : "BELUM BAYAR";
      const scoreParts = [
        r.scores.teoriKata != null ? `TK:${r.scores.teoriKata}` : null,
        r.scores.teoriKumite != null ? `TKM:${r.scores.teoriKumite}` : null,
        r.scores.praktik != null ? `PR:${r.scores.praktik}` : null,
      ].filter(Boolean);
      const scoreStr = scoreParts.length > 0 ? scoreParts.join(" / ") : "-";

      const statusBadgeClass =
        r.status === "LULUS"
          ? "lulus"
          : r.status === "SIAP_UJIAN"
            ? "siap"
            : r.status === "MENGULANG"
              ? "ulang"
              : "proses";

      const resultText =
        r.status === "LULUS" && r.grantedLicense
          ? `${escapeHtml(r.grantedLicense)}${r.licenseValidUntil ? `<br/><small>Berlaku s/d ${escapeHtml(r.licenseValidUntil)}</small>` : ""}`
          : escapeHtml(r.status.replace(/_/g, " "));

      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>
            <strong>${escapeHtml(r.name)}</strong><br/>
            <span class="sub">${escapeHtml(idCode)} · ${escapeHtml(r.danRank)}${r.age != null ? ` · ${r.age} th` : ""}</span>
          </td>
          <td>${escapeHtml(r.dojoName)}</td>
          <td style="text-align:center;">${escapeHtml(SUBMISSION_LABEL[r.submissionType])}</td>
          <td>
            <strong>${escapeHtml(targetStr)}</strong>
            ${r.currentLicense ? `<br/><span class="sub">Awal: ${escapeHtml(r.currentLicense)}</span>` : ""}
          </td>
          <td style="text-align:right;">Rp ${r.feeAmount.toLocaleString("id-ID")}</td>
          <td style="text-align:center;">${escapeHtml(payText)}</td>
          <td style="text-align:center;font-family:monospace;">${escapeHtml(scoreStr)}</td>
          <td style="text-align:center;"><span class="badge ${statusBadgeClass}">${resultText}</span></td>
        </tr>
      `;
    })
    .join("");

  const scheduleSubtitle = period
    ? `Teori: ${formatDateId(period.theoryDate)} · Praktik: ${formatDateId(period.practicalDate)} · Lokasi: ${escapeHtml(period.location)}`
    : isArchiveView
      ? "Rekapitulasi Gabungan Arsip Riwayat Sertifikasi Wasit & Juri"
      : scopeLabel;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Rekap Sertifikasi Wasit Juri - ${escapeHtml(periodTitle)}</title>
  <style>
    @page {
      size: ${pageCssSize} landscape;
      margin: 11mm;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10.5px;
      margin: 0;
      color: #111827;
      background: #ffffff;
    }
    .kop {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      border-bottom: 3px double #8b0000;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .kop img {
      width: 54px;
      height: auto;
    }
    .kop-text {
      text-align: center;
    }
    .kop-text h2 {
      margin: 0;
      font-size: 15px;
      color: #8b0000;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .kop-text h3 {
      margin: 3px 0 0;
      font-size: 12px;
      color: #1f2937;
      text-transform: uppercase;
    }
    .kop-text p {
      margin: 2px 0 0;
      font-size: 10px;
      color: #4b5563;
    }
    .summary-box {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 7px 12px;
      margin-bottom: 10px;
      font-weight: bold;
      font-size: 10.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #9ca3af;
      padding: 5px 7px;
      vertical-align: middle;
    }
    th {
      background-color: #8b0000;
      color: #ffffff;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    tr:nth-child(even) {
      background-color: #f9fafb;
    }
    .sub {
      font-size: 9px;
      color: #4b5563;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 8.5px;
      font-weight: bold;
    }
    .badge.lulus { background: #dcfce7; color: #166534; }
    .badge.siap { background: #dbeafe; color: #1e40af; }
    .badge.ulang { background: #fee2e2; color: #991b1b; }
    .badge.proses { background: #fef3c7; color: #92400e; }
    .signatures {
      margin-top: 22px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .sig-box {
      width: 42%;
      text-align: center;
      font-size: 10.5px;
    }
    .sig-space {
      height: 56px;
    }
    .sig-line {
      display: inline-block;
      min-width: 180px;
      border-top: 1px solid #374151;
      padding-top: 4px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="kop">
    <img src="${logoUrl}" alt="Logo INKAI" />
    <div class="kop-text">
      <h2>INSTITUT KARATE-DO INDONESIA (INKAI) — CABANG KOTA SURABAYA</h2>
      <h3>DAFTAR PESERTA & HASIL SERTIFIKASI WASIT JURI: ${escapeHtml(periodTitle)}</h3>
      <p>${scheduleSubtitle}</p>
    </div>
  </div>

  <div class="summary-box">
    <span>Cakupan: ${escapeHtml(scopeLabel)}</span>
    <span>Total Peserta: ${totalCount} Orang</span>
    <span>Lunas Terverifikasi: ${paidCount} Orang (Rp ${totalFeePaid.toLocaleString("id-ID")})</span>
    <span>Lulus Bersertifikat: ${passedCount} Orang</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:28px;">No</th>
        <th>Nama Peserta / No. MSH</th>
        <th>Ranting / Dojo</th>
        <th style="width:68px;">Jenis</th>
        <th>Target Lisensi</th>
        <th style="width:82px;">Biaya</th>
        <th style="width:92px;">Pembayaran</th>
        <th style="width:96px;">Nilai Ujian</th>
        <th style="width:155px;">Status / Lisensi</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="9" style="text-align:center;padding:18px;color:#6b7280;">Belum ada data peserta pada tampilan ini.</td></tr>`}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-box">
      <div>Mengetahui,</div>
      <div><strong>Ketua Umum INKAI Cabang Surabaya</strong></div>
      <div class="sig-space"></div>
      <div class="sig-line">( ............................................ )</div>
    </div>
    <div class="sig-box">
      <div>Surabaya, ${escapeHtml(printDate)}</div>
      <div><strong>Ketua Komisi Perwasitan</strong></div>
      <div class="sig-space"></div>
      <div class="sig-line">( ............................................ )</div>
    </div>
  </div>
</body>
</html>`;
}

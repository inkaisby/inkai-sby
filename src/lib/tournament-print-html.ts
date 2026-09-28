import { deriveAgeCategoryLabel } from "./tournament-category-presets";

export interface TournamentPrintRegistrant {
  id: string;
  member: {
    fullName: string;
    nia?: string | null;
    currentRank?: string | null;
    gender?: string | null;
    birthDate?: string | null;
    photoUrl?: string | null;
  };
  dojo: {
    name: string;
  };
  category: {
    name: string;
    categoryType: string;
    gender: string;
    minAge?: number | null;
    maxAge?: number | null;
    fee: number;
  };
  status: string;
  notes?: string | null;
  actualWeight?: number | null;
  officialName?: string | null;
  officialPhone?: string | null;
}

export function generateTournamentIdCardsHtml(
  eventTitle: string,
  registrants: TournamentPrintRegistrant[],
  paperSize: "A4" | "F4" = "A4"
): string {
  const cardsHtml = registrants
    .map((r, idx) => {
      const typeLabel = r.category.categoryType.startsWith("KATA") ? "KATA" : "KUMITE";
      const photoSrc = r.member.photoUrl || "/images/default-avatar.png";
      const payMethod = r.notes?.includes("CASH") ? "TUNAI" : "TRANSFER";
      return `
        <div class="card">
          <div class="card-header">
            <div class="org-name">INKAI CABANG SURABAYA</div>
            <div class="event-title">${eventTitle}</div>
            <div class="badge-type ${typeLabel.toLowerCase()}">${typeLabel}</div>
          </div>
          <div class="card-body">
            <div class="photo-container">
              <img src="${photoSrc}" alt="${r.member.fullName}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(r.member.fullName)}&background=8b0000&color=fff'" />
            </div>
            <div class="info">
              <div class="name">${r.member.fullName}</div>
              <div class="nia">NIA: ${r.member.nia || "-"}</div>
              <div class="rank">Sabuk: ${r.member.currentRank || "Putih"}</div>
              <div class="dojo">Dojo: <strong>${r.dojo.name}</strong></div>
              <div class="category">Kelas: <strong>${r.category.name}</strong></div>
            </div>
          </div>
          <div class="card-footer">
            <span>ID ATLET #${(idx + 1).toString().padStart(4, "0")} (${payMethod})</span>
            <span>STATUS: ${r.status}</span>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>ID Card Pertandingan - ${eventTitle}</title>
      <style>
        @page {
          size: ${paperSize === "F4" ? "215mm 330mm" : "A4 portrait"};
          margin: 10mm;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 0;
          background: #fff;
          color: #111;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }
        .card {
          border: 2px solid #8b0000;
          border-radius: 8px;
          overflow: hidden;
          page-break-inside: avoid;
          background: #fff;
          display: flex;
          flex-direction: column;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .card-header {
          background: linear-gradient(135deg, #8b0000 0%, #cc0000 100%);
          color: #fff;
          padding: 8px 12px;
          text-align: center;
          position: relative;
        }
        .org-name {
          font-size: 10px;
          font-weight: bold;
          letter-spacing: 1px;
          opacity: 0.9;
        }
        .event-title {
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          margin-top: 2px;
        }
        .badge-type {
          position: absolute;
          top: 6px;
          right: 8px;
          background: #ffcc00;
          color: #000;
          font-size: 9px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .badge-type.kumite {
          background: #ff4444;
          color: #fff;
        }
        .card-body {
          display: flex;
          padding: 10px;
          gap: 12px;
          align-items: center;
        }
        .photo-container {
          width: 70px;
          height: 90px;
          border-radius: 4px;
          overflow: hidden;
          border: 1px solid #ccc;
          flex-shrink: 0;
        }
        .photo-container img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .info {
          flex: 1;
          font-size: 11px;
          line-height: 1.4;
        }
        .info .name {
          font-size: 13px;
          font-weight: bold;
          color: #8b0000;
          margin-bottom: 2px;
        }
        .info .category {
          color: #111;
          margin-top: 4px;
        }
        .card-footer {
          background: #f4f4f4;
          border-top: 1px solid #eee;
          padding: 4px 10px;
          font-size: 9px;
          display: flex;
          justify-content: space-between;
          color: #555;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="grid">
        ${cardsHtml}
      </div>
    </body>
    </html>
  `;
}

export function generateTournamentRosterHtml(
  eventTitle: string,
  registrants: TournamentPrintRegistrant[],
  paperSize: "A4" | "F4" = "A4",
  orientation: "landscape" | "portrait" = "landscape",
  origin: string = ""
): string {
  const logoUrl = origin ? `${origin.replace(/\/$/, "")}/logo-inkai.png` : "/logo-inkai.png";
  const rows = registrants
    .map((r, idx) => {
      const payMethod = r.notes?.includes("CASH") ? "TUNAI" : "TRANSFER";
      const weightText = r.actualWeight ? `${r.actualWeight} kg` : "-";
      const ageCategory = deriveAgeCategoryLabel(
        r.category.name,
        r.category.minAge,
        r.category.maxAge,
        r.member.birthDate
      );
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><strong>${r.member.fullName}</strong></td>
          <td>${r.member.nia || "-"}</td>
          <td>${r.dojo.name}</td>
          <td>${r.member.currentRank || "-"}</td>
          <td style="text-align:center;"><strong>${ageCategory}</strong></td>
          <td>${r.category.name}</td>
          <td style="text-align:center;">Rp ${(r.category.fee || 0).toLocaleString("id-ID")}</td>
          <td style="text-align:center;"><strong>${payMethod}</strong></td>
          <td style="text-align:center;">${weightText}</td>
          <td style="text-align:center;"><span class="badge ${r.status.toLowerCase()}">${r.status}</span></td>
        </tr>
      `;
    })
    .join("");

  const pageCssSize = paperSize === "F4" ? "215mm 330mm" : "A4";

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Daftar Peserta Pertandingan - ${eventTitle}</title>
      <style>
        @page {
          size: ${pageCssSize} ${orientation};
          margin: 12mm;
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 11px;
          margin: 0;
          color: #111;
          background: #fff;
        }
        .kop {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          border-bottom: 3px double #8b0000;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .kop img {
          width: 55px;
          height: auto;
        }
        .kop-text {
          text-align: center;
        }
        .kop-text h2 {
          margin: 0;
          font-size: 15px;
          color: #8b0000;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .kop-text h3 {
          margin: 3px 0 0 0;
          font-size: 12px;
          color: #333;
          font-weight: bold;
          text-transform: uppercase;
        }
        .kop-text p {
          margin: 2px 0 0 0;
          font-size: 10px;
          color: #666;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        th, td {
          border: 1px solid #999;
          padding: 6px 8px;
          font-size: 10.5px;
        }
        th {
          background-color: #8b0000;
          color: white;
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.3px;
        }
        tr:nth-child(even) {
          background-color: #fcfcfc;
        }
        .badge {
          padding: 2px 5px;
          border-radius: 3px;
          font-size: 8.5px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .badge.registered, .badge.tercatat { background: #e0f2fe; color: #0369a1; }
        .badge.paid, .badge.lunas { background: #dcfce7; color: #15803d; }
        .badge.verified { background: #dbeafe; color: #1e40af; }
        .summary-box {
          margin-top: 10px;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 11px;
        }
        .signatures {
          margin-top: 25px;
          display: flex;
          justify-content: space-between;
          text-align: center;
          page-break-inside: avoid;
        }
        .sig-box {
          width: 220px;
          font-size: 10.5px;
        }
        .sig-title {
          font-weight: bold;
          margin-bottom: 50px;
        }
        .sig-name {
          font-weight: bold;
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="kop">
        <img src="${logoUrl}" alt="Logo INKAI" onerror="this.style.display='none'" />
        <div class="kop-text">
          <h2>INSTITUT KARATE-DO INDONESIA (INKAI) CABANG SURABAYA</h2>
          <h3>DAFTAR PESERTA PERTANDINGAN: ${eventTitle.toUpperCase()}</h3>
          <p>Sekretariat: Surabaya, Jawa Timur | Official Website: inkai-sby.vercel.app</p>
        </div>
      </div>

      <div class="summary-box">
        <span>TOTAL PESERTA TERDAFTAR: ${registrants.length} Atlet</span>
        <span>KERTAS: ${paperSize} (${orientation.toUpperCase()})</span>
        <span>TANGGAL CETAK: ${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 30px;">No</th>
            <th>Nama Atlet</th>
            <th>NIA</th>
            <th>Dojo / Kontingen</th>
            <th>Sabuk</th>
            <th>Kategori Usia</th>
            <th>Kelas Pertandingan</th>
            <th style="width: 90px;">Biaya</th>
            <th style="width: 80px;">Metode</th>
            <th style="width: 70px;">BB (kg)</th>
            <th style="width: 90px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length > 0 ? rows : '<tr><td colSpan="11" style="text-align:center; padding: 20px;">Belum ada peserta terdaftar.</td></tr>'}
        </tbody>
      </table>


      <div class="signatures">
        <div class="sig-box">
          <div class="sig-title">Mengetahui,<br/>Panitia Kejuaraan INKAI Surabaya</div>
          <div class="sig-name">( ............................................ )</div>
        </div>
        <div class="sig-box">
          <div class="sig-title">Surabaya, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}<br/>Ketua Pertandingan / Perwasitan</div>
          <div class="sig-name">( ............................................ )</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export interface TournamentMedalTallyItem {
  dojoName: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  points: number;
  winners: {
    athleteName: string;
    categoryName: string;
    medal: string;
  }[];
}

export function generateTournamentMedalTallyHtml(
  eventTitle: string,
  tally: TournamentMedalTallyItem[],
  paperSize: "A4" | "F4" = "A4"
): string {
  const totalGold = tally.reduce((s, t) => s + t.gold, 0);
  const totalSilver = tally.reduce((s, t) => s + t.silver, 0);
  const totalBronze = tally.reduce((s, t) => s + t.bronze, 0);
  const totalMedals = totalGold + totalSilver + totalBronze;

  const rows = tally
    .map((t, idx) => {
      const rankBadge =
        idx === 0 ? "🥇 JUARA UMUM I" :
        idx === 1 ? "🥈 JUARA UMUM II" :
        idx === 2 ? "🥉 JUARA UMUM III" : `Peringkat #${idx + 1}`;

      const winnerList = t.winners
        .map((w) => {
          const mLabel =
            w.medal === "GOLD" ? "🥇 Emas" :
            w.medal === "SILVER" ? "🥈 Perak" : "🥉 Perunggu";
          return `<li><strong>${w.athleteName}</strong> (${w.categoryName}) - <span class="m-tag">${mLabel}</span></li>`;
        })
        .join("");

      return `
        <tr>
          <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
          <td>
            <div style="font-weight:bold; font-size:13px;">${t.dojoName}</div>
            <div style="font-size:10px; color:#c53030; font-weight:bold; margin-top:2px;">${rankBadge}</div>
          </td>
          <td style="text-align:center; font-weight:bold; color:#d69e2e; background:#fefcbf;">${t.gold}</td>
          <td style="text-align:center; font-weight:bold; color:#718096; background:#edf2f7;">${t.silver}</td>
          <td style="text-align:center; font-weight:bold; color:#dd6b20; background:#feebc8;">${t.bronze}</td>
          <td style="text-align:center; font-weight:bold;">${t.total}</td>
          <td style="text-align:center; font-weight:bold; color:#2b6cb0;">${t.points}</td>
        </tr>
        ${
          winnerList
            ? `
          <tr style="background-color: #fafafa;">
            <td colspan="2" style="font-size:10px; color:#555; padding-left:25px;"><em>Rincian Pemenang Medali:</em></td>
            <td colspan="5" style="padding:6px 12px;">
              <ul style="margin:0; padding-left:15px; font-size:10px; line-height:1.5;">${winnerList}</ul>
            </td>
          </tr>
        `
            : ""
        }
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Rekapitulasi Medali & Juara Umum - ${eventTitle}</title>
      <style>
        @page {
          size: ${paperSize === "F4" ? "215mm 330mm" : "A4 portrait"};
          margin: 12mm;
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 11px;
          margin: 0;
          color: #222;
        }
        .header {
          text-align: center;
          margin-bottom: 15px;
          border-bottom: 3px double #8b0000;
          padding-bottom: 8px;
        }
        .header h2 {
          margin: 0;
          color: #8b0000;
          font-size: 16px;
          text-transform: uppercase;
        }
        .header h3 {
          margin: 4px 0 0 0;
          color: #2b6cb0;
          font-size: 13px;
        }
        .summary-box {
          display: flex;
          justify-content: space-around;
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 15px;
          font-weight: bold;
          text-align: center;
        }
        .summary-item {
          display: flex;
          flex-direction: column;
        }
        .summary-item .num {
          font-size: 16px;
          color: #8b0000;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          border: 1px solid #cbd5e0;
          padding: 7px 10px;
        }
        th {
          background-color: #8b0000;
          color: white;
          text-transform: uppercase;
          font-size: 10px;
        }
        .m-tag {
          font-weight: bold;
        }
        .signatures {
          margin-top: 30px;
          display: flex;
          justify-content: space-between;
          text-align: center;
          page-break-inside: avoid;
        }
        .sig-box {
          width: 220px;
        }
        .sig-title {
          font-weight: bold;
          margin-bottom: 60px;
        }
        .sig-name {
          font-weight: bold;
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>INSTITUT KARATE-DO INDONESIA (INKAI) CABANG SURABAYA</h2>
        <h3>LAPORAN REKAPITULASI MEDALI & KLASEMEN JUARA UMUM</h3>
        <div style="font-size:11px; font-weight:bold; margin-top:3px; color:#4a5568;">${eventTitle.toUpperCase()}</div>
      </div>

      <div class="summary-box">
        <div class="summary-item">
          <span class="num">${tally.length}</span>
          <span>DOJO / RANTING</span>
        </div>
        <div class="summary-item">
          <span class="num" style="color:#d69e2e;">🥇 ${totalGold}</span>
          <span>MEDALI EMAS</span>
        </div>
        <div class="summary-item">
          <span class="num" style="color:#718096;">🥈 ${totalSilver}</span>
          <span>MEDALI PERAK</span>
        </div>
        <div class="summary-item">
          <span class="num" style="color:#dd6b20;">🥉 ${totalBronze}</span>
          <span>MEDALI PERUNGGU</span>
        </div>
        <div class="summary-item">
          <span class="num">${totalMedals}</span>
          <span>TOTAL MEDALI</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 35px;">No</th>
            <th>Nama Dojo / Ranting Kontingen</th>
            <th style="width: 75px;">🥇 Emas</th>
            <th style="width: 75px;">🥈 Perak</th>
            <th style="width: 75px;">🥉 Perunggu</th>
            <th style="width: 80px;">Total Medali</th>
            <th style="width: 70px;">Total Poin</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-box">
          <div class="sig-title">Mengetahui,<br/>Ketua Panitia Kejuaraan</div>
          <div class="sig-name">( ............................................ )</div>
        </div>
        <div class="sig-box">
          <div class="sig-title">Surabaya, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}<br/>Dewan Perwasitan Kejuaraan</div>
          <div class="sig-name">( ............................................ )</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

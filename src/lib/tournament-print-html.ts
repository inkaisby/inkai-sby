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
  paperSize: "A4" | "F4" = "A4"
): string {
  const rows = registrants
    .map((r, idx) => {
      const payMethod = r.notes?.includes("CASH") ? "TUNAI" : "TRANSFER";
      const weightText = r.actualWeight ? `${r.actualWeight} kg` : "-";
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><strong>${r.member.fullName}</strong></td>
          <td>${r.member.nia || "-"}</td>
          <td>${r.dojo.name}</td>
          <td>${r.member.currentRank || "-"}</td>
          <td>${r.category.name}</td>
          <td style="text-align:center;">Rp ${(r.category.fee || 0).toLocaleString("id-ID")}</td>
          <td style="text-align:center;"><strong>${payMethod}</strong></td>
          <td style="text-align:center;">${weightText}</td>
          <td style="text-align:center;"><span class="badge ${r.status.toLowerCase()}">${r.status}</span></td>
        </tr>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Roster Pertandingan - ${eventTitle}</title>
      <style>
        @page {
          size: ${paperSize === "F4" ? "215mm 330mm" : "A4 landscape"};
          margin: 15mm;
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          margin: 0;
          color: #222;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 3px double #8b0000;
          padding-bottom: 10px;
        }
        .header h2 {
          margin: 0;
          color: #8b0000;
          text-transform: uppercase;
        }
        .header h3 {
          margin: 5px 0 0 0;
          color: #444;
          font-weight: normal;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        th, td {
          border: 1px solid #ccc;
          padding: 8px;
          font-size: 11px;
        }
        th {
          background-color: #8b0000;
          color: white;
          text-transform: uppercase;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .badge {
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 9px;
          font-weight: bold;
        }
        .badge.registered { background: #e0f2fe; color: #0369a1; }
        .badge.paid { background: #dcfce7; color: #15803d; }
        .badge.verified { background: #dbeafe; color: #1e40af; }
        .summary-box {
          margin-top: 15px;
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          background: #f1f5f9;
          padding: 10px;
          border-radius: 5px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>INSTITUT KARATE-DO INDONESIA (INKAI) CABANG SURABAYA</h2>
        <h3>DAFTAR ROSTER PESERTA PERTANDINGAN: ${eventTitle.toUpperCase()}</h3>
      </div>

      <div class="summary-box">
        <span>TOTAL PESERTA/KATEGORI: ${registrants.length}</span>
        <span>TANGGAL CETAK: ${new Date().toLocaleDateString("id-ID")}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 35px;">No</th>
            <th>Nama Atlet</th>
            <th>NIA</th>
            <th>Dojo / Ranting</th>
            <th>Sabuk</th>
            <th>Kelas / Kategori Pertandingan</th>
            <th>Biaya (Rp)</th>
            <th>Metode Bayar</th>
            <th>Berat Badan</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </body>
    </html>
  `;
}

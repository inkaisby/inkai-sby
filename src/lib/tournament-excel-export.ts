export function exportTournamentRosterToExcel(
  eventName: string,
  registrations: Array<{
    id?: string;
    member: {
      fullName: string;
      nia?: string | null;
      currentRank?: string | null;
      birthPlace?: string | null;
      birthDate?: string | null;
    };
    dojo: { name: string };
    category: { name: string; fee: number; isFeeVisible?: boolean };
    status: string;
    paymentMethod?: string | null;
    actualWeight?: number | null;
    officialName?: string | null;
    officialPhone?: string | null;
    notes?: string | null;
  }>
) {
  if (!registrations || registrations.length === 0) return;

  const cleanEventName = eventName || "Kejuaraan Karate INKAI Surabaya";
  const dateStr = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let totalFee = 0;
  let hasAnyVisibleFee = false;

  const rowsHtml = registrations
    .map((r, idx) => {
      const isCash = r.notes?.includes("CASH") || r.paymentMethod === "CASH";
      const payMethod = isCash ? "TUNAI" : "TRANSFER / QRIS";
      const fee = r.category?.fee || 0;
      const showFee = r.category?.isFeeVisible !== false;
      if (showFee) {
        totalFee += fee;
        hasAnyVisibleFee = true;
      }
      const feeCell = showFee ? `Rp ${fee.toLocaleString("id-ID")}` : "-";

      const weightText = r.actualWeight ? `${r.actualWeight} kg` : "Belum timbang";
      const bgClass = idx % 2 === 1 ? 'class="zebra"' : "";

      const place = (r.member?.birthPlace || "").trim();
      let dStr = "";
      if (r.member?.birthDate) {
        const d = new Date(r.member.birthDate);
        if (!Number.isNaN(d.getTime())) {
          const pad = (n: number) => String(n).padStart(2, "0");
          dStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
        } else {
          dStr = String(r.member.birthDate).trim();
        }
      }
      const ttlText = place && dStr ? `${place}, ${dStr}` : place || dStr || "-";

      return `<tr ${bgClass}>
        <td class="text-center text-fmt">${idx + 1}</td>
        <td class="text-left"><b>${escapeXml(r.member?.fullName || "-")}</b></td>
        <td class="text-center text-fmt">${escapeXml(r.member?.nia || "-")}</td>
        <td class="text-left">${escapeXml(ttlText)}</td>
        <td class="text-left">${escapeXml(r.dojo?.name || "-")}</td>
        <td class="text-left">${escapeXml(r.member?.currentRank || "Putih")}</td>
        <td class="text-left">${escapeXml(r.category?.name || "-")}</td>
        <td class="${showFee ? 'currency' : 'text-center'}">${feeCell}</td>
        <td class="text-center"><b>${escapeXml(r.status || "REGISTERED")}</b></td>
        <td class="text-center">${escapeXml(payMethod)}</td>
        <td class="text-center">${escapeXml(weightText)}</td>
        <td class="text-left">${escapeXml(r.officialName || "-")}</td>
        <td class="text-center text-fmt">${escapeXml(r.officialPhone || "-")}</td>
      </tr>`;
    })
    .join("\n");

  const totalFeeFormatted = hasAnyVisibleFee ? `Rp ${totalFee.toLocaleString("id-ID")}` : "-";

  const html = `<html xmlns:o="urn:schemas-microsoft-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]>
<xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>Roster Peserta</x:Name>
    <x:WorksheetOptions>
     <x:DisplayGridlines/>
    </x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 11pt; color: #111827; }
  table { border-collapse: collapse; width: 100%; margin-top: 10px; }
  th { background-color: #B91C1C; color: #FFFFFF; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #991B1B; padding: 10px 8px; font-size: 10.5pt; }
  td { border: 1px solid #D1D5DB; padding: 8px 10px; vertical-align: middle; font-size: 10pt; }
  .zebra { background-color: #F9FAFB; }
  .text-left { text-align: left; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .currency { mso-number-format: "Rp\\ \\#\\,\\#\\#0"; text-align: right; font-weight: bold; color: #047857; }
  .text-fmt { mso-number-format: "\\@"; }
  .header-banner { background-color: #991B1B; color: #FFFFFF; font-size: 14pt; font-weight: bold; text-align: center; padding: 12px; }
  .subheader-banner { background-color: #FEF2F2; color: #7F1D1D; font-size: 10pt; font-weight: bold; text-align: center; padding: 6px; }
  .summary-row { background-color: #FEF2F2; font-weight: bold; font-size: 10.5pt; border-top: 2px solid #B91C1C; border-bottom: 2px solid #B91C1C; }
</style>
</head>
<body>
  <table>
    <col style="width: 45px;" />
    <col style="width: 260px;" />
    <col style="width: 110px;" />
    <col style="width: 160px;" />
    <col style="width: 180px;" />
    <col style="width: 130px;" />
    <col style="width: 250px;" />
    <col style="width: 130px;" />
    <col style="width: 140px;" />
    <col style="width: 140px;" />
    <col style="width: 130px;" />
    <col style="width: 160px;" />
    <col style="width: 130px;" />
    <thead>
      <tr>
        <th colspan="13" class="header-banner">INKAI CABANG SURABAYA - DAFTAR PESERTA KEJUARAAN KARATE</th>
      </tr>
      <tr>
        <th colspan="13" class="subheader-banner">Event: ${escapeXml(cleanEventName)} | Tanggal Cetak/Ekspor: ${escapeXml(dateStr)}</th>
      </tr>
      <tr>
        <th>No</th>
        <th>Nama Atlet</th>
        <th>NIA</th>
        <th>TTL</th>
        <th>Dojo / Kontingen</th>
        <th>Sabuk</th>
        <th>Kelas Pertandingan</th>
        <th>Biaya (Rp)</th>
        <th>Status Pendaftaran</th>
        <th>Metode Pembayaran</th>
        <th>Hasil Berat Badan</th>
        <th>Nama Official</th>
        <th>Kontak Official</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr class="summary-row">
        <td colspan="7" class="text-right">TOTAL KESELURUHAN (${registrations.length} PESERTA):</td>
        <td class="currency">${totalFeeFormatted}</td>
        <td colspan="5"></td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;

  const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const fileName = `Roster_${cleanEventName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xls`;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeXml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

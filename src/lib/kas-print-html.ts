import { formatRp } from "@/lib/terbilang";
import { openHtmlPrintWindow } from "@/lib/ukt-print-html";
import { formatKasDateId, type KasLedgerRow } from "@/lib/kas";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type KasPrintData = {
  origin: string;
  scopeLabel: string;
  periodLabel: string;
  printedAt: string;
  saldoAkhir: number;
  rows: KasLedgerRow[];
  sekretariatAddress?: string;
};

export function buildKasPrintHtml(data: KasPrintData): string {
  const logoUrl = `${data.origin.replace(/\/$/, "")}/logo-inkai.png`;
  const sekretariat =
    data.sekretariatAddress?.trim() ||
    "Sekretariat: Jl. Raya Kertajaya Indah No. 77 Surabaya";
  const body = data.rows
    .map(
      (r) => `
      <tr>
        <td class="c">${r.no}</td>
        <td>${escapeHtml(formatKasDateId(r.txnDate))}</td>
        <td>${escapeHtml(r.description)}</td>
        <td class="r">${r.amountIn ? escapeHtml(formatRp(r.amountIn)) : "—"}</td>
        <td class="r">${r.amountOut ? escapeHtml(formatRp(r.amountOut)) : "—"}</td>
        <td class="r">${escapeHtml(formatRp(r.saldo))}</td>
        <td>${escapeHtml(r.kegiatan || "—")}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Laporan Keuangan Detail</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
    .kop { display: flex; gap: 12px; align-items: center; border-bottom: 2px solid #b91c1c; padding-bottom: 8px; }
    .kop img { height: 56px; width: 56px; object-fit: contain; }
    .kop-title { font-weight: 700; font-size: 14px; }
    .kop-city { font-size: 12px; }
    h1 { text-align: center; font-size: 16px; margin: 12px 0 4px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .saldo { border: 2px solid #15803d; padding: 6px 10px; font-weight: 700; color: #15803d; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #333; padding: 4px 6px; }
    th { background: #f3f4f6; }
    td.c, th.c { text-align: center; }
    td.r, th.r { text-align: right; }
  </style>
</head>
<body>
  <div class="kop">
    <img src="${escapeHtml(logoUrl)}" alt="Logo INKAI" />
    <div>
      <div class="kop-title">INSTITUT KARATE-DO INDONESIA</div>
      <div class="kop-city">Cabang Surabaya · ${escapeHtml(data.scopeLabel)}</div>
      <div>${escapeHtml(sekretariat.startsWith("Sekretariat") ? sekretariat : `Sekretariat: ${sekretariat}`)}</div>
    </div>
  </div>
  <h1>LAPORAN KEUANGAN DETAIL</h1>
  <div class="meta">
    <div>Periode: ${escapeHtml(data.periodLabel)} · Dicetak ${escapeHtml(data.printedAt)}</div>
    <div class="saldo">Saldo akhir ${escapeHtml(formatRp(data.saldoAkhir))}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="c">No</th>
        <th>Tanggal</th>
        <th>Keterangan</th>
        <th class="r">Masuk</th>
        <th class="r">Keluar</th>
        <th class="r">Saldo</th>
        <th>Kegiatan</th>
      </tr>
    </thead>
    <tbody>${body || `<tr><td colspan="7" class="c">Tidak ada data</td></tr>`}</tbody>
  </table>
</body>
</html>`;
}

export function printKasDocument(data: KasPrintData): void {
  openHtmlPrintWindow(buildKasPrintHtml(data));
}

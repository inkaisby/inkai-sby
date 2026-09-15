import { formatRp } from "@/lib/terbilang";
import { openHtmlPrintWindow } from "@/lib/ukt-print-html";
import { formatKasDateId, type KasLedgerRow } from "@/lib/kas";
import type { KasSwotAnalysisResult } from "@/components/admin/kas/KasChartSwotPanel";

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
  swotAnalysis?: KasSwotAnalysisResult;
  selectedKegiatanList?: string[];
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

  // Build SWOT section if available
  let swotHtml = "";
  if (data.swotAnalysis) {
    const sw = data.swotAnalysis;
    const kegListStr =
      data.selectedKegiatanList && data.selectedKegiatanList.length > 0
        ? data.selectedKegiatanList.join(", ")
        : "Semua Kegiatan";

    const sItems = sw.strengths
      .map((s) => `<li><strong>${escapeHtml(s.title)}</strong><br/><span style="color:#333;">${escapeHtml(s.description)}</span></li>`)
      .join("");

    const wItems =
      sw.weaknesses.length > 0
        ? sw.weaknesses
            .map((w) => `<li><strong>${escapeHtml(w.title)}</strong><br/><span style="color:#333;">${escapeHtml(w.description)}</span></li>`)
            .join("")
        : `<li><em style="color:#555;">Tidak ada kelemahan krusial terdeteksi.</em></li>`;

    const oItems = sw.opportunities
      .map((o) => `<li><strong>${escapeHtml(o.title)}</strong><br/><span style="color:#333;">${escapeHtml(o.description)}</span></li>`)
      .join("");

    const tItems = sw.threats
      .map((t) => `<li><strong>${escapeHtml(t.title)}</strong><br/><span style="color:#333;">${escapeHtml(t.description)}</span></li>`)
      .join("");

    const recItems = sw.recommendations
      .map((rec) => `<li>${escapeHtml(rec)}</li>`)
      .join("");

    swotHtml = `
    <div class="swot-section" style="page-break-inside: avoid; margin-bottom: 16px;">
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 10px;">
        <div style="font-weight: 700; font-size: 13px; color: #0f172a;">📊 RINGKASAN GRAFIK & ANALISIS SWOT KEUANGAN</div>
        <div style="font-size: 10px; color: #475569; margin-top: 2px;">
          Filter Kegiatan: <strong>${escapeHtml(kegListStr)}</strong> · 
          Total Masuk: <strong style="color: #15803d;">${formatRp(sw.metricsSummary.totalIn)}</strong> · 
          Total Keluar: <strong style="color: #b91c1c;">${formatRp(sw.metricsSummary.totalOut)}</strong> · 
          Net: <strong style="color: #1d4ed8;">${formatRp(sw.metricsSummary.netCashFlow)}</strong>
        </div>
      </div>

      <div class="swot-grid">
        <div class="swot-box s-box">
          <div class="swot-title s-title">💪 KEKUATAN (STRENGTHS)</div>
          <ul>${sItems}</ul>
        </div>
        <div class="swot-box w-box">
          <div class="swot-title w-title">⚠️ KELEMAHAN (WEAKNESSES)</div>
          <ul>${wItems}</ul>
        </div>
        <div class="swot-box o-box">
          <div class="swot-title o-title">💡 PELUANG (OPPORTUNITIES)</div>
          <ul>${oItems}</ul>
        </div>
        <div class="swot-box t-box">
          <div class="swot-title t-title">⚡ ANCAMAN (THREATS)</div>
          <ul>${tItems}</ul>
        </div>
      </div>

      <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-top: 8px;">
        <div style="font-weight: 700; font-size: 11px; color: #1e293b; margin-bottom: 4px;">🎯 REKOMENDASI STRATEGIS KEUANGAN</div>
        <ol style="margin: 0; padding-left: 18px; font-size: 10px; line-height: 1.4; color: #334155;">${recItems}</ol>
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Laporan Keuangan Detail</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #111; line-height: 1.3; }
    .kop { display: flex; gap: 12px; align-items: center; border-bottom: 2px solid #b91c1c; padding-bottom: 8px; }
    .kop img { height: 50px; width: 50px; object-fit: contain; }
    .kop-title { font-weight: 700; font-size: 13px; }
    .kop-city { font-size: 11px; }
    h1 { text-align: center; font-size: 15px; margin: 10px 0 4px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center; }
    .saldo { border: 2px solid #15803d; padding: 4px 8px; font-weight: 700; color: #15803d; font-size: 11px; border-radius: 4px; }
    
    .swot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .swot-box { border-radius: 6px; padding: 6px 10px; font-size: 10px; border: 1px solid #ddd; }
    .swot-title { font-weight: 700; font-size: 11px; padding-bottom: 3px; border-bottom: 1px solid #ccc; margin-bottom: 4px; }
    .swot-box ul { margin: 0; padding-left: 14px; }
    .swot-box li { margin-bottom: 3px; }

    .s-box { background: #f0fdf4; border-color: #bbf7d0; }
    .s-title { color: #15803d; border-color: #86efac; }
    .w-box { background: #fff1f2; border-color: #fecdd3; }
    .w-title { color: #be123c; border-color: #fda4af; }
    .o-box { background: #eff6ff; border-color: #bfdbfe; }
    .o-title { color: #1d4ed8; border-color: #93c5fd; }
    .t-box { background: #fffbeb; border-color: #fde68a; }
    .t-title { color: #b45309; border-color: #fcd34d; }

    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #333; padding: 4px 6px; font-size: 10px; }
    th { background: #f3f4f6; font-weight: 700; }
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

  ${swotHtml}

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
    <tbody>${
      body ||
      `<tr><td colspan="7" class="c" style="padding: 16px; color: #555;">Tidak ada mutasi yang cocok dengan filter yang dipilih (${escapeHtml(
        data.periodLabel,
      )}).<br/>Saldo kas berjalan tercatat sebesar <strong>${escapeHtml(
        formatRp(data.saldoAkhir),
      )}</strong>.</td></tr>`
    }</tbody>
  </table>
</body>
</html>`;
}

export function printKasDocument(data: KasPrintData): void {
  openHtmlPrintWindow(buildKasPrintHtml(data));
}


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

const DONUT_COLORS = [
  "#16a34a", // emerald
  "#2563eb", // blue
  "#d97706", // amber
  "#9333ea", // purple
  "#0891b2", // cyan
  "#e11d48", // rose
  "#475569", // slate
];

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

  // Build All Visual Charts Section (Donut, Area Line, Bar Chart)
  let allChartsHtml = "";
  if (data.rows && data.rows.length > 0) {
    const selectedSet =
      data.selectedKegiatanList && data.selectedKegiatanList.length > 0
        ? new Set(data.selectedKegiatanList)
        : null;

    const filteredRows = selectedSet
      ? data.rows.filter((r) => selectedSet.has((r.kegiatan || "Tanpa Kegiatan").trim()))
      : data.rows;

    const totalIn = filteredRows.reduce((a, r) => a + r.amountIn, 0);
    const totalOut = filteredRows.reduce((a, r) => a + r.amountOut, 0);

    // 1. Kegiatan Breakdown & Bars
    const kegiatanMap = new Map<string, { name: string; in: number; out: number; count: number }>();
    for (const r of filteredRows) {
      const kName = (r.kegiatan || "Tanpa Kegiatan").trim() || "Tanpa Kegiatan";
      const current = kegiatanMap.get(kName) || { name: kName, in: 0, out: 0, count: 0 };
      current.in += r.amountIn;
      current.out += r.amountOut;
      current.count += 1;
      kegiatanMap.set(kName, current);
    }

    const kegiatanItems = Array.from(kegiatanMap.values())
      .sort((a, b) => (b.in + b.out) - (a.in + a.out));

    let maxVal = 1;
    for (const item of kegiatanItems) {
      if (item.in > maxVal) maxVal = item.in;
      if (item.out > maxVal) maxVal = item.out;
    }

    // Donut Segments (Pemasukan or Pengeluaran)
    const donutTargetItems = totalIn >= totalOut
      ? kegiatanItems.filter((k) => k.in > 0).map((k) => ({ name: k.name, val: k.in }))
      : kegiatanItems.filter((k) => k.out > 0).map((k) => ({ name: k.name, val: k.out }));

    const donutTotal = totalIn >= totalOut ? totalIn : totalOut;
    const donutLabel = totalIn >= totalOut ? "Pemasukan" : "Pengeluaran";

    let accumulatedPct = 0;
    const radius = 35;
    const circumference = 2 * Math.PI * radius;

    const donutSvgCircles = donutTargetItems.map((item, idx) => {
      const pct = donutTotal > 0 ? item.val / donutTotal : 0;
      const strokeDasharray = `${(pct * circumference).toFixed(1)} ${circumference.toFixed(1)}`;
      const strokeDashoffset = (-accumulatedPct * circumference).toFixed(1);
      accumulatedPct += pct;
      const color = DONUT_COLORS[idx % DONUT_COLORS.length];
      return `<circle cx="45" cy="45" r="${radius}" fill="transparent" stroke="${color}" stroke-width="14" stroke-dasharray="${strokeDasharray}" stroke-dashoffset="${strokeDashoffset}" />`;
    }).join("");

    const donutLegendRows = donutTargetItems.map((item, idx) => {
      const pct = donutTotal > 0 ? Math.round((item.val / donutTotal) * 100) : 0;
      const color = DONUT_COLORS[idx % DONUT_COLORS.length];
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9px; margin-bottom: 2px;">
          <div style="display: flex; align-items: center; gap: 4px; overflow: hidden; white-space: nowrap;">
            <span style="display: inline-block; width: 8px; height: 8px; background: ${color}; border-radius: 1px; flex-shrink: 0;"></span>
            <span style="font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.name)}</span>
          </div>
          <div style="font-family: monospace; font-weight: 700; flex-shrink: 0; margin-left: 6px;">
            <span>${pct}%</span> <span style="color: #64748b; font-weight: 400; font-size: 8px;">(${formatRp(item.val)})</span>
          </div>
        </div>`;
    }).join("");

    // Monthly Trend & Area Line Chart
    const monthlyMap = new Map<string, { label: string; in: number; out: number; net: number }>();
    for (const r of filteredRows) {
      const ym = r.txnDate.slice(0, 7);
      let label = ym;
      const parts = ym.split("-");
      if (parts.length === 2) {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        const mIdx = parseInt(parts[1], 10) - 1;
        if (mIdx >= 0 && mIdx < 12) label = `${monthNames[mIdx]} ${parts[0]}`;
      }
      const curr = monthlyMap.get(ym) || { label, in: 0, out: 0, net: 0 };
      curr.in += r.amountIn;
      curr.out += r.amountOut;
      curr.net = curr.in - curr.out;
      monthlyMap.set(ym, curr);
    }

    const monthlyTrendList = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map((entry) => entry[1]);

    // Area Line SVG path
    let areaSvgPath = { lineD: "", areaD: "", zeroY: 45, points: [] as { x: number; y: number; net: number; label: string }[] };
    if (monthlyTrendList.length > 0) {
      const width = 280;
      const height = 90;
      const padding = 15;

      const nets = monthlyTrendList.map((d) => d.net);
      const maxNet = Math.max(...nets, 1);
      const minNet = Math.min(...nets, 0);
      const rangeNet = maxNet - minNet || 1;

      const pts = monthlyTrendList.map((d, i) => {
        const x = padding + (i / Math.max(monthlyTrendList.length - 1, 1)) * (width - 2 * padding);
        const y = height - padding - ((d.net - minNet) / rangeNet) * (height - 2 * padding);
        return { x, y, net: d.net, label: d.label };
      });

      const zeroY = height - padding - ((0 - minNet) / rangeNet) * (height - 2 * padding);
      const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
      const firstX = pts[0]?.x ?? padding;
      const lastX = pts[pts.length - 1]?.x ?? (width - padding);
      const areaD = `${lineD} L ${lastX.toFixed(1)} ${zeroY.toFixed(1)} L ${firstX.toFixed(1)} ${zeroY.toFixed(1)} Z`;

      areaSvgPath = { lineD, areaD, zeroY, points: pts };
    }

    // Bar Chart Rows per Kegiatan (Display ALL activities)
    const chartBars = kegiatanItems
      .map((item) => {
        const inPct = Math.min(100, Math.max(3, Math.round((item.in / maxVal) * 100)));
        const outPct = Math.min(100, Math.max(3, Math.round((item.out / maxVal) * 100)));
        const net = item.in - item.out;

        return `
        <div style="margin-bottom: 4px; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; font-size: 9px; font-weight: 700; margin-bottom: 1px;">
            <span>${escapeHtml(item.name)} <span style="font-weight: 400; color: #64748b;">(${item.count} mutasi)</span></span>
            <span style="color: ${net >= 0 ? "#15803d" : "#b91c1c"}; font-family: monospace;">Net: ${formatRp(net)}</span>
          </div>
          ${
            item.in > 0
              ? `<div style="display: flex; align-items: center; gap: 4px; margin-bottom: 1px;">
                  <span style="width: 40px; font-size: 8px; color: #15803d; font-weight: 600;">Masuk</span>
                  <div style="flex: 1; background: #e2e8f0; height: 8px; border-radius: 2px; overflow: hidden;">
                    <div style="width: ${inPct}%; background: #16a34a; height: 100%;"></div>
                  </div>
                  <span style="width: 80px; text-align: right; font-size: 8px; font-weight: 700; color: #15803d; font-family: monospace;">${formatRp(item.in)}</span>
                </div>`
              : ""
          }
          ${
            item.out > 0
              ? `<div style="display: flex; align-items: center; gap: 4px;">
                  <span style="width: 40px; font-size: 8px; color: #b91c1c; font-weight: 600;">Keluar</span>
                  <div style="flex: 1; background: #e2e8f0; height: 8px; border-radius: 2px; overflow: hidden;">
                    <div style="width: ${outPct}%; background: #dc2626; height: 100%;"></div>
                  </div>
                  <span style="width: 80px; text-align: right; font-size: 8px; font-weight: 700; color: #b91c1c; font-family: monospace;">${formatRp(item.out)}</span>
                </div>`
              : ""
          }
        </div>`;
      })
      .join("");

    allChartsHtml = `
    <div style="margin-bottom: 12px;">
      <div style="font-weight: 700; font-size: 11px; color: #0f172a; border-bottom: 2px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px;">
        📊 VISUALISASI & DIAGRAM GRAFIK KEUANGAN KAS
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; page-break-inside: avoid;">
        <!-- CHART 1: DONUT CHART PROPORSI -->
        <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px;">
          <div style="font-weight: 700; font-size: 10px; color: #1e293b; margin-bottom: 4px; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">
            🍩 PROPORSI ${donutLabel.toUpperCase()} PER KEGIATAN
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="position: relative; width: 90px; height: 90px; flex-shrink: 0;">
              <svg viewBox="0 0 90 90" style="width: 90px; height: 90px; transform: rotate(-90deg);">
                ${donutSvgCircles || '<circle cx="45" cy="45" r="35" fill="transparent" stroke="#e2e8f0" stroke-width="14" />'}
              </svg>
              <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
                <span style="font-size: 7px; color: #64748b; text-transform: uppercase;">Total ${donutLabel}</span>
                <span style="font-size: 8px; font-weight: 700; color: #0f172a; font-family: monospace;">${formatRp(donutTotal)}</span>
              </div>
            </div>
            <div style="flex: 1; min-width: 0; max-height: 90px; overflow-y: auto;">
              ${donutLegendRows || '<div style="font-size: 8px; color: #64748b;">Tidak ada data donat.</div>'}
            </div>
          </div>
        </div>

        <!-- CHART 2: AREA LINE ARUS KAS BERSIH -->
        <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px;">
          <div style="font-weight: 700; font-size: 10px; color: #1e293b; margin-bottom: 4px; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">
            📈 TRAJEKTORI ARUS KAS BERSIH (NET)
          </div>
          <div style="width: 100%; height: 90px;">
            <svg viewBox="0 0 280 90" style="width: 100%; height: 68px;">
              <defs>
                <linearGradient id="printNetGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#2563eb" stop-opacity="0.35" />
                  <stop offset="100%" stop-color="#2563eb" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <line x1="15" y1="${areaSvgPath.zeroY}" x2="265" y2="${areaSvgPath.zeroY}" stroke="#94a3b8" stroke-dasharray="3 3" stroke-width="1" />
              ${areaSvgPath.areaD ? `<path d="${areaSvgPath.areaD}" fill="url(#printNetGrad)" />` : ""}
              ${areaSvgPath.lineD ? `<path d="${areaSvgPath.lineD}" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" />` : ""}
              ${areaSvgPath.points.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${p.net >= 0 ? "#16a34a" : "#dc2626"}" stroke="#ffffff" stroke-width="1" />`).join("")}
            </svg>
            <div style="display: flex; justify-content: space-between; font-size: 8px; color: #475569; font-weight: 600; margin-top: -2px;">
              ${monthlyTrendList.map((m) => `<span>${m.label}: <strong style="color:${m.net >= 0 ? "#15803d" : "#b91c1c"};">${formatRp(m.net)}</strong></span>`).join(" · ")}
            </div>
          </div>
        </div>
      </div>

      <!-- CHART 3: PERBANDINGAN PORSI & EFISIENSI BAR PER KEGIATAN -->
      <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px; margin-bottom: 6px; page-break-after: avoid;">
          <span style="font-weight: 700; font-size: 10px; color: #1e293b;">⚖️ EFISIENSI & NOMINAL MUTASI PER KEGIATAN</span>
          <span style="font-size: 9px; font-weight: 600; color: #64748b;">(Total ${kegiatanItems.length} Kegiatan Terdaftar)</span>
        </div>
        ${chartBars || '<div style="font-size: 9px; color: #64748b;">Tidak ada data kegiatan.</div>'}
      </div>
    </div>`;

  }

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
    <div class="swot-section" style="margin-bottom: 14px;">
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 8px; page-break-inside: avoid;">
        <div style="font-weight: 700; font-size: 12px; color: #0f172a;">📊 RINGKASAN & ANALISIS SWOT KEUANGAN</div>
        <div style="font-size: 9px; color: #475569; margin-top: 2px;">
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

      <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-top: 8px; page-break-inside: avoid;">
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
    
    .swot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; page-break-inside: avoid; }
    .swot-box { border-radius: 6px; padding: 6px 10px; font-size: 10px; border: 1px solid #ddd; page-break-inside: avoid; }
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
    tr { page-break-inside: avoid; }
    th, td { border: 1px solid #333; padding: 4px 6px; font-size: 10px; }
    th { background: #f3f4f6; font-weight: 700; }
    td.c, th.c { text-align: center; }
    td.r, th.r { text-align: right; }

    .signature-container { display: flex; justify-content: space-between; margin-top: 28px; padding: 0 40px; page-break-inside: avoid; }
    .signature-box { text-align: center; width: 220px; }
    .signature-box .role { font-weight: 700; margin-top: 2px; }
    .signature-box .space { height: 55px; }
    .signature-box .name { font-weight: 700; }
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

  ${allChartsHtml}

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

  <div class="signature-container">
    <div class="signature-box">
      <div>Mengetahui,</div>
      <div class="role">Ketua</div>
      <div class="space"></div>
      <div class="name">( .................................... )</div>
    </div>
    <div class="signature-box">
      <div>Surabaya, ${escapeHtml(data.printedAt.split(" ")[0] || "")}</div>
      <div class="role">Bendahara</div>
      <div class="space"></div>
      <div class="name">( .................................... )</div>
    </div>
  </div>
</body>
</html>`;
}

export function printKasDocument(data: KasPrintData): void {
  openHtmlPrintWindow(buildKasPrintHtml(data));
}

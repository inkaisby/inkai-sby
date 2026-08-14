import type { AdminMemberRow } from "@/lib/inkai-api/admin-data";
import { formatMemberName, formatRankLabel } from "@/lib/belt";
import { triggerCsvDownload } from "@/lib/ukt";
import { downloadPdfFromHtml } from "@/lib/ukt-print-html";

export const ANGGOTA_EXPORT_CAP = 2000;

export const ANGGOTA_CSV_HEADERS = [
  "NIA",
  "No. MSH",
  "Nama",
  "Status",
  "Sabuk",
  "Dojo",
  "Cabang",
  "Terdaftar",
  "Dokumen Akte",
  "Dokumen BPJS",
] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatAnggotaExportDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const date = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} ${time}`;
}

export function buildAnggotaCsvRows(members: AdminMemberRow[]) {
  return members.map((m) => [
    m.nia ?? "",
    m.mshNumber ?? "",
    m.fullName,
    m.status,
    m.currentRank,
    m.dojo?.name ?? "",
    m.dojo?.branch?.name ?? "",
    formatAnggotaExportDateTime(m.createdAt),
    m.birthCertificateUrl ? "Ada" : "Belum",
    m.bpjsCardUrl ? "Ada" : "Belum",
  ]);
}

export function formatAnggotaWaLines(members: AdminMemberRow[]): string {
  return members
    .map((row, index) => {
      const name = formatMemberName(row.fullName);
      const rank = formatRankLabel(row.currentRank);
      return `${index + 1}. ${name}, ${rank || "—"}`;
    })
    .join("\n");
}

export type AnggotaRosterPrintData = {
  title: string;
  subtitle?: string;
  printedAt: string;
  rows: Array<{ no: number; nama: string; sabuk: string }>;
};

export function buildAnggotaRosterHtml(data: AnggotaRosterPrintData): string {
  const tableRows =
    data.rows.length === 0
      ? `<tr><td colspan="3" style="text-align:center;padding:12px 0;">Tidak ada anggota</td></tr>`
      : data.rows
          .map(
            (r) => `
        <tr>
          <td style="padding:4px 8px;text-align:center;width:48px;">${r.no}</td>
          <td style="padding:4px 8px;">${escapeHtml(r.nama)}</td>
          <td style="padding:4px 8px;">${escapeHtml(r.sabuk)}</td>
        </tr>`,
          )
          .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(data.title)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0; background: #fff; color: #000;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px; line-height: 1.45;
    }
    .page { width: 100%; max-width: 186mm; margin: 0 auto; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .subtitle { font-size: 12px; color: #444; margin: 0 0 8px; }
    .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left; padding: 6px 8px; border-bottom: 2px solid #000;
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em;
    }
    td { border-bottom: 1px solid #ddd; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
  </style>
</head>
<body>
  <div class="page">
    <h1>${escapeHtml(data.title)}</h1>
    ${data.subtitle ? `<p class="subtitle">${escapeHtml(data.subtitle)}</p>` : ""}
    <p class="meta">Dicetak: ${escapeHtml(data.printedAt)} · ${data.rows.length} anggota</p>
    <table>
      <thead>
        <tr>
          <th style="width:48px;text-align:center;">No</th>
          <th>Nama</th>
          <th>Sabuk</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
</body>
</html>`;
}

function openHtmlPrintWindow(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 800);
  };

  const doPrint = () => {
    win.focus();
    win.print();
    cleanup();
  };

  setTimeout(doPrint, 120);
}

export function buildAnggotaRosterPrintData(
  members: AdminMemberRow[],
  opts?: { dojoName?: string },
): AnggotaRosterPrintData {
  const dojoName = opts?.dojoName?.trim();
  return {
    title: "Kelola Anggota",
    subtitle: dojoName || undefined,
    printedAt: new Date().toLocaleString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    rows: members.map((m, index) => ({
      no: index + 1,
      nama: formatMemberName(m.fullName),
      sabuk: formatRankLabel(m.currentRank) || "—",
    })),
  };
}

export function printAnggotaRosterDocument(
  members: AdminMemberRow[],
  opts?: { dojoName?: string },
): void {
  const html = buildAnggotaRosterHtml(buildAnggotaRosterPrintData(members, opts));
  openHtmlPrintWindow(html);
}

export async function downloadAnggotaRosterPdf(
  members: AdminMemberRow[],
  filename: string,
  opts?: { dojoName?: string },
): Promise<void> {
  const html = buildAnggotaRosterHtml(buildAnggotaRosterPrintData(members, opts));
  await downloadPdfFromHtml(html, filename, { orientation: "portrait" });
}

export function downloadAnggotaCsv(
  members: AdminMemberRow[],
  filename = "anggota-export.csv",
): void {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = buildAnggotaCsvRows(members);
  const lines = [
    ANGGOTA_CSV_HEADERS.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ];
  triggerCsvDownload(filename, `\uFEFF${lines.join("\n")}`);
}

export async function copyTextRobust(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export type AnggotaExportFilterParams = Record<string, string>;

export function buildAnggotaExportQuery(params: AnggotaExportFilterParams): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  qs.set("page", "1");
  qs.set("pageSize", "export");
  qs.set("counts", "0");
  return qs.toString();
}

export async function fetchAnggotaExportMembers(
  params: AnggotaExportFilterParams,
): Promise<AdminMemberRow[]> {
  const qs = buildAnggotaExportQuery(params);
  const res = await fetch(`/api/admin/members?${qs}`, { cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    members?: AdminMemberRow[];
  };
  if (!res.ok) {
    throw new Error(data.error || "Gagal memuat data export");
  }
  return data.members ?? [];
}

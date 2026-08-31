/**
 * Parse Excel kas cabang → bandingkan dengan portal.
 */
import ExcelJS from "exceljs";
import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { parseFlexibleIdDate } from "../src/lib/parse-birth-date";
import {
  cleanupKasImportRows,
  rawKasRowsToImportDrafts,
  type RawKasSpreadsheetRow,
} from "../src/lib/kas-import-cleanup";
import {
  filterRange,
  kasKpis,
  sumBefore,
  withRunningSaldo,
  type KasLedgerInput,
} from "../src/lib/kas";
import { SITE_BRANCH_NAME } from "../src/lib/site";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env"), override: true });

const xlsxPath =
  process.argv[2] ?? "C:/Users/USER/Downloads/LAPORAN KAS  CABANG INKAI SBY.xlsx";

function parseMoney(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Math.round(v);
  const s = String(v).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function cellDate(v: unknown): string {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return parseFlexibleIdDate(s) ?? "";
}

function dateFromGroupTitle(s: string): string {
  const m = s.match(/(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli)\s+(\d{4})/i);
  if (!m) return "";
  const months: Record<string, string> = {
    januari: "01",
    februari: "02",
    maret: "03",
    april: "04",
    mei: "05",
    juni: "06",
    juli: "07",
  };
  const mo = months[m[2].toLowerCase()];
  if (!mo) return "";
  return `${m[3]}-${mo}-${m[1].padStart(2, "0")}`;
}

async function parseExcel(): Promise<{
  rows: RawKasSpreadsheetRow[];
  lastSaldo: number;
  maxNo: number;
}> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(resolve(xlsxPath));
  const ws = wb.worksheets[0]!;
  const out: RawKasSpreadsheetRow[] = [];
  let lastDate = "";
  let lastKegiatan = "";
  let lastSaldo = 0;
  let maxNo = 0;

  for (let r = 4; r <= 320; r++) {
    const row = ws.getRow(r);
    const noRaw = row.getCell(1).value;
    if (noRaw == null || String(noRaw).trim() === "") continue;
    const no = Number.parseInt(String(noRaw), 10);
    if (!Number.isFinite(no)) continue;
    maxNo = Math.max(maxNo, no);

    const col2 = row.getCell(2).value;
    const desc = String(row.getCell(3).value ?? "").trim();
    const masuk = parseMoney(row.getCell(4).value);
    const keluar = parseMoney(row.getCell(5).value);
    const saldo = parseMoney(row.getCell(6).value);
    const kegiatan = String(row.getCell(7).value ?? "").trim();

    if (saldo) lastSaldo = saldo;

    let txnDate = cellDate(col2);
    if (!txnDate && typeof col2 === "string") {
      txnDate = dateFromGroupTitle(col2);
    }
    if (!txnDate && /^\d+\.$/.test(String(col2 ?? "").trim())) {
      // sub-row "1." "2." — keep lastDate
    }
    if (txnDate) lastDate = txnDate;
    else if (lastDate) txnDate = lastDate;

    if (kegiatan) lastKegiatan = kegiatan;
    else if (lastKegiatan) {
      /* fill later via cleanup */
    }

    // skip total/header rows
    if (
      /^pemasukkan latihan bersama persiapan ukt$/i.test(desc) &&
      !masuk &&
      !keluar &&
      saldo > 0
    ) {
      if (kegiatan) lastKegiatan = kegiatan;
      continue;
    }
    if (
      /^pengeluaran latihan bersama persiapan ukt$/i.test(desc) &&
      !masuk &&
      !keluar
    ) {
      continue;
    }
    if (!desc || !txnDate) continue;
    if (!masuk && !keluar) continue;

    out.push({
      no: String(no),
      txnDate,
      description: desc,
      amountIn: masuk,
      amountOut: keluar,
      kegiatan: kegiatan || lastKegiatan,
    });
  }

  return { rows: out, lastSaldo, maxNo };
}

async function main() {
  const { rows, lastSaldo, maxNo } = await parseExcel();
  const cleaned = cleanupKasImportRows(rows);
  const drafts = rawKasRowsToImportDrafts(cleaned);

  const all: KasLedgerInput[] = drafts.map((d, i) => ({
    id: String(i),
    txnDate: d.txnDate,
    description: d.description,
    kegiatan: d.kegiatan,
    amountIn: d.direction === "in" ? d.amount : 0,
    amountOut: d.direction === "out" ? d.amount : 0,
    createdAt: `${d.txnDate}T00:00:00.000Z`,
    sourceType: "manual",
    sourceId: String(i),
    reconStatus: "open",
  }));

  const from = "2026-01-27";
  const to = "2026-07-25";
  const opening = sumBefore(all, from);
  const filtered = filterRange(all, from, to);
  const kpis = kasKpis(withRunningSaldo(filtered, opening), opening);

  const latber = cleaned.filter(
    (r) => r.txnDate === "2026-04-05" && r.amountIn > 0 && /anak/i.test(r.description),
  );

  const prisma = new PrismaClient();
  let dbSaldo = 0;
  let dbRows = 0;
  try {
    const branch = await prisma.branch.findFirst({
      where: { name: SITE_BRANCH_NAME, isDeleted: false },
      select: { id: true },
    });
    if (branch) {
      const entries = await prisma.kasEntry.findMany({
        where: { scopeType: "branch", scopeId: branch.id },
        orderBy: [{ txnDate: "asc" }, { createdAt: "asc" }],
      });
      const dbAll: KasLedgerInput[] = entries.map((e) => ({
        id: e.id,
        txnDate: e.txnDate.toISOString().slice(0, 10),
        description: e.description,
        kegiatan: e.kegiatan,
        amountIn: e.amountIn,
        amountOut: e.amountOut,
        createdAt: e.createdAt.toISOString(),
        sourceType: e.sourceType,
        sourceId: e.id,
        reconStatus: "open",
      }));
      const dbOpening = sumBefore(dbAll, from);
      const dbFiltered = filterRange(dbAll, from, to);
      dbSaldo = kasKpis(withRunningSaldo(dbFiltered, dbOpening), dbOpening).saldoAkhir;
      dbRows = dbFiltered.filter((r) => r.sourceType === "manual").length;
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    JSON.stringify(
      {
        excel: {
          maxNo,
          rawRows: rows.length,
          cleanedRows: cleaned.length,
          importDrafts: drafts.length,
          lastSaldoColumn: lastSaldo,
          latberApr5In: latber.length,
          kaiZen: cleaned.find((r) => /kai-zen/i.test(r.description)),
          griyaAmerta: cleaned.find((r) => /griya amerta/i.test(r.description)),
        },
        period27JanTo25Jul: {
          opening,
          rowCount: filtered.length,
          saldoAkhirCalc: kpis.saldoAkhir,
          totalIn: kpis.totalIn,
          totalOut: kpis.totalOut,
        },
        portal: {
          manualRowsInPeriod: dbRows,
          saldoAkhir: dbSaldo,
        },
        target: 7045700,
        gapPortalVsExcel: dbSaldo - kpis.saldoAkhir,
        gapPortalVsTarget: dbSaldo - 7045700,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

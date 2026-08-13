import ExcelJS from "exceljs";
import {
  buildLatberRekapFilename,
  buildLatberRekapTotals,
  formatLatberCurrency,
  type LatberRekapRow,
} from "@/lib/latber";

const PAPER_A4 = 9 as import("exceljs").PaperSize;

export type LatberRekapXlsxInput = {
  periodTitle: string;
  feeAmount: number;
  komisiRanting: number;
  rows: LatberRekapRow[];
};

const THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
};

function applyHeaderCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, name: "Calibri", size: 10 };
  cell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9E1F2" },
  };
  cell.border = THIN;
}

export async function buildLatberRekapXlsxBuffer(
  input: LatberRekapXlsxInput,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "INKAI Surabaya";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Rekap Latber", {
    pageSetup: {
      orientation: "landscape",
      paperSize: PAPER_A4,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.6,
        bottom: 0.6,
        header: 0.2,
        footer: 0.2,
      },
    },
    views: [{ state: "frozen", ySplit: 6, showGridLines: false }],
  });

  sheet.columns = [
    { width: 6 },
    { width: 14 },
    { width: 32 },
    { width: 22 },
    { width: 22 },
    { width: 14 },
    { width: 24 },
  ];

  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").value = "INKAI — INSTITUT KARATE-DO INDONESIA";
  sheet.getCell("A1").font = { bold: true, name: "Calibri", size: 14 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.mergeCells("A2:G2");
  sheet.getCell("A2").value = "KOTA SURABAYA";
  sheet.getCell("A2").font = { bold: true, name: "Calibri", size: 12 };
  sheet.getCell("A2").alignment = { horizontal: "center" };

  sheet.mergeCells("A4:G4");
  sheet.getCell("A4").value = `REKAP LATIHAN BERSAMA — ${input.periodTitle}`;
  sheet.getCell("A4").font = { bold: true, name: "Calibri", size: 12 };
  sheet.getCell("A4").alignment = { horizontal: "center" };

  const headers = ["No", "NIA", "Nama", "Sabuk", "Ranting", "Biaya", "Status"];
  const headerRow = sheet.getRow(6);
  headers.forEach((label, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = label;
    applyHeaderCell(cell);
  });
  headerRow.height = 22;

  input.rows.forEach((row, i) => {
    const excelRow = sheet.getRow(7 + i);
    const values: Array<string | number> = [
      row.no,
      row.nia,
      row.nama,
      row.sabuk,
      row.ranting,
      row.biaya,
      row.status,
    ];
    values.forEach((value, idx) => {
      const cell = excelRow.getCell(idx + 1);
      cell.value = value;
      cell.font = { name: "Calibri", size: 10 };
      cell.border = THIN;
      cell.alignment = {
        vertical: "middle",
        horizontal: idx === 0 || idx === 5 ? "center" : "left",
      };
      if (idx === 5) {
        cell.numFmt = '"Rp "#,##0';
      }
    });
  });

  const totals = buildLatberRekapTotals(
    input.rows.length,
    input.feeAmount,
    input.komisiRanting,
  );
  const start = 8 + input.rows.length;
  const summary = [
    ["Jumlah peserta", String(input.rows.length)],
    ["Subtotal", formatLatberCurrency(totals.subtotal)],
    ["Komisi ranting", `− ${formatLatberCurrency(totals.komisiTotal)}`],
    ["TOTAL disetor ke cabang", formatLatberCurrency(totals.grandTotal)],
  ];
  summary.forEach((pair, i) => {
    const excelRow = sheet.getRow(start + i);
    excelRow.getCell(5).value = pair[0];
    excelRow.getCell(5).font = {
      name: "Calibri",
      size: 10,
      bold: i === summary.length - 1,
    };
    excelRow.getCell(6).value = pair[1];
    excelRow.getCell(6).font = {
      name: "Calibri",
      size: 10,
      bold: i === summary.length - 1,
    };
    excelRow.getCell(6).alignment = { horizontal: "right" };
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

export function latberRekapDownloadName(periodTitle: string): string {
  return buildLatberRekapFilename(periodTitle, "xlsx");
}

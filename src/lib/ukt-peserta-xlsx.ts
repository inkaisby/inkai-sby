import ExcelJS from "exceljs";
import { SITE_BRANCH_NAME } from "@/lib/site";
import {
  buildUktPesertaExportRows,
  buildUktPesertaTitle,
  type UktMemberRow,
  type UktSemester,
} from "@/lib/ukt";

const PAPER_A4 = 9 as import("exceljs").PaperSize;
const PAPER_FOLIO = 5 as import("exceljs").PaperSize; // Legal / Folio (F4: 215x330mm)

export type UktPesertaPaper = "A4" | "F4";

export type UktPesertaXlsxInput = {
  semester: UktSemester;
  year: number;
  paper?: UktPesertaPaper;
  sekretariatAddress?: string;
  rows: UktMemberRow[];
};

const THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
};

function applyHeaderCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, name: "Calibri", size: 9 };
  cell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2F2F2" },
  };
  cell.border = THIN;
}

export function uktPesertaXlsxDownloadName(opts: {
  semester: UktSemester;
  year: number;
  paper?: UktPesertaPaper;
}): string {
  const p = opts.paper ? `-${opts.paper}` : "";
  return `ukt-peserta-S${opts.semester}-${opts.year}${p}.xlsx`;
}

export async function buildUktPesertaXlsxBuffer(
  input: UktPesertaXlsxInput,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "INKAI Surabaya";
  wb.created = new Date();

  const paperSize = input.paper === "F4" ? PAPER_FOLIO : PAPER_A4;
  const sheetName = `PESERTA SMT.${input.semester}`;

  const sheet = wb.addWorksheet(sheetName, {
    pageSetup: {
      orientation: "landscape",
      paperSize,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    },
    views: [{ state: "frozen", ySplit: 7, showGridLines: true }],
  });

  // 10 Kolom Presisi Sesuai Gambar
  sheet.columns = [
    { width: 7 },  // 1. NO. URUT
    { width: 18 }, // 2. NO. INDUK ANGGOTA
    { width: 7 },  // 3. NO. R
    { width: 32 }, // 4. NAMA
    { width: 24 }, // 5. TEMPAT TANGGAL LAHIR
    { width: 10 }, // 6. JENIS KELAMIN
    { width: 38 }, // 7. ALAMAT
    { width: 7 },  // 8. KYU
    { width: 10 }, // 9. KYU BARU
    { width: 18 }, // 10. RANTING
  ];

  // Kop Header Organisasi (Kiri & Kanan)
  sheet.getCell("A1").value = "INSTITUT KARATE-DO INDONESIA";
  sheet.getCell("A1").font = { bold: true, name: "Calibri", size: 12 };

  sheet.getCell("A2").value = "KOTA SURABAYA";
  sheet.getCell("A2").font = { bold: true, name: "Calibri", size: 11 };

  const sekretariat =
    input.sekretariatAddress?.trim() ||
    "SEKRETARIAT: JL. RAYA KERTAJAYA 77, SURABAYA, JAWA TIMUR 60226";
  sheet.getCell("A3").value = sekretariat.toUpperCase();
  sheet.getCell("A3").font = { name: "Calibri", size: 8, color: { argb: "FF404040" } };

  sheet.getCell("J1").value = `CABANG : ${SITE_BRANCH_NAME.toUpperCase()}`;
  sheet.getCell("J1").font = { bold: true, name: "Calibri", size: 11 };
  sheet.getCell("J1").alignment = { horizontal: "right" };

  // Garis Pembatas Kop (Baris 4)
  for (let c = 1; c <= 10; c++) {
    const cell = sheet.getCell(4, c);
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF000000" } },
    };
  }

  // Judul Dokumen (Baris 5)
  sheet.mergeCells("A5:J5");
  const titleText = buildUktPesertaTitle(input.semester, input.year);
  const titleCell = sheet.getCell("A5");
  titleCell.value = titleText;
  titleCell.font = { bold: true, underline: true, name: "Calibri", size: 12 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(5).height = 24;

  // Header Tabel (Baris 7)
  const headers = [
    "NO. URUT",
    "NO. INDUK ANGGOTA",
    "NO. R",
    "NAMA",
    "TEMPAT TANGGAL LAHIR",
    "JENIS KELAMIN",
    "ALAMAT",
    "KYU",
    "KYU BARU",
    "RANTING",
  ];

  const headerRow = sheet.getRow(7);
  headers.forEach((label, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = label;
    applyHeaderCell(cell);
  });
  headerRow.height = 26;

  // Data Peserta (Baris 8+)
  const exportRows = buildUktPesertaExportRows(input.rows);
  exportRows.forEach((row, i) => {
    const excelRow = sheet.getRow(8 + i);
    const values = [
      row.no,
      row.nia,
      row.noRanting,
      row.nama,
      row.tempatTanggalLahir,
      row.jenisKelamin,
      row.alamat,
      row.kyu,
      row.kyuBaru,
      row.ranting,
    ];

    values.forEach((value, idx) => {
      const cell = excelRow.getCell(idx + 1);
      cell.value = value;
      cell.font = {
        name: "Calibri",
        size: 9,
        bold: idx === 3, // NAMA dicetak tebal (bold)
      };
      cell.border = THIN;
      cell.alignment = {
        vertical: "middle",
        wrapText: idx === 3 || idx === 4 || idx === 6,
        horizontal:
          idx === 0 || idx === 1 || idx === 2 || idx === 5 || idx === 7 || idx === 8
            ? "center"
            : "left",
      };
    });
    excelRow.height = 20;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

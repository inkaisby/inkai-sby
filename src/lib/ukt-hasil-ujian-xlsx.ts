import ExcelJS from "exceljs";

const PAPER_A4 = 9 as import("exceljs").PaperSize;
import {
  buildUktHasilUjianFilename,
  countUktHasilUjianRanting,
  countUktHasilUjianSabuk,
  formatUktExamDateLong,
  resolveUktHasilUjianLastNia,
  UKT_HASIL_UJIAN_OFFICERS,
  UKT_HASIL_UJIAN_SABUK_ORDER,
  type UktHasilUjianRecapRow,
  type UktSemester,
} from "@/lib/ukt";

export type UktHasilUjianXlsxInput = {
  semester: UktSemester;
  year: number;
  examAt?: string | null;
  ketuaCabangName?: string | null;
  bidangUjianName?: string | null;
  rows: UktHasilUjianRecapRow[];
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
    fgColor: { argb: "FFD9E1F2" },
  };
  cell.border = THIN;
}

export async function buildUktHasilUjianXlsxBuffer(
  input: UktHasilUjianXlsxInput,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "INKAI Surabaya";
  wb.created = new Date();

  const sheetName = `SMT. ${input.semester}`;
  const sheet = wb.addWorksheet(sheetName, {
    pageSetup: {
      orientation: "landscape",
      paperSize: PAPER_A4,
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
    views: [{ state: "frozen", ySplit: 7, showGridLines: false }],
  });

  sheet.columns = [
    { width: 8 },
    { width: 12 },
    { width: 16 },
    { width: 32 },
    { width: 28 },
    { width: 8 },
    { width: 36 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 18 },
  ];

  sheet.getCell("B2").value = "INSTITUT KARATE-DO INDONESIA";
  sheet.getCell("B2").font = { bold: true, name: "Calibri", size: 14 };
  sheet.getCell("B3").value = "DAERAH JAWA TIMUR";
  sheet.getCell("B3").font = { bold: true, name: "Calibri", size: 12 };
  sheet.getCell("H3").value = "KAB/KOTA  :  SURABAYA";
  sheet.getCell("H3").font = { bold: true, name: "Calibri", size: 11 };

  sheet.mergeCells("A5:K5");
  sheet.getCell("A5").value =
    `REKAP HASIL UJIAN SEMESTER ${input.semester} TAHUN ${input.year}`;
  sheet.getCell("A5").font = { bold: true, name: "Calibri", size: 13 };
  sheet.getCell("A5").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(5).height = 22;

  const headers = [
    "NO. URUT",
    "NO. URUT PESERTA RANTING",
    "NO. INDUK ANGGOTA",
    "NAMA",
    "TEMPAT TANGGAL LAHIR",
    "JENIS KELAMIN",
    "ALAMAT",
    "KYU LAMA",
    "KYU BARU",
    "SABUK",
    "RANTING",
  ];
  const headerRow = sheet.getRow(7);
  headers.forEach((label, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = label;
    applyHeaderCell(cell);
  });
  headerRow.height = 28;

  input.rows.forEach((row, i) => {
    const excelRow = sheet.getRow(8 + i);
    const values = [
      row.no,
      row.noRanting,
      row.nia,
      row.nama,
      row.tempatTanggalLahir,
      row.jenisKelamin,
      row.alamat,
      row.kyuLama,
      row.kyuBaru,
      row.sabuk,
      row.ranting,
    ];
    values.forEach((value, idx) => {
      const cell = excelRow.getCell(idx + 1);
      cell.value = value;
      cell.font = { name: "Calibri", size: 9 };
      cell.border = THIN;
      cell.alignment = {
        vertical: "middle",
        wrapText: idx === 3 || idx === 4 || idx === 6,
        horizontal: idx === 0 || idx === 1 || idx === 5 || idx === 7 || idx === 8
          ? "center"
          : "left",
      };
    });
    excelRow.height = 18;
  });

  const ttd = wb.addWorksheet("LEMBAR TTD", {
    pageSetup: {
      orientation: "landscape",
      paperSize: PAPER_A4,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
    },
    views: [{ showGridLines: false }],
  });
  ttd.columns = [
    { width: 16 },
    { width: 8 },
    { width: 28 },
    { width: 10 },
    { width: 28 },
    { width: 8 },
    { width: 32 },
    { width: 8 },
    { width: 8 },
    { width: 28 },
    { width: 16 },
  ];

  const examLabel = formatUktExamDateLong(input.examAt);
  ttd.getCell("C5").value = "Mengetahui,";
  ttd.getCell("J5").value = examLabel
    ? `Surabaya, ${examLabel}`
    : "Surabaya,";
  ttd.getCell("C6").value = "Pengurus Daerah INKAI Jatim";
  ttd.getCell("E6").value = "Majelis Sabuk Hitam INKAI Jatim";
  ttd.getCell("G6").value = "Pengurus Kota INKAI Surabaya";
  ttd.getCell("J6").value = "Koordinator Penguji";
  ttd.getCell("C7").value = "Ketua Umum,";
  ttd.getCell("E7").value = "Ketua,";
  ttd.getCell("G7").value = "Ketua,";

  ttd.getCell("C11").value = UKT_HASIL_UJIAN_OFFICERS.pengdaKetua;
  ttd.getCell("C11").font = { bold: true, underline: true };
  ttd.getCell("E11").value = UKT_HASIL_UJIAN_OFFICERS.mshKetua;
  ttd.getCell("E11").font = { bold: true, underline: true };
  ttd.getCell("G11").value = (input.ketuaCabangName || "").trim();
  ttd.getCell("G11").font = { bold: true, underline: true };
  ttd.getCell("J11").value = (input.bidangUjianName || "").trim();
  ttd.getCell("J11").font = { bold: true, underline: true };

  ttd.getCell("C12").value = UKT_HASIL_UJIAN_OFFICERS.pengdaKetuaTitle;
  ttd.getCell("E12").value = UKT_HASIL_UJIAN_OFFICERS.mshKetuaTitle;

  const counts = countUktHasilUjianSabuk(input.rows);
  const total = input.rows.length;
  const rantingCount = countUktHasilUjianRanting(input.rows);
  const lastNia = resolveUktHasilUjianLastNia(input.rows);

  ttd.getCell("A16").value = "CATATAN :";
  ttd.getCell("A16").font = { bold: true };
  ttd.getCell("E16").value = "NAMA-NAMA PENGUJI :";
  ttd.getCell("E16").font = { bold: true };

  const sabukLines = UKT_HASIL_UJIAN_SABUK_ORDER.filter(
    (sabuk) => sabuk !== "HITAM" || counts.HITAM > 0,
  );
  sabukLines.forEach((sabuk, idx) => {
    const r = 17 + idx;
    ttd.getCell(`A${r}`).value = `SABUK ${sabuk}`;
    ttd.getCell(`C${r}`).value = "=";
    ttd.getCell(`D${r}`).value = counts[sabuk];
    ttd.getCell(`E${r}`).value = `${idx + 1}.`;
  });
  const totalRow = 17 + sabukLines.length;
  ttd.getCell(`C${totalRow}`).value = "=";
  ttd.getCell(`D${totalRow}`).value = total;
  ttd.getCell(`D${totalRow}`).font = { bold: true };

  ttd.getCell(`A${totalRow + 2}`).value =
    `JUMLAH RANTING YANG IKUT UJIAN : ${rantingCount} RANTING`;
  ttd.getCell(`A${totalRow + 2}`).font = { bold: true };

  ttd.getCell(`C${totalRow + 5}`).value = lastNia;
  ttd.getCell(`D${totalRow + 5}`).value = "NIA TERAKHIR";
  ttd.getCell(`D${totalRow + 5}`).font = { bold: true };

  for (const cell of ttd.getRows(5, 20) ?? []) {
    cell.eachCell((c) => {
      if (!c.font?.name) c.font = { ...(c.font || {}), name: "Calibri", size: 11 };
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}

export function uktHasilUjianDownloadName(input: UktHasilUjianXlsxInput): string {
  return buildUktHasilUjianFilename(input.semester, input.year, input.examAt);
}

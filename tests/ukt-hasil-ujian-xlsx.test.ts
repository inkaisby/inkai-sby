import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import {
  buildUktHasilUjianRecapRows,
  UKT_HASIL_UJIAN_OFFICERS,
  type UktMemberRow,
} from "../src/lib/ukt";
import { buildUktHasilUjianXlsxBuffer } from "../src/lib/ukt-hasil-ujian-xlsx";

function row(
  partial: Partial<UktMemberRow> & Pick<UktMemberRow, "memberId" | "fullName">,
): UktMemberRow {
  return {
    registrationId: `reg-${partial.memberId}`,
    photoUrl: null,
    nia: partial.nia ?? "26.37619",
    birthPlace: "Surabaya",
    birthDate: "2011-02-28",
    gender: "P",
    address: "Jl. Contoh",
    kyuLama: partial.kyuLama ?? "Putih (Kyu 10)",
    kyuBaru: partial.kyuBaru ?? "Kuning (Kyu 8)",
    birthCertificateUrl: null,
    bpjsCardUrl: null,
    dojoName: partial.dojoName ?? "AIRLANGGA",
    dojoId: partial.dojoId ?? "d-air",
    status: "APPROVED",
    billingId: null,
    billingStatus: null,
    billingAmount: null,
    outstandingDues: 0,
    pendingVerifications: 0,
    attendancePct: null,
    attendanceCount: 0,
    examResult: "LULUS",
    examPresent: true,
    ...partial,
  };
}

describe("buildUktHasilUjianXlsxBuffer", () => {
  it("menghasilkan 2 sheet SMT + LEMBAR TTD", async () => {
    const recap = buildUktHasilUjianRecapRows([
      row({ memberId: "a", fullName: "Ana Putih" }),
      row({
        memberId: "b",
        fullName: "Bima Dan",
        dojoId: "d-gading",
        dojoName: "GADING",
        kyuLama: "Coklat (Kyu 3)",
        kyuBaru: "Hitam (DAN 1)",
        nia: "26.39999",
      }),
    ]);
    const buffer = await buildUktHasilUjianXlsxBuffer({
      semester: "II",
      year: 2026,
      examAt: "2026-10-05",
      ketuaCabangName: "Ketua Tes",
      bidangUjianName: "SETIA BASUKI",
      rows: recap,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as any);
    expect(wb.worksheets.map((s) => s.name)).toEqual(["SMT. II", "LEMBAR TTD"]);
    const smt = wb.getWorksheet("SMT. II");
    expect(smt?.getCell("A5").value).toBe(
      "REKAP HASIL UJIAN SEMESTER II TAHUN 2026",
    );
    expect(smt?.getCell("D8").value).toBe("ANA PUTIH");
    const ttd = wb.getWorksheet("LEMBAR TTD");
    expect(String(ttd?.getCell("J5").value ?? "")).toContain("5 Oktober 2026");
    expect(String(ttd?.getCell("A16").value ?? "")).toContain("CATATAN");
    expect(String(ttd?.getCell("A17").value ?? "")).toMatch(/SABUK .+ = /);
    expect(String(ttd?.getCell("E16").value ?? "")).toContain("NAMA-NAMA PENGUJI");
    expect(String(ttd?.getCell("E17").value ?? "")).toMatch(/^1\./);
    expect(String(ttd?.getCell("C11").value ?? "")).toContain(
      UKT_HASIL_UJIAN_OFFICERS.pengdaKetua,
    );
  });

  it("memakai pejabat + penguji dari payload; sabuk = angka di satu sel", async () => {
    const recap = buildUktHasilUjianRecapRows([
      row({ memberId: "a", fullName: "Ana Putih" }),
    ]);
    const buffer = await buildUktHasilUjianXlsxBuffer({
      semester: "I",
      year: 2026,
      pengdaKetua: "SUYANTO KASDI",
      mshKetua: "S YAHRULLAH",
      ketuaCabangName: "JONATHAN",
      bidangUjianName: "SETIA BASUKI",
      pengujiNames: ["Ahmad", "Budi"],
      rows: recap,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as any);
    const ttd = wb.getWorksheet("LEMBAR TTD");
    expect(String(ttd?.getCell("C11").value ?? "")).toBe("SUYANTO KASDI");
    expect(String(ttd?.getCell("E11").value ?? "")).toBe("S YAHRULLAH");
    expect(String(ttd?.getCell("G11").value ?? "")).toBe("JONATHAN");
    expect(String(ttd?.getCell("J11").value ?? "")).toBe("SETIA BASUKI");
    expect(String(ttd?.getCell("E17").value ?? "")).toBe("1. Ahmad");
    expect(String(ttd?.getCell("E18").value ?? "")).toBe("2. Budi");
    expect(String(ttd?.getCell("A17").value ?? "")).toBe("SABUK PUTIH = 0");
    expect(String(ttd?.getCell("A18").value ?? "")).toBe("SABUK KUNING = 1");
  });
});

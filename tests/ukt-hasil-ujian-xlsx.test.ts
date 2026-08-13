import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { buildUktHasilUjianRecapRows, type UktMemberRow } from "../src/lib/ukt";
import { buildUktHasilUjianXlsxBuffer } from "../src/lib/ukt-hasil-ujian-xlsx";

function row(partial: Partial<UktMemberRow> & Pick<UktMemberRow, "memberId" | "fullName">): UktMemberRow {
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
    await wb.xlsx.load(buffer);
    expect(wb.worksheets.map((s) => s.name)).toEqual(["SMT. II", "LEMBAR TTD"]);
    const smt = wb.getWorksheet("SMT. II");
    expect(smt?.getCell("A5").value).toBe(
      "REKAP HASIL UJIAN SEMESTER II TAHUN 2026",
    );
    expect(smt?.getCell("D8").value).toBe("ANA PUTIH");
    const ttd = wb.getWorksheet("LEMBAR TTD");
    expect(String(ttd?.getCell("J5").value ?? "")).toContain("5 Oktober 2026");
    expect(String(ttd?.getCell("A16").value ?? "")).toContain("CATATAN");
  });
});

import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import {
  buildLatberCabangWaReportText,
  buildLatberPublicCormatWaText,
  buildLatberRekapFilename,
  buildLatberRekapRows,
  buildLatberRantingWaReportText,
  filterLatberApprovedRows,
  type LatberMemberRow,
} from "../src/lib/latber";
import { buildLatberRekapXlsxBuffer } from "../src/lib/latber-rekap-xlsx";

function row(
  partial: Partial<LatberMemberRow> & Pick<LatberMemberRow, "memberId" | "fullName">,
): LatberMemberRow {
  return {
    registrationId: `reg-${partial.memberId}`,
    nia: partial.nia ?? "36.12345",
    currentRank: partial.currentRank ?? "Kuning (Kyu 7)",
    dojoId: partial.dojoId ?? "d1",
    dojoName: partial.dojoName ?? "GADING",
    status: partial.status ?? "APPROVED",
    billingId: partial.billingId ?? "b1",
    billingStatus: partial.billingStatus ?? "PENDING",
    ...partial,
  };
}

describe("latber WA/rekap", () => {
  it("filterLatberApprovedRows mengabaikan mandiri PENDING", () => {
    const rows = [
      row({
        memberId: "m1",
        fullName: "Fulan",
        status: "PENDING",
        billingId: null,
        selfRegistration: true,
        memberPaymentConfirmedAt: "2026-08-13T00:00:00.000Z",
      }),
      row({ memberId: "m2", fullName: "Budi" }),
    ];
    expect(filterLatberApprovedRows(rows).map((r) => r.memberId)).toEqual(["m2"]);
  });

  it("Laporan WA ranting memuat peserta dan total setor", () => {
    const approved = [row({ memberId: "m1", fullName: "Fulan" })];
    const text = buildLatberRantingWaReportText(
      "Latihan Bersama — persiapan UKT",
      "GADING",
      approved,
      45_000,
      5_000,
    );
    expect(text).toContain("*Ranting/Dojo: GADING*");
    expect(text).toContain("FULAN");
    expect(text).toContain("1 × Rp 45.000");
    expect(text).toContain("*TOTAL disetor ke cabang: Rp 40.000*");
  });

  it("Laporan WA cabang merangkum ranting dan sabuk", () => {
    const text = buildLatberCabangWaReportText("Latihan Bersama — persiapan UKT", [
      row({ memberId: "m1", fullName: "A", dojoName: "GADING" }),
      row({
        memberId: "m2",
        fullName: "B",
        dojoId: "d2",
        dojoName: "AIRLANGGA",
        currentRank: "Putih (Kyu 10)",
      }),
    ]);
    expect(text).toContain("*Total Ranting : 2*");
    expect(text).toContain("GADING = _1 peserta_");
    expect(text).toContain("*TOTAL SEMUA: 2 peserta*");
  });

  it("Salin WA Cormat menampilkan tanggal pelaksanaan sebelum countdown", () => {
    const text = buildLatberPublicCormatWaText({
      registrationCloseAt: "2026-08-25T17:00:00.000Z",
      eventAt: "2026-08-30T03:00:00.000Z",
      rows: [],
    });
    expect(text).toContain("*Pelaksanaan Latihan Bersama*");
    expect(text).toContain("_30-Aug-2026_");
    expect(text.indexOf("_30-Aug-2026_")).toBeLessThan(text.indexOf("Hari:"));
  });

  it("buildLatberRekapRows mengisi status UI", () => {
    const recap = buildLatberRekapRows(
      [row({ memberId: "m1", fullName: "Fulan", billingStatus: "WAITING_VERIFICATION" })],
      45_000,
    );
    expect(recap).toHaveLength(1);
    expect(recap[0]?.status).toBe("Menunggu Verifikasi");
    expect(recap[0]?.biaya).toBe(45_000);
  });

  it("nama file rekap memakai slug periode", () => {
    expect(buildLatberRekapFilename("Latihan Bersama — persiapan UKT", "xlsx")).toMatch(
      /^rekap-latber-persiapan-ukt-\d{8}\.xlsx$/,
    );
  });

  it("Excel rekap berisi header dan total setor", async () => {
    const recap = buildLatberRekapRows(
      [row({ memberId: "m1", fullName: "Fulan" })],
      45_000,
    );
    const buffer = await buildLatberRekapXlsxBuffer({
      periodTitle: "Latihan Bersama — persiapan UKT",
      feeAmount: 45_000,
      komisiRanting: 5_000,
      rows: recap,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const sheet = wb.getWorksheet("Rekap Latber");
    expect(sheet).toBeTruthy();
    expect(String(sheet?.getCell("A4").value)).toContain("persiapan UKT");
    expect(String(sheet?.getCell("A6").value)).toBe("No");
    expect(String(sheet?.getCell("C7").value)).toContain("FULAN");
  });
});

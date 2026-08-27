import { describe, expect, it } from "vitest";
import {
  kasUktDepositDisplay,
  matchKasDojoId,
  resolveUktTermFromDateRange,
  uktTermFromYmd,
} from "@/lib/kas-ukt-deposit";
import { formatRecapDojoTextForWa, type DojoKasSummary } from "@/lib/kas";

describe("kas UKT deposit join", () => {
  it("maps August dates to semester II", () => {
    expect(uktTermFromYmd("2026-08-01")).toEqual({ semester: "II", year: 2026 });
    expect(uktTermFromYmd("2026-01-15")).toEqual({ semester: "I", year: 2026 });
  });

  it("flags ambiguous range across semesters and uses midpoint term", () => {
    const res = resolveUktTermFromDateRange("2026-06-15", "2026-07-15");
    expect(res.ambiguous).toBe(true);
    // Midpoint of 15 Jun–15 Jul ≈ 30 Jun → semester I
    expect(res.term).toEqual({ semester: "I", year: 2026 });
  });

  it("matches ranting label to dojoId", () => {
    expect(
      matchKasDojoId("KAI - ZEN", [
        { id: "d1", name: "Ranting KAI - ZEN" },
        { id: "d2", name: "FORTRESS" },
      ]),
    ).toBe("d1");
  });

  it("shows dash without dojoId, not Belum setor", () => {
    expect(kasUktDepositDisplay(null, {})).toEqual({
      label: "—",
      status: null,
    });
    expect(kasUktDepositDisplay("d1", {})).toEqual({
      label: "Belum setor",
      status: "PENDING",
    });
    expect(
      kasUktDepositDisplay("d1", { d1: { status: "RECEIVED" } }),
    ).toEqual({
      label: "Setoran diterima",
      status: "RECEIVED",
    });
  });

  it("includes status setor in WA text", () => {
    const rows: DojoKasSummary[] = [
      {
        dojoName: "FORTRESS",
        isOfficialDojo: true,
        dojoId: "d1",
        totalUkt: 1000,
        totalKomisiUkt: 0,
        totalLatber: 0,
        totalKomisiLatber: 0,
        totalIuran: 0,
        totalLainnya: 0,
        totalMasuk: 1000,
        uktDepositLabel: "Belum setor",
      },
    ];
    const text = formatRecapDojoTextForWa(rows, "1–27 Agu 2026", (n) => `Rp ${n}`);
    expect(text).toContain("Status setor UKT: Belum setor");
  });
});

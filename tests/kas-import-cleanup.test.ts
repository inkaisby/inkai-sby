import { describe, expect, it } from "vitest";
import {
  cleanupKasImportRows,
  fillDownKasDates,
  isKasTotalGroupRow,
  kasImportDraftsToTsv,
  parseRawKasSpreadsheet,
  rawKasRowsToImportDrafts,
} from "@/lib/kas-import-cleanup";
import { parseKasImportTsv } from "@/lib/kas";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseKasPdfText } from "@/lib/kas-pdf-parse";

describe("kas import cleanup", () => {
  it("fill-down tanggal ke sub-baris", () => {
    const rows = fillDownKasDates([
      {
        txnDate: "2026-01-27",
        description: "Grup header",
        amountIn: 0,
        amountOut: 0,
        kegiatan: "MUSKOT",
      },
      {
        txnDate: "",
        description: "Honor ss Tony",
        amountIn: 0,
        amountOut: 300000,
        kegiatan: "MUSKOT",
      },
    ]);
    expect(rows[1].txnDate).toBe("2026-01-27");
  });

  it("skip baris total grup latber", () => {
    expect(
      isKasTotalGroupRow({
        txnDate: "2026-04-05",
        description: "Pemasukkan Latihan Bersama Persiapan UKT",
        amountIn: 5000000,
        amountOut: 0,
        kegiatan: "",
      }),
    ).toBe(true);
    expect(
      isKasTotalGroupRow({
        txnDate: "2026-04-19",
        description: "TOTAL PEMASUKAN UKT SEMESTER I-2026",
        amountIn: 81170000,
        amountOut: 0,
        kegiatan: "",
      }),
    ).toBe(false);
  });

  it("cleanup + round-trip TSV", () => {
    const raw = parseRawKasSpreadsheet(
      [
        "tanggal\tketerangan\tmasuk\tkeluar\tkegiatan",
        "2026-01-27\tHonor ss Tony\t\t300000\tMUSKOT",
        "2026-04-05\tPemasukkan Latihan Bersama Persiapan UKT\t1000000\t\t",
        "2026-04-05\tShabara 3 Anak\t75000\t\tPemasukkan Latihan Bersama Persiapan UKT",
      ].join("\n"),
    );
    const cleaned = cleanupKasImportRows(raw);
    expect(cleaned).toHaveLength(2);
    const drafts = rawKasRowsToImportDrafts(cleaned);
    const tsv = kasImportDraftsToTsv(drafts);
    const roundTrip = parseKasImportTsv(tsv);
    expect(roundTrip).toHaveLength(2);
    expect(roundTrip[0].direction).toBe("out");
    expect(roundTrip[1].direction).toBe("in");
  });

  it("parse PDF cabang → saldo akhir mendekati target", () => {
    const txtPath = resolve(process.cwd(), "data/kas/laporan-kas-cabang.txt");
    const text = readFileSync(txtPath, "utf8");
    const rows = parseKasPdfText(text);
    expect(rows.length).toBeGreaterThan(280);
    expect(rows.length).toBeLessThanOrEqual(314);
    let saldo = 0;
    for (const r of rows) saldo += r.amountIn - r.amountOut;
    expect(Math.abs(saldo - 7_045_700)).toBeLessThanOrEqual(2_000_000);
  });
});

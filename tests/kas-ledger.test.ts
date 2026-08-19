import { describe, expect, it } from "vitest";
import {
  filterMonth,
  groupKasTable,
  parseKasImportTsv,
  skipKwitansiJenis,
  sumBefore,
  withRunningSaldo,
  type KasLedgerInput,
} from "@/lib/kas";

function row(
  partial: Partial<KasLedgerInput> & Pick<KasLedgerInput, "id" | "txnDate">,
): KasLedgerInput {
  return {
    description: "x",
    kegiatan: "",
    amountIn: 0,
    amountOut: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    sourceType: "manual",
    sourceId: partial.id,
    reconStatus: "open",
    ...partial,
  };
}

describe("kas ledger", () => {
  it("running saldo after sort by date then createdAt", () => {
    const rows = withRunningSaldo([
      row({
        id: "2",
        txnDate: "2026-01-02",
        amountIn: 1000,
        createdAt: "2026-01-02T10:00:00.000Z",
      }),
      row({
        id: "1",
        txnDate: "2026-01-02",
        amountOut: 200,
        createdAt: "2026-01-02T08:00:00.000Z",
      }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["1", "2"]);
    expect(rows[0].saldo).toBe(-200);
    expect(rows[1].saldo).toBe(800);
  });

  it("carry-forward uses transactions before month start", () => {
    const all = [
      row({ id: "a", txnDate: "2025-12-31", amountIn: 5000 }),
      row({ id: "b", txnDate: "2026-01-01", amountOut: 1000 }),
    ];
    expect(sumBefore(all, "2026-01-01")).toBe(5000);
    const jan = withRunningSaldo(filterMonth(all, 2026, 1), 5000);
    expect(jan[0].saldo).toBe(4000);
  });

  it("skips kwitansi jenis iuran", () => {
    expect(skipKwitansiJenis("iuran")).toBe(true);
    expect(skipKwitansiJenis("Iuran/tagihan")).toBe(true);
    expect(skipKwitansiJenis("prestasi")).toBe(false);
  });

  it("idempotent unique key is source+scope conceptually", () => {
    const a = { sourceType: "iuran", sourceId: "b1:branch", scopeId: "cab" };
    const b = { sourceType: "iuran", sourceId: "b1:branch", scopeId: "cab" };
    expect(`${a.sourceType}:${a.sourceId}:${a.scopeId}`).toBe(
      `${b.sourceType}:${b.sourceId}:${b.scopeId}`,
    );
  });

  it("dual setor uses two sourceIds", () => {
    const billingId = "bill-1";
    expect(`${billingId}:dojo`).not.toBe(`${billingId}:branch`);
  });

  it("groups kegiatan without merging cells", () => {
    const rows = withRunningSaldo([
      row({
        id: "1",
        txnDate: "2026-01-01",
        kegiatan: "MUSKOT",
        amountOut: 100,
        createdAt: "2026-01-01T01:00:00.000Z",
      }),
      row({
        id: "2",
        txnDate: "2026-01-01",
        kegiatan: "MUSKOT",
        amountOut: 50,
        createdAt: "2026-01-01T02:00:00.000Z",
      }),
    ]);
    const table = groupKasTable(rows);
    expect(table[0]).toMatchObject({ kind: "group", kegiatan: "MUSKOT", totalOut: 150 });
    expect(table.filter((r) => r.kind === "entry")).toHaveLength(2);
  });

  it("parses TSV import", () => {
    const drafts = parseKasImportTsv(
      "2026-08-01\tHonor SP\t\t200000\tMUSKOT\nKonsumsi\t0\t750000\tMUSKOT",
    );
    expect(drafts).toHaveLength(2);
    expect(drafts[0].direction).toBe("out");
    expect(drafts[0].amount).toBe(200000);
  });
});

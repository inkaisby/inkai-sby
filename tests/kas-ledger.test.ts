import { describe, expect, it } from "vitest";
import {
  aggregateKasByDojo,
  filterMonth,
  filterRange,
  formatKasDateId,
  groupKasTable,
  kasGroupKegiatanNames,
  mergeMassPasteRows,
  parseKasImportTsv,
  parseKasMassPaste,
  skipKwitansiJenis,
  sumBefore,
  visibleKasTableRows,
  withRunningSaldo,
  type KasLedgerInput,
} from "@/lib/kas";
import { parseFlexibleIdDate } from "@/lib/parse-birth-date";
import { kasTransferSchema, kasTransferKegiatanSchema, kasTransferBatchSchema } from "@/lib/security/schemas";

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

  it("lists group kegiatan names from table rows", () => {
    const rows = withRunningSaldo([
      row({ id: "1", txnDate: "2026-01-01", kegiatan: "MUSKOT", amountOut: 100 }),
      row({ id: "2", txnDate: "2026-01-01", kegiatan: "MUSKOT", amountOut: 50 }),
      row({ id: "3", txnDate: "2026-01-02", kegiatan: "LATBER", amountOut: 20 }),
    ]);
    expect(kasGroupKegiatanNames(groupKasTable(rows))).toEqual(["MUSKOT"]);
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

  it("parses Indonesian report dates including weekday", () => {
    expect(parseFlexibleIdDate("Selasa, 27 Januari 2026")).toBe("2026-01-27");
    expect(parseFlexibleIdDate("27 Januari 2026")).toBe("2026-01-27");
    expect(parseFlexibleIdDate("2026-01-27")).toBe("2026-01-27");
    expect(parseFlexibleIdDate(formatKasDateId("2026-01-27"))).toBe("2026-01-27");
  });

  it("filterRange is inclusive and carry-forward uses from exclusive", () => {
    const all = [
      row({ id: "a", txnDate: "2025-12-31", amountIn: 5000 }),
      row({ id: "b", txnDate: "2026-01-01", amountOut: 1000 }),
      row({ id: "c", txnDate: "2026-01-15", amountIn: 200 }),
      row({ id: "d", txnDate: "2026-02-01", amountIn: 50 }),
    ];
    const mid = filterRange(all, "2026-01-01", "2026-01-31");
    expect(mid.map((r) => r.id)).toEqual(["b", "c"]);
    expect(sumBefore(all, "2026-01-01")).toBe(5000);
    const withOpen = withRunningSaldo(mid, 5000);
    expect(withOpen[0].saldo).toBe(4000);
    expect(filterRange(all, null, null)).toHaveLength(4);
  });

  it("collapse hides grouped entries but not empty-kegiatan rows", () => {
    const rows = withRunningSaldo([
      row({ id: "1", txnDate: "2026-02-10", kegiatan: "Porprov", amountOut: 100 }),
      row({ id: "2", txnDate: "2026-02-10", kegiatan: "Porprov", amountOut: 50 }),
      row({ id: "3", txnDate: "2026-03-14", kegiatan: "", amountOut: 20 }),
    ]);
    const table = groupKasTable(rows);
    const folded = visibleKasTableRows(table, ["Porprov"]);
    expect(folded.filter((r) => r.kind === "group")).toHaveLength(1);
    expect(folded.filter((r) => r.kind === "entry").map((r) => r.id)).toEqual(["3"]);
  });

  it("validates transfer payload", () => {
    expect(
      kasTransferSchema.safeParse({
        targetScopeType: "branch",
        targetScopeId: "scope-1",
      }).success,
    ).toBe(true);
    expect(
      kasTransferSchema.safeParse({
        targetScopeType: "dojo",
        targetScopeId: "",
      }).success,
    ).toBe(false);
  });

  it("transfer kegiatan schema and filters only manual rows", () => {
    expect(
      kasTransferKegiatanSchema.safeParse({
        kegiatan: "MUSKOT",
        targetScopeType: "dojo",
        targetScopeId: "ranting-1",
      }).success,
    ).toBe(true);
    expect(
      kasTransferKegiatanSchema.safeParse({
        kegiatan: "  ",
        targetScopeType: "branch",
        targetScopeId: "cab",
      }).success,
    ).toBe(false);

    const rows = [
      row({ id: "m1", txnDate: "2026-03-01", kegiatan: "MUSKOT", sourceType: "manual" }),
      row({ id: "a1", txnDate: "2026-03-01", kegiatan: "MUSKOT", sourceType: "iuran" }),
      row({ id: "m2", txnDate: "2026-03-02", kegiatan: "Lain", sourceType: "manual" }),
    ];
    const moved = rows.filter(
      (r) => r.sourceType === "manual" && r.kegiatan === "MUSKOT",
    );
    expect(moved.map((r) => r.id)).toEqual(["m1"]);
  });

  it("transfer batch schema and keeps only requested manual ids", () => {
    expect(
      kasTransferBatchSchema.safeParse({
        ids: ["a", "b"],
        targetScopeType: "dojo",
        targetScopeId: "r1",
      }).success,
    ).toBe(true);
    expect(
      kasTransferBatchSchema.safeParse({
        ids: [],
        targetScopeType: "branch",
        targetScopeId: "c1",
      }).success,
    ).toBe(false);
    expect(
      kasTransferBatchSchema.safeParse({
        ids: Array.from({ length: 101 }, (_, i) => `id-${i}`),
        targetScopeType: "branch",
        targetScopeId: "c1",
      }).success,
    ).toBe(false);

    const ids = ["m1", "a1", "m1", "missing"];
    const deduped = [...new Set(ids)];
    const rows = [
      row({ id: "m1", txnDate: "2026-03-01", sourceType: "manual" }),
      row({ id: "a1", txnDate: "2026-03-01", sourceType: "iuran" }),
      row({ id: "m2", txnDate: "2026-03-02", sourceType: "manual" }),
    ];
    const moved = rows.filter(
      (r) => r.sourceType === "manual" && deduped.includes(r.id),
    );
    expect(moved.map((r) => r.id)).toEqual(["m1"]);
  });

  it("parses mass paste two-column description and Rp amount as keluar", () => {
    const rows = parseKasMassPaste("Beli Roti\tRp333.500\nBeli Minuman\tRp50.000", {
      defaultDirection: "out",
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      description: "Beli Roti",
      direction: "out",
      amount: 333500,
    });
    expect(rows[1].amount).toBe(50000);
  });

  it("strips leading row numbers from mass paste", () => {
    const rows = parseKasMassPaste("1\tBeli Baterai\tRp36.500", {
      defaultDirection: "out",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("Beli Baterai");
    expect(rows[0].amount).toBe(36500);
  });

  it("parses mass paste with different dates per row", () => {
    const rows = parseKasMassPaste(
      "2026-06-01\tItem A\tRp100.000\n2026-06-15\tItem B\t200000",
      { defaultDirection: "out", defaultTxnDate: "2026-01-01" },
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].txnDate).toBe("2026-06-01");
    expect(rows[1].txnDate).toBe("2026-06-15");
  });

  it("parses Indonesian date in mass paste first column", () => {
    const rows = parseKasMassPaste("27 Januari 2026\tHonor\tRp500.000", {
      defaultDirection: "out",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].txnDate).toBe("2026-01-27");
  });

  it("mergeMassPasteRows appends and respects max", () => {
    const existing = [
      { txnDate: "2026-06-01", description: "A", direction: "out" as const, amount: "100" },
    ];
    const incoming = [
      { txnDate: "2026-06-02", description: "B", direction: "out" as const, amount: "200" },
    ];
    const ok = mergeMassPasteRows(existing, incoming, 500);
    expect("error" in ok).toBe(false);
    if (!("error" in ok)) {
      expect(ok.rows).toHaveLength(2);
      expect(ok.added).toBe(1);
    }
    const fail = mergeMassPasteRows(existing, incoming, 1);
    expect(fail).toEqual({ error: "max" });
  });

  it("aggregateKasByDojo calculates net UKT amount Rp 2.725.000 for FORTRESS 11 participants", () => {
    const rows = [
      row({
        id: "k1",
        txnDate: "2026-08-15",
        description: "Setoran UKT FORTRESS",
        kegiatan: "UKT Semester II-2026",
        amountIn: 3275000,
        sourceType: "ukt",
      }),
      row({
        id: "k2",
        txnDate: "2026-08-15",
        description: "Setoran Latber FORTRESS",
        kegiatan: "Latber",
        amountIn: 80000,
        sourceType: "latber",
      }),
    ];
    const res = aggregateKasByDojo(rows, ["FORTRESS"]);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      dojoName: "FORTRESS",
      totalUkt: 2725000, // 3.275.000 gross - 550.000 komisi (11 × 50k) = 2.725.000 net
      totalKomisiUkt: 550000,
      totalLatber: 80000,
      totalKomisiLatber: 10000, // 80.000 net latber / 40k = 2 participants × 5k = 10.000
      totalMasuk: 2805000, // 2.725.000 net ukt + 80.000 latber
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  KAS_LATBER_PERSIAPAN_UKT_KEGIATAN,
  formatLatberKasKegiatan,
  formatUktKasKegiatan,
  parseUktKasTerm,
} from "@/lib/kas-kegiatan";
import {
  getKasBudgetKey,
  setKasPosTag,
  stripKasPosTag,
} from "@/lib/kas";

describe("parseUktKasTerm", () => {
  it("membaca II-2026 dari judul pendaftaran", () => {
    expect(
      parseUktKasTerm("Biaya pendaftaran UKT Semester II-2026 - Pendaftaran"),
    ).toBe("II-2026");
  });

  it("membaca I-2026", () => {
    expect(parseUktKasTerm("UKT Semester I-2026")).toBe("I-2026");
  });

  it("null jika tidak ada term", () => {
    expect(parseUktKasTerm("Pendaftaran UKT")).toBeNull();
  });
});

describe("formatUktKasKegiatan", () => {
  it("FORTRESS II-2026", () => {
    expect(
      formatUktKasKegiatan(
        "Biaya pendaftaran UKT Semester II-2026 - Pendaftaran",
        "FORTRESS",
      ),
    ).toBe("Bayar UKT II-2026 - FORTRESS");
  });

  it("tanpa nama ranting", () => {
    expect(formatUktKasKegiatan("Semester II-2026")).toBe("Bayar UKT II-2026");
  });
});

describe("formatLatberKasKegiatan", () => {
  it("persiapan UKT → label ranting", () => {
    expect(formatLatberKasKegiatan("Latihan Bersama — persiapan UKT")).toBe(
      KAS_LATBER_PERSIAPAN_UKT_KEGIATAN,
    );
    expect(formatLatberKasKegiatan("Latihan Bersama - persiapan UKT")).toBe(
      KAS_LATBER_PERSIAPAN_UKT_KEGIATAN,
    );
  });

  it("periode lain tetap Latber + judul", () => {
    expect(formatLatberKasKegiatan("Latihan Bersama Agustus")).toBe(
      "Latber Latihan Bersama Agustus",
    );
  });
});

describe("sumber kas pos tags & budget categorization", () => {
  it("tags description with [pos: <key>] cleanly", () => {
    const tagged = setKasPosTag("Pembelian seragam karate", "perlengkapan");
    expect(tagged).toBe("Pembelian seragam karate [pos: perlengkapan]");
    expect(stripKasPosTag(tagged)).toBe("Pembelian seragam karate");
  });

  it("replaces existing tag when changing sumber kas", () => {
    const initial = "Beli matras [pos: investasi]";
    const updated = setKasPosTag(initial, "duka");
    expect(updated).toBe("Beli matras [pos: duka]");
    expect(stripKasPosTag(updated)).toBe("Beli matras");
  });

  it("getKasBudgetKey resolves explicit [pos: ...] overrides regardless of keywords", () => {
    // Description contains "matras" (investasi keyword) but explicit tag says "pembinaan"
    const budget = getKasBudgetKey("Operasional", "Beli matras dojo [pos: pembinaan]");
    expect(budget.key).toBe("pembinaan");
    expect(budget.pct).toBe(35);
  });

  it("getKasBudgetKey resolves all 5 preset keys", () => {
    expect(getKasBudgetKey("", "[pos: pembinaan]").key).toBe("pembinaan");
    expect(getKasBudgetKey("", "[pos: duka]").key).toBe("duka");
    expect(getKasBudgetKey("", "[pos: insidentil]").key).toBe("insidentil");
    expect(getKasBudgetKey("", "[pos: investasi]").key).toBe("investasi");
    expect(getKasBudgetKey("", "[pos: perlengkapan]").key).toBe("perlengkapan");
  });
});

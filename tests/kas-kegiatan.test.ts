import { describe, expect, it } from "vitest";
import {
  KAS_LATBER_PERSIAPAN_UKT_KEGIATAN,
  formatLatberKasKegiatan,
  formatUktKasKegiatan,
  parseUktKasTerm,
} from "@/lib/kas-kegiatan";

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

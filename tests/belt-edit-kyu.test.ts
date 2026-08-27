import { describe, expect, it } from "vitest";

import { canEditKyuBaru, formatRankLabel } from "../src/lib/belt";
import { canEditKyuByWilayah } from "../src/lib/wilayah-rbac";

describe("canEditKyuBaru / canEditKyuByWilayah", () => {
  it("mengizinkan ADMINISTRATOR dan ADMIN_BRANCH mengubah sabuk / Kyu Lama", () => {
    expect(canEditKyuBaru(["ADMINISTRATOR"])).toBe(true);
    expect(canEditKyuBaru(["ADMIN_PUSAT"])).toBe(true);
    expect(canEditKyuBaru(["ADMIN_BRANCH"])).toBe(true);
    expect(canEditKyuByWilayah(["ADMINISTRATOR"])).toBe(true);
    expect(canEditKyuByWilayah(["ADMIN_BRANCH"])).toBe(true);
  });

  it("menolak Pengprov dan Ranting", () => {
    expect(canEditKyuBaru(["ADMIN_PROVINCE"])).toBe(false);
    expect(canEditKyuBaru(["ADMIN_DOJO"])).toBe(false);
    expect(canEditKyuBaru(["MEMBER"])).toBe(false);
    expect(canEditKyuByWilayah(["ADMIN_PROVINCE"])).toBe(false);
    expect(canEditKyuByWilayah(["ADMIN_DOJO"])).toBe(false);
  });
});

describe("formatRankLabel fallback opsi dropdown", () => {
  it("menormalisasi label kyu ke opsi BELT_RANK_OPTIONS", () => {
    expect(formatRankLabel("kyu 7")).toBe("Kuning (Kyu 7)");
    expect(formatRankLabel("Putih (Kyu 10)")).toBe("Putih (Kyu 10)");
  });
});

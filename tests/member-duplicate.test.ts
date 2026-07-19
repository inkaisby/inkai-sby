import { describe, expect, it } from "vitest";
import {
  birthDateDayRange,
  formatDuplicateError,
  normalizeMemberName,
  type DuplicateHit,
} from "../src/lib/member-duplicate-utils";

describe("normalizeMemberName", () => {
  it("uppercases and collapses spaces", () => {
    expect(normalizeMemberName("  budi   santoso ")).toBe("BUDI SANTOSO");
  });
});

describe("birthDateDayRange", () => {
  it("parses YYYY-MM-DD to UTC day range", () => {
    const range = birthDateDayRange("2000-05-15");
    expect(range).not.toBeNull();
    expect(range!.gte.toISOString()).toBe("2000-05-15T00:00:00.000Z");
    expect(range!.lt.toISOString()).toBe("2000-05-16T00:00:00.000Z");
  });

  it("rejects invalid dates", () => {
    expect(birthDateDayRange("15-05-2000")).toBeNull();
    expect(birthDateDayRange("")).toBeNull();
  });
});

describe("formatDuplicateError", () => {
  const hit: DuplicateHit = {
    id: "1",
    fullName: "BUDI SANTOSO",
    nia: null,
    status: "Active",
    dojoName: "Dojo A",
    hasAccount: false,
    reasons: ["NIK", "NAME_BIRTHDATE"],
    severity: "hard",
  };

  it("guides public users without account to contact ranting", () => {
    const msg = formatDuplicateError([hit], "public");
    expect(msg).toContain("sudah terdaftar oleh pengurus ranting");
    expect(msg).toContain("digabungkan");
  });

  it("blocks admin create with existing member details", () => {
    const msg = formatDuplicateError([hit], "admin");
    expect(msg).toContain("Anggota sudah terdaftar");
    expect(msg).toContain("belum punya akun");
  });
});

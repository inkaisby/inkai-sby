import { describe, expect, it } from "vitest";
import { formatRegisteredAtWib } from "@/lib/format-wib";

describe("formatRegisteredAtWib", () => {
  it("returns em dash for empty values", () => {
    expect(formatRegisteredAtWib(null)).toBe("—");
    expect(formatRegisteredAtWib(undefined)).toBe("—");
    expect(formatRegisteredAtWib("")).toBe("—");
    expect(formatRegisteredAtWib("bukan-tanggal")).toBe("—");
  });

  it("formats ISO as WIB date and time", () => {
    const label = formatRegisteredAtWib("2026-08-18T14:48:00.000Z");
    expect(label).toMatch(/18 Agu 2026/);
    expect(label).toMatch(/21\.48/);
  });
});

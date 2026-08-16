import { describe, expect, it } from "vitest";
import { DEFAULT_LATBER_FEE, resolveLatberPeriodFees } from "@/lib/latber";
import { parseMemberCardScanPayload } from "@/lib/latber-card-scan";

describe("Latber flat fee", () => {
  it("defaults to Rp45.000 without unique tail", () => {
    expect(DEFAULT_LATBER_FEE).toBe(45_000);
    expect(resolveLatberPeriodFees(null).feeAmount).toBe(45_000);
    expect(resolveLatberPeriodFees({ archived: false, locked: false }).feeAmount).toBe(
      45_000,
    );
  });
});

describe("parseMemberCardScanPayload", () => {
  it("parses /v/ paths and URLs", () => {
    expect(parseMemberCardScanPayload("https://inkai-sby.vercel.app/v/36.12345")).toBe(
      "36.12345",
    );
    expect(parseMemberCardScanPayload("/v/abc-uuid")).toBe("abc-uuid");
    expect(parseMemberCardScanPayload("36.12345")).toBe("36.12345");
  });
});
